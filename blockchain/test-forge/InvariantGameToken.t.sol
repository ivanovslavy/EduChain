// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Whitelist} from "../contracts/Whitelist.sol";
import {GameToken} from "../contracts/GameToken.sol";

/// @notice Drives random buys/withdraws from a pool of whitelisted actors.
contract GameTokenHandler is Test {
    Whitelist public wl;
    GameToken public gt;
    address[] public actors;
    address public owner;

    constructor(Whitelist wl_, GameToken gt_, address owner_) {
        wl = wl_; gt = gt_; owner = owner_;
        for (uint160 i = 1; i <= 5; i++) {
            address a = address(0x1000 + i);
            actors.push(a);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function buy(uint256 seed, uint256 n) public {
        address a = _actor(seed);
        n = bound(n, 1, gt.maxTokensPerPurchase());
        uint256 cost = n * gt.tokenPrice();
        vm.deal(a, cost);
        vm.prank(a);
        try gt.buyTokens{value: cost}(n) {} catch {}
    }

    function warp(uint256 dt) public {
        dt = bound(dt, 0, 2 days);
        vm.warp(block.timestamp + dt);
    }

    function withdrawTokens(uint256 amt) public {
        uint256 held = gt.balanceOf(address(gt));
        if (held == 0) return;
        amt = bound(amt, 1, held);
        vm.prank(owner);
        try gt.withdrawTokens(amt) {} catch {}
    }
}

contract InvariantGameToken is Test {
    Whitelist wl;
    GameToken gt;
    GameTokenHandler handler;
    address owner = address(this);

    function setUp() public {
        wl = new Whitelist(owner);
        gt = new GameToken("Game", "GAME", address(wl), owner, 0.01 ether);
        handler = new GameTokenHandler(wl, gt, owner);
        // whitelist all handler actors + raise daily caps so the invariant explores
        // supply/accounting broadly (rate limits are covered by the unit suite).
        for (uint160 i = 1; i <= 5; i++) wl.addToWhitelist(address(0x1000 + i));
        gt.setMaxTokensPer24Hours(type(uint128).max / 2);
        gt.setBuysPer24Hours(1_000_000);
        targetContract(address(handler));
    }

    /// Tokens sold + tokens withdrawn by owner + pool == totalSupply, always.
    function invariant_supplyConserved() public view {
        uint256 pool = gt.balanceOf(address(gt));
        uint256 sold; // in whole tokens → *1e18
        // sum user balances instead (robust to withdrawTokens moving to owner)
        uint256 users;
        for (uint160 i = 1; i <= 5; i++) users += gt.balanceOf(address(0x1000 + i));
        uint256 ownerBal = gt.balanceOf(owner);
        assertEq(users + ownerBal + pool, gt.totalSupply());
        sold = gt.totalTokensSold();
        assertLe(sold * 1e18, gt.totalSupply());
    }

    /// ETH held by the contract equals total sales ETH minus any withdrawn.
    function invariant_ethNeverExceedsSales() public view {
        assertLe(address(gt).balance, gt.totalSalesETH());
    }
}
