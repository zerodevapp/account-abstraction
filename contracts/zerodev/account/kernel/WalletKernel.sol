// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../../plugin/IPlugin.sol";
import "../../../core/Helpers.sol";
import "../../../interfaces/IAccount.sol";
import "../../utils/OpinionatedExec.sol";
import "./Compatibility.sol";

struct WalletKernelStorage {
    address owner;
    uint256 nonce;
}


/// @title Wallet Kernel
/// @author taek<leekt216@gmail.com>
/// @notice wallet kernel for minimal wallet functionality
/// @dev supports only 1 owner and 1 threshold, multiple plugins
contract WalletKernel is IAccount, EIP712, Compatibility {

    function getWalletKernelStorage() internal pure returns (WalletKernelStorage storage ws) {
        bytes32 storagePosition = bytes32(uint256(keccak256("zero-dev.account.walletkernel")) - 1);
        assembly {
            ws.slot := storagePosition
        }
    }

    uint256 constant private SIG_VALIDATION_FAILED = 1;

    address public immutable entryPoint;

    error QueryResult(bytes result);

    constructor(address _entryPoint) EIP712("WalletKernel", "0.0.1") {
        entryPoint = _entryPoint;
    }

    /// @notice Query plugin for data
    /// @dev this function will always fail, it should be used only to query plugin for data using error message
    /// @param _plugin Plugin address
    /// @param _data Data to query
    function queryPlugin(address _plugin, bytes calldata _data) external {
        (bool success, bytes memory _ret) = OpinionatedExec.delegateCall(_plugin, _data);
        if(success) {
            revert QueryResult(_ret);
        } else {
            assembly {
                revert(add(_ret, 32), mload(_ret))
            }
        }
    }


    /**
     * Execute a call but also revert if the execution fails.
     * The default behavior of the Safe is to not revert if the call fails,
     * which is challenging for integrating with ERC4337 because then the
     * EntryPoint wouldn't know to emit the UserOperationRevertReason event,
     * which the frontend/client uses to capture the reason for the failure.
     */
    function executeAndRevert(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external {
        require(msg.sender == entryPoint, "account: not from entrypoint");
        bool success;
        bytes memory ret;
        if(operation == Enum.Operation.DelegateCall) {
            (success, ret) = OpinionatedExec.delegateCall(to, data);
        } else {
            (success, ret) = OpinionatedExec.call(to, value, data);
        }
        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }


    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
    external returns (uint256 validationData) {
        require(UserOperationLib.checkUserOpOffset(userOp), "userOp: invalid offset");
        require(msg.sender == entryPoint, "account: not from entryPoint");
        if(userOp.signature.length == 65){
            validationData = _validateUserOp(userOp, userOpHash);
        } else if(userOp.signature.length > 97) {
            // userOp.signature = address(plugin) + validUntil + validAfter + pluginData + pluginSignature
            address plugin = address(bytes20(userOp.signature[0:20]));
            uint48 validUntil = uint48(bytes6(userOp.signature[20:26]));
            uint48 validAfter = uint48(bytes6(userOp.signature[26:32]));
            bytes memory signature = userOp.signature[32:97];
            (bytes memory data, ) = abi.decode(userOp.signature[97:], (bytes, bytes));

            bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
                keccak256("ValidateUserOpPlugin(address sender,uint48 validUntil,uint48 validAfter,address plugin,bytes data)"), // we are going to trust plugin for verification
                userOp.sender,
                validUntil,
                validAfter,
                plugin,
                keccak256(data)
            )));

            address signer = ECDSA.recover(digest, signature);
            if(getWalletKernelStorage().owner != signer) {
                return SIG_VALIDATION_FAILED;
            }
            bytes memory ret = _delegateToPlugin(
                plugin,
                userOp,
                userOpHash,
                missingAccountFunds
            );
            bool res = abi.decode(ret, (bool));
            if(res) {
                return SIG_VALIDATION_FAILED;
            }
            validationData = _packValidationData(!res, validUntil, validAfter);
        } else {
            return SIG_VALIDATION_FAILED;
        }
        if(missingAccountFunds > 0) { // we are going to assume signature is valid at this point
            (bool success, ) = msg.sender.call{value: missingAccountFunds}("");
            (success);
            return validationData;
        }
    }

    function _validateUserOp(UserOperation calldata userOp, bytes32 userOpHash)
    internal returns (uint256 validationData) {
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        address recovered = ECDSA.recover(hash,userOp.signature);
        WalletKernelStorage storage ws = getWalletKernelStorage();
        if (ws.owner != recovered) {
            return SIG_VALIDATION_FAILED;
        }

        if (userOp.initCode.length == 0) {
            if(ws.nonce++ != userOp.nonce) {
                return SIG_VALIDATION_FAILED;
            }
        }
    }

    /**
     * delegate the contract call to the plugin
     */
    function _delegateToPlugin(
        address plugin,
        UserOperation calldata userOp,
        bytes32 opHash,
        uint256 missingAccountFunds
    ) internal returns (bytes memory) {
        // delegate entire msg.data (including the appended "msg.sender") to the EIP4337Manager
        // will work only for GnosisSafe contracts
        bytes memory data = abi.encodeWithSelector(IPlugin.validatePluginData.selector, 
            userOp,
            opHash,
            missingAccountFunds
        );
        (bool success, bytes memory ret) = OpinionatedExec.delegateCall(plugin, data); // Q: should we allow value > 0?
        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) public override view returns (bytes4) {
        bytes32 hash = ECDSA.toEthSignedMessageHash(_hash);
        address recovered = ECDSA.recover(hash, _signature);
        WalletKernelStorage storage ws = getWalletKernelStorage();
        // Validate signatures
        if (ws.owner == recovered) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }
}
