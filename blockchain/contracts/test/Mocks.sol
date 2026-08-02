// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ─────────────────────────────────────────────────────────────────────────────
// TEST-ONLY helper contracts for the EduChain audit suite.
// NEVER deployed by scripts/deploy.js. Live under contracts/test/ so Hardhat +
// Foundry compile them; they are excluded from any production deployment.
// ─────────────────────────────────────────────────────────────────────────────

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Plain, well-behaved ERC-20 used for marketplace happy-path listings.
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @notice Plain, well-behaved ERC-721 used for marketplace happy-path listings.
contract MockERC721 is ERC721 {
    uint256 public nextId;
    constructor() ERC721("MockNFT", "MNFT") {}
    function mint(address to) external returns (uint256 id) {
        id = nextId++;
        _mint(to, id);
    }
}
