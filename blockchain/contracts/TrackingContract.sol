// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IWhitelist {
    function checkWhitelist(address user) external view returns (bool);
    function getEverWhitelistedPaginated(uint256 start, uint256 limit)
        external view returns (address[] memory users, uint256 total);
}

interface IGameTokenPrice {
    function tokenPrice() external view returns (uint256);
}

interface INFTPrice {
    function mintPrice() external view returns (uint256);
}

interface INFTCustomPrice {
    function ethMintPrice() external view returns (uint256);
}

/**
 * @title   TrackingContract
 * @author  GEMBA IT — https://gembait.com
 * @notice  Live-reading leaderboard aggregator for the EduChain ecosystem.
 *          No storage of user state, no caching, no cooldowns — every read is
 *          a fresh computation from the source contracts' current balances.
 *          Sorting and pagination happen in the UI. Gas cost for callers is
 *          zero because all interactions are view calls served by RPC nodes.
 *
 * @dev     Tracked-user list is sourced from the Whitelist's `_everWhitelisted`
 *          set. Anyone who has ever been whitelisted is trackable, even after
 *          removal from the active whitelist — so historical data is preserved.
 *
 *          Points formula (owner-configurable):
 *            points = wholeERC20 * pointsPerERC20
 *                   + predefCount * pointsPerPredefined
 *                   + customCount * pointsPerCustom
 *
 *          Net worth is computed live from mint prices × balances, giving the
 *          UI a real-time portfolio valuation without touching Marketplace
 *          history.
 *
 *          Tiers: pure mapping from points to a tier index. Thresholds are
 *          owner-configurable.
 */
contract TrackingContract is Ownable {

    // ─────────────────────────────────────────────────────────────
    // Constants & immutables
    // ─────────────────────────────────────────────────────────────

    string public constant VERSION = "2.0.0";

    /// @notice Maximum users per batch view call. Guards against RPC gas cap.
    uint256 public constant MAX_BATCH_VIEW = 500;

    IWhitelist       public immutable whitelist;
    IERC20           public immutable gameToken;
    IERC721          public immutable gameNFTPredefined;
    IERC721          public immutable gameNFTCustom;

    // ─────────────────────────────────────────────────────────────
    // Points formula (owner-configurable)
    // ─────────────────────────────────────────────────────────────

    uint256 public pointsPerERC20;
    uint256 public pointsPerPredefined;
    uint256 public pointsPerCustom;

    // ─────────────────────────────────────────────────────────────
    // Tier thresholds (owner-configurable)
    // ─────────────────────────────────────────────────────────────

    /// @notice Minimum points for each tier. Tier 0 = Unranked.
    /// @dev    Always: tierBronze < tierSilver < tierGold < tierPlatinum.
    uint256 public tierBronze;
    uint256 public tierSilver;
    uint256 public tierGold;
    uint256 public tierPlatinum;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event PointsFormulaChanged(
        uint256 pointsPerERC20,
        uint256 pointsPerPredefined,
        uint256 pointsPerCustom
    );
    event TierThresholdsChanged(
        uint256 bronze,
        uint256 silver,
        uint256 gold,
        uint256 platinum
    );

    // ─────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error BatchTooLarge(uint256 size, uint256 max);
    error InvalidTierOrdering();
    error OwnershipNotRenounceable();

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    constructor(
        address whitelist_,
        address gameToken_,
        address gameNFTPredefined_,
        address gameNFTCustom_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (whitelist_          == address(0)) revert ZeroAddress();
        if (gameToken_          == address(0)) revert ZeroAddress();
        if (gameNFTPredefined_  == address(0)) revert ZeroAddress();
        if (gameNFTCustom_      == address(0)) revert ZeroAddress();
        if (initialOwner        == address(0)) revert ZeroAddress();

        whitelist         = IWhitelist(whitelist_);
        gameToken         = IERC20(gameToken_);
        gameNFTPredefined = IERC721(gameNFTPredefined_);
        gameNFTCustom     = IERC721(gameNFTCustom_);

        pointsPerERC20       = 1;
        pointsPerPredefined  = 10;
        pointsPerCustom      = 30;

        tierBronze   = 10;
        tierSilver   = 50;
        tierGold     = 200;
        tierPlatinum = 1000;
    }

    // ═════════════════════════════════════════════════════════════
    //                   CORE: single-user entry
    // ═════════════════════════════════════════════════════════════

    struct UserLeaderboardEntry {
        address user;
        uint256 erc20BalanceWei;
        uint256 erc20Whole;
        uint256 predefinedCount;
        uint256 customCount;
        uint256 totalPoints;
        uint256 netWorthWei;
        uint8   tier;                 // 0 Unranked | 1 Bronze | 2 Silver | 3 Gold | 4 Platinum
        bool    isCurrentlyWhitelisted;
    }

    /**
     * @notice Full live-computed leaderboard entry for a single user.
     * @dev    Reads from GameToken, both NFT contracts, and their price feeds.
     *         ~6-8 external view calls. Zero gas for the caller at RPC level.
     */
    function getUserEntry(address user) public view returns (UserLeaderboardEntry memory) {
        return _computeEntry(user);
    }

    function _computeEntry(address user) internal view returns (UserLeaderboardEntry memory entry) {
        uint256 erc20Wei = gameToken.balanceOf(user);
        uint256 erc20Whole = erc20Wei / 1e18;
        uint256 predefCount = gameNFTPredefined.balanceOf(user);
        uint256 customCount = gameNFTCustom.balanceOf(user);

        uint256 points =
            erc20Whole * pointsPerERC20 +
            predefCount * pointsPerPredefined +
            customCount * pointsPerCustom;

        // Live prices from source contracts.
        uint256 gameTokenPrice     = IGameTokenPrice(address(gameToken)).tokenPrice();
        uint256 predefinedMintEth  = INFTPrice(address(gameNFTPredefined)).mintPrice();
        uint256 customEthPrice     = INFTCustomPrice(address(gameNFTCustom)).ethMintPrice();

        uint256 netWorth =
            erc20Whole * gameTokenPrice +
            predefCount * predefinedMintEth +
            customCount * customEthPrice;

        entry = UserLeaderboardEntry({
            user:                    user,
            erc20BalanceWei:         erc20Wei,
            erc20Whole:              erc20Whole,
            predefinedCount:         predefCount,
            customCount:             customCount,
            totalPoints:             points,
            netWorthWei:             netWorth,
            tier:                    _computeTier(points),
            isCurrentlyWhitelisted:  whitelist.checkWhitelist(user)
        });
    }

    function _computeTier(uint256 points) internal view returns (uint8) {
        if (points >= tierPlatinum) return 4;
        if (points >= tierGold)     return 3;
        if (points >= tierSilver)   return 2;
        if (points >= tierBronze)   return 1;
        return 0;
    }

    // ═════════════════════════════════════════════════════════════
    //                 BATCH LEADERBOARD (paginated)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Fetch entries for an explicit list of users.
     * @dev    UI uses this after it already knows which users to render (e.g.
     *         for the "compare my friends" feature).
     */
    function getEntriesBatch(address[] calldata users)
        external
        view
        returns (UserLeaderboardEntry[] memory entries)
    {
        uint256 len = users.length;
        if (len > MAX_BATCH_VIEW) revert BatchTooLarge(len, MAX_BATCH_VIEW);

        entries = new UserLeaderboardEntry[](len);
        for (uint256 i = 0; i < len; ++i) {
            entries[i] = _computeEntry(users[i]);
        }
    }

    /**
     * @notice Paginated leaderboard backed by the Whitelist's ever-whitelisted set.
     * @param  start Zero-based index into the whitelist.
     * @param  limit Page size. Capped at MAX_BATCH_VIEW.
     * @return entries Live-computed entries for the page.
     * @return total   Total size of the ever-whitelisted set.
     * @dev    UI sorts `entries` client-side by any field (points, net worth, etc.).
     *         For a full leaderboard, fetch pages of up to 500 until `total` is reached.
     */
    function getLeaderboardPaginated(uint256 start, uint256 limit)
        external
        view
        returns (UserLeaderboardEntry[] memory entries, uint256 total)
    {
        if (limit > MAX_BATCH_VIEW) revert BatchTooLarge(limit, MAX_BATCH_VIEW);

        (address[] memory users, uint256 totalUsers) =
            whitelist.getEverWhitelistedPaginated(start, limit);

        total = totalUsers;
        uint256 n = users.length;
        entries = new UserLeaderboardEntry[](n);
        for (uint256 i = 0; i < n; ++i) {
            entries[i] = _computeEntry(users[i]);
        }
    }

    // ═════════════════════════════════════════════════════════════
    //                 AGGREGATE ECOSYSTEM STATS
    // ═════════════════════════════════════════════════════════════

    struct EcosystemStats {
        uint256 totalTrackedUsers;      // Ever-whitelisted count
        uint256 totalActiveWhitelisted; // Currently-whitelisted count (proxied via Whitelist)
        uint256 pointsPerERC20;
        uint256 pointsPerPredefined;
        uint256 pointsPerCustom;
        uint256 tierBronze;
        uint256 tierSilver;
        uint256 tierGold;
        uint256 tierPlatinum;
    }

    /// @notice Configuration snapshot + totals, single RPC call.
    function getEcosystemStats() external view returns (EcosystemStats memory) {
        (, uint256 everWhitelisted) = whitelist.getEverWhitelistedPaginated(0, 1);
        return EcosystemStats({
            totalTrackedUsers:       everWhitelisted,
            totalActiveWhitelisted:  _activeWhitelistedCount(),
            pointsPerERC20:          pointsPerERC20,
            pointsPerPredefined:     pointsPerPredefined,
            pointsPerCustom:         pointsPerCustom,
            tierBronze:              tierBronze,
            tierSilver:              tierSilver,
            tierGold:                tierGold,
            tierPlatinum:            tierPlatinum
        });
    }

    /// @dev Approximated via iterating ever-whitelisted. For very large populations the UI
    ///      should prefer Whitelist.getStats() directly (one call, no iteration).
    function _activeWhitelistedCount() internal view returns (uint256 count) {
        // Instead of iterating, call the Whitelist stats directly via raw interface lookup.
        // Here we prefer a dedicated helper to avoid coupling too tightly.
        // Returns 0 if the call fails (defensive).
        try IWhitelistStats(address(whitelist)).whitelistedCount() returns (uint256 c) {
            return c;
        } catch {
            return 0;
        }
    }

    // ═════════════════════════════════════════════════════════════
    //                    OWNER: configuration
    // ═════════════════════════════════════════════════════════════

    function setPointsFormula(
        uint256 newPointsPerERC20,
        uint256 newPointsPerPredefined,
        uint256 newPointsPerCustom
    ) external onlyOwner {
        pointsPerERC20      = newPointsPerERC20;
        pointsPerPredefined = newPointsPerPredefined;
        pointsPerCustom     = newPointsPerCustom;
        emit PointsFormulaChanged(newPointsPerERC20, newPointsPerPredefined, newPointsPerCustom);
    }

    function setTierThresholds(
        uint256 newBronze,
        uint256 newSilver,
        uint256 newGold,
        uint256 newPlatinum
    ) external onlyOwner {
        if (!(newBronze < newSilver && newSilver < newGold && newGold < newPlatinum)) {
            revert InvalidTierOrdering();
        }
        tierBronze   = newBronze;
        tierSilver   = newSilver;
        tierGold     = newGold;
        tierPlatinum = newPlatinum;
        emit TierThresholdsChanged(newBronze, newSilver, newGold, newPlatinum);
    }

    // ═════════════════════════════════════════════════════════════
    //              DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    function renounceOwnership() public pure override {
        revert OwnershipNotRenounceable();
    }
}

/// @dev Minimal satellite interface for reading the Whitelist's active count.
interface IWhitelistStats {
    function whitelistedCount() external view returns (uint256);
}
