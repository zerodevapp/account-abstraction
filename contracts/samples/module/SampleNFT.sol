// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// A sample ERC721 contract
contract SampleNFT is ERC721 {
    uint256 public tokenId;

    constructor() ERC721("SampleNFT", "SNFT") {}

    function mint(address to, uint256 _tokenId) public {
        _safeMint(to, _tokenId);
    }

    function mintOne(address to) public {
        _safeMint(to, tokenId++);
    }
}