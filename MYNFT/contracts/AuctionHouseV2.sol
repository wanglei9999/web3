// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract AuctionHouseV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    struct Auction {
        uint256 auctionId;
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 startingPrice;
        uint256 startTime;
        uint256 endTime;
        address highestBidder;
        uint256 highestBid;
        bool isActive;
        address paymentToken;
        bool isETH;
    }

    uint256 public auctionCounter;
    mapping(address => mapping(uint256 => uint256)) public nftToken2AuctionId;
    mapping(uint256 => Auction) public auctionData;

    AggregatorV3Interface public ethUsdPriceFeed;
    mapping(address => AggregatorV3Interface) public tokenUsdPriceFeeds;

    uint256 public version;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        bool isETH
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        bool isETH
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 amount
    );

    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed seller
    );

    function initialize(address _ethUsdPriceFeed) public initializer {
        __Ownable_init();
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        version = 2;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function getVersion() public view returns (uint256) {
        return version;
    }

    function addTokenPriceFeed(address token, address priceFeed) public onlyOwner {
        tokenUsdPriceFeeds[token] = AggregatorV3Interface(priceFeed);
    }

    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 startTime,
        uint256 duration,
        address paymentToken,
        bool isETH
    ) public {
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner of NFT");
        require(nft.isApprovedForAll(msg.sender, address(this)) || 
                nft.getApproved(tokenId) == address(this), "AuctionHouse not approved");
        require(startingPrice > 0, "Starting price must be positive");
        require(duration > 0, "Duration must be positive");
        require(nftToken2AuctionId[nftContract][tokenId] == 0, "NFT already has an active auction");

        uint256 auctionId = auctionCounter++;
        uint256 endTime = startTime + duration;
        if (startTime == 0) {
            startTime = block.timestamp;
            endTime = block.timestamp + duration;
        }

        auctionData[auctionId] = Auction({
            auctionId: auctionId,
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startingPrice: startingPrice,
            startTime: startTime,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0,
            isActive: true,
            paymentToken: paymentToken,
            isETH: isETH
        });

        nftToken2AuctionId[nftContract][tokenId] = auctionId;

        nft.transferFrom(msg.sender, address(this), tokenId);

        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId, startingPrice, startTime, endTime, paymentToken, isETH);
    }

    function bidAuction(uint256 auctionId) public payable {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(auction.isETH, "Auction requires ERC20");
        require(msg.value > 0, "Bid must be positive");

        uint256 minBid = auction.highestBid == 0 ? auction.startingPrice : auction.highestBid;
        require(msg.value > minBid, "Bid too low");

        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit BidPlaced(auctionId, msg.sender, msg.value, true);
    }

    function bidAuctionERC20(uint256 auctionId, uint256 amount) public {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(!auction.isETH, "Auction requires ETH");
        require(amount > 0, "Bid must be positive");

        uint256 minBid = auction.highestBid == 0 ? auction.startingPrice : auction.highestBid;
        require(amount > minBid, "Bid too low");

        IERC20 token = IERC20(auction.paymentToken);
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        if (auction.highestBidder != address(0)) {
            token.safeTransfer(auction.highestBidder, auction.highestBid);
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

        auction.highestBidder = msg.sender;
        auction.highestBid = amount;

        emit BidPlaced(auctionId, msg.sender, amount, false);
    }

    function endAuction(uint256 auctionId) public {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        auction.isActive = false;

        if (auction.highestBidder != address(0)) {
            IERC721 nft = IERC721(auction.nftContract);
            nft.transferFrom(address(this), auction.highestBidder, auction.tokenId);

            if (auction.isETH) {
                payable(auction.seller).transfer(auction.highestBid);
            } else {
                IERC20 token = IERC20(auction.paymentToken);
                token.safeTransfer(auction.seller, auction.highestBid);
            }
        } else {
            IERC721 nft = IERC721(auction.nftContract);
            nft.transferFrom(address(this), auction.seller, auction.tokenId);
        }

        nftToken2AuctionId[auction.nftContract][auction.tokenId] = 0;

        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    function cancelAuction(uint256 auctionId) public {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(auction.seller == msg.sender, "Not auction seller");
        require(block.timestamp < auction.startTime, "Auction already started");

        auction.isActive = false;

        IERC721 nft = IERC721(auction.nftContract);
        nft.transferFrom(address(this), auction.seller, auction.tokenId);

        nftToken2AuctionId[auction.nftContract][auction.tokenId] = 0;

        emit AuctionCancelled(auctionId, auction.seller);
    }

    function getLatestETHPrice() public view returns (int256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        return price;
    }

    function getLatestTokenPrice(address token) public view returns (int256) {
        AggregatorV3Interface feed = tokenUsdPriceFeeds[token];
        require(address(feed) != address(0), "Price feed not set");
        (, int256 price, , , ) = feed.latestRoundData();
        return price;
    }

    function convertToUSD(bool isETH, uint256 amount, address token) public view returns (uint256) {
        if (isETH) {
            int256 price = getLatestETHPrice();
            return (amount * uint256(price)) / 10**18;
        } else {
            int256 price = getLatestTokenPrice(token);
            AggregatorV3Interface feed = tokenUsdPriceFeeds[token];
            uint8 decimals = feed.decimals();
            return (amount * uint256(price)) / (10**decimals);
        }
    }

    function getAuctionDetails(uint256 auctionId) public view returns (
        uint256,
        address,
        address,
        uint256,
        uint256,
        uint256,
        uint256,
        address,
        uint256,
        bool,
        address,
        bool,
        uint256
    ) {
        Auction storage auction = auctionData[auctionId];
        uint256 usdValue = auction.highestBid > 0 ? convertToUSD(auction.isETH, auction.highestBid, auction.paymentToken) : 0;
        return (
            auction.auctionId,
            auction.seller,
            auction.nftContract,
            auction.tokenId,
            auction.startingPrice,
            auction.startTime,
            auction.endTime,
            auction.highestBidder,
            auction.highestBid,
            auction.isActive,
            auction.paymentToken,
            auction.isETH,
            usdValue
        );
    }
}
