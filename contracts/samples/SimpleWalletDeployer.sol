// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "./SimpleWallet.sol";
import "hardhat/console.sol";

/**
 * a sampler deployer contract for SimpleWallet
 * the "initCode" for a wallet hold its address and a method call (deployWallet) with parameters, not actual constructor code.
 */
contract SimpleWalletDeployer {
    function deployWallet(
        IEntryPoint entryPoint,
        address owner,
        uint salt
    ) public returns (SimpleWallet) {
        console.log(
            "deploying wallet with arguments: %s, %s, %s",
            address(entryPoint),
            owner,
            salt
        );
        try new SimpleWallet{salt: bytes32(salt)}(entryPoint, owner) returns (
            SimpleWallet sw
        ) {
            console.log("contract created");
            return sw;
        } catch Error(string memory reason) {
            console.log("contract revert reason: %s", reason);
        } catch (bytes memory reason) {
            console.log("contract revert reason bytes:");
            console.logBytes(reason);
        }
    }
}
