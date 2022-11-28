// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import '../core/BaseAccount.sol';
import '../interfaces/IEntryPointRegistry.sol';
import '../interfaces/IPlugin.sol';

contract ZeroDevAccount is BaseAccount {
    using ECDSA for bytes32;

    event PersonalEntryPointChanged(address indexed oldEntryPoint, address indexed newEntryPoint);

    bytes4 public constant PLUGIN_SELECTOR = bytes4(keccak256("zerodev.plugins"));

    //explicit sizes of nonce, to fit a single storage cell with "owner"
    uint96 private _nonce;
    address public owner;

    // By default, the entrypoint in the global registry is used.
    // However, to guard against the attack where a malicious entrypoint
    // is put into the registry (which would not be possible once the
    // registry has been frozen), we allow users to set their own entrypoint.
    IEntryPoint public personalEntryPoint;
    IEntryPointRegistry public entryPointRegistry;

    function nonce() public view virtual override returns (uint256) {
        return _nonce;
    }

    function entryPoint() public view virtual override returns (IEntryPoint) {
        if (address(personalEntryPoint) != address(0)) {
            return personalEntryPoint;
        }
        return entryPointRegistry.getEntryPoint();
    }

    function _updateEntryPoint(address newEntryPoint) internal override {
        emit PersonalEntryPointChanged(address(personalEntryPoint), newEntryPoint);
        personalEntryPoint = IEntryPoint(payable(newEntryPoint));
    }

    function _validateAndUpdateNonce(UserOperation calldata userOp) internal override {
        require(_nonce++ == userOp.nonce, "account: invalid nonce");
    }

    function _requireFromEntryPointOrOwner() internal view {
        require(msg.sender == address(entryPoint()) || msg.sender == address(owner), "account: not from EntryPoint or owner");
    }

    // The primary interface for executing transactions
    function execBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata datas) external {
        _requireFromEntryPointOrOwner();
        require(targets.length == datas.length, "account: wrong data array lengths");
        // As an optimization, we allow the values array to be empty if none of
        // calls in the batch specifies a value.  If any specifies a value,
        // however, all must.
        require(targets.length == values.length || values.length == 0, "account: wrong value array lengths");

        for (uint256 i = 0; i < targets.length; i++) {
            _call(targets[i], values.length == 0 ? 0 : values[i], datas[i]);
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value : value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash, address aggregator)
    internal override virtual returns (uint256 deadline) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        //ignore signature mismatch of from==ZERO_ADDRESS (for eth_callUserOp validation purposes)
        // solhint-disable-next-line avoid-tx-origin
        if (owner == hash.recover(userOp.signature) || tx.origin == address(0)) {
            return 0;
        } else {
            // If the signature is wrong, we check if this is a plugin op
            IPlugin plugin = _extractPlugin(userOp.signature);
            return plugin.validateSignature(userOp, userOpHash, aggregator);
        }
    }

    function _extractPlugin(bytes calldata signature) internal pure returns (IPlugin) {
        (bytes4 prefix, address plugin) = abi.decode(signature, (bytes4, address));
        require(prefix == PLUGIN_SELECTOR, "account: invalid signature");
        return IPlugin(plugin);
    }

}