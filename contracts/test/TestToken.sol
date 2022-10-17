// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor()
        // solhint-disable-next-line no-empty-blocks
        ERC20("TST", "TestToken")
    {}

    function mint(address sender, uint256 amount) external {
        _mint(sender, amount);
    }

    // Anyone can mint any amount
    function selfMint(uint256 _amount) public {
        _mint(msg.sender, _amount);
    }

    function increment() public {
        _mint(msg.sender, 1 ether);
    }

    function decrement() public {
        _burn(msg.sender, 1 ether);
    }
}
