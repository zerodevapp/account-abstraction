// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/base/Executor.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../../interfaces/IAccount.sol";
import "../../interfaces/IEntryPoint.sol";
import "./IPlugin.sol";
import "../ZeroDevPluginSafe.sol";
import "hardhat/console.sol";

abstract contract ZeroDevBasePlugin is IPlugin, Executor, EIP712 {
    function validatePluginData(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (bool validated) {
        // data offset starts at 97
        (bytes calldata data, bytes calldata signature) = parseDataAndSignature(userOp.signature[97:]);
        validated = _validatePluginData(userOp, userOpHash, data, signature);
        if (missingAccountFunds > 0) {
            //TODO: MAY pay more than the minimum, to deposit for future transactions
            (bool success,) = payable(msg.sender).call{value : missingAccountFunds}("");
            (success);
            //ignore failure (its EntryPoint's job to verify, not account.)
        }
    }

    function _validatePluginData(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        bytes calldata data,
        bytes calldata signature
    ) internal virtual returns(bool);

    function parseDataAndSignature(
        bytes calldata _packed
    ) public view returns(bytes calldata data, bytes calldata signature) {
        uint256 data_position = uint256(bytes32(_packed[0:32]));
        uint256 data_length = uint256(bytes32(_packed[data_position:data_position+32]));
        uint256 signature_position = uint256(bytes32(_packed[32:64]));
        uint256 signature_length = uint256(bytes32(_packed[signature_position:signature_position+32]));
        data = _packed[data_position+32:data_position+32+data_length];
        signature = _packed[signature_position+32:signature_position+32+signature_length];

        require(data_position + 64 + ((data_length) / 32) * 32 == signature_position, "invalid data");
        require(signature_position + 64 + ((signature_length) / 32) * 32 == _packed.length, "invalid signature");
    }
}