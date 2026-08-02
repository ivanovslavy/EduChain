// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Whitelist} from "../contracts/Whitelist.sol";
import {GameToken} from "../contracts/GameToken.sol";

contract FuzzGameToken is Test {
    Whitelist wl;
    GameToken gt;
    address owner = address(this);
    address alice = address(0xA11CE);

    function setUp() public {
        wl = new Whitelist(owner);
        gt = new GameToken("Game", "GAME", address(wl), owner, 0.01 ether);
        wl.addToWhitelist(alice);
    }

    // A single in-limits buy always yields exactly n*1e18 and conserves supply.
    function testFuzz_buyWithinLimits(uint256 n, uint256 extra) public {
        n = bound(n, 1, gt.maxTokensPerPurchase());
        extra = bound(extra, 0, 5 ether);
        uint256 cost = n * gt.tokenPrice();
        vm.deal(alice, cost + extra);
        vm.prank(alice);
        gt.buyTokens{value: cost + extra}(n);
        assertEq(gt.balanceOf(alice), n * 1e18);
        // supply conservation
        assertEq(gt.totalTokensSold() * 1e18 + gt.balanceOf(address(gt)), gt.totalSupply());
    }

    // Underpayment always reverts, never mints.
    function testFuzz_underpayReverts(uint256 n, uint256 pay) public {
        n = bound(n, 1, gt.maxTokensPerPurchase());
        uint256 cost = n * gt.tokenPrice();
        pay = bound(pay, 0, cost - 1);
        vm.deal(alice, cost);
        vm.prank(alice);
        vm.expectRevert();
        gt.buyTokens{value: pay}(n);
        assertEq(gt.balanceOf(alice), 0);
    }

    // A non-whitelisted address can never buy, whatever it pays.
    function testFuzz_nonWhitelistedNeverBuys(address who, uint256 n) public {
        vm.assume(who != alice && who != address(0) && who != address(gt));
        n = bound(n, 1, gt.maxTokensPerPurchase());
        uint256 cost = n * gt.tokenPrice();
        vm.deal(who, cost);
        vm.prank(who);
        vm.expectRevert();
        gt.buyTokens{value: cost}(n);
    }
}
