// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IWhitelist {
    function checkWhitelist(address user) external view returns (bool);
}

/**
 * @title   GameNFTCustom
 * @author  GEMBA IT — https://gembait.com
 * @notice  User-curated ERC-721 collection for the EduChain ecosystem. Two
 *          payment paths:
 *            - `mintWithETH`:    user pays native ETH.
 *            - `mintWithTokens`: user pays in a configured ERC-20 (GAME token).
 *
 *          Each mint accepts an IPFS (or HTTP) metadata URI. When `quantity > 1`
 *          the same URI is applied to every token in the batch (typical use:
 *          mint 5 identical cards). Passing an empty string falls back to the
 *          collection-level pattern `baseURI + tokenId + baseURIExtension`.
 *
 * @dev     Design decisions:
 *           - ERC721A (Chiru Labs) makes batch minting 60-80% cheaper than loop-
 *             based ERC-721 mints. First tokenId = 0 to align with "0.json".
 *           - Per-token URI storage is an explicit mapping written once per
 *             tokenId during mint. This costs gas but gives immutable per-token
 *             metadata — no bait-and-switch possible after mint.
 *           - Dual-payment architecture is two distinct functions, not a
 *             branched one, to avoid simultaneous `msg.value` + `transferFrom`
 *             confusion and to keep each happy path focused.
 *           - CEI pattern is strict: checks -> effects -> interactions. Refund
 *             (for ETH path) and ERC-20 pull (for token path) are the last step.
 *           - `maxSupply = 0` means unlimited; any positive value is a hard cap.
 *           - Rate limits count NFTs per rolling day, so 3/day is 3 NFTs total
 *             regardless of how many transactions.
 */
contract GameNFTCustom is ERC721A, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────
    // Constants & immutables
    // ─────────────────────────────────────────────────────────────

    string public constant VERSION = "2.0.0";
    uint256 public constant MINT_PERIOD = 1 days;

    /// @notice Canonical whitelist contract. Set at construction, never changed.
    IWhitelist public immutable whitelist;

    // ─────────────────────────────────────────────────────────────
    // Configurable parameters (owner-controlled)
    // ─────────────────────────────────────────────────────────────

    /// @notice ETH price per NFT (wei).
    uint256 public ethMintPrice;

    /// @notice ERC-20 price per NFT, denominated in `paymentToken` wei-units.
    uint256 public tokenMintPrice;

    /// @notice ERC-20 accepted for token-denominated mints. Zero = disabled.
    IERC20 public paymentToken;

    /// @notice Hard cap on total mints ever. 0 = unlimited.
    uint256 public maxSupply;

    /// @notice Maximum NFTs minted in a single call.
    uint256 public maxBatchSize;

    /// @notice Maximum NFTs a single caller may mint per rolling day.
    uint256 public maxMintsPer24Hours;

    /// @notice When false, user-to-user transfers revert; mints and burns always allowed.
    bool public transfersEnabled;

    /// @dev Collection-level metadata prefix, e.g. "ipfs://myipfs/".
    string private _base;

    /// @dev Suffix appended after tokenId when falling back to baseURI, default ".json".
    string private _ext;

    /// @dev Per-token custom URI. Empty string triggers baseURI fallback.
    mapping(uint256 => string) private _tokenURIs;

    // ─────────────────────────────────────────────────────────────
    // Per-user state (packed)
    // ─────────────────────────────────────────────────────────────

    struct UserMintInfo {
        uint64 windowStart;
        uint64 mintsThisWindow;
    }
    mapping(address => UserMintInfo) private _userMintInfo;

    // ─────────────────────────────────────────────────────────────
    // Global statistics
    // ─────────────────────────────────────────────────────────────

    uint256 public totalSalesETH;
    uint256 public totalSalesTokens;
    uint256 public totalEthMints;
    uint256 public totalTokenMints;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event MintedWithETH(
        address indexed to,
        uint256 indexed firstTokenId,
        uint256 quantity,
        uint256 ethPaid,
        string tokenURI_
    );
    event MintedWithTokens(
        address indexed to,
        uint256 indexed firstTokenId,
        uint256 quantity,
        uint256 tokensPaid,
        string tokenURI_
    );
    event EthMintPriceChanged(uint256 oldValue, uint256 newValue);
    event TokenMintPriceChanged(uint256 oldValue, uint256 newValue);
    event PaymentTokenChanged(address indexed oldToken, address indexed newToken);
    event MaxSupplyChanged(uint256 oldValue, uint256 newValue);
    event MaxBatchSizeChanged(uint256 oldValue, uint256 newValue);
    event MaxMintsPer24HoursChanged(uint256 oldValue, uint256 newValue);
    event BaseURIChanged(string newBaseURI);
    event BaseURIExtensionChanged(string newExtension);
    event TransfersToggled(bool enabled);
    event EthWithdrawn(address indexed to, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error NotWhitelisted(address user);
    error ExceedsBatchSize(uint256 requested, uint256 allowed);
    error ExceedsDailyMintLimit(uint256 requested, uint256 remaining);
    error ExceedsMaxSupply(uint256 requested, uint256 remaining);
    error InsufficientPayment(uint256 sent, uint256 required);
    error PaymentTokenNotSet();
    error TransfersDisabled();
    error RefundFailed();
    error NothingToWithdraw();
    error InvalidPrice();
    error InvalidMaxSupply();
    error NonexistentToken(uint256 tokenId);
    error OwnershipNotRenounceable();

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * @param name_                   Collection name.
     * @param symbol_                 Collection symbol.
     * @param baseURI_                Metadata prefix for URI-less mints.
     * @param whitelist_              Whitelist contract.
     * @param initialOwner            Initial contract owner.
     * @param initialEthMintPrice     ETH price per NFT (wei).
     * @param initialTokenMintPrice   ERC-20 price per NFT (wei in paymentToken units).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address whitelist_,
        address initialOwner,
        uint256 initialEthMintPrice,
        uint256 initialTokenMintPrice
    )
        ERC721A(name_, symbol_)
        Ownable(initialOwner)
    {
        if (whitelist_ == address(0))     revert ZeroAddress();
        if (initialOwner == address(0))   revert ZeroAddress();
        if (initialEthMintPrice == 0)     revert InvalidPrice();
        if (initialTokenMintPrice == 0)   revert InvalidPrice();

        whitelist           = IWhitelist(whitelist_);
        _base               = baseURI_;
        _ext                = ".json";
        ethMintPrice        = initialEthMintPrice;
        tokenMintPrice      = initialTokenMintPrice;
        maxSupply           = 0;   // unlimited by default
        maxBatchSize        = 10;
        maxMintsPer24Hours  = 3;
        transfersEnabled    = true;
    }

    // ═════════════════════════════════════════════════════════════
    //                          MINT
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Mint `quantity` NFTs to `to`, paying in ETH.
     * @param  to           Recipient. Non-zero.
     * @param  quantity     Number of NFTs to mint. 1 to `maxBatchSize`.
     * @param  tokenURI_    Metadata URI applied to every NFT in the batch.
     *                      Empty string => fallback to baseURI+tokenId+ext.
     */
    function mintWithETH(address to, uint256 quantity, string calldata tokenURI_)
        external
        payable
        nonReentrant
    {
        _preMintChecks(to, quantity);

        uint256 cost = quantity * ethMintPrice;
        if (msg.value < cost) revert InsufficientPayment(msg.value, cost);

        _applyMintLimits(quantity);

        totalSalesETH += cost;
        totalEthMints += quantity;

        uint256 firstTokenId = _nextTokenId();
        _mint(to, quantity);
        _storeCustomURI(firstTokenId, quantity, tokenURI_);

        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            if (!ok) revert RefundFailed();
        }

        emit MintedWithETH(to, firstTokenId, quantity, cost, tokenURI_);
    }

    /**
     * @notice Mint `quantity` NFTs to `to`, paying in the configured ERC-20.
     * @dev    Caller must have approved `address(this)` to spend `quantity * tokenMintPrice`.
     *         Reverts if no `paymentToken` is set.
     */
    function mintWithTokens(address to, uint256 quantity, string calldata tokenURI_)
        external
        nonReentrant
    {
        if (address(paymentToken) == address(0)) revert PaymentTokenNotSet();
        _preMintChecks(to, quantity);

        uint256 cost = quantity * tokenMintPrice;

        _applyMintLimits(quantity);

        totalSalesTokens += cost;
        totalTokenMints  += quantity;

        uint256 firstTokenId = _nextTokenId();
        _mint(to, quantity);
        _storeCustomURI(firstTokenId, quantity, tokenURI_);

        // Pull payment LAST (interactions).
        paymentToken.safeTransferFrom(msg.sender, address(this), cost);

        emit MintedWithTokens(to, firstTokenId, quantity, cost, tokenURI_);
    }

    function _preMintChecks(address to, uint256 quantity) private view {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert ZeroAmount();
        if (quantity > maxBatchSize) revert ExceedsBatchSize(quantity, maxBatchSize);

        if (maxSupply != 0) {
            uint256 minted = _totalMinted();
            if (minted + quantity > maxSupply) {
                revert ExceedsMaxSupply(quantity, maxSupply - minted);
            }
        }
    }

    function _applyMintLimits(uint256 quantity) private {
        UserMintInfo memory info = _userMintInfo[msg.sender];
        if (block.timestamp >= uint256(info.windowStart) + MINT_PERIOD) {
            info.windowStart     = uint64(block.timestamp);
            info.mintsThisWindow = 0;
        }
        uint256 newMintsInWindow = uint256(info.mintsThisWindow) + quantity;
        if (newMintsInWindow > maxMintsPer24Hours) {
            uint256 remaining = maxMintsPer24Hours > info.mintsThisWindow
                ? maxMintsPer24Hours - info.mintsThisWindow
                : 0;
            revert ExceedsDailyMintLimit(quantity, remaining);
        }
        info.mintsThisWindow       = uint64(newMintsInWindow);
        _userMintInfo[msg.sender]  = info;
    }

    /// @dev Persists the same URI for every token in the batch. Empty URI is a no-op (fallback path).
    function _storeCustomURI(uint256 firstTokenId, uint256 quantity, string calldata tokenURI_) private {
        if (bytes(tokenURI_).length == 0) return;
        for (uint256 i = 0; i < quantity; ++i) {
            _tokenURIs[firstTokenId + i] = tokenURI_;
        }
    }

    // ═════════════════════════════════════════════════════════════
    //                       METADATA
    // ═════════════════════════════════════════════════════════════

    /// @inheritdoc ERC721A
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken(tokenId);
        string memory stored = _tokenURIs[tokenId];
        if (bytes(stored).length > 0) return stored;
        return string.concat(_base, tokenId.toString(), _ext);
    }

    /// @notice Raw collection metadata prefix (for fallback URIs only).
    function baseURI() external view returns (string memory) {
        return _base;
    }

    /// @notice Suffix appended after the tokenId for fallback URIs, e.g. ".json".
    function baseURIExtension() external view returns (string memory) {
        return _ext;
    }

    // ═════════════════════════════════════════════════════════════
    //               TRANSFER GATING (mint/burn always allowed)
    // ═════════════════════════════════════════════════════════════

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override {
        if (from != address(0) && to != address(0) && !transfersEnabled) {
            revert TransfersDisabled();
        }
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    // ═════════════════════════════════════════════════════════════
    //                     VIEW: user & global
    // ═════════════════════════════════════════════════════════════

    struct UserMintStats {
        uint256 mintsThisWindow;
        uint256 remainingMints;
        uint256 windowResetAt;
    }

    function getUserMintStats(address user) external view returns (UserMintStats memory) {
        UserMintInfo memory info = _userMintInfo[user];
        bool active = block.timestamp < uint256(info.windowStart) + MINT_PERIOD;
        uint256 mints = active ? info.mintsThisWindow : 0;
        return UserMintStats({
            mintsThisWindow: mints,
            remainingMints:  maxMintsPer24Hours > mints ? maxMintsPer24Hours - mints : 0,
            windowResetAt:   active ? uint256(info.windowStart) + MINT_PERIOD : 0
        });
    }

    /**
     * @notice Can the user mint `quantity` right now?
     * @return ok    True iff the mint would succeed (ignoring price/approval).
     * @return code  0 ok | 1 not whitelisted | 2 exceeds batch | 3 exceeds daily
     *               | 4 exceeds supply | 5 zero quantity.
     */
    function canUserMint(address user, uint256 quantity) external view returns (bool ok, uint256 code) {
        if (!whitelist.checkWhitelist(user)) return (false, 1);
        if (quantity == 0)                   return (false, 5);
        if (quantity > maxBatchSize)         return (false, 2);

        if (maxSupply != 0) {
            uint256 minted = _totalMinted();
            if (minted + quantity > maxSupply) return (false, 4);
        }

        UserMintInfo memory info = _userMintInfo[user];
        bool active = block.timestamp < uint256(info.windowStart) + MINT_PERIOD;
        uint256 mints = active ? info.mintsThisWindow : 0;
        if (mints + quantity > maxMintsPer24Hours) return (false, 3);

        return (true, 0);
    }

    struct SalesStats {
        uint256 totalSalesETH;
        uint256 totalSalesTokens;
        uint256 totalEthMints;
        uint256 totalTokenMints;
        uint256 totalMinted;
        uint256 currentEthPrice;
        uint256 currentTokenPrice;
        uint256 remainingSupply;   // type(uint256).max when unlimited
        uint256 maxSupplyLimit;    // 0 when unlimited
    }

    function getSalesStats() external view returns (SalesStats memory) {
        uint256 minted = _totalMinted();
        return SalesStats({
            totalSalesETH:     totalSalesETH,
            totalSalesTokens:  totalSalesTokens,
            totalEthMints:     totalEthMints,
            totalTokenMints:   totalTokenMints,
            totalMinted:       minted,
            currentEthPrice:   ethMintPrice,
            currentTokenPrice: tokenMintPrice,
            remainingSupply:   maxSupply == 0
                ? type(uint256).max
                : (maxSupply > minted ? maxSupply - minted : 0),
            maxSupplyLimit:    maxSupply
        });
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId();
    }

    // ═════════════════════════════════════════════════════════════
    //                    OWNER: configuration
    // ═════════════════════════════════════════════════════════════

    function setEthMintPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        emit EthMintPriceChanged(ethMintPrice, newPrice);
        ethMintPrice = newPrice;
    }

    function setTokenMintPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        emit TokenMintPriceChanged(tokenMintPrice, newPrice);
        tokenMintPrice = newPrice;
    }

    /**
     * @notice Set the ERC-20 used for `mintWithTokens`. Zero address disables token mints.
     */
    function setPaymentToken(address newToken) external onlyOwner {
        emit PaymentTokenChanged(address(paymentToken), newToken);
        paymentToken = IERC20(newToken);
    }

    /// @notice Set the max supply. 0 means unlimited. Cannot go below `_totalMinted()`.
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        if (newMaxSupply != 0 && newMaxSupply < _totalMinted()) revert InvalidMaxSupply();
        emit MaxSupplyChanged(maxSupply, newMaxSupply);
        maxSupply = newMaxSupply;
    }

    function setMaxBatchSize(uint256 newBatchSize) external onlyOwner {
        if (newBatchSize == 0) revert ZeroAmount();
        emit MaxBatchSizeChanged(maxBatchSize, newBatchSize);
        maxBatchSize = newBatchSize;
    }

    function setMaxMintsPer24Hours(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroAmount();
        emit MaxMintsPer24HoursChanged(maxMintsPer24Hours, newLimit);
        maxMintsPer24Hours = newLimit;
    }

    function setBaseURI(string calldata newBase) external onlyOwner {
        _base = newBase;
        emit BaseURIChanged(newBase);
    }

    function setBaseURIExtension(string calldata newExt) external onlyOwner {
        _ext = newExt;
        emit BaseURIExtensionChanged(newExt);
    }

    function setTransfersEnabled(bool enabled) external onlyOwner {
        transfersEnabled = enabled;
        emit TransfersToggled(enabled);
    }

    // ═════════════════════════════════════════════════════════════
    //                    OWNER: funds
    // ═════════════════════════════════════════════════════════════

    function withdrawETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();
        (bool ok, ) = owner().call{value: balance}("");
        if (!ok) revert RefundFailed();
        emit EthWithdrawn(owner(), balance);
    }

    /// @notice Withdraw accumulated payment-token proceeds to the owner.
    function withdrawTokens() external onlyOwner nonReentrant {
        if (address(paymentToken) == address(0)) revert PaymentTokenNotSet();
        uint256 balance = paymentToken.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        paymentToken.safeTransfer(owner(), balance);
        emit TokensWithdrawn(owner(), balance);
    }

    // ═════════════════════════════════════════════════════════════
    //              DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Ownership renunciation is permanently disabled.
     * @dev    An ownerless contract would strand ETH/token proceeds and freeze
     *         price/supply configuration forever.
     */
    function renounceOwnership() public pure override {
        revert OwnershipNotRenounceable();
    }
}
