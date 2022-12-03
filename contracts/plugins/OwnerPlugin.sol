// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import '../interfaces/IPlugin.sol';
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// This plugin effective adds another owner to an account
contract OwnerPlugin is IPlugin {
    using ECDSA for bytes32;

    address public owner;

    function validateSignature(UserOperation calldata /*userOp*/, bytes32 userOpHash, bytes calldata pluginSig, address /*aggregator*/)
        external view returns (uint256 deadline) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();

        //ignore signature mismatch of from==ZERO_ADDRESS (for eth_callUserOp validation purposes)
        // solhint-disable-next-line avoid-tx-origin
        require(owner == hash.recover(pluginSig) || tx.origin == address(0), "account: wrong signature");
        return 0;
    }
}