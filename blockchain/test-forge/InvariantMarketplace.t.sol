// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Whitelist} from "../contracts/Whitelist.sol";
import {TokenMarketplace} from "../contracts/TokenMarketplace.sol";
import {MockERC721} from "../contracts/test/Mocks.sol";

/// @notice Random list/purchase/cancel of ERC-721s by whitelisted actors.
contract MarketHandler is Test {
    Whitelist public wl;
    TokenMarketplace public mkt;
    MockERC721 public nft;
    address[] public actors;

    constructor(Whitelist wl_, TokenMarketplace mkt_, MockERC721 nft_) {
        wl = wl_; mkt = mkt_; nft = nft_;
        for (uint160 i = 1; i <= 4; i++) actors.push(address(0x2000 + i));
    }

    function _actor(uint256 s) internal view returns (address) { return actors[s % actors.length]; }

    function list(uint256 seed, uint256 price) public {
        address a = _actor(seed);
        price = bound(price, 1, 10 ether);
        uint256 id = nft.mint(a);
        vm.startPrank(a);
        nft.approve(address(mkt), id);
        try mkt.createERC721Listing(address(nft), id, price, address(0)) {} catch {}
        vm.stopPrank();
    }

    function purchase(uint256 seed) public {
        uint256 count = mkt.activeListingsCount();
        if (count == 0) return;
        (uint256[] memory ids,) = mkt.getActiveListingIds(0, count > 100 ? 100 : count);
        if (ids.length == 0) return;
        uint256 lid = ids[seed % ids.length];
        (address seller,,,, uint256 price,,, bool active,) = mkt.listings(lid);
        if (!active) return;
        address buyer = _actor(seed + 1);
        if (buyer == seller) buyer = _actor(seed + 2);
        vm.deal(buyer, price);
        vm.prank(buyer);
        try mkt.purchaseListing{value: price}(lid) {} catch {}
    }

    function cancel(uint256 seed) public {
        uint256 count = mkt.activeListingsCount();
        if (count == 0) return;
        (uint256[] memory ids,) = mkt.getActiveListingIds(0, count > 100 ? 100 : count);
        if (ids.length == 0) return;
        uint256 lid = ids[seed % ids.length];
        (address seller,,,,,,, bool active,) = mkt.listings(lid);
        if (!active) return;
        vm.prank(seller);
        try mkt.cancelListing(lid) {} catch {}
    }

    function warp(uint256 dt) public { vm.warp(block.timestamp + bound(dt, 0, 2 days)); }
}

contract InvariantMarketplace is Test {
    Whitelist wl;
    TokenMarketplace mkt;
    MockERC721 nft;
    MarketHandler handler;
    address owner = address(this);

    function setUp() public {
        wl = new Whitelist(owner);
        mkt = new TokenMarketplace(address(wl), owner);
        nft = new MockERC721();
        handler = new MarketHandler(wl, mkt, nft);
        for (uint160 i = 1; i <= 4; i++) wl.addToWhitelist(address(0x2000 + i));
        mkt.setListingsPerDayLimit(1_000_000);
        mkt.setPurchasesPerDayLimit(1_000_000);
        targetContract(address(handler));
    }

    /// Every ACTIVE ERC-721 listing's token must actually sit in marketplace escrow.
    function invariant_activeListingsAreEscrowed() public view {
        uint256 count = mkt.activeListingsCount();
        if (count == 0) return;
        (uint256[] memory ids,) = mkt.getActiveListingIds(0, count > 200 ? 200 : count);
        for (uint256 i = 0; i < ids.length; i++) {
            (, address tokenContract, uint256 tokenId,,,, TokenMarketplace.TokenType tt, bool active,) = mkt.listings(ids[i]);
            if (active && tt == TokenMarketplace.TokenType.ERC721) {
                assertEq(nft.ownerOf(tokenId), address(mkt), "active listing not escrowed");
            }
            tokenContract; // silence
        }
    }

    /// The marketplace never holds ETH between transactions (it forwards immediately).
    function invariant_noTrappedEth() public view {
        assertEq(address(mkt).balance, 0);
    }
}
