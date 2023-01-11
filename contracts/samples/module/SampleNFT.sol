// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// A sample ERC721 contract
contract SampleNFT is ERC721 {
    constructor() ERC721("SampleNFT", "SNFT") {}

    function mint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId);
    }
}