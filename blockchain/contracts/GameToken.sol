// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWhitelist {
    function checkWhitelist(address user) external view returns (bool);
}

/**
 * @title   GameToken
 * @author  GEMBA IT — https://gembait.com
 * @notice  Rate-limited ERC-20 token for the EduChain ecosystem.
 *          Whitelisted users purchase whole tokens with ETH at a fixed price.
 *          Three independent rate limits protect against spam and spending sprees:
 *            - maxTokensPerPurchase: per-transaction cap
 *            - buysPer24Hours:       per-user transaction count per rolling day
 *            - maxTokensPer24Hours:  per-user token total per rolling day
 *
 * @dev     Design decisions:
 *           - Immutable whitelist reference via minimal IWhitelist interface keeps
 *             contract size small (no Whitelist bytecode embedded).
 *           - Initial supply minted to the contract itself; owner triggers future
 *             top-ups via `mintToContract`. Tokens never leave the pool unless
 *             purchased.
 *           - All user accounting is packed into a single storage slot (UserInfo)
 *             to minimise gas on the hot path (`buyTokens`).
 *           - Unit convention: `amount` parameters in `buyTokens` are in whole
 *             tokens (not wei). This mirrors how educational users think about
 *             "buy 3 tokens" and removes wei arithmetic from the UI. The contract
 *             converts once internally.
 *           - CEI pattern: checks → effects → interactions. Refund is the final
 *             step. Reentrancy guard is belt-and-suspenders.
 *           - `.call{value:}` used for refunds (not `.transfer()`) to survive
 *             EIP-2929 gas repricing and smart-contract wallets.
 */
contract GameToken is ERC20, Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    string public constant VERSION = "2.0.0";

    /// @notice Rolling-day window for all rate limits.
    uint256 public constant BUY_PERIOD = 1 days;

    /// @notice Initial supply minted to the contract at deployment: 1,000,000 tokens.
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 1e18;

    /// @notice Canonical whitelist contract. Set at construction, never changed.
    IWhitelist public immutable whitelist;

    // ─────────────────────────────────────────────────────────────
    // Configurable parameters (owner-controlled)
    // ─────────────────────────────────────────────────────────────

    /// @notice ETH price for ONE whole token (in wei). Example: 0.01 ETH = 1e16.
    uint256 public tokenPrice;

    /// @notice Maximum whole tokens per single `buyTokens` call.
    uint256 public maxTokensPerPurchase;

    /// @notice Maximum `buyTokens` transactions per user per rolling day.
    uint256 public buysPer24Hours;

    /// @notice Maximum whole tokens a user may purchase in a rolling day.
    uint256 public maxTokensPer24Hours;

    // ─────────────────────────────────────────────────────────────
    // Per-user state (packed into one slot)
    // ─────────────────────────────────────────────────────────────

    /// @dev Packed per-user accounting. All three fields fit into one storage slot.
    struct UserInfo {
        uint64  windowStart;      // Unix timestamp when the current rolling day began.
        uint64  buysThisWindow;   // Count of purchase transactions within the current window.
        uint128 tokensThisWindow; // Whole tokens purchased within the current window.
    }

    mapping(address => UserInfo) private _userInfo;

    // ─────────────────────────────────────────────────────────────
    // Global sales statistics
    // ─────────────────────────────────────────────────────────────

    uint256 public totalSalesETH;
    uint256 public totalTokensSold;     // In whole tokens.
    uint256 public totalTransactions;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event TokensPurchased(
        address indexed buyer,
        uint256 wholeTokens,
        uint256 ethPaid
    );
    event TokenPriceChanged(uint256 oldPrice, uint256 newPrice);
    event MaxTokensPerPurchaseChanged(uint256 oldValue, uint256 newValue);
    event BuysPer24HoursChanged(uint256 oldValue, uint256 newValue);
    event MaxTokensPer24HoursChanged(uint256 oldValue, uint256 newValue);
    event EthWithdrawn(address indexed to, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);
    event ContractRefilled(uint256 amount);

    // ─────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error NotWhitelisted(address user);
    error ExceedsPerPurchaseLimit(uint256 requested, uint256 allowed);
    error ExceedsDailyBuyCount(uint256 current, uint256 allowed);
    error ExceedsDailyTokenLimit(uint256 requested, uint256 remaining);
    error InsufficientSupply(uint256 requested, uint256 available);
    error InsufficientPayment(uint256 sent, uint256 required);
    error InsufficientBalance(uint256 requested, uint256 available);
    error RefundFailed();
    error NothingToWithdraw();
    error InvalidPrice();

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * @param name_                Token name (e.g. "Game Token").
     * @param symbol_              Token symbol (e.g. "GAME").
     * @param whitelist_           Whitelist contract address.
     * @param initialOwner         Initial owner address.
     * @param initialTokenPrice    ETH price per whole token (wei).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address whitelist_,
        address initialOwner,
        uint256 initialTokenPrice
    )
        ERC20(name_, symbol_)
        Ownable(initialOwner)
    {
        if (whitelist_ == address(0)) revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();
        if (initialTokenPrice == 0) revert InvalidPrice();

        whitelist = IWhitelist(whitelist_);
        tokenPrice           = initialTokenPrice;
        maxTokensPerPurchase = 3;
        buysPer24Hours       = 3;
        maxTokensPer24Hours  = 3;

        _mint(address(this), INITIAL_SUPPLY);
    }

    // ═════════════════════════════════════════════════════════════
    //                        PURCHASE
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Buy `wholeTokens` whole GAME tokens with ETH.
     * @param  wholeTokens Number of WHOLE tokens to purchase (not wei-scaled).
     * @dev    All rate limits are evaluated in whole tokens. Internal transfer
     *         converts to wei once. Any ETH sent in excess of the price is refunded.
     */
    function buyTokens(uint256 wholeTokens) external payable nonReentrant {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);
        if (wholeTokens == 0) revert ZeroAmount();
        if (wholeTokens > maxTokensPerPurchase) {
            revert ExceedsPerPurchaseLimit(wholeTokens, maxTokensPerPurchase);
        }

        uint256 cost = wholeTokens * tokenPrice;
        if (msg.value < cost) revert InsufficientPayment(msg.value, cost);

        uint256 scaled = wholeTokens * 1e18;
        uint256 available = balanceOf(address(this));
        if (scaled > available) revert InsufficientSupply(scaled, available);

        // Load, refresh window if expired, enforce limits.
        UserInfo memory info = _userInfo[msg.sender];
        if (block.timestamp >= uint256(info.windowStart) + BUY_PERIOD) {
            info.windowStart      = uint64(block.timestamp);
            info.buysThisWindow   = 0;
            info.tokensThisWindow = 0;
        }

        if (info.buysThisWindow + 1 > buysPer24Hours) {
            revert ExceedsDailyBuyCount(info.buysThisWindow, buysPer24Hours);
        }
        uint256 newTokensInWindow = uint256(info.tokensThisWindow) + wholeTokens;
        if (newTokensInWindow > maxTokensPer24Hours) {
            uint256 remaining = maxTokensPer24Hours > info.tokensThisWindow
                ? maxTokensPer24Hours - info.tokensThisWindow
                : 0;
            revert ExceedsDailyTokenLimit(wholeTokens, remaining);
        }

        // Effects: write state.
        info.buysThisWindow   += 1;
        info.tokensThisWindow  = uint128(newTokensInWindow);
        _userInfo[msg.sender]  = info;

        totalSalesETH     += cost;
        totalTokensSold   += wholeTokens;
        totalTransactions += 1;

        // Interactions: token transfer then refund.
        _transfer(address(this), msg.sender, scaled);

        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            if (!ok) revert RefundFailed();
        }

        emit TokensPurchased(msg.sender, wholeTokens, cost);
    }

    /**
     * @notice Total cost in wei for purchasing `wholeTokens` at the current price.
     */
    function calculateCost(uint256 wholeTokens) external view returns (uint256) {
        return wholeTokens * tokenPrice;
    }

    // ═════════════════════════════════════════════════════════════
    //                   VIEW: user & global state
    // ═════════════════════════════════════════════════════════════

    struct UserPurchaseStats {
        uint256 buysThisWindow;
        uint256 tokensThisWindow;
        uint256 remainingBuys;
        uint256 remainingTokens;
        uint256 windowResetAt;
    }

    /**
     * @notice Per-user purchase telemetry (read-only; factors in window expiry).
     */
    function getUserPurchaseStats(address user) external view returns (UserPurchaseStats memory) {
        UserInfo memory info = _userInfo[user];
        bool windowActive = block.timestamp < uint256(info.windowStart) + BUY_PERIOD;

        uint256 buys   = windowActive ? info.buysThisWindow   : 0;
        uint256 tokens = windowActive ? info.tokensThisWindow : 0;

        return UserPurchaseStats({
            buysThisWindow:   buys,
            tokensThisWindow: tokens,
            remainingBuys:    buysPer24Hours      > buys   ? buysPer24Hours      - buys   : 0,
            remainingTokens:  maxTokensPer24Hours > tokens ? maxTokensPer24Hours - tokens : 0,
            windowResetAt:    windowActive ? uint256(info.windowStart) + BUY_PERIOD : 0
        });
    }

    /**
     * @notice Can the user buy `wholeTokens` right now? Returns a reason code
     *         the UI can map to a translated string without attempting a tx.
     * @return ok   True if the purchase would succeed.
     * @return code One of: 0 ok, 1 not whitelisted, 2 per-purchase limit,
     *              3 daily buy count, 4 daily token limit, 5 zero amount,
     *              6 insufficient supply.
     */
    function canUserBuy(address user, uint256 wholeTokens) external view returns (bool ok, uint256 code) {
        if (!whitelist.checkWhitelist(user)) return (false, 1);
        if (wholeTokens == 0)                return (false, 5);
        if (wholeTokens > maxTokensPerPurchase) return (false, 2);

        UserInfo memory info = _userInfo[user];
        bool windowActive = block.timestamp < uint256(info.windowStart) + BUY_PERIOD;
        uint256 buys   = windowActive ? info.buysThisWindow   : 0;
        uint256 tokens = windowActive ? info.tokensThisWindow : 0;

        if (buys + 1 > buysPer24Hours)                          return (false, 3);
        if (tokens + wholeTokens > maxTokensPer24Hours)         return (false, 4);
        if (wholeTokens * 1e18 > balanceOf(address(this)))      return (false, 6);

        return (true, 0);
    }

    struct SalesStats {
        uint256 totalSalesETH;
        uint256 totalTokensSold;
        uint256 totalTransactions;
        uint256 currentTokenPrice;
        uint256 remainingSupply;
    }

    /**
     * @notice Aggregate contract sales telemetry.
     */
    function getSalesStats() external view returns (SalesStats memory) {
        return SalesStats({
            totalSalesETH:     totalSalesETH,
            totalTokensSold:   totalTokensSold,
            totalTransactions: totalTransactions,
            currentTokenPrice: tokenPrice,
            remainingSupply:   balanceOf(address(this))
        });
    }

    // ═════════════════════════════════════════════════════════════
    //                     OWNER: configuration
    // ═════════════════════════════════════════════════════════════

    function setTokenPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        emit TokenPriceChanged(tokenPrice, newPrice);
        tokenPrice = newPrice;
    }

    function setMaxTokensPerPurchase(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroAmount();
        emit MaxTokensPerPurchaseChanged(maxTokensPerPurchase, newLimit);
        maxTokensPerPurchase = newLimit;
    }

    function setBuysPer24Hours(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroAmount();
        emit BuysPer24HoursChanged(buysPer24Hours, newLimit);
        buysPer24Hours = newLimit;
    }

    function setMaxTokensPer24Hours(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroAmount();
        emit MaxTokensPer24HoursChanged(maxTokensPer24Hours, newLimit);
        maxTokensPer24Hours = newLimit;
    }

    // ═════════════════════════════════════════════════════════════
    //                     OWNER: funds management
    // ═════════════════════════════════════════════════════════════

    /// @notice Withdraw accumulated ETH sale proceeds to the owner.
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();
        (bool ok, ) = owner().call{value: balance}("");
        if (!ok) revert RefundFailed();
        emit EthWithdrawn(owner(), balance);
    }

    /**
     * @notice Withdraw unsold tokens from the contract pool to the owner.
     * @param  amount Amount in wei-scaled units (i.e. the full ERC-20 amount).
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 held = balanceOf(address(this));
        if (amount > held) revert InsufficientBalance(amount, held);
        _transfer(address(this), owner(), amount);
        emit TokensWithdrawn(owner(), amount);
    }

    /**
     * @notice Mint additional tokens into the contract's own pool.
     * @param  amount Amount in wei-scaled units.
     */
    function mintToContract(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        _mint(address(this), amount);
        emit ContractRefilled(amount);
    }

    // ═════════════════════════════════════════════════════════════
    //              DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Prevent accidental ownership renunciation.
     * @dev    An ownerless GameToken would freeze price and limit controls and
     *         lock the ETH proceeds forever.
     */
    function renounceOwnership() public pure override {
        revert NotWhitelisted(address(0)); // reuse: non-recoverable
    }
}
