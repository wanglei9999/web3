// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract AuctionHouseV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
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
        bool highestBidIsETH;
        bool isActive;
        address paymentToken;
        bool isETH;
    }

    uint256 public auctionCounter;
    uint256 public version;
    mapping(address => mapping(uint256 => uint256)) public nftToken2AuctionId;
    mapping(uint256 => Auction) public auctionData;
    mapping(address => mapping(uint256 => bool)) public nftHasActiveAuction;

    AggregatorV3Interface public ethUsdPriceFeed;
    mapping(address => AggregatorV3Interface) public tokenUsdPriceFeeds;

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
        __ReentrancyGuard_init();
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        auctionCounter = 0;
        version = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function initializeV2() public onlyOwner {
        require(version == 1, "Already initialized");
        version = 2;
    }

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
        require(!nftHasActiveAuction[nftContract][tokenId], "NFT already has an active auction");

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
            highestBidIsETH: false,
            isActive: true,
            paymentToken: paymentToken,
            isETH: isETH
        });

        nftToken2AuctionId[nftContract][tokenId] = auctionId;
        nftHasActiveAuction[nftContract][tokenId] = true;

        nft.transferFrom(msg.sender, address(this), tokenId);

        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId, startingPrice, startTime, endTime, paymentToken, isETH);
    }

    function bidAuction(uint256 auctionId) public payable nonReentrant {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.value > 0, "Bid must be positive");

        if (auction.highestBid == 0) {
            require(msg.value > auction.startingPrice, "Bid too low");
        } else if (auction.highestBidIsETH) {
            require(msg.value > auction.highestBid, "Bid too low");
        } else {
            uint256 bidUsdValue = convertToUSD(true, msg.value, address(0));
            uint256 minBidUsdValue = convertToUSD(false, auction.highestBid, auction.paymentToken);
            require(bidUsdValue > minBidUsdValue, "Bid too low");
        }

        if (auction.highestBidder != address(0)) {
            if (auction.highestBidIsETH) {
                _safeTransferETH(auction.highestBidder, auction.highestBid);
            } else {
                IERC20 token = IERC20(auction.paymentToken);
                token.safeTransfer(auction.highestBidder, auction.highestBid);
            }
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;
        auction.highestBidIsETH = true;

        emit BidPlaced(auctionId, msg.sender, msg.value, true);
    }

    function bidAuctionERC20(uint256 auctionId, uint256 amount) public nonReentrant {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(amount > 0, "Bid must be positive");

        if (auction.highestBid == 0) {
            require(amount > auction.startingPrice, "Bid too low");
        } else if (!auction.highestBidIsETH) {
            require(amount > auction.highestBid, "Bid too low");
        } else {
            uint256 bidUsdValue = convertToUSD(false, amount, auction.paymentToken);
            uint256 minBidUsdValue = convertToUSD(true, auction.highestBid, address(0));
            require(bidUsdValue > minBidUsdValue, "Bid too low");
        }

        IERC20 token = IERC20(auction.paymentToken);
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        if (auction.highestBidder != address(0)) {
            if (auction.highestBidIsETH) {
                _safeTransferETH(auction.highestBidder, auction.highestBid);
            } else {
                token.safeTransfer(auction.highestBidder, auction.highestBid);
            }
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

        auction.highestBidder = msg.sender;
        auction.highestBid = amount;
        auction.highestBidIsETH = false;

        emit BidPlaced(auctionId, msg.sender, amount, false);
    }

    function endAuction(uint256 auctionId) public nonReentrant {
        Auction storage auction = auctionData[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        auction.isActive = false;

        if (auction.highestBidder != address(0)) {
            IERC721 nft = IERC721(auction.nftContract);
            nft.transferFrom(address(this), auction.highestBidder, auction.tokenId);

            if (auction.highestBidIsETH) {
                _safeTransferETH(auction.seller, auction.highestBid);
            } else {
                IERC20 token = IERC20(auction.paymentToken);
                token.safeTransfer(auction.seller, auction.highestBid);
            }
        } else {
            IERC721 nft = IERC721(auction.nftContract);
            nft.transferFrom(address(this), auction.seller, auction.tokenId);
        }

        nftToken2AuctionId[auction.nftContract][auction.tokenId] = 0;
        nftHasActiveAuction[auction.nftContract][auction.tokenId] = false;

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
        nftHasActiveAuction[auction.nftContract][auction.tokenId] = false;

        emit AuctionCancelled(auctionId, auction.seller);
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
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

    struct AuctionDetails {
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
        uint256 usdValue;
    }

    function getAuctionDetails(uint256 auctionId) public view returns (AuctionDetails memory) {
        Auction storage auction = auctionData[auctionId];
        return AuctionDetails({
            auctionId: auction.auctionId,
            seller: auction.seller,
            nftContract: auction.nftContract,
            tokenId: auction.tokenId,
            startingPrice: auction.startingPrice,
            startTime: auction.startTime,
            endTime: auction.endTime,
            highestBidder: auction.highestBidder,
            highestBid: auction.highestBid,
            isActive: auction.isActive,
            paymentToken: auction.paymentToken,
            isETH: auction.isETH,
            usdValue: auction.highestBid > 0 ? convertToUSD(auction.isETH, auction.highestBid, auction.paymentToken) : 0
        });
    }
}
