// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// A sample ERC721 contract
contract SampleNFT is ERC721 {
    uint256 public tokenId;

    constructor() ERC721("SampleNFT", "SNFT") {}

    // Anyone can mint an NFT for anyone
    function mint(address _to) public {
        _safeMint(_to, tokenId++);
    }
}
