// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPrometheans {
  function mint() external payable;

  function mintTo(address to) external payable;

  function currentEmber() external view returns (uint256);
}

contract PrometheansTest is ERC721, IPrometheans {
  uint256 public m_currentEmber = 75;
  uint256 public m_currentTokenId = 0;

  constructor() ERC721("Prometheans Safe Mint", "PSM") {}

  function setCurrentEmber(uint256 _currentEmber) external {
    m_currentEmber = _currentEmber;
  }

  function currentEmber() external view override returns (uint256) {
    return m_currentEmber;
  }

  function mint() external payable override {
    m_currentEmber = 75;
    _mint(msg.sender, ++m_currentTokenId);
  }

  function mintTo(address to) external payable {
    m_currentEmber = 75;
    _mint(to, ++m_currentTokenId);
  }
}
