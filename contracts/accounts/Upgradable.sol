// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.15;

library LibAddress {
  /**
   * @notice Will return true if provided address is a contract
   * @param account Address to verify if contract or not
   * @dev This contract will return false if called within the constructor of
   *      a contract's deployment, as the code is not yet stored on-chain.
   */
  function isContract(address account) internal view returns (bool) {
    uint256 csize;
    // solhint-disable-next-line no-inline-assembly
    assembly { csize := extcodesize(account) }
    return csize != 0;
  }
}

// Merged from various contracts at: https://github.com/0xsequence/wallet-contracts/tree/cdfd9df2a6ed4cd74a84c6850b393d7a45713616/src/contracts
//
// This contract is to be inherited by account implementations in order to work
// with UpgradableProxy.
contract Upgradable {
  using LibAddress for address;

  event ImplementationUpdated(address newImplementation);

  modifier onlySelf() {
    require(msg.sender == address(this), "Upgradable#onlySelf: NOT_AUTHORIZED");
    _;
  }

  /**
   * @notice Updates the implementation of the base account
   * @param _implementation New main module implementation
   * @dev WARNING Updating the implementation can brick the account
   */
  function updateImplementation(address _implementation) external onlySelf {
    require(_implementation.isContract(), "Upgradable#updateImplementation: INVALID_IMPLEMENTATION");
    _setImplementation(_implementation);
    emit ImplementationUpdated(_implementation);
  }

  /**
   * @notice Updates the account implementation
   * @param _imp New implementation address
   * @dev The account implementation is stored on the storage slot
   *   defined by the address of the account itself
   *   WARNING updating this value may break the account and users
   *   must be confident that the new implementation is safe.
   */
  function _setImplementation(address _imp) internal {
    assembly {
      sstore(address(), _imp)
    }
  }

  /**
   * @notice Returns the account implementation
   * @return _imp The address of the current account implementation
   */
  function _getImplementation() internal view returns (address _imp) {
    assembly {
      _imp := sload(address())
    }
  }
}