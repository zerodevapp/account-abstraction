// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import './UserOperation.sol';

interface IPlugin {
    function validateSignature(UserOperation calldata userOp, bytes32 userOpHash, address aggregator)
        external returns (uint256 deadline);
}