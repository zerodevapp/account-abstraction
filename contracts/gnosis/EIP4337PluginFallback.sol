//SPDX-License-Identifier: GPL
pragma solidity ^0.8.7;

/* solhint-disable no-inline-assembly */

import "@gnosis.pm/safe-contracts/contracts/handler/DefaultCallbackHandler.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "../interfaces/IAccount.sol";
import "./EIP4337Manager.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../interfaces/IPlugin.sol";

    using ECDSA for bytes32;

contract EIP4337PluginFallback is DefaultCallbackHandler, IAccount, IERC1271, EIP712 {
    address immutable public defaultEIP4337Manager;
    constructor(address _eip4337manager) EIP712("EIP4337PluginFallback", "1.0.0") {
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
    function delegateToPlugin(
        address plugin,
        UserOperation calldata userOp,
        bytes32 opHash,
        address aggregator,
        uint256 missingAccountFunds
    ) internal returns (bytes memory) {
        // delegate entire msg.data (including the appended "msg.sender") to the EIP4337Manager
        // will work only for GnosisSafe contracts
        GnosisSafe safe = GnosisSafe(payable(msg.sender));
        abi.encodeWithSelector(IPlugin.validatePluginData.selector, 
            userOp,
            opHash,
            aggregator,
            missingAccountFunds
        );
        (bool success, bytes memory ret) = safe.execTransactionFromModuleReturnData(
            plugin,
            0,
            msg.data,
            Enum.Operation.DelegateCall
        );
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
    function validateUserOp(UserOperation calldata userOp, bytes32 opHash, address aggregator, uint256 missingAccountFunds) override external returns (uint256 deadline){
        if(userOp.signature.length == 65){
            bytes memory ret = delegateToManager();
            return abi.decode(ret, (uint256));
        } if(userOp.signature.length > 85){ // address(plugin) + validUntil + validAfter + signature + data
            require(userOp.initCode.length == 0, "not in init");
            address plugin = address(bytes20(userOp.signature[0:20]));
            uint48 validUntil = uint48(bytes6(userOp.signature[20:26]));
            uint48 validAfter = uint48(bytes6(userOp.signature[26:32]));
            bytes memory signature = userOp.signature[32:97];
            (bytes memory data, ) = abi.decode(userOp.signature[97:], (bytes, bytes));
            bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
                keccak256("ValidateUserOpPlugin(address sender,uint256 nonce,uint48 validUntil,uint48 validAfter,address plugin,bytes data)"), // we are going to trust plugin for verification
                userOp.sender,
                userOp.nonce,
                validUntil,
                validAfter,
                plugin,
                data
            )));
            require(IERC1271(msg.sender).isValidSignature(digest, signature) == 0x1626ba7e, "Invalid signature");
            require(GnosisSafe(payable(msg.sender)).nonce() == userOp.nonce, "Invalid nonce"); // we allow nonce reuse only when it is current nonce
            bytes memory ret = delegateToPlugin(
                plugin,
                userOp,
                opHash,
                aggregator,
                missingAccountFunds
            );
            bool res = abi.decode(ret, (bool));
            return packSigTimeRange(!res, validUntil, validAfter);
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

    function packSigTimeRange(bool sigFailed, uint48 validUntil, uint48 validAfter) internal pure returns (uint256) {
        return uint256(sigFailed ? 1 : 0) | uint256(validUntil << 8) | uint256(validAfter << (48+8));
    }
}
