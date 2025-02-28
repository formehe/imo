// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract ERC20TokenSample is ERC20 {
    constructor() ERC20("ERC20 Token Sample1", "Sample 1") {
        _mint(msg.sender, 100_000_000_000 * 10**18 );
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}