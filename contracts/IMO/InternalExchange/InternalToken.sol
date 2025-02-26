// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract InternalToken is ERC20, Ownable {
    uint public maxTx;
    uint256 private _maxTxAmount;
    uint256 private _totalSupply;
    mapping(address => bool) private isExcludedFromMaxTx;

    event MaxTxUpdated(uint _maxTx);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        uint _maxTx
    ) ERC20(name_, symbol_) Ownable() {
        _totalSupply = supply * 10 ** 18;
        _mint(msg.sender, _totalSupply);

        isExcludedFromMaxTx[_msgSender()] = true;
        isExcludedFromMaxTx[address(this)] = true;
        _updateMaxTx(_maxTx);

        emit Transfer(address(0), _msgSender(), _totalSupply);
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function _updateMaxTx(uint _maxTx) internal {
        maxTx = _maxTx;
        _maxTxAmount = (maxTx * _totalSupply) / 100;

        emit MaxTxUpdated(_maxTx);
    }

    function updateMaxTx(uint256 _maxTx) public onlyOwner {
        _updateMaxTx(_maxTx);
    }

    function excludeFromMaxTx(address user) public onlyOwner {
        require(
            user != address(0),
            "ERC20: Exclude Max Tx from the zero address"
        );

        isExcludedFromMaxTx[user] = true;
    }

    function _beforeTokenTransfer(
        address from,
        address /*to*/,
        uint256 amount
    ) internal override view {
        if (!isExcludedFromMaxTx[from]) {
            require(amount <= _maxTxAmount, "Exceeds MaxTx");
        }
    }

    function burnFrom(address user, uint256 amount) public onlyOwner {
        require(user != address(0), "Invalid address");
        _burn(user, amount);
        emit Transfer(user, address(0), amount);
    }
}
