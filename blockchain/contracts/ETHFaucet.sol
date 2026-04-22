// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWhitelist {
    function checkWhitelist(address user) external view returns (bool);
}

/**
 * @title   ETHFaucet
 * @author  GEMBA IT — https://gembait.com
 * @notice  Rate-limited ETH dispenser for the EduChain ecosystem. Whitelisted
 *          users claim a fixed amount of ETH once per cooldown window. The
 *          faucet is funded by anyone (`fundFaucet` or direct send) and only
 *          the owner can withdraw.
 *
 * @dev     Design decisions:
 *           - Immutable whitelist via minimal interface keeps the contract tiny.
 *           - Per-user state is packed into one storage slot (lastClaim,
 *             totalClaimed, claimCount) for a cheap hot path.
 *           - Cooldown is configurable in seconds (not hours) for precision.
 *           - Grab amount is capped at 1 ETH at the contract level; owner
 *             cannot misconfigure a giveaway that drains the pool instantly.
 *           - `receive()` and `fallback()` accept funding from any address
 *             but emit an event so it's always traceable. No silent accrual.
 *           - `.call{value:}` everywhere (no `.transfer()`); survives gas
 *             repricing and smart-contract wallets.
 *           - CEI pattern + ReentrancyGuard on every state-changing action.
 */
contract ETHFaucet is Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────
    // Constants & immutables
    // ─────────────────────────────────────────────────────────────

    string public constant VERSION = "2.0.0";

    /// @notice Hard ceiling on per-claim amount; protects against owner misconfiguration.
    uint256 public constant MAX_CLAIM_AMOUNT = 1 ether;

    /// @notice Hard ceiling on cooldown — one week. Prevents indefinite lockout.
    uint256 public constant MAX_COOLDOWN = 7 days;

    /// @notice Canonical whitelist contract.
    IWhitelist public immutable whitelist;

    // ─────────────────────────────────────────────────────────────
    // Configurable parameters (owner-controlled)
    // ─────────────────────────────────────────────────────────────

    /// @notice ETH dispensed per claim (wei). Default 0.05 ETH.
    uint256 public claimAmount;

    /// @notice Minimum seconds between claims per user. Default 24 hours.
    uint256 public cooldown;

    // ─────────────────────────────────────────────────────────────
    // Per-user state (packed into one storage slot)
    // ─────────────────────────────────────────────────────────────

    struct UserInfo {
        uint64  lastClaim;      // Unix timestamp of last claim.
        uint64  claimCount;     // Total claims ever by this user.
        uint128 totalClaimed;   // Cumulative ETH claimed (wei).
    }
    mapping(address => UserInfo) private _userInfo;

    // ─────────────────────────────────────────────────────────────
    // Global statistics
    // ─────────────────────────────────────────────────────────────

    uint256 public totalDispensed;
    uint256 public totalClaims;
    uint256 public uniqueClaimers;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event Claimed(address indexed user, uint256 amount);
    event Funded(address indexed funder, uint256 amount);
    event ClaimAmountChanged(uint256 oldValue, uint256 newValue);
    event CooldownChanged(uint256 oldValue, uint256 newValue);
    event Withdrawn(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error NotWhitelisted(address user);
    error InsufficientFaucetBalance(uint256 requested, uint256 available);
    error CooldownActive(uint256 secondsRemaining);
    error ClaimAmountTooHigh(uint256 requested, uint256 max);
    error CooldownOutOfRange(uint256 requested, uint256 max);
    error TransferFailed();
    error NothingToWithdraw();
    error OwnershipNotRenounceable();

    // ─────────────────────────────────────────────────────────────
    // Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * @param whitelist_            Whitelist contract address.
     * @param initialOwner          Initial contract owner.
     * @param initialClaimAmount    ETH per claim (wei). Must be <= MAX_CLAIM_AMOUNT.
     * @param initialCooldown       Seconds between claims. Must be 1 <= x <= MAX_COOLDOWN.
     */
    constructor(
        address whitelist_,
        address initialOwner,
        uint256 initialClaimAmount,
        uint256 initialCooldown
    ) Ownable(initialOwner) {
        if (whitelist_ == address(0))   revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();
        if (initialClaimAmount == 0 || initialClaimAmount > MAX_CLAIM_AMOUNT) {
            revert ClaimAmountTooHigh(initialClaimAmount, MAX_CLAIM_AMOUNT);
        }
        if (initialCooldown == 0 || initialCooldown > MAX_COOLDOWN) {
            revert CooldownOutOfRange(initialCooldown, MAX_COOLDOWN);
        }

        whitelist   = IWhitelist(whitelist_);
        claimAmount = initialClaimAmount;
        cooldown    = initialCooldown;
    }

    // ═════════════════════════════════════════════════════════════
    //                          CLAIM
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Claim ETH from the faucet. Caller must be whitelisted and past
     *         their cooldown window.
     */
    function claim() external nonReentrant {
        if (!whitelist.checkWhitelist(msg.sender)) revert NotWhitelisted(msg.sender);

        UserInfo memory info = _userInfo[msg.sender];
        uint256 nextAllowed = uint256(info.lastClaim) + cooldown;
        if (block.timestamp < nextAllowed) {
            revert CooldownActive(nextAllowed - block.timestamp);
        }

        uint256 amount = claimAmount;
        uint256 bal = address(this).balance;
        if (bal < amount) revert InsufficientFaucetBalance(amount, bal);

        // Effects.
        bool firstEver = info.claimCount == 0;
        info.lastClaim     = uint64(block.timestamp);
        info.claimCount   += 1;
        info.totalClaimed  = uint128(uint256(info.totalClaimed) + amount);
        _userInfo[msg.sender] = info;

        totalDispensed += amount;
        totalClaims    += 1;
        if (firstEver) uniqueClaimers += 1;

        // Interaction.
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Claimed(msg.sender, amount);
    }

    // ═════════════════════════════════════════════════════════════
    //                        FUNDING
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Fund the faucet explicitly. Anyone may call.
     */
    function fundFaucet() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit Funded(msg.sender, msg.value);
    }

    /**
     * @notice Accept direct ETH transfers. Emits Funded for traceability.
     */
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @dev Fallback mirrors receive for compatibility with odd senders.
    fallback() external payable {
        emit Funded(msg.sender, msg.value);
    }

    // ═════════════════════════════════════════════════════════════
    //                      VIEW QUERIES
    // ═════════════════════════════════════════════════════════════

    struct UserClaimStats {
        uint256 lastClaim;
        uint256 claimCount;
        uint256 totalClaimed;
        bool    canClaimNow;
        uint256 secondsUntilNextClaim;
        uint256 nextClaimAmount;
    }

    /**
     * @notice Full per-user claim telemetry in one call.
     */
    function getUserClaimStats(address user) external view returns (UserClaimStats memory) {
        UserInfo memory info = _userInfo[user];
        uint256 nextAllowed = uint256(info.lastClaim) + cooldown;
        bool eligible =
            whitelist.checkWhitelist(user) &&
            block.timestamp >= nextAllowed &&
            address(this).balance >= claimAmount;

        return UserClaimStats({
            lastClaim:              info.lastClaim,
            claimCount:             info.claimCount,
            totalClaimed:           info.totalClaimed,
            canClaimNow:            eligible,
            secondsUntilNextClaim:  block.timestamp >= nextAllowed ? 0 : nextAllowed - block.timestamp,
            nextClaimAmount:        claimAmount
        });
    }

    /**
     * @notice Can the user claim right now? Returns a reason code for UI routing.
     * @return ok    True if a claim would succeed.
     * @return code  0 ok | 1 not whitelisted | 2 cooldown active | 3 insufficient faucet balance.
     */
    function canUserClaim(address user) external view returns (bool ok, uint256 code) {
        if (!whitelist.checkWhitelist(user)) return (false, 1);
        uint256 nextAllowed = uint256(_userInfo[user].lastClaim) + cooldown;
        if (block.timestamp < nextAllowed) return (false, 2);
        if (address(this).balance < claimAmount) return (false, 3);
        return (true, 0);
    }

    struct FaucetStats {
        uint256 balance;
        uint256 claimAmount;
        uint256 cooldown;
        uint256 totalDispensed;
        uint256 totalClaims;
        uint256 uniqueClaimers;
        uint256 maxPossibleClaims;  // balance / claimAmount
    }

    /// @notice Aggregate faucet telemetry.
    function getFaucetStats() external view returns (FaucetStats memory) {
        uint256 bal = address(this).balance;
        return FaucetStats({
            balance:           bal,
            claimAmount:       claimAmount,
            cooldown:          cooldown,
            totalDispensed:    totalDispensed,
            totalClaims:       totalClaims,
            uniqueClaimers:    uniqueClaimers,
            maxPossibleClaims: claimAmount == 0 ? 0 : bal / claimAmount
        });
    }

    /// @notice Current ETH balance of the faucet.
    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Batch eligibility check for multiple addresses.
     * @dev    Useful for teacher dashboards that monitor a whole classroom at once.
     */
    function batchCanClaim(address[] calldata users)
        external
        view
        returns (bool[] memory eligibilities, uint256[] memory secondsUntilNext)
    {
        uint256 len = users.length;
        eligibilities = new bool[](len);
        secondsUntilNext = new uint256[](len);

        uint256 currentBalance = address(this).balance;
        uint256 required = claimAmount;

        for (uint256 i = 0; i < len; ++i) {
            if (!whitelist.checkWhitelist(users[i])) {
                continue; // false, 0
            }
            uint256 nextAllowed = uint256(_userInfo[users[i]].lastClaim) + cooldown;
            if (block.timestamp < nextAllowed) {
                secondsUntilNext[i] = nextAllowed - block.timestamp;
                continue;
            }
            if (currentBalance < required) {
                continue;
            }
            eligibilities[i] = true;
        }
    }

    // ═════════════════════════════════════════════════════════════
    //                    OWNER: configuration
    // ═════════════════════════════════════════════════════════════

    function setClaimAmount(uint256 newAmount) external onlyOwner {
        if (newAmount == 0 || newAmount > MAX_CLAIM_AMOUNT) {
            revert ClaimAmountTooHigh(newAmount, MAX_CLAIM_AMOUNT);
        }
        emit ClaimAmountChanged(claimAmount, newAmount);
        claimAmount = newAmount;
    }

    function setCooldown(uint256 newCooldown) external onlyOwner {
        if (newCooldown == 0 || newCooldown > MAX_COOLDOWN) {
            revert CooldownOutOfRange(newCooldown, MAX_COOLDOWN);
        }
        emit CooldownChanged(cooldown, newCooldown);
        cooldown = newCooldown;
    }

    // ═════════════════════════════════════════════════════════════
    //                       OWNER: funds
    // ═════════════════════════════════════════════════════════════

    /// @notice Withdraw a specific amount of ETH to an arbitrary address.
    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 bal = address(this).balance;
        if (amount > bal) revert InsufficientFaucetBalance(amount, bal);

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(to, amount);
    }

    /// @notice Drain the entire faucet to the owner. Emergency exit.
    function emergencyWithdrawAll() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToWithdraw();

        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(owner(), bal);
    }

    // ═════════════════════════════════════════════════════════════
    //              DISABLED — renounceOwnership
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Prevent accidental ownership renunciation.
     * @dev    An ownerless faucet would strand ETH proceeds forever and lock
     *         out claim amount / cooldown adjustments.
     */
    function renounceOwnership() public pure override {
        revert OwnershipNotRenounceable();
    }
}
