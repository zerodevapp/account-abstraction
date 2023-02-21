// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UserOperation.sol";

interface IPlugin {
    function validatePluginData(        
        UserOperation calldata userOp,
        bytes32 userOpHash,
        address /*aggregator*/,
        uint256 missingAccountFunds
    ) external returns (bool);
}