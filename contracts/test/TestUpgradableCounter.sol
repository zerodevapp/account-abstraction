// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import "../accounts/Upgradable.sol";

// a simple counter contract, with a public counter variable
// and a function for incrementing it.
contract TestUpgradableCounter is Upgradable {
    uint256 public counter;

    // updateImplementation can only be called by self.
    // creating a public wrapper so anyone can update the implementation.
    function updateMe(address implementation) public {
        this.updateImplementation(implementation);
    }

    function increment() public {
        counter++;
    }
}

// same as TestUpgradableCounter, but with a decrement function
contract TestUpgradableCounterV2 is TestUpgradableCounter {
    function decrement() public {
        counter--;
    }
}