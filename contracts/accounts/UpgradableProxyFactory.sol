// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.15;
import "./UpgradableProxy.sol";


// Adopted from: https://github.com/0xsequence/wallet-contracts/blob/cdfd9df2a6ed4cd74a84c6850b393d7a45713616/src/contracts/Factory.sol
contract UpgradableProxyFactory {
  event Deployed(address indexed _contract, address indexed _mainModule, bytes32 _salt);

  /**
   * @notice Will deploy a new wallet instance
   * @param _mainModule Address of the main module to be used by the wallet
   * @param _salt Salt used to generate the wallet, which is the imageHash
   *       of the wallet's configuration.
   * @dev It is recommended to not have more than 200 signers as opcode repricing
   *      could make transactions impossible to execute as all the signers must be
   *      passed for each transaction.
   */
  function deploy(address _mainModule, bytes32 _salt) public payable returns (address _contract) {
    bytes memory code = abi.encodePacked(UpgradableProxy.creationCode, uint256(uint160(_mainModule)));
    assembly { _contract := create2(callvalue(), add(code, 32), mload(code), _salt) }
    emit Deployed(_contract, _mainModule, _salt);
  }
}
