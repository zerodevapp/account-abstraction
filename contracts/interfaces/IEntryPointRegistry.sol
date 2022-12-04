// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import "./IEntryPoint.sol";

interface IEntryPointRegistry {
  function getEntryPoint() external view returns (IEntryPoint);
}