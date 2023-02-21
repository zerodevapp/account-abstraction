//SPDX-License-Identifier: GPL
pragma solidity ^0.8.7;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/base/Executor.sol";
import "@gnosis.pm/safe-contracts/contracts/examples/libraries/GnosisSafeStorage.sol";
import "./EIP4337Fallback.sol";
import "../utils/BytesLib.sol";
import "../interfaces/IAccount.sol";
import "../interfaces/IEntryPoint.sol";
import "../interfaces/IPlugin.sol";

    using ECDSA for bytes32;
/**
 * Main EIP4337 module.
 * Called (through the fallback module) using "delegate" from the GnosisSafe as an "IAccount",
 * so must implement validateUserOp
 * holds an immutable reference to the EntryPoint
 * Inherits GnosisSafeStorage so that it can reference the memory storage
 */
contract EIP4337SessionKeyPlugin is IPlugin, GnosisSafeStorage, Executor {

    address public immutable pluginFallback;
    address public immutable entryPoint;

    mapping(address => bool) public revoked;
    mapping(address => uint256) public sessionNonce;

    // return value in case of signature failure, with no time-range.
    // equivalent to packSigTimeRange(true,0,0);
    uint256 constant internal SIG_VALIDATION_FAILED = 1;

    constructor(address _entryPoint, address _pluginFallback) {
        entryPoint = _entryPoint;
        pluginFallback = _pluginFallback;
    }

    // revoke session key
    function revokeSessionKey(address _key) external {
        GnosisSafe pThis = GnosisSafe(payable(address(this)));
        require(pThis.isOwner(msg.sender), "account: not owner");
        revoked[_key] = true;
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
        require(address(bytes20(userOp.signature[0:20])) == address(this), "!this");
        require(msg.sender == pluginFallback, "account: not from eip4337Fallback");
        address _msgSender = address(bytes20(msg.data[msg.data.length - 20 :]));
        require(_msgSender == entryPoint, "account: not from entrypoint");
        // data = sessionKey
        // data offset starts at 97
        (bytes memory data, bytes memory signature) = abi.decode(userOp.signature[97:], (bytes, bytes));
        address sessionKey = address(bytes20(BytesLib.slice(data,0,20)));
        require(!revoked[sessionKey]);
        bytes32 hash = keccak256(
            abi.encodePacked(userOpHash, sessionNonce[sessionKey]++)
        ).toEthSignedMessageHash();
        address recovered = hash.recover(signature);
        require(recovered == sessionKey, "account: invalid signature");
        if (missingAccountFunds > 0) {
            //TODO: MAY pay more than the minimum, to deposit for future transactions
            (bool success,) = payable(_msgSender).call{value : missingAccountFunds}("");
            (success);
            //ignore failure (its EntryPoint's job to verify, not account.)
        }
        return true;
    }
}
