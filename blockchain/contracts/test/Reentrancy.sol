// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ─────────────────────────────────────────────────────────────────────────────
// TEST-ONLY reentrancy + griefing attackers for the EduChain audit suite.
// Each targets a specific value-moving path. All expect to be DEFEATED
// (ReentrancyGuard + CEI); the tests assert the attack reverts / cannot double-spend.
// ─────────────────────────────────────────────────────────────────────────────

interface IMarketplace {
    function createERC20Listing(address token, uint256 amount, uint256 price, address allowedBuyer) external returns (uint256);
    function purchaseListing(uint256 listingId) external payable;
    function cancelListing(uint256 listingId) external;
}

interface IFaucet {
    function claim() external;
}

interface IERC20Min {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

interface INFTCustom {
    function mintWithTokens(address to, uint256 quantity, string calldata uri) external;
}

/**
 * @notice Whitelisted seller that re-enters the marketplace when paid.
 *         Lists an ERC-20, and on receiving the sale ETH tries to re-enter
 *         purchaseListing / cancelListing on the same id. Must be defeated by
 *         nonReentrant + `isActive=false` set before the payout call.
 */
contract ReentrantSeller {
    IMarketplace public immutable mkt;
    uint256 public targetId;
    uint8   public mode;        // 0 off | 1 re-purchase | 2 re-cancel
    uint256 public reenterAttempts;
    bool    public reenterReverted;

    constructor(address mkt_) { mkt = IMarketplace(mkt_); }

    function list(address token, uint256 amount, uint256 price) external returns (uint256 id) {
        IERC20Min(token).approve(address(mkt), type(uint256).max);
        id = mkt.createERC20Listing(token, amount, price, address(0));
        targetId = id;
    }

    function arm(uint8 m) external { mode = m; }

    receive() external payable {
        if (mode == 0) return;
        reenterAttempts++;
        if (mode == 1) {
            try mkt.purchaseListing{value: msg.value}(targetId) { }
            catch { reenterReverted = true; }
        } else if (mode == 2) {
            try mkt.cancelListing(targetId) { }
            catch { reenterReverted = true; }
        }
    }
}

/**
 * @notice Whitelisted buyer that overpays and re-enters on the overpay refund.
 *         purchaseListing refunds the overpay via msg.sender.call — this contract
 *         re-enters purchaseListing on that callback. Must be defeated.
 */
contract ReentrantBuyer {
    IMarketplace public immutable mkt;
    uint256 public targetId;
    bool    public armed;
    uint256 public reenterAttempts;
    bool    public reenterReverted;

    constructor(address mkt_) payable { mkt = IMarketplace(mkt_); }

    function buy(uint256 id, uint256 price, uint256 overpay) external {
        targetId = id;
        armed = true;
        mkt.purchaseListing{value: price + overpay}(id);
    }

    receive() external payable {
        if (!armed) return;
        armed = false; // one shot
        reenterAttempts++;
        try mkt.purchaseListing{value: msg.value}(targetId) { }
        catch { reenterReverted = true; }
    }

    function fund() external payable {}
}

/**
 * @notice Whitelisted faucet claimer that re-enters claim() on payout.
 *         Must be defeated by nonReentrant + cooldown written before the send.
 */
contract ReentrantClaimer {
    IFaucet public immutable faucet;
    bool    public armed;
    uint256 public reenterAttempts;
    bool    public reenterReverted;
    uint256 public received;

    constructor(address faucet_) { faucet = IFaucet(faucet_); }

    function arm() external { armed = true; }
    function go() external { faucet.claim(); }

    receive() external payable {
        received += msg.value;
        if (!armed) return;
        armed = false;
        reenterAttempts++;
        try faucet.claim() { }
        catch { reenterReverted = true; }
    }
}

/**
 * @notice A contract that REJECTS all incoming ETH. Used to grief payout/refund
 *         paths: a rejecting seller (marketplace payout), a rejecting buyer
 *         (overpay refund), a rejecting faucet claimer (claim send). Confirms the
 *         contracts fail closed (revert) rather than losing/locking funds silently.
 */
contract RejectingReceiver {
    IMarketplace public mkt;
    IFaucet public faucet;

    function setMkt(address m) external { mkt = IMarketplace(m); }
    function setFaucet(address f) external { faucet = IFaucet(f); }

    function listERC20(address token, uint256 amount, uint256 price) external returns (uint256) {
        IERC20Min(token).approve(address(mkt), type(uint256).max);
        return mkt.createERC20Listing(token, amount, price, address(0));
    }

    function claim() external { faucet.claim(); }

    // No receive()/fallback that accepts ETH → any incoming transfer reverts.
    receive() external payable { revert("no ETH"); }
}

/**
 * @notice ERC-20 whose transferFrom re-enters GameNFTCustom.mintWithTokens.
 *         GameNFTCustom pulls payment LAST (interactions), after _mint. This
 *         probes whether that ordering + nonReentrant is exploitable. `_mint`
 *         (not `_safeMint`) fires no receiver hook, and nonReentrant blocks the
 *         re-entry — the test asserts the nested mint reverts.
 */
contract ReentrantERC20 {
    string public name = "ReentrantERC20";
    string public symbol = "REN";
    uint8  public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    INFTCustom public target;
    address public reenterTo;
    string  public reenterUri;
    bool    public armed;
    uint256 public reenterAttempts;
    bool    public reenterReverted;

    function mint(address to, uint256 amt) external { balanceOf[to] += amt; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; return true; }
    function transfer(address to, uint256 v) external returns (bool) { _move(msg.sender, to, v); return true; }

    function configure(address nft, address to, string calldata uri) external {
        target = INFTCustom(nft); reenterTo = to; reenterUri = uri;
    }
    function arm() external { armed = true; }

    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        // Reenter BEFORE moving funds, mid-interaction of the outer mint.
        if (armed) {
            armed = false;
            reenterAttempts++;
            try target.mintWithTokens(reenterTo, 1, reenterUri) { }
            catch { reenterReverted = true; }
        }
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) { require(a >= v, "allowance"); allowance[from][msg.sender] = a - v; }
        _move(from, to, v);
        return true;
    }

    function _move(address from, address to, uint256 v) private {
        require(balanceOf[from] >= v, "balance");
        balanceOf[from] -= v; balanceOf[to] += v;
    }
}
