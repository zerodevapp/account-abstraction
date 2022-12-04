// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../core/BaseAccount.sol";
import "../interfaces/IEntryPointRegistry.sol";
import "../interfaces/IPlugin.sol";

contract ZeroDevAccount is BaseAccount {
    using ECDSA for bytes32;

    event PersonalEntryPointChanged(address indexed oldEntryPoint, address indexed newEntryPoint);
    event PluginRegistered(address indexed plugin);
    event PluginDeregistered(address indexed plugin);

    bytes4 public constant PLUGIN_SELECTOR = bytes4(keccak256("zerodev.plugins"));

    //explicit sizes of nonce, to fit a single storage cell with "owner"
    uint96 private _nonce;
    address public owner;

    // A set of registered plugins
    mapping(address => bool) public plugins;

    // By default, the entrypoint in the global registry is used.
    // However, to guard against the attack where a malicious entrypoint
    // is put into the registry (which would not be possible once the
    // registry has been frozen), we allow users to set their own entrypoint.
    IEntryPoint public personalEntryPoint;
    IEntryPointRegistry public entryPointRegistry;

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the entryPoint (which gets redirected through execFromEntryPoint)
        require(msg.sender == owner || msg.sender == address(this), "account: only owner");
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor(address _entryPointRegistry, address _owner) {
        entryPointRegistry = IEntryPointRegistry(_entryPointRegistry);
        owner = _owner;
    }

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
        require(msg.sender == address(entryPoint()) || msg.sender == address(owner), "account: need EntryPoint/owner");
    }

    /**
     * transfer eth value to a destination address
     */
    function transfer(address payable dest, uint256 amount) external onlyOwner {
        dest.transfer(amount);
    }

    /**
     * execute a transaction (called directly from owner, not by entryPoint)
     */
    function exec(address dest, uint256 value, bytes calldata func) external onlyOwner {
        _call(dest, value, func);
    }

    // The primary interface for executing transactions
    function execBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata datas) external {
        _requireFromEntryPointOrOwner();
        require(targets.length == datas.length, "account: wrong datas length");
        // As an optimization, we allow the values array to be empty if none of
        // calls in the batch specifies a value.  If any specifies a value,
        // however, all must.
        require(targets.length == values.length || values.length == 0, "account: wrong values length");

        for (uint256 i = 0; i < targets.length; i++) {
            _call(targets[i], values.length == 0 ? 0 : values[i], datas[i]);
        }
    }

    function registerPlugin(address plugin) external {
        emit PluginRegistered(plugin);
        plugins[plugin] = true;
    }

    function deregisterPlugin(address plugin) external {
        emit PluginDeregistered(plugin);
        delete plugins[plugin];
    }

    // This function can only be called by itself.  It's not the most
    // gas-efficient way but it simplifies the API since this call can
    // be part of `execBatch`.
    // This function primarily exists to make it possible for plugins
    // to execute complex logic for the user, in case batch call doesn't
    // suffice.
    // function execDelegateCall(address delegateTo, address target, uint256 value, bytes memory data) external onlySelf {
    //     (bool success, bytes memory result) = delegateTo.delegatecall{value : value}(data);
    //     if (!success) {
    //         assembly {
    //             revert(add(result, 32), mload(result))
    //         }
    //     }
    // }

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

        // 65 is the ECDSA signature length
        //ignore signature mismatch of from==ZERO_ADDRESS (for eth_callUserOp validation purposes)
        // solhint-disable-next-line avoid-tx-origin
        if ((userOp.signature.length == 65 && owner == hash.recover(userOp.signature)) || tx.origin == address(0)) {
            return 0;
        } else {
            // If the signature is wrong, we check if this is a plugin op
            (address plugin, bytes memory pluginSig) = _parsePluginSignature(userOp.signature);
            require(plugins[plugin], "account: plugin not registered");
            return IPlugin(plugin).validateSignature(userOp, userOpHash, pluginSig, aggregator);
        }
    }

    function _parsePluginSignature(bytes calldata signature) internal view returns (address, bytes memory) {
        (bytes4 prefix, address plugin, bytes memory pluginSig) = abi.decode(signature, (bytes4, address, bytes));
        require(prefix == PLUGIN_SELECTOR, "account: invalid signature");
        return (plugin, pluginSig);
    }

}
 