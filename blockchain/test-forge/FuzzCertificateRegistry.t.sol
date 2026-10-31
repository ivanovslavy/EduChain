// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import {CertificateRegistry} from "../contracts/CertificateRegistry.sol";

/**
 * Property fuzzing for CertificateRegistry: thousands of random holders, hashes, scores, course ids
 * and callers, asserting the properties the Hardhat suite checks with hand-picked values.
 *
 * The properties, stated as sentences:
 *   1. only the issuer key can issue, whoever asks and however the arguments look;
 *   2. an accepted score is always 0..100, and what is read back is what was written;
 *   3. the same dataHash can never produce two serials;
 *   4. a certificate can never leave the address it was issued to;
 *   5. validCount is always issued-minus-revoked;
 *   6. isValid is false for every serial that was never issued.
 */
contract FuzzCertificateRegistry is Test {
    CertificateRegistry reg;
    address owner = address(0xA11CE);
    address issuer = address(0x15511E4);

    function setUp() public {
        reg = new CertificateRegistry(owner, issuer, "https://educhain.gembait.com/api/certificates/token/");
    }

    // 1 · only the issuer issues
    function testFuzz_onlyIssuerCanIssue(address caller, address holder, bytes32 h, uint16 course, uint16 score) public {
        vm.assume(caller != issuer);
        vm.assume(holder != address(0));
        vm.assume(h != bytes32(0));
        score = uint16(bound(score, 0, 100));
        vm.prank(caller);
        vm.expectRevert(CertificateRegistry.NotIssuer.selector);
        reg.issue(holder, h, course, score);
        assertEq(reg.totalIssued(), 0);
    }

    // 2 · the score is bounded and round-trips
    function testFuzz_scoreIsBoundedAndRoundTrips(address holder, bytes32 h, uint16 course, uint16 score) public {
        vm.assume(holder != address(0) && holder.code.length == 0);
        vm.assume(h != bytes32(0));
        vm.startPrank(issuer);
        if (score > 100) {
            vm.expectRevert(CertificateRegistry.ScoreOutOfRange.selector);
            reg.issue(holder, h, course, score);
            vm.stopPrank();
            return;
        }
        uint256 id = reg.issue(holder, h, course, score);
        vm.stopPrank();
        (address gotHolder, bytes32 gotHash,, uint16 gotCourse, uint16 gotScore, bool revoked,,) = reg.getCertificate(id);
        assertEq(gotHolder, holder);
        assertEq(gotHash, h);
        assertEq(gotCourse, course);
        assertEq(gotScore, score);
        assertFalse(revoked);
        assertTrue(reg.isValid(id));
    }

    // 3 · one hash, one serial, forever
    function testFuzz_hashIsUniqueForever(address a, address b, bytes32 h, uint16 score) public {
        vm.assume(a != address(0) && b != address(0));
        vm.assume(a.code.length == 0 && b.code.length == 0);
        vm.assume(h != bytes32(0));
        score = uint16(bound(score, 0, 100));
        vm.startPrank(issuer);
        uint256 first = reg.issue(a, h, 1, score);
        vm.expectRevert(abi.encodeWithSelector(CertificateRegistry.HashAlreadyIssued.selector, first));
        reg.issue(b, h, 1, score);
        vm.stopPrank();
        assertEq(reg.totalIssued(), 1);
        assertEq(reg.serialOfHash(h), first);
    }

    // 4 · soulbound against any caller and any destination
    function testFuzz_neverTransferable(address holder, address to, address caller, bytes32 h) public {
        vm.assume(holder != address(0) && to != address(0) && holder != to);
        vm.assume(holder.code.length == 0 && to.code.length == 0);
        vm.assume(h != bytes32(0));
        vm.prank(issuer);
        uint256 id = reg.issue(holder, h, 1, 90);
        vm.prank(caller);
        vm.expectRevert();
        reg.transferFrom(holder, to, id);
        assertEq(reg.ownerOf(id), holder);
    }

    // 5 · validCount is exactly issued minus revoked
    function testFuzz_validCountMatches(uint8 n, uint8 revokeEvery) public {
        n = uint8(bound(n, 1, 25));
        revokeEvery = uint8(bound(revokeEvery, 2, 6));
        for (uint256 i = 1; i <= n; i++) {
            vm.prank(issuer);
            reg.issue(address(uint160(0x1000 + i)), keccak256(abi.encode("f", i)), 1, 90);
        }
        uint256 revoked;
        for (uint256 i = 1; i <= n; i++) {
            if (i % revokeEvery == 0) {
                vm.prank(owner);
                reg.revoke(i, 1);
                revoked++;
            }
        }
        assertEq(reg.totalIssued(), n);
        assertEq(reg.validCount(), uint256(n) - revoked);
        uint256 counted;
        for (uint256 i = 1; i <= n; i++) if (reg.isValid(i)) counted++;
        assertEq(counted, uint256(n) - revoked);
    }

    // 6 · never-issued serials are never valid
    function testFuzz_unknownSerialIsNeverValid(uint256 id) public {
        vm.assume(id != 0);
        assertFalse(reg.isValid(id));
        vm.expectRevert(CertificateRegistry.UnknownCertificate.selector);
        reg.getCertificate(id);
    }

    // 7 · the issuer can never revoke, whatever the reason code
    function testFuzz_issuerCannotRevoke(uint8 reasonCode, bytes32 h) public {
        vm.assume(h != bytes32(0));
        vm.prank(issuer);
        uint256 id = reg.issue(address(0xBEEF), h, 1, 90);
        vm.prank(issuer);
        vm.expectRevert();
        reg.revoke(id, reasonCode);
        assertTrue(reg.isValid(id));
    }
}
