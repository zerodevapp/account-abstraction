//SPDX-License-Identifier: GPL
pragma solidity ^0.8.7;

/* solhint-disable no-inline-assembly */

import "@gnosis.pm/safe-contracts/contracts/handler/DefaultCallbackHandler.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "../interfaces/IAccount.sol";
import "./EIP4337Manager.sol";

    using ECDSA for bytes32;

contract EIP4337PluginFallback is DefaultCallbackHandler, IAccount, IERC1271 {
    address immutable public defaultEIP4337Manager;
    constructor(address _eip4337manager) {
        defaultEIP4337Manager = _eip4337manager;
    }

    /**
     * delegate the contract call to the EIP4337Manager
     */
    function delegateToManager() internal returns (bytes memory) {
        // delegate entire msg.data (including the appended "msg.sender") to the EIP4337Manager
        // will work only for GnosisSafe contracts
        GnosisSafe safe = GnosisSafe(payable(msg.sender));
        (bool success, bytes memory ret) = safe.execTransactionFromModuleReturnData(defaultEIP4337Manager, 0, msg.data, Enum.Operation.DelegateCall);
        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    /**
     * delegate the contract call to the plugin
     */
    function delegateToPlugin(address plugin) internal returns (bytes memory) {
        // delegate entire msg.data (including the appended "msg.sender") to the EIP4337Manager
        // will work only for GnosisSafe contracts
        GnosisSafe safe = GnosisSafe(payable(msg.sender));
        (bool success, bytes memory ret) = safe.execTransactionFromModuleReturnData(plugin, 0, msg.data, Enum.Operation.DelegateCall);
        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    /**
     * called from the Safe. delegate actual work to EIP4337Manager
     */
    function validateUserOp(UserOperation calldata userOp, bytes32, address, uint256) override external returns (uint256 deadline){
        if(userOp.signature.length == 65){
            bytes memory ret = delegateToManager();
            return abi.decode(ret, (uint256));
        } if(userOp.signature.length > 85){ // address + signature + data
            (address plugin, bytes memory signature) = abi.decode(userOp.signature, (address, bytes));
            bytes32 hashWithPlugin = keccak256(abi.encodePacked(UserOperationLib.hash(userOp), plugin));
            require(IERC1271(msg.sender).isValidSignature(hashWithPlugin, signature) == 0x1626ba7e, "Invalid signature");
            bytes memory ret = delegateToPlugin(plugin);
            return abi.decode(ret, (uint256));
        } else {
            revert("Invalid signature");
        }
    }

    /**
     * called from the Safe. delegate actual work to EIP4337Manager
     */
    function executeAndRevert(
        address,
        uint256,
        bytes memory,
        Enum.Operation
    ) external {
        delegateToManager();
    }

    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) external override view returns (bytes4) {
        bytes32 hash = _hash.toEthSignedMessageHash();
        address recovered = hash.recover(_signature);

        GnosisSafe safe = GnosisSafe(payable(address(msg.sender)));

        // Validate signatures
        if (safe.isOwner(recovered)) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }
}
