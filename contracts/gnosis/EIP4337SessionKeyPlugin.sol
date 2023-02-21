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
import "../interfaces/IAccount.sol";
import "../interfaces/IEntryPoint.sol";

    using ECDSA for bytes32;

/**
 * Main EIP4337 module.
 * Called (through the fallback module) using "delegate" from the GnosisSafe as an "IAccount",
 * so must implement validateUserOp
 * holds an immutable reference to the EntryPoint
 * Inherits GnosisSafeStorage so that it can reference the memory storage
 */
contract EIP4337SessionKeyPlugin is IAccount, GnosisSafeStorage, Executor {

    address public immutable pluginFallback;
    address public immutable entryPoint;

    mapping(bytes32 => bool) public revoked;

    // return value in case of signature failure, with no time-range.
    // equivalent to packSigTimeRange(true,0,0);
    uint256 constant internal SIG_VALIDATION_FAILED = 1;

    constructor(address _entryPoint, address _pluginFallback) {
        entryPoint = _entryPoint;
        pluginFallback = _pluginFallback;
    }

    // revoke session key
    function revokeSessionKey(bytes32 _key) external {
        GnosisSafe pThis = GnosisSafe(payable(address(this)));
        require(pThis.isOwner(msg.sender), "account: not owner");
        revoked[_key] = true;
    }

    /**
     * delegate-called (using execFromModule) through the fallback, so "real" msg.sender is attached as last 20 bytes
     */
    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, address /*aggregator*/, uint256 missingAccountFunds)
    external override returns (uint256 sigTimeRange) {
        require(msg.sender == pluginFallback, "account: not from eip4337Fallback");
        address _msgSender = address(bytes20(msg.data[msg.data.length - 20 :]));
        require(_msgSender == entryPoint, "account: not from entrypoint");

        GnosisSafe pThis = GnosisSafe(payable(address(this)));
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        require(address(userOp.signature[0:20]) == address(this), "!this");

        address recovered = hash.recover(userOp.signature[20:85]); // first 20 bytes are address of this
        require(threshold == 1, "account: only threshold 1");
        if (!pThis.isOwner(recovered)) {
            sigTimeRange = SIG_VALIDATION_FAILED;
        }

        bytes memory data = userOp.signature[85:];

        // data = sessionKey + validUntil + validFrom
        bytes32 sessionKey = bytes32(data[0:20]);
        uint48 validUntil = uint48(bytes6(data[20:26]));
        uint48 validFrom = uint48(bytes6(data[26:32]));
        require(!revoked[sessionKey]);

        if (missingAccountFunds > 0) {
            //TODO: MAY pay more than the minimum, to deposit for future transactions
            (bool success,) = payable(_msgSender).call{value : missingAccountFunds}("");
            (success);
            //ignore failure (its EntryPoint's job to verify, not account.)
        }
    }

    function packSigTimeRange(bool sigFailed, uint48 validUntil, uint48 validAfter) internal pure returns (uint256) {
        return uint256(sigFailed ? 1 : 0) | uint256(validUntil << 8) | uint256(validAfter << (48+8));
    }
}
