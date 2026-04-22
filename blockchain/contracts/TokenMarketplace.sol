// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IWhitelist {
    function checkWhitelist(address user) external view returns (bool);
}

/**
 * @title   TokenMarketplace
 * @author  GEMBA IT — https://gembait.com
 * @notice  Escrow-based peer-to-peer marketplace for the EduChain ecosystem.
 *          Supports two token types: ERC-20 (fungible amounts) and ERC-721
 *          (non-fungible individual tokens). All listings are fixed-price in
 *          ETH. Optional `allowedBuyer` creates a private offer to one address.
 *
 * @dev     Design decisions:
 *           - Escrow model: the seller's assets are transferred to the
 *             marketplace at listing time. A buyer interacting with an active
 *             listing always receives the asset. No approval race conditions.
 *           - EnumerableSet tracks currently-active listing IDs, giving O(1)
 *             add/remove and gap-free pagination — no wasted iteration over
 *             cancelled/sold entries.
 *           - Per-user rate limits pack all four counters (listings window +
 *             purchases window) into a single 256-bit slot.
 *           - CEI pattern throughout: effects completed before transfers; ETH
 *             sent via `.call{value:}` to survive gas repricing and support
 *             smart-contract wallets.
 *           - SafeERC20 for all ERC-20 movements (USDT-style non-reverting
 *             returns handled cleanly).
 *           - No protocol fee. Educational platform.
 *           - ERC-1155 support removed compared to v1 (no ERC-1155 contracts
 *             exist in this ecosystem; removing dead code shrinks the surface).
 *           - Metadata not snapshotted on-chain: our NFT contracts' URIs are
 *             already immutable per-token, so bait-and-switch is impossible.
 *             UI fetches `tokenURI(tokenId)` live.
 */
contract TokenMarketplace is IERC721Receiver, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    // ─────────────────────────────────────────────────────────────
    // Constants & immutables
    // ─────────────────────────────────────────────────────────────

    string public constant VERSION = "2.0.0";
    uint256 public constant INTERACTION_PERIOD = 1 days;
    uint256 public constant MAX_BATCH_VIEW = 500;

    /// @notice Canonical whitelist contract.
    IWhitelist public immutable whitelist;

    // ─────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────

    enum TokenType { ERC20, ERC721 }

    struct Listing {
        address seller;
        address tokenContract;
        uint256 tokenId;       // ERC-721: token id. ERC-20: ignored (0).
        uint256 amount;        // ERC-20: token amount. ERC-721: always 1.
        uint256 price;         // Total price in wei for the whole listing.
        address allowedBuyer;  // 0x0 = public. Non-zero = private to that address.
        TokenType tokenType;
        bool    isActive;      // False after sale or cancel.
        uint64  createdAt;     // Listing timestamp.
    }

    // ─────────────────────────────────────────────────────────────
    // Configurable parameters (owner-controlled)
    // ─────────────────────────────────────────────────────────────

    uint256 public listingsPerDayLimit;
    uint256 public purchasesPerDayLimit;

    // ─────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId = 1;

    /// @dev Currently-active listing IDs. Automatically pruned on cancel/sale.
    EnumerableSet.UintSet private _activeListings;

    /// @dev Append-only history of every listing ID created by each seller.
    mapping(address => uint256[]) private _sellerListings;

    /// @dev Packed per-user rate-limit state. One slot.
    struct UserMarketInfo {
        uint64 listingWindowStart;
        uint64 listingsThisWindow;
        uint64 purchaseWindowStart;
        uint64 purchasesThisWindow;
    }
    mapping(address => UserMarketInfo) private _userInfo;

    // ─────────────────────────────────────────────────────────────
    // Global statistics
    // ─────────────────────────────────────────────────────────────

    uint256 public totalSalesETH;
    uint256 public totalTransactions;
    uint256 public totalListingsEverCreated;
    uint256 public salesERC20;
    uint256 public salesERC721;
    uint256 public transactionsERC20;
    uint256 public transactionsERC721;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address indexed tokenContract,
        TokenType tokenType,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        address allowedBuyer
    );

    event ListingPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        address tokenContract,
        TokenType tokenType,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller,
        bool byOwner
    );

    event ListingsPerDayLimitChanged(uint256 oldValue, uint256 newValue);
    event PurchasesPerDayLimitChanged(uint256 oldValue, uint256 newValue);

    // ─────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error ZeroPrice();
    error NotWhitelisted(address user);
    error ListingInactive(uint256 listingId);
    error NotSeller(address caller, address seller);
    error CannotBuyOwnListing();
    error NotAllowedBuyer(address caller, address allowed);
    error InsufficientPayment(uint256 sent, uint256 required);
    error ExceedsListingsPerDay(uint256 current, uint256 max);
    error ExceedsPurchasesPerDay(uint256 current, uint256 max);
    error BatchTooLarge(uint256 size, uint256 max);
    error NotTokenOwner();
    error InsufficientTokenBalance(uint256 requested, uint256 available);
    error InsufficientAllowance(uint256 requested, uint256 available);
    error TransferFailed();
    error OwnershipNotRenounceable();

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    constructor(address whitelist_, address initialOwner) Ownable(initialOwner) {
        if (whitelist_ == address(0))   revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();

        whitelist            = IWhitelist(whitelist_);
        listingsPerDayLimit  = 3;
        purchasesPerDayLimit = 3;
    }

    // ═════════════════════════════════════════════════════════════
    //                    LISTING CREATION
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice List an ERC-721 NFT for sale at a fixed ETH price.
     * @dev    Caller must have approved this marketplace for the specific
     *         tokenId (or via `setApprovalForAll`). The NFT is transferred
     *         into escrow immediately.
     * @param  tokenContract_  ERC-721 contract address.
     * @param  tokenId         Token ID to list.
     * @param  price           Sale price in wei.
     * @param  allowedBuyer    0x0 for public, else a specific buyer address.
     */
    function createERC721Listing(
        address tokenContract_,
        uint256 tokenId,
        uint256 price,
        address allowedBuyer
    ) external nonReentrant returns (uint256 listingId) {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);
        if (tokenContract_ == address(0)) revert ZeroAddress();
        if (price == 0) revert ZeroPrice();

        IERC721 nft = IERC721(tokenContract_);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        _applyListingLimit();

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller:        msg.sender,
            tokenContract: tokenContract_,
            tokenId:       tokenId,
            amount:        1,
            price:         price,
            allowedBuyer:  allowedBuyer,
            tokenType:     TokenType.ERC721,
            isActive:      true,
            createdAt:     uint64(block.timestamp)
        });

        _activeListings.add(listingId);
        _sellerListings[msg.sender].push(listingId);
        unchecked { ++totalListingsEverCreated; }

        // Escrow the NFT. Caller must have approved this contract.
        nft.transferFrom(msg.sender, address(this), tokenId);

        emit ListingCreated(
            listingId,
            msg.sender,
            tokenContract_,
            TokenType.ERC721,
            tokenId,
            1,
            price,
            allowedBuyer
        );
    }

    /**
     * @notice List ERC-20 tokens for sale at a fixed ETH price.
     * @param  tokenContract_  ERC-20 contract address.
     * @param  amount          Amount of tokens to list (in wei-units of the ERC-20).
     * @param  price           Total sale price in wei for the whole amount.
     * @param  allowedBuyer    0x0 for public, else a specific buyer address.
     */
    function createERC20Listing(
        address tokenContract_,
        uint256 amount,
        uint256 price,
        address allowedBuyer
    ) external nonReentrant returns (uint256 listingId) {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);
        if (tokenContract_ == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (price == 0) revert ZeroPrice();

        IERC20 token = IERC20(tokenContract_);
        uint256 callerBalance = token.balanceOf(msg.sender);
        if (callerBalance < amount) revert InsufficientTokenBalance(amount, callerBalance);
        uint256 allowed = token.allowance(msg.sender, address(this));
        if (allowed < amount) revert InsufficientAllowance(amount, allowed);

        _applyListingLimit();

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller:        msg.sender,
            tokenContract: tokenContract_,
            tokenId:       0,
            amount:        amount,
            price:         price,
            allowedBuyer:  allowedBuyer,
            tokenType:     TokenType.ERC20,
            isActive:      true,
            createdAt:     uint64(block.timestamp)
        });

        _activeListings.add(listingId);
        _sellerListings[msg.sender].push(listingId);
        unchecked { ++totalListingsEverCreated; }

        // Escrow the tokens.
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit ListingCreated(
            listingId,
            msg.sender,
            tokenContract_,
            TokenType.ERC20,
            0,
            amount,
            price,
            allowedBuyer
        );
    }

    function _applyListingLimit() private {
        UserMarketInfo memory info = _userInfo[msg.sender];
        if (block.timestamp >= uint256(info.listingWindowStart) + INTERACTION_PERIOD) {
            info.listingWindowStart   = uint64(block.timestamp);
            info.listingsThisWindow   = 0;
        }
        if (info.listingsThisWindow + 1 > listingsPerDayLimit) {
            revert ExceedsListingsPerDay(info.listingsThisWindow, listingsPerDayLimit);
        }
        info.listingsThisWindow += 1;
        _userInfo[msg.sender]    = info;
    }

    // ═════════════════════════════════════════════════════════════
    //                       PURCHASE
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Buy an active listing at its fixed price.
     * @dev    Msg.value must be >= listing.price. Overpayment is refunded.
     *         The asset is transferred to the buyer; ETH (minus overpay) is
     *         transferred to the seller.
     */
    function purchaseListing(uint256 listingId) external payable nonReentrant {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);

        Listing storage l = listings[listingId];
        if (!l.isActive) revert ListingInactive(listingId);
        if (l.seller == msg.sender) revert CannotBuyOwnListing();
        if (l.allowedBuyer != address(0) && l.allowedBuyer != msg.sender) {
            revert NotAllowedBuyer(msg.sender, l.allowedBuyer);
        }
        if (msg.value < l.price) revert InsufficientPayment(msg.value, l.price);

        _applyPurchaseLimit();

        // Snapshot values we'll need before effects modify storage.
        address seller        = l.seller;
        address tokenContract = l.tokenContract;
        uint256 tokenId       = l.tokenId;
        uint256 amount        = l.amount;
        uint256 price         = l.price;
        TokenType tType       = l.tokenType;

        // Effects.
        l.isActive = false;
        _activeListings.remove(listingId);

        totalSalesETH      += price;
        totalTransactions  += 1;
        if (tType == TokenType.ERC20) {
            salesERC20         += price;
            transactionsERC20  += 1;
        } else {
            salesERC721        += price;
            transactionsERC721 += 1;
        }

        // Interactions.
        // 1) Pay seller.
        (bool ok, ) = seller.call{value: price}("");
        if (!ok) revert TransferFailed();

        // 2) Deliver asset to buyer.
        if (tType == TokenType.ERC721) {
            IERC721(tokenContract).transferFrom(address(this), msg.sender, tokenId);
        } else {
            IERC20(tokenContract).safeTransfer(msg.sender, amount);
        }

        // 3) Refund overpay.
        if (msg.value > price) {
            (bool okRefund, ) = msg.sender.call{value: msg.value - price}("");
            if (!okRefund) revert TransferFailed();
        }

        emit ListingPurchased(
            listingId,
            msg.sender,
            seller,
            tokenContract,
            tType,
            tokenId,
            amount,
            price
        );
    }

    function _applyPurchaseLimit() private {
        UserMarketInfo memory info = _userInfo[msg.sender];
        if (block.timestamp >= uint256(info.purchaseWindowStart) + INTERACTION_PERIOD) {
            info.purchaseWindowStart   = uint64(block.timestamp);
            info.purchasesThisWindow   = 0;
        }
        if (info.purchasesThisWindow + 1 > purchasesPerDayLimit) {
            revert ExceedsPurchasesPerDay(info.purchasesThisWindow, purchasesPerDayLimit);
        }
        info.purchasesThisWindow += 1;
        _userInfo[msg.sender]     = info;
    }

    // ═════════════════════════════════════════════════════════════
    //                        CANCEL
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Seller cancels their own active listing and reclaims the asset.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        if (!l.isActive) revert ListingInactive(listingId);
        if (l.seller != msg.sender) revert NotSeller(msg.sender, l.seller);
        _doCancel(listingId, false);
    }

    /**
     * @notice Owner-initiated emergency cancellation. Returns the asset to the
     *         original seller.
     */
    function emergencyCancelListing(uint256 listingId) external onlyOwner nonReentrant {
        Listing storage l = listings[listingId];
        if (!l.isActive) revert ListingInactive(listingId);
        _doCancel(listingId, true);
    }

    function _doCancel(uint256 listingId, bool byOwner) private {
        Listing storage l = listings[listingId];
        address seller        = l.seller;
        address tokenContract = l.tokenContract;
        uint256 tokenId       = l.tokenId;
        uint256 amount        = l.amount;
        TokenType tType       = l.tokenType;

        l.isActive = false;
        _activeListings.remove(listingId);

        if (tType == TokenType.ERC721) {
            IERC721(tokenContract).transferFrom(address(this), seller, tokenId);
        } else {
            IERC20(tokenContract).safeTransfer(seller, amount);
        }

        emit ListingCancelled(listingId, seller, byOwner);
    }

    // ═════════════════════════════════════════════════════════════
    //                          VIEWS
    // ═════════════════════════════════════════════════════════════

    /// @notice Number of currently-active listings across the whole marketplace.
    function activeListingsCount() external view returns (uint256) {
        return _activeListings.length();
    }

    /**
     * @notice Paginated list of active listing IDs (gap-free).
     * @dev    UI fetches IDs then calls `getListings` for full details.
     */
    function getActiveListingIds(uint256 start, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        total = _activeListings.length();
        if (start >= total) return (new uint256[](0), total);
        if (limit > MAX_BATCH_VIEW) revert BatchTooLarge(limit, MAX_BATCH_VIEW);

        uint256 end = start + limit > total ? total : start + limit;
        uint256 n = end - start;
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            ids[i] = _activeListings.at(start + i);
        }
    }

    /**
     * @notice Paginated active listings with full details in one call.
     */
    function getActiveListingsPaginated(uint256 start, uint256 limit)
        external
        view
        returns (Listing[] memory result, uint256 total)
    {
        total = _activeListings.length();
        if (start >= total) return (new Listing[](0), total);
        if (limit > MAX_BATCH_VIEW) revert BatchTooLarge(limit, MAX_BATCH_VIEW);

        uint256 end = start + limit > total ? total : start + limit;
        uint256 n = end - start;
        result = new Listing[](n);
        for (uint256 i = 0; i < n; ++i) {
            result[i] = listings[_activeListings.at(start + i)];
        }
    }

    /// @notice Fetch multiple listings by their IDs in one call.
    function getListings(uint256[] calldata ids) external view returns (Listing[] memory out) {
        uint256 n = ids.length;
        if (n > MAX_BATCH_VIEW) revert BatchTooLarge(n, MAX_BATCH_VIEW);
        out = new Listing[](n);
        for (uint256 i = 0; i < n; ++i) {
            out[i] = listings[ids[i]];
        }
    }

    /**
     * @notice Full history of listing IDs created by a seller (active + cancelled + sold).
     * @dev    UI filters by `listings[id].isActive` or by comparing seller/state.
     */
    function getSellerListingIds(address seller) external view returns (uint256[] memory) {
        return _sellerListings[seller];
    }

    struct UserInteractionStats {
        uint256 listingsThisWindow;
        uint256 purchasesThisWindow;
        uint256 remainingListings;
        uint256 remainingPurchases;
        uint256 listingWindowResetAt;
        uint256 purchaseWindowResetAt;
    }

    /// @notice Per-user rate-limit telemetry.
    function getUserInteractionStats(address user) external view returns (UserInteractionStats memory) {
        UserMarketInfo memory info = _userInfo[user];
        bool lActive = block.timestamp < uint256(info.listingWindowStart) + INTERACTION_PERIOD;
        bool pActive = block.timestamp < uint256(info.purchaseWindowStart) + INTERACTION_PERIOD;
        uint256 listings_  = lActive ? info.listingsThisWindow  : 0;
        uint256 purchases_ = pActive ? info.purchasesThisWindow : 0;
        return UserInteractionStats({
            listingsThisWindow:    listings_,
            purchasesThisWindow:   purchases_,
            remainingListings:     listingsPerDayLimit  > listings_  ? listingsPerDayLimit  - listings_  : 0,
            remainingPurchases:    purchasesPerDayLimit > purchases_ ? purchasesPerDayLimit - purchases_ : 0,
            listingWindowResetAt:  lActive ? uint256(info.listingWindowStart)  + INTERACTION_PERIOD : 0,
            purchaseWindowResetAt: pActive ? uint256(info.purchaseWindowStart) + INTERACTION_PERIOD : 0
        });
    }

    /**
     * @notice Can the user list right now? Returns a reason code for UI routing.
     * @return ok   True if a new listing would succeed (assumes valid args).
     * @return code 0 ok | 1 not whitelisted | 2 daily listing limit.
     */
    function canUserList(address user) external view returns (bool ok, uint256 code) {
        if (!whitelist.checkWhitelist(user)) return (false, 1);
        UserMarketInfo memory info = _userInfo[user];
        bool active = block.timestamp < uint256(info.listingWindowStart) + INTERACTION_PERIOD;
        uint256 listings_ = active ? info.listingsThisWindow : 0;
        if (listings_ + 1 > listingsPerDayLimit) return (false, 2);
        return (true, 0);
    }

    /**
     * @notice Can the user purchase right now?
     * @return ok   True if a purchase would succeed (assumes listing valid + payment).
     * @return code 0 ok | 1 not whitelisted | 2 daily purchase limit.
     */
    function canUserPurchase(address user) external view returns (bool ok, uint256 code) {
        if (!whitelist.checkWhitelist(user)) return (false, 1);
        UserMarketInfo memory info = _userInfo[user];
        bool active = block.timestamp < uint256(info.purchaseWindowStart) + INTERACTION_PERIOD;
        uint256 purchases_ = active ? info.purchasesThisWindow : 0;
        if (purchases_ + 1 > purchasesPerDayLimit) return (false, 2);
        return (true, 0);
    }

    struct MarketplaceStats {
        uint256 activeListingsCount;
        uint256 totalListingsEverCreated;
        uint256 totalTransactions;
        uint256 totalSalesETH;
        uint256 salesERC20;
        uint256 salesERC721;
        uint256 transactionsERC20;
        uint256 transactionsERC721;
        uint256 listingsPerDayLimit;
        uint256 purchasesPerDayLimit;
    }

    /// @notice Aggregate marketplace telemetry in one call.
    function getMarketplaceStats() external view returns (MarketplaceStats memory) {
        return MarketplaceStats({
            activeListingsCount:      _activeListings.length(),
            totalListingsEverCreated: totalListingsEverCreated,
            totalTransactions:        totalTransactions,
            totalSalesETH:            totalSalesETH,
            salesERC20:               salesERC20,
            salesERC721:              salesERC721,
            transactionsERC20:        transactionsERC20,
            transactionsERC721:       transactionsERC721,
            listingsPerDayLimit:      listingsPerDayLimit,
            purchasesPerDayLimit:     purchasesPerDayLimit
        });
    }

    // ═════════════════════════════════════════════════════════════
    //                    OWNER: configuration
    // ═════════════════════════════════════════════════════════════

    function setListingsPerDayLimit(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroAmount();
        emit ListingsPerDayLimitChanged(listingsPerDayLimit, newLimit);
        listingsPerDayLimit = newLimit;
    }

    function setPurchasesPerDayLimit(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroAmount();
        emit PurchasesPerDayLimitChanged(purchasesPerDayLimit, newLimit);
        purchasesPerDayLimit = newLimit;
    }

    // ═════════════════════════════════════════════════════════════
    //               ERC-721 RECEIVER COMPLIANCE
    // ═════════════════════════════════════════════════════════════

    /// @inheritdoc IERC721Receiver
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ═════════════════════════════════════════════════════════════
    //              DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Ownership renunciation is permanently disabled.
     * @dev    An ownerless marketplace would freeze rate-limit configuration
     *         and disable emergency listing cancellation.
     */
    function renounceOwnership() public pure override {
        revert OwnershipNotRenounceable();
    }
}
