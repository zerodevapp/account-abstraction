// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@gnosis.pm/zodiac/contracts/core/Module.sol";

interface GnosisSafe {
    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, Enum.Operation operation)
        external
        returns (bool success);
}

// A Gnosis module that allows a user to subscribe to an ERC721 collection.
//
// The user initializes the module with the ERC721 collection address, how much
// they'd like to pay for each NFT, and how often they'd like to be charged.
//
// A designated address can send the user NFTs from this collection to trigger
// the subscription payments.
contract ERC721SubscriptionModule {

    IERC721 public erc721collection;
    address public sender;
    uint256 public price;
    uint256 public period;

    // map receiver to the timestamp at which they last paid
    mapping(address => uint256) lastPayments;

    // erc721collection: the address of the ERC721 collection we are subscribing to
    // sender: the address that can send NFTs to owner to trigger the subscription payments
    // price: the amount to pay for each NFT
    // period: the minimal amount of time between payments
    constructor(address _erc721collection, address _sender, uint256 _price, uint256 _period) {
        erc721collection = IERC721(_erc721collection);
        sender = _sender;
        price = _price;
        period = _period;
    }

    function triggerPayment(address _receiver, uint256 _tokenId) public {
        // grab the NFT, which presumably has been approved by the sender
        erc721collection.transferFrom(sender, _receiver, _tokenId);

        // revert if the payment period has not elapsed
        uint256 lastPayment = lastPayments[_receiver];
        if (block.timestamp < lastPayment + period) {
            revert("Payment period has not elapsed");
        }

        // pay the subscription fee
        GnosisSafe safe = GnosisSafe(_receiver);
        bool success = safe.execTransactionFromModule(
            address(this),
            price,
            abi.encodePacked(bytes4(keccak256("transferETH()"))),
            Enum.Operation.Call
        );

        if (!success) {
            revert("Payment failed");
        }

        lastPayments[_receiver] = block.timestamp;
    }

    // meant to be delegate called
    function transferETH() payable public {
        (bool sent, ) = sender.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
    }

}
 