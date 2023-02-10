pragma solidity ^0.8.0;

import "@zerodev/safe-contracts/contracts/GnosisSafe.sol";

contract ModifiedGnosisSafe is GnosisSafe {
    constructor(address _eip4337EntryPoint) GnosisSafe(_eip4337EntryPoint) {
    }
}
