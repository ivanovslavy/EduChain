// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title CertificateRegistry
 * @notice EduChain course certificates: a soulbound ERC-721 plus a public registry that anybody can
 *         check without asking us anything.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS ON-CHAIN, AND WHAT IS DELIBERATELY NOT
 *
 * On-chain: the holder's address, a 32-byte hash of the certificate's contents, the date, the score,
 * and whether it has been revoked. That is all.
 *
 * NOT on-chain: the name, the e-mail, the position, the organisation — no personal data of any kind.
 * A public blockchain is permanent and world-readable, so a name written into it can never be
 * corrected, hidden or erased, and GDPR's right to erasure would be impossible to honour. The hash
 * is enough for the only thing the chain is needed for: proving that a certificate presented to you
 * is byte-for-byte the one that was issued. The readable fields live in EduChain's database and on
 * the PDF, where they can be corrected and deleted.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY SOULBOUND
 *
 * A diploma that can be sold does not certify anything. Transfers and approvals are refused at the
 * contract level: once minted, a certificate stays at the address it was issued to.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * ROLES — SEPARATED ON PURPOSE
 *
 *   owner   — the cold deployer key. Appoints the issuer, revokes certificates, sets the base URI.
 *   issuer  — a HOT key that lives on the EduChain server and may do exactly ONE thing: issue().
 *             It cannot revoke, cannot change roles, cannot touch the base URI. If the server is
 *             compromised the damage is bounded to issuing certificates nobody earned — visible in
 *             the event log and revocable by the owner.
 *
 * There are no payable functions and no external calls anywhere in this contract: `_mint` is used
 * rather than `_safeMint` precisely so that minting cannot call out to a recipient contract. With no
 * value and no calls out, there is no reentrancy surface at all.
 */
contract CertificateRegistry is ERC721, Ownable {
    // ─── Types ────────────────────────────────────────────────────────────────────────────────────

    struct Certificate {
        bytes32 dataHash;   // keccak256 of the certificate's readable contents (see hashOf off-chain)
        uint64 issuedAt;    // block timestamp of issuing
        uint64 revokedAt;   // 0 while valid
        uint16 scorePct;    // 0..100, the score the certificate was earned with
        uint8 reasonCode;   // revocation reason CODE (never free text — no personal data on-chain)
        uint16 courseId;    // which course/exam this certificate is for
    }

    // ─── Storage ──────────────────────────────────────────────────────────────────────────────────

    /// @notice tokenId => certificate record. tokenId IS the serial number printed on the PDF.
    mapping(uint256 => Certificate) private _certs;

    /// @notice dataHash => tokenId. Makes the same certificate impossible to issue twice.
    mapping(bytes32 => uint256) public tokenOfHash;

    /// @notice The hot key allowed to issue. Address zero means issuing is switched off.
    address public issuer;

    /// @notice Where tokenURI points. Owner-settable so a domain change does not orphan the tokens.
    string private _base;

    /// @notice Last issued serial. Serials start at 1 and only ever go up.
    uint256 public lastSerial;

    /// @notice How many certificates are currently valid (issued minus revoked).
    uint256 public validCount;

    // ─── Events ───────────────────────────────────────────────────────────────────────────────────

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed holder,
        bytes32 indexed dataHash,
        uint16 courseId,
        uint16 scorePct,
        uint64 issuedAt
    );
    event CertificateRevoked(uint256 indexed tokenId, uint8 reasonCode, uint64 revokedAt);
    event CertificateReinstated(uint256 indexed tokenId, uint64 at);
    event IssuerChanged(address indexed previousIssuer, address indexed newIssuer);
    event BaseURIChanged(string newBaseURI);

    // ─── Errors ───────────────────────────────────────────────────────────────────────────────────

    error NotIssuer();
    error SoulboundNonTransferable();
    error ZeroHolder();
    error ZeroHash();
    error HashAlreadyIssued(uint256 tokenId);
    error ScoreOutOfRange();
    error UnknownCertificate();
    error AlreadyRevoked();
    error NotRevoked();
    error ReasonRequired();

    // ─── Construction ─────────────────────────────────────────────────────────────────────────────

    /**
     * @param initialOwner the cold key that governs the contract
     * @param initialIssuer the hot key allowed to issue (may be address(0) to start switched off)
     * @param baseURI_ prefix for tokenURI, e.g. "https://educhain.gembait.com/api/certificates/token/"
     */
    constructor(address initialOwner, address initialIssuer, string memory baseURI_)
        ERC721("EduChain Certificate", "EDUCERT")
        Ownable(initialOwner)
    {
        issuer = initialIssuer;
        _base = baseURI_;
        emit IssuerChanged(address(0), initialIssuer);
        emit BaseURIChanged(baseURI_);
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────────────────────────

    modifier onlyIssuer() {
        // The owner is NOT silently allowed to issue: the two roles are separate so that the event
        // log tells the truth about which key acted. The owner can appoint itself if it ever needs to.
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    // ─── Issuing ──────────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Issue one certificate. Only the issuer key, and only once per dataHash.
     * @param holder the learner's address — the certificate is bound to it forever
     * @param dataHash keccak256 over the certificate's readable contents, computed off-chain
     * @param courseId which exam this is for
     * @param scorePct the score, 0..100
     * @return tokenId the serial number
     */
    function issue(address holder, bytes32 dataHash, uint16 courseId, uint16 scorePct)
        external
        onlyIssuer
        returns (uint256 tokenId)
    {
        if (holder == address(0)) revert ZeroHolder();
        if (dataHash == bytes32(0)) revert ZeroHash();
        if (scorePct > 100) revert ScoreOutOfRange();
        uint256 existing = tokenOfHash[dataHash];
        if (existing != 0) revert HashAlreadyIssued(existing);

        tokenId = ++lastSerial;
        uint64 now64 = uint64(block.timestamp);

        _certs[tokenId] = Certificate({
            dataHash: dataHash,
            issuedAt: now64,
            revokedAt: 0,
            scorePct: scorePct,
            reasonCode: 0,
            courseId: courseId
        });
        tokenOfHash[dataHash] = tokenId;
        validCount += 1;

        // `_mint`, not `_safeMint`: no call out to the recipient, so no reentrancy and no way for a
        // contract recipient to make issuing fail.
        _mint(holder, tokenId);

        emit CertificateIssued(tokenId, holder, dataHash, courseId, scorePct, now64);
    }

    // ─── Revocation (owner only) ──────────────────────────────────────────────────────────────────

    /**
     * @notice Mark a certificate invalid. Owner only.
     * @param tokenId the serial
     * @param reasonCode a non-zero CODE from the published list (1 = issued in error, 2 = integrity
     *        breach during the exam, 3 = withdrawn at the holder's request, 4 = data correction,
     *        255 = other). Free text stays off-chain in the audit log — a reason typed into a public
     *        chain could never be corrected or erased.
     */
    function revoke(uint256 tokenId, uint8 reasonCode) external onlyOwner {
        Certificate storage c = _certs[tokenId];
        if (c.issuedAt == 0) revert UnknownCertificate();
        if (c.revokedAt != 0) revert AlreadyRevoked();
        if (reasonCode == 0) revert ReasonRequired();

        c.revokedAt = uint64(block.timestamp);
        c.reasonCode = reasonCode;
        validCount -= 1;

        emit CertificateRevoked(tokenId, reasonCode, c.revokedAt);
    }

    /**
     * @notice Undo a revocation. Owner only.
     * @dev Refusing to correct an administrative mistake is worse than allowing the correction: both
     *      events stay in the log forever, so nothing is hidden by reinstating.
     */
    function reinstate(uint256 tokenId) external onlyOwner {
        Certificate storage c = _certs[tokenId];
        if (c.issuedAt == 0) revert UnknownCertificate();
        if (c.revokedAt == 0) revert NotRevoked();

        c.revokedAt = 0;
        c.reasonCode = 0;
        validCount += 1;

        emit CertificateReinstated(tokenId, uint64(block.timestamp));
    }

    // ─── Administration ───────────────────────────────────────────────────────────────────────────

    /// @notice Appoint (or, with address(0), switch off) the hot issuing key.
    function setIssuer(address newIssuer) external onlyOwner {
        address previous = issuer;
        issuer = newIssuer;
        emit IssuerChanged(previous, newIssuer);
    }

    /// @notice Change where tokenURI points.
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _base = baseURI_;
        emit BaseURIChanged(baseURI_);
    }

    // ─── Views ────────────────────────────────────────────────────────────────────────────────────

    /// @notice Everything the chain knows about one certificate. Reverts for an unknown serial.
    function getCertificate(uint256 tokenId)
        external
        view
        returns (
            address holder,
            bytes32 dataHash,
            uint64 issuedAt,
            uint16 courseId,
            uint16 scorePct,
            bool revoked,
            uint8 reasonCode,
            uint64 revokedAt
        )
    {
        Certificate storage c = _certs[tokenId];
        if (c.issuedAt == 0) revert UnknownCertificate();
        return (
            _ownerOf(tokenId),
            c.dataHash,
            c.issuedAt,
            c.courseId,
            c.scorePct,
            c.revokedAt != 0,
            c.reasonCode,
            c.revokedAt
        );
    }

    /// @notice The one question a verifier asks. False for unknown and for revoked serials alike.
    function isValid(uint256 tokenId) external view returns (bool) {
        Certificate storage c = _certs[tokenId];
        return c.issuedAt != 0 && c.revokedAt == 0;
    }

    /// @notice Does this exact certificate content exist, and under which serial? 0 = no.
    function serialOfHash(bytes32 dataHash) external view returns (uint256) {
        return tokenOfHash[dataHash];
    }

    /// @notice Total certificates ever issued (revoked ones included).
    function totalIssued() external view returns (uint256) {
        return lastSerial;
    }

    function baseURI() external view returns (string memory) {
        return _base;
    }

    // ─── ERC-721 overrides ────────────────────────────────────────────────────────────────────────

    // `_baseURI()` is deliberately NOT overridden: `tokenURI` below is overridden directly, so an
    // override of `_baseURI` would be code that nothing calls (Slither's dead-code finding, 2026-10-31).
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory b = _base;
        return bytes(b).length == 0 ? "" : string.concat(b, Strings.toString(tokenId));
    }

    /**
     * @dev Soulbound. Minting (from == 0) is allowed; every transfer is refused, and so is burning —
     *      a certificate that the holder could burn would make the registry disagree with itself.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert SoulboundNonTransferable();
        return super._update(to, tokenId, auth);
    }

    /// @dev An approval that can never be used is a lie in the interface; refuse it instead.
    function approve(address, uint256) public pure override {
        revert SoulboundNonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundNonTransferable();
    }
}
