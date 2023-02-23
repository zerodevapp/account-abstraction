//SPDX-License-Identifier: GPL
pragma solidity ^0.8.7;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/base/Executor.sol";
import "@gnosis.pm/safe-contracts/contracts/examples/libraries/GnosisSafeStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../../utils/BytesLib.sol";
import "../../interfaces/IAccount.sol";
import "../../interfaces/IEntryPoint.sol";
import "./IPlugin.sol";
import "hardhat/console.sol";

    using ECDSA for bytes32;
/**
 * Main EIP4337 module.
 * Called (through the fallback module) using "delegate" from the GnosisSafe as an "IAccount",
 * so must implement validateUserOp
 * holds an immutable reference to the EntryPoint
 * Inherits GnosisSafeStorage so that it can reference the memory storage
 */
struct SessionKeyStorageStruct {
    mapping(address => bool) revoked;
    mapping(address => uint256) sessionNonce;
}
contract EIP4337SessionKeyPlugin is IPlugin, GnosisSafeStorage, Executor, EIP712 {

    address public immutable pluginFallback;
    address public immutable entryPoint;

    function getSessionKeyStorage() internal pure returns (SessionKeyStorageStruct storage s) {
        bytes32 position = bytes32(uint256(keccak256("zero-dev.account.eip4337.sessionkey")) - 1);
        assembly {
            s.slot := position
        }
    }

    // return value in case of signature failure, with no time-range.
    // equivalent to packSigTimeRange(true,0,0);
    uint256 constant internal SIG_VALIDATION_FAILED = 1;

    event SessionKeyRevoked(address indexed key);

    constructor(address _entryPoint, address _pluginFallback) EIP712("EIP4337SessionKeyPlugin", "1.0.0") {
        entryPoint = _entryPoint;
        pluginFallback = _pluginFallback;
    }

    // revoke session key
    function revokeSessionKey(address _key) external {
        getSessionKeyStorage().revoked[_key] = true;
        emit SessionKeyRevoked(_key);
    }

    function revoked(address _key) external view returns (bool) {
        return getSessionKeyStorage().revoked[_key];
    }

    function sessionNonce(address _key) external view returns (uint256) {
        return getSessionKeyStorage().sessionNonce[_key];
    }

    /**
     * delegate-called (using execFromModule) through the fallback, so "real" msg.sender is attached as last 20 bytes
     */
    function validatePluginData(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        address /*aggregator*/,
        uint256 missingAccountFunds
    )
    external override returns (bool) {
        // require(address(bytes20(userOp.signature[0:20])) == address(this), "!this");
        require(msg.sender == pluginFallback, "account: not from eip4337Fallback");
        // data = sessionKey
        // data offset starts at 97
        (bytes memory data, bytes memory signature) = abi.decode(userOp.signature[97:], (bytes, bytes));
        address sessionKey = address(bytes20(BytesLib.slice(data,0,20)));
        require(!getSessionKeyStorage().revoked[sessionKey]);
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Session(bytes32 userOpHash,uint256 nonce)"), // we are going to trust plugin for verification
            userOpHash,
            getSessionKeyStorage().sessionNonce[sessionKey]++
        )));
        address recovered = digest.recover(signature);
        require(recovered == sessionKey, "account: invalid signature");
        if (missingAccountFunds > 0) {
            //TODO: MAY pay more than the minimum, to deposit for future transactions
            (bool success,) = payable(entryPoint).call{value : missingAccountFunds}("");
            (success);
            //ignore failure (its EntryPoint's job to verify, not account.)
        }
        return true;
    }
}
