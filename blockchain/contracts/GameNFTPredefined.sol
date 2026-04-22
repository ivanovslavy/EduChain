// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IWhitelist {
    function checkWhitelist(address user) external view returns (bool);
}

/**
 * @title   GameNFTPredefined
 * @author  GEMBA IT — https://gembait.com
 * @notice  Predefined-metadata ERC-721 collection for the EduChain ecosystem.
 *          Whitelisted users mint from a capped, shared collection at a fixed
 *          ETH price. Metadata URIs follow a deterministic scheme:
 *
 *                  baseURI + tokenId + baseURIExtension
 *
 *          e.g. "ipfs://myipfs/" + "7" + ".json" -> "ipfs://myipfs/7.json".
 *
 * @dev     Design decisions:
 *           - ERC721A (Chiru Labs) powers gas-optimised batch minting. A single
 *             transaction can mint several sequential tokenIds to one recipient
 *             for dramatically less gas than looping standard ERC-721 mints.
 *             First tokenId = 0, which aligns with the "0.json" metadata.
 *           - Immutable `whitelist` via minimal interface keeps this contract's
 *             bytecode small and decouples it from whitelist upgrades.
 *           - Packed per-user rate-limit state (one storage slot) keeps the
 *             mint hot path cheap.
 *           - All mint rate limits count NFTs (not transactions), so a user
 *             who batches 3 at once exhausts a 3/day cap in one tx.
 *           - Transfer gating lets the teacher freeze secondary movement for
 *             the duration of a class; mints and burns are always allowed.
 *           - CEI pattern: checks, effects, interactions. Refund is last.
 *             ReentrancyGuard is belt-and-suspenders.
 */
contract GameNFTPredefined is ERC721A, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    string public constant VERSION = "2.0.0";

    /// @notice Rolling-day window for the per-user mint limit.
    uint256 public constant MINT_PERIOD = 1 days;

    /// @notice Canonical whitelist contract. Set at construction, never changed.
    IWhitelist public immutable whitelist;

    // ─────────────────────────────────────────────────────────────
    // Configurable parameters (owner-controlled)
    // ─────────────────────────────────────────────────────────────

    /// @notice ETH price per NFT (in wei). Example: 0.01 ETH = 1e16.
    uint256 public mintPrice;

    /// @notice Hard cap on total NFTs that can ever be minted.
    uint256 public maxSupply;

    /// @notice Maximum NFTs minted in a single `mint` call (gas-bound).
    uint256 public maxBatchSize;

    /// @notice Maximum NFTs a single user may mint in a rolling day.
    uint256 public maxMintsPer24Hours;

    /// @notice When false, only mint and burn transfers are allowed; user-to-user transfers revert.
    bool public transfersEnabled;

    /// @dev Collection-level metadata prefix, e.g. "ipfs://myipfs/".
    string private _base;

    /// @dev Suffix appended after tokenId, default ".json".
    string private _ext;

    // ─────────────────────────────────────────────────────────────
    // Per-user state (packed)
    // ─────────────────────────────────────────────────────────────

    /// @dev Packed per-user mint counters. Fits in one storage slot.
    struct UserMintInfo {
        uint64 windowStart;       // Unix ts when the rolling window began.
        uint64 mintsThisWindow;   // NFTs minted within the current window.
    }
    mapping(address => UserMintInfo) private _userMintInfo;

    // ─────────────────────────────────────────────────────────────
    // Global statistics
    // ─────────────────────────────────────────────────────────────

    uint256 public totalSalesETH;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event Minted(address indexed to, uint256 indexed firstTokenId, uint256 quantity, uint256 ethPaid);
    event MintPriceChanged(uint256 oldValue, uint256 newValue);
    event MaxSupplyChanged(uint256 oldValue, uint256 newValue);
    event MaxBatchSizeChanged(uint256 oldValue, uint256 newValue);
    event MaxMintsPer24HoursChanged(uint256 oldValue, uint256 newValue);
    event BaseURIChanged(string newBaseURI);
    event BaseURIExtensionChanged(string newExtension);
    event TransfersToggled(bool enabled);
    event EthWithdrawn(address indexed to, uint256 amount);

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
    error TransfersDisabled();
    error RefundFailed();
    error NothingToWithdraw();
    error InvalidPrice();
    error InvalidMaxSupply();
    error NonexistentToken(uint256 tokenId);

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * @param name_              Collection name.
     * @param symbol_            Collection symbol.
     * @param baseURI_           Metadata prefix, e.g. "ipfs://myipfs/".
     * @param whitelist_         Whitelist contract address.
     * @param initialOwner       Initial contract owner.
     * @param initialMintPrice   ETH price per NFT (wei).
     * @param initialMaxSupply   Total cap for the collection.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address whitelist_,
        address initialOwner,
        uint256 initialMintPrice,
        uint256 initialMaxSupply
    )
        ERC721A(name_, symbol_)
        Ownable(initialOwner)
    {
        if (whitelist_ == address(0))   revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();
        if (initialMintPrice == 0)      revert InvalidPrice();
        if (initialMaxSupply == 0)      revert InvalidMaxSupply();

        whitelist           = IWhitelist(whitelist_);
        _base               = baseURI_;
        _ext                = ".json";
        mintPrice           = initialMintPrice;
        maxSupply           = initialMaxSupply;
        maxBatchSize        = 10;
        maxMintsPer24Hours  = 3;
        transfersEnabled    = true;
    }

    // ═════════════════════════════════════════════════════════════
    //                          MINT
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Mint `quantity` NFTs to address `to`.
     * @dev    Caller (`msg.sender`) must be whitelisted. Recipient can be any
     *         non-zero address, which allows a teacher to mint on a student's
     *         behalf. Rate-limits apply to the CALLER, not the recipient.
     */
    function mint(address to, uint256 quantity) external payable nonReentrant {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert ZeroAmount();
        if (quantity > maxBatchSize) revert ExceedsBatchSize(quantity, maxBatchSize);

        uint256 cost = quantity * mintPrice;
        if (msg.value < cost) revert InsufficientPayment(msg.value, cost);

        uint256 minted = _totalMinted();
        if (minted + quantity > maxSupply) {
            revert ExceedsMaxSupply(quantity, maxSupply - minted);
        }

        // Refresh window if expired, then enforce the daily limit.
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

        // Effects.
        info.mintsThisWindow       = uint64(newMintsInWindow);
        _userMintInfo[msg.sender]  = info;
        totalSalesETH             += cost;

        uint256 firstTokenId = _nextTokenId();

        // Interactions.
        _mint(to, quantity);

        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            if (!ok) revert RefundFailed();
        }

        emit Minted(to, firstTokenId, quantity, cost);
    }

    // ═════════════════════════════════════════════════════════════
    //                       METADATA
    // ═════════════════════════════════════════════════════════════

    /// @inheritdoc ERC721A
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken(tokenId);
        return string.concat(_base, tokenId.toString(), _ext);
    }

    /// @notice Raw collection metadata prefix (e.g. "ipfs://cid/").
    function baseURI() external view returns (string memory) {
        return _base;
    }

    /// @notice Suffix appended after the tokenId, e.g. ".json".
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
        // from == 0 is mint, to == 0 is burn. Both always allowed.
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

    /// @notice Per-user mint telemetry (factors in window expiry).
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
     * @notice Can the user mint `quantity` right now? Returns a reason code
     *         the UI can map to a translated string without attempting a tx.
     * @return ok    True if the mint would succeed.
     * @return code  0 ok | 1 not whitelisted | 2 exceeds batch | 3 exceeds daily
     *               | 4 exceeds supply | 5 zero quantity.
     */
    function canUserMint(address user, uint256 quantity) external view returns (bool ok, uint256 code) {
        if (!whitelist.checkWhitelist(user)) return (false, 1);
        if (quantity == 0)                   return (false, 5);
        if (quantity > maxBatchSize)         return (false, 2);

        uint256 minted = _totalMinted();
        if (minted + quantity > maxSupply)   return (false, 4);

        UserMintInfo memory info = _userMintInfo[user];
        bool active = block.timestamp < uint256(info.windowStart) + MINT_PERIOD;
        uint256 mints = active ? info.mintsThisWindow : 0;
        if (mints + quantity > maxMintsPer24Hours) return (false, 3);

        return (true, 0);
    }

    struct SalesStats {
        uint256 totalSalesETH;
        uint256 totalMinted;
        uint256 remainingSupply;
        uint256 maxSupplyLimit;
        uint256 currentMintPrice;
    }

    /// @notice Aggregate collection telemetry.
    function getSalesStats() external view returns (SalesStats memory) {
        uint256 minted = _totalMinted();
        return SalesStats({
            totalSalesETH:    totalSalesETH,
            totalMinted:      minted,
            remainingSupply:  maxSupply > minted ? maxSupply - minted : 0,
            maxSupplyLimit:   maxSupply,
            currentMintPrice: mintPrice
        });
    }

    /// @notice Next token id that will be assigned on the next mint.
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId();
    }

    // ═════════════════════════════════════════════════════════════
    //                    OWNER: configuration
    // ═════════════════════════════════════════════════════════════

    function setMintPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        emit MintPriceChanged(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        if (newMaxSupply < _totalMinted()) revert InvalidMaxSupply();
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

    /// @notice Withdraw accumulated ETH mint proceeds to the owner.
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();
        (bool ok, ) = owner().call{value: balance}("");
        if (!ok) revert RefundFailed();
        emit EthWithdrawn(owner(), balance);
    }

    // ═════════════════════════════════════════════════════════════
    //           DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Prevent accidental ownership renunciation.
     * @dev    An ownerless collection would lock price, supply, and baseURI
     *         forever, plus strand any ETH in the contract.
     */
    function renounceOwnership() public pure override {
        revert NotWhitelisted(address(0)); // reuse: non-recoverable
    }
}
