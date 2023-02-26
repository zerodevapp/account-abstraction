// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../../utils/BytesLib.sol";
import "./IPolicy.sol";
import "../../ZeroDevPluginSafe.sol";

using BytesLib for bytes;
contract FunctionSignaturePolicy is IPolicy {
    struct Policy {
        address to;
        bytes4 sig;
    }

    mapping(address => mapping(bytes4 => bool)) public policies;

    constructor(Policy[] memory _policies) {
        for(uint256 i = 0; i < _policies.length; i++) {
            policies[_policies[i].to][_policies[i].sig] = true;
        }
    }

    // we are not going to allow Delegation call and value > 0
    function executeAndRevert(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external view override returns (bool)
    {
        if(
         value > 0 ||
            operation != Enum.Operation.Call
        ) {
            return false;
        }
        bytes4 selector = bytes4(data[0:4]);
        return policies[to][selector];
    }
}