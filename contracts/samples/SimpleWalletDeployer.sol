// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "./SimpleWallet.sol";

/**
 * a sampler deployer contract for SimpleWallet
 * the "initCode" for a wallet hold its address and a method call (deployWallet) with parameters, not actual constructor code.
 */
contract SimpleWalletDeployer {
    function isDeployed(address _addr) private view returns (bool isContract){
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    function getWalletAddress(IEntryPoint entryPoint, address owner, uint salt) public view returns (address) {
        bytes32 bytecodeHash = keccak256(abi.encodePacked(type(SimpleWallet).creationCode, abi.encode(entryPoint, owner)));
        bytes32 _data = keccak256(abi.encodePacked(bytes1(0xff), address(this), bytes32(salt), bytecodeHash));
        return address(uint160(uint256(_data)));
    }

    function deployWallet(IEntryPoint entryPoint, address owner, uint salt) public returns (SimpleWallet) {
        address payable walletAddr = payable(getWalletAddress(entryPoint, owner, salt));
        if (isDeployed(walletAddr)) {
            return SimpleWallet(walletAddr);
        } else {
            return new SimpleWallet{salt : bytes32(salt)}(entryPoint, owner);
        }
    }
}
