// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title   Whitelist
 * @author  GEMBA IT — https://gembait.com
 * @notice  Access control registry for the EduChain ecosystem.
 *          Maintains three distinct sets — whitelisted users, blacklisted users,
 *          and administrators (teachers) — and exposes O(1) membership checks
 *          used by all downstream contracts (GameToken, NFTs, Marketplace,
 *          Tracking, Faucet).
 *
 * @dev     Roles:
 *           - Owner: full control. Manages admins, blacklist, and whitelist.
 *           - Admin (teacher): may add/remove whitelist entries. Nothing else.
 *           - Whitelisted user: passive permission to participate in the ecosystem.
 *
 *          Blacklist always overrides whitelist. Adding a user to the blacklist
 *          automatically evicts them from the active whitelist. Removing them
 *          from the blacklist does NOT re-add them; that requires a separate
 *          `addToWhitelist` call.
 *
 *          EnumerableSet gives O(1) membership checks plus ordered pagination
 *          with no gaps after deletions.
 *
 *          Custom errors are used throughout in place of revert strings — both
 *          for gas savings and for machine-readable error handling on the front end.
 *
 *          Contract is immutable: there is no proxy, no upgrade path, no
 *          delegatecall surface. Once deployed, behaviour is final.
 */
contract Whitelist is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    /// @notice Human-readable contract version.
    string public constant VERSION = "2.0.0";

    /// @notice Maximum batch operation size. Prevents gas-limit DoS.
    uint256 public constant MAX_BATCH_SIZE = 200;

    // ─────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────

    /// @dev Currently active whitelist. Does not include blacklisted users.
    EnumerableSet.AddressSet private _whitelisted;

    /// @dev Blacklist. A blacklisted user cannot be whitelisted until un-blacklisted.
    EnumerableSet.AddressSet private _blacklisted;

    /// @dev Admin (teacher) role. Admins can manage the whitelist but not the blacklist.
    EnumerableSet.AddressSet private _admins;

    /// @dev Historical record of every address that has ever been whitelisted.
    /// Useful for analytics; never pruned.
    EnumerableSet.AddressSet private _everWhitelisted;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event Whitelisted(address indexed user, address indexed actor);
    event Unwhitelisted(address indexed user, address indexed actor);
    event Blacklisted(address indexed user, address indexed actor);
    event Unblacklisted(address indexed user, address indexed actor);
    event AdminAdded(address indexed admin, address indexed actor);
    event AdminRemoved(address indexed admin, address indexed actor);
    event BatchWhitelisted(uint256 added, address indexed actor);
    event BatchUnwhitelisted(uint256 removed, address indexed actor);

    // ─────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error NotAuthorized();
    error AlreadyWhitelisted(address user);
    error NotWhitelisted(address user);
    error AlreadyBlacklisted(address user);
    error NotBlacklisted(address user);
    error AlreadyAdmin(address admin);
    error NotAdmin(address admin);
    error IsBlacklisted(address user);
    error BatchTooLarge(uint256 size, uint256 max);
    error EmptyBatch();

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * @param initialOwner Address to receive ownership. Must not be zero.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────

    modifier onlyOwnerOrAdmin() {
        if (msg.sender != owner() && !_admins.contains(msg.sender)) revert NotAuthorized();
        _;
    }

    // ═════════════════════════════════════════════════════════════
    //                      ADMIN MANAGEMENT
    //            (owner only)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Grant the admin (teacher) role to an address.
     * @dev    Admins may add or remove addresses from the whitelist, but cannot
     *         manage the blacklist or grant/revoke other admins.
     */
    function addAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert ZeroAddress();
        if (!_admins.add(admin)) revert AlreadyAdmin(admin);
        emit AdminAdded(admin, msg.sender);
    }

    /// @notice Revoke the admin role.
    function removeAdmin(address admin) external onlyOwner {
        if (!_admins.remove(admin)) revert NotAdmin(admin);
        emit AdminRemoved(admin, msg.sender);
    }

    /// @notice Check whether an address has the admin role.
    function isAdmin(address account) external view returns (bool) {
        return _admins.contains(account);
    }

    /// @notice Number of admins currently configured.
    function adminCount() external view returns (uint256) {
        return _admins.length();
    }

    /**
     * @notice Paginated list of admin addresses.
     * @param  start  Zero-based index to start from.
     * @param  limit  Maximum number of results to return.
     * @return admins Page of admin addresses.
     * @return total  Total admin count.
     */
    function getAdmins(uint256 start, uint256 limit)
        external
        view
        returns (address[] memory admins, uint256 total)
    {
        total = _admins.length();
        if (start >= total) return (new address[](0), total);
        uint256 end = start + limit > total ? total : start + limit;
        uint256 n = end - start;
        admins = new address[](n);
        for (uint256 i = 0; i < n; ++i) {
            admins[i] = _admins.at(start + i);
        }
    }

    // ═════════════════════════════════════════════════════════════
    //                  WHITELIST MANAGEMENT
    //              (owner or admin)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Add an address to the whitelist.
     * @dev    Reverts if the address is zero, blacklisted, or already whitelisted.
     */
    function addToWhitelist(address user) external onlyOwnerOrAdmin {
        _addOne(user);
        emit Whitelisted(user, msg.sender);
    }

    /**
     * @notice Remove an address from the whitelist.
     * @dev    The address remains in the historical `_everWhitelisted` set.
     */
    function removeFromWhitelist(address user) external onlyOwnerOrAdmin {
        if (!_whitelisted.remove(user)) revert NotWhitelisted(user);
        emit Unwhitelisted(user, msg.sender);
    }

    /**
     * @notice Batch add addresses to the whitelist.
     * @dev    Skips zero addresses, blacklisted addresses, and addresses already
     *         whitelisted. Emits one `Whitelisted` event per added address plus
     *         one aggregate `BatchWhitelisted` event.
     */
    function batchAddToWhitelist(address[] calldata users) external onlyOwnerOrAdmin {
        uint256 len = users.length;
        if (len == 0) revert EmptyBatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len, MAX_BATCH_SIZE);

        uint256 added;
        for (uint256 i = 0; i < len; ++i) {
            address user = users[i];
            if (user == address(0)) continue;
            if (_blacklisted.contains(user)) continue;
            if (_whitelisted.add(user)) {
                _everWhitelisted.add(user);
                emit Whitelisted(user, msg.sender);
                unchecked { ++added; }
            }
        }
        emit BatchWhitelisted(added, msg.sender);
    }

    /**
     * @notice Batch remove addresses from the whitelist.
     * @dev    Silently skips addresses not currently whitelisted.
     */
    function batchRemoveFromWhitelist(address[] calldata users) external onlyOwnerOrAdmin {
        uint256 len = users.length;
        if (len == 0) revert EmptyBatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len, MAX_BATCH_SIZE);

        uint256 removed;
        for (uint256 i = 0; i < len; ++i) {
            if (_whitelisted.remove(users[i])) {
                emit Unwhitelisted(users[i], msg.sender);
                unchecked { ++removed; }
            }
        }
        emit BatchUnwhitelisted(removed, msg.sender);
    }

    /// @dev Internal helper shared by `addToWhitelist`.
    function _addOne(address user) private {
        if (user == address(0)) revert ZeroAddress();
        if (_blacklisted.contains(user)) revert IsBlacklisted(user);
        if (!_whitelisted.add(user)) revert AlreadyWhitelisted(user);
        _everWhitelisted.add(user);
    }

    // ═════════════════════════════════════════════════════════════
    //                  BLACKLIST MANAGEMENT
    //              (owner only)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Add an address to the blacklist.
     * @dev    Auto-evicts from the active whitelist if present. The address
     *         remains in `_everWhitelisted` for historical purposes.
     */
    function addToBlacklist(address user) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        if (!_blacklisted.add(user)) revert AlreadyBlacklisted(user);

        // Blacklist overrides whitelist: evict from active whitelist if present.
        if (_whitelisted.remove(user)) {
            emit Unwhitelisted(user, msg.sender);
        }
        emit Blacklisted(user, msg.sender);
    }

    /**
     * @notice Remove an address from the blacklist.
     * @dev    Does NOT auto-restore whitelist membership. To re-enable the user,
     *         call `addToWhitelist` separately.
     */
    function removeFromBlacklist(address user) external onlyOwner {
        if (!_blacklisted.remove(user)) revert NotBlacklisted(user);
        emit Unblacklisted(user, msg.sender);
    }

    // ═════════════════════════════════════════════════════════════
    //                      STATUS QUERIES
    //              (view, unrestricted)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Canonical access check used by all downstream ecosystem contracts.
     * @dev    Returns true iff the user is whitelisted AND not blacklisted.
     */
    function checkWhitelist(address user) external view returns (bool) {
        return _whitelisted.contains(user) && !_blacklisted.contains(user);
    }

    /// @notice Raw whitelist membership (does not account for blacklist).
    function isWhitelisted(address user) external view returns (bool) {
        return _whitelisted.contains(user);
    }

    /// @notice Blacklist membership.
    function isBlacklisted(address user) external view returns (bool) {
        return _blacklisted.contains(user);
    }

    /// @notice True if the address has ever been on the whitelist.
    function wasEverWhitelisted(address user) external view returns (bool) {
        return _everWhitelisted.contains(user);
    }

    struct UserStatus {
        bool whitelisted;
        bool blacklisted;
        bool active;           // whitelisted && !blacklisted
        bool everWhitelisted;
    }

    /// @notice Full access status for a single user in one call.
    function getUserStatus(address user) external view returns (UserStatus memory) {
        bool w = _whitelisted.contains(user);
        bool b = _blacklisted.contains(user);
        return UserStatus({
            whitelisted: w,
            blacklisted: b,
            active: w && !b,
            everWhitelisted: _everWhitelisted.contains(user)
        });
    }

    /**
     * @notice Batch access-check for many addresses.
     * @dev    Gas cost scales linearly with array length. Keep `users.length`
     *         reasonable (the RPC call gas cap is typically 30M).
     */
    function batchCheckWhitelist(address[] calldata users)
        external
        view
        returns (bool[] memory statuses)
    {
        uint256 len = users.length;
        statuses = new bool[](len);
        for (uint256 i = 0; i < len; ++i) {
            statuses[i] = _whitelisted.contains(users[i]) && !_blacklisted.contains(users[i]);
        }
    }

    // ═════════════════════════════════════════════════════════════
    //                  STATISTICS & PAGINATION
    //              (view, unrestricted)
    // ═════════════════════════════════════════════════════════════

    struct WhitelistStats {
        uint256 totalWhitelisted;
        uint256 totalBlacklisted;
        uint256 totalAdmins;
        uint256 totalEverWhitelisted;
    }

    /// @notice All relevant counters in a single call.
    function getStats() external view returns (WhitelistStats memory) {
        return WhitelistStats({
            totalWhitelisted: _whitelisted.length(),
            totalBlacklisted: _blacklisted.length(),
            totalAdmins: _admins.length(),
            totalEverWhitelisted: _everWhitelisted.length()
        });
    }

    function whitelistedCount() external view returns (uint256) {
        return _whitelisted.length();
    }

    function blacklistedCount() external view returns (uint256) {
        return _blacklisted.length();
    }

    /**
     * @notice Paginated list of currently whitelisted addresses.
     * @dev    Order follows EnumerableSet internal ordering (insertion order
     *         with gaps closed after removals). Gas cost is O(limit).
     */
    function getWhitelistedPaginated(uint256 start, uint256 limit)
        external
        view
        returns (address[] memory users, uint256 total)
    {
        return _paginate(_whitelisted, start, limit);
    }

    /// @notice Paginated list of currently blacklisted addresses.
    function getBlacklistedPaginated(uint256 start, uint256 limit)
        external
        view
        returns (address[] memory users, uint256 total)
    {
        return _paginate(_blacklisted, start, limit);
    }

    /// @notice Paginated list of addresses that have ever been whitelisted.
    function getEverWhitelistedPaginated(uint256 start, uint256 limit)
        external
        view
        returns (address[] memory users, uint256 total)
    {
        return _paginate(_everWhitelisted, start, limit);
    }

    /// @dev Shared pagination helper. Reads from storage reference.
    function _paginate(
        EnumerableSet.AddressSet storage set,
        uint256 start,
        uint256 limit
    ) private view returns (address[] memory users, uint256 total) {
        total = set.length();
        if (start >= total) return (new address[](0), total);
        uint256 end = start + limit > total ? total : start + limit;
        uint256 n = end - start;
        users = new address[](n);
        for (uint256 i = 0; i < n; ++i) {
            users[i] = set.at(start + i);
        }
    }

    // ═════════════════════════════════════════════════════════════
    //           DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Overridden to prevent accidental ownership renunciation.
     * @dev    Ownerless whitelist would permanently freeze the blacklist
     *         and admin role management. Use `transferOwnership` instead.
     */
    function renounceOwnership() public pure override {
        revert NotAuthorized();
    }
}
