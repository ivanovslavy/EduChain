// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title MaliciousERC721
 * @notice TEST-ONLY. A fake ERC-721 that LIES about ownership and no-ops its
 *         transfers. It is NOT a real ERC721 — it only implements the two
 *         methods TokenMarketplace calls on a listed NFT contract:
 *
 *           createERC721Listing -> ownerOf(tokenId)  (must equal the lister)
 *                                -> transferFrom(lister, marketplace, id)  (no-op)
 *           purchaseListing      -> transferFrom(marketplace, buyer, id)   (no-op)
 *
 *         Attack: a whitelisted attacker lists a "token" that never actually
 *         enters escrow; a victim buys it, the marketplace pays the attacker
 *         first (CEI: seller paid before asset delivery), and the buyer receives
 *         nothing. Bait-and-switch / payment-for-nothing.
 */
contract MaliciousERC721 {
    address public fakeOwner;           // ownerOf() always returns this
    uint256 public transferFromCalls;   // observability for the test

    function setFakeOwner(address who) external { fakeOwner = who; }

    function ownerOf(uint256) external view returns (address) {
        return fakeOwner;
    }

    /// @dev Deliberately does nothing: the asset never moves.
    function transferFrom(address, address, uint256) external {
        transferFromCalls++;
    }

    // The marketplace uses plain transferFrom (not safeTransferFrom), so no
    // receiver hook is needed. These stubs exist only so tooling sees an
    // ERC721-ish surface.
    function approve(address, uint256) external {}
    function setApprovalForAll(address, bool) external {}
    function isApprovedForAll(address, address) external pure returns (bool) { return true; }
    function balanceOf(address) external pure returns (uint256) { return 1; }
    function supportsInterface(bytes4) external pure returns (bool) { return true; }
}
