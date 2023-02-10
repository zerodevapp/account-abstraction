// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "./EIP4337Manager.sol";
import "../utils/Exec.sol";
/**
 * A wrapper factory contract to deploy GnosisSafe as an Account-Abstraction wallet contract.
 */
contract ModifiedGnosisSafeAccountFactory {

    bytes32 public immutable prefix;

    GnosisSafeProxyFactory public immutable proxyFactory;
    address public immutable safeSingleton;
    address public immutable eip4337EntryPoint;

    event AccountCreated(address indexed account, address indexed owner, uint salt);

    constructor(
        bytes32 _prefix,
        GnosisSafeProxyFactory _proxyFactory,
        address _safeSingleton,
        address _eip4337EntryPoint
    ) {
        prefix = _prefix;
        proxyFactory = _proxyFactory;
        safeSingleton = _safeSingleton;
        eip4337EntryPoint = _eip4337EntryPoint;
    }

    function encodeSalt(address owner, uint256 salt) public view returns(uint256) {
        return uint256(keccak256(
            abi.encodePacked(prefix, owner, salt)
        ));
    }

    function createAccount(address owner, uint salt) public returns (address addr) {
        addr = getAddress(owner, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return addr;
        }

        address account = address(proxyFactory.createProxyWithNonce(
            safeSingleton, "", encodeSalt(owner, salt)
        ));
        emit AccountCreated(account, owner, salt);

        (bool success, bytes memory ret) = addr.call(getInitializer(owner));
        require(success, string(ret));
    }

    function getInitializer(address owner) internal view returns (bytes memory) {
        address[] memory owners = new address[](1);
        owners[0] = owner;
        uint threshold = 1;
        bytes memory setupData = abi.encodeCall(ModifiedGnosisSafeAccountFactory.setupModule,());
        return abi.encodeCall(GnosisSafe.setup, (
            owners,
            threshold,
            address(this),
            setupData,
            address(0),
            address(0),
            0,
            payable(0) //no payment receiver
        ));
    }

    function setupModule() external {
        GnosisSafe pThis = GnosisSafe(payable(address(this)));
        pThis.enableModule(eip4337EntryPoint);
    }

    /**
    * calculate the counterfactual address of this account as it would be returned by createAccount()
    * (uses the same "create2 signature" used by GnosisSafeProxyFactory.createProxyWithNonce)
    */
    function getAddress(address owner, uint salt) public view returns (address) {
        //copied from deployProxyWithNonce
        bytes32 salt2 = keccak256(abi.encodePacked(keccak256(""), encodeSalt(owner, salt)));
        bytes memory deploymentData = abi.encodePacked(proxyFactory.proxyCreationCode(), uint256(uint160(safeSingleton)));
        return Create2.computeAddress(bytes32(salt2), keccak256(deploymentData), address (proxyFactory));
    }
}
