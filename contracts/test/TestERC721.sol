// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC721 is ERC721Enumerable, Ownable {
    constructor() ERC721("Test", "TEST") {}

    function mint(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        if (!_exists(tokenId)) return address(0);

        return super.ownerOf(tokenId);
    }
}
