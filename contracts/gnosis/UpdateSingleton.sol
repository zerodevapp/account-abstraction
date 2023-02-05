// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.7;
import "@gnosis.pm/safe-contracts/contracts/examples/libraries/GnosisSafeStorage.sol";

// adopted from: https://github.com/safe-global/safe-contracts/blob/main/contracts/examples/libraries/Migrate_1_3_0_to_1_2_0.sol
contract UpdateSingleton is GnosisSafeStorage {
    address public immutable migrationSingleton;

    constructor() {
        migrationSingleton = address(this);
    }

    event ChangedMasterCopy(address singleton);

    bytes32 private guard;

    /// @dev Allows to migrate the contract. 
    function migrate(address targetSingleton) public {
        require(targetSingleton != address(0), "Invalid singleton address provided");

        // Can only be called via a delegatecall.
        require(address(this) != migrationSingleton, "Migration should only be called via delegatecall");

        singleton = targetSingleton;
        emit ChangedMasterCopy(singleton);
    }
}