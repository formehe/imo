// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract CloneFactory {
    using Clones for address;

    event CloneCreated(address indexed cloneAddress);

    function cloneContract(address implementation) external returns (address) {
        address clone = implementation.clone();
        emit CloneCreated(clone);
        return clone;
    }
}