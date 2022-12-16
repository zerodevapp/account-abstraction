// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import "../interfaces/IEntryPointRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// The registry owner is initially set to ZeroDev while the system is being developed,
// but it's intended to eventually be set to a smart contract that only updates
// the entrypoint under specific conditions.
contract EntryPointRegistry is IEntryPointRegistry, Ownable {
    IEntryPoint public entryPoint;

    function getEntryPoint() external view override returns (IEntryPoint) {
        return entryPoint;
    }

    function setEntryPoint(IEntryPoint _entryPoint) external onlyOwner {
        entryPoint = _entryPoint;
    }
}

