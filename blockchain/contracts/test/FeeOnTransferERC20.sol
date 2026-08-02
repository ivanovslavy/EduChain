// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FeeOnTransferERC20
 * @notice TEST-ONLY. A token that skims a fee on every non-mint/non-burn
 *         transfer, so `balanceOf(recipient)` after a transfer is LESS than the
 *         amount sent. Models USDT-style / deflationary tokens.
 *
 *         Attack target: TokenMarketplace.createERC20Listing records the
 *         REQUESTED `amount`, not the amount actually received into escrow. All
 *         active listings for the same token share one pooled balance, so a
 *         fee-on-transfer token lets an earlier buyer be paid out of a later
 *         seller's escrow — the last seller/buyer is left short (drain).
 */
contract FeeOnTransferERC20 is ERC20 {
    uint256 public feeBps;          // e.g. 500 = 5%
    address public constant SINK = address(0xdEaD);

    constructor(uint256 feeBps_) ERC20("FeeToken", "FEE") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setFeeBps(uint256 f) external { feeBps = f; }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && feeBps > 0) {
            uint256 fee = (value * feeBps) / 10_000;
            super._update(from, to, value - fee);
            if (fee > 0) super._update(from, SINK, fee);
        } else {
            super._update(from, to, value);
        }
    }
}
