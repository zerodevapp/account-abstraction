// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@gnosis.pm/zodiac/contracts/core/Module.sol";

// A Gnosis module that allows a user to subscribe to an ERC721 collection.
//
// The user initializes the module with the ERC721 collection address, how much
// they'd like to pay for each NFT, and how often they'd like to be charged.
//
// A designated address can send the user NFTs from this collection to trigger
// the subscription payments.

contract ERC721SubscriptionModule is Module {

    IERC721 public erc721collection;
    address public sender;
    uint256 public price;
    uint256 public period;

    uint256 lastPayment;

    // owner: the account address
    // erc721collection: the address of the ERC721 collection we are subscribing to
    // sender: the address that can send NFTs to owner to trigger the subscription payments
    // price: the amount to pay for each NFT
    // period: the minimal amount of time between payments
    constructor(address _owner, address _erc721collection, address _sender, uint256 _price, uint256 _period) {
        bytes memory initializeParams = abi.encode(_owner, _erc721collection, _sender, _price, _period);
        setUp(initializeParams);
    }

    /// @dev Initialize function, will be triggered when a new proxy is deployed
    /// @param initializeParams Parameters of initialization encoded
    function setUp(bytes memory initializeParams) public override initializer {
        __Ownable_init();
        (address _owner, address _erc721collection, address _sender, uint256 _price, uint256 _period)  = abi.decode(
            initializeParams,
            (address, address, address, uint256, uint256)
        );

        setAvatar(_owner);
        setTarget(_owner);

        erc721collection = IERC721(_erc721collection);
        sender = _sender;
        price = _price;
        period = _period;

        transferOwnership(_owner);
    }

    function triggerPayment(uint256 tokenId) public {
        // grab the NFT, which presumably has been approved by the sender
        erc721collection.transferFrom(sender, owner(), tokenId);

        // revert if the payment period has not elapsed
        if (block.timestamp < lastPayment + period) {
            revert("Payment period has not elapsed");
        }

        // pay the subscription fee
        bool success = exec(
            address(this),
            price,
            abi.encodePacked(bytes4(keccak256("transferETH()"))),
            Enum.Operation.Call
        );

        if (!success) {
            revert("Payment failed");
        }

        lastPayment = block.timestamp;
    }

    // meant to be delegate called
    function transferETH() payable public {
        (bool sent, ) = sender.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
    }

}
 