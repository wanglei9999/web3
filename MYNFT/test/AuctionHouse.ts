import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract, Signer } from "ethers";

describe("AuctionHouse", function () {
  let owner: Signer;
  let seller: Signer;
  let bidder1: Signer;
  let bidder2: Signer;
  let myNFT: Contract;
  let myERC20: Contract;
  let auctionHouse: Contract;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    const MyNFT = await ethers.getContractFactory("MyNFT");
    myNFT = await MyNFT.deploy();
    await myNFT.waitForDeployment();

    const MyERC20 = await ethers.getContractFactory("MyERC20");
    myERC20 = await MyERC20.deploy();
    await myERC20.waitForDeployment();

    const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

    const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
    auctionHouse = await upgrades.deployProxy(AuctionHouse, [ETH_USD_FEED], {
      initializer: "initialize",
    });
    await auctionHouse.waitForDeployment();

    await myNFT.safeMint(await seller.getAddress(), "https://example.com/nft/1");
    await myNFT.connect(seller).setApprovalForAll(await auctionHouse.getAddress(), true);

    await myERC20.mint(await bidder1.getAddress(), ethers.parseUnits("1000", 18));
    await myERC20.mint(await bidder2.getAddress(), ethers.parseUnits("1000", 18));
  });

  describe("createAuction", function () {
    it("should create an ETH auction", async function () {
      const tokenId = 0;
      const startingPrice = ethers.parseEther("1");
      const startTime = 0;
      const duration = 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        tokenId,
        startingPrice,
        startTime,
        duration,
        ethers.ZeroAddress,
        true
      );

      const auction = await auctionHouse.auctionData(0);
      expect(auction.seller).to.equal(await seller.getAddress());
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(Number(auction.tokenId)).to.equal(tokenId);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.isActive).to.be.true;
      expect(auction.isETH).to.be.true;
    });

    it("should create an ERC20 auction", async function () {
      const tokenId = 0;
      const startingPrice = ethers.parseUnits("100", 18);
      const startTime = 0;
      const duration = 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        tokenId,
        startingPrice,
        startTime,
        duration,
        await myERC20.getAddress(),
        false
      );

      const auction = await auctionHouse.auctionData(0);
      expect(auction.paymentToken).to.equal(await myERC20.getAddress());
      expect(auction.isETH).to.be.false;
    });

    it("should track NFT to auction mapping", async function () {
      const tokenId = 0;
      const startingPrice = ethers.parseEther("1");
      const startTime = 0;
      const duration = 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        tokenId,
        startingPrice,
        startTime,
        duration,
        ethers.ZeroAddress,
        true
      );

      const auctionId = await auctionHouse.nftToken2AuctionId(await myNFT.getAddress(), tokenId);
      expect(Number(auctionId)).to.equal(0);
    });

    it("should prevent duplicate auction for same NFT", async function () {
      const tokenId = 0;
      const startingPrice = ethers.parseEther("1");
      const startTime = 0;
      const duration = 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        tokenId,
        startingPrice,
        startTime,
        duration,
        ethers.ZeroAddress,
        true
      );

      try {
        await auctionHouse.connect(seller).createAuction(
          await myNFT.getAddress(),
          tokenId,
          startingPrice,
          startTime,
          duration,
          ethers.ZeroAddress,
          true
        );
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e).to.exist;
      }
    });
  });

  describe("bidAuction", function () {
    it("should place an ETH bid", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        3600,
        ethers.ZeroAddress,
        true
      );

      await auctionHouse.connect(bidder1).bidAuction(0, { value: ethers.parseEther("2") });

      const auction = await auctionHouse.auctionData(0);
      expect(auction.highestBidder).to.equal(await bidder1.getAddress());
      expect(auction.highestBid).to.equal(ethers.parseEther("2"));
    });

    it("should reject bids before auction starts", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        futureTime,
        3600,
        ethers.ZeroAddress,
        true
      );

      try {
        await auctionHouse.connect(bidder1).bidAuction(0, { value: ethers.parseEther("2") });
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e).to.exist;
      }
    });

    it("should reject low ETH bids", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        3600,
        ethers.ZeroAddress,
        true
      );

      await auctionHouse.connect(bidder1).bidAuction(0, { value: ethers.parseEther("2") });

      try {
        await auctionHouse.connect(bidder2).bidAuction(0, { value: ethers.parseEther("1.5") });
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e).to.exist;
      }
    });

    it("should refund previous bidder", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        3600,
        ethers.ZeroAddress,
        true
      );

      const initialBalance = await ethers.provider.getBalance(await bidder1.getAddress());

      await auctionHouse.connect(bidder1).bidAuction(0, { value: ethers.parseEther("2") });
      await auctionHouse.connect(bidder2).bidAuction(0, { value: ethers.parseEther("3") });

      const finalBalance = await ethers.provider.getBalance(await bidder1.getAddress());
      const diff = initialBalance - finalBalance;
      expect(diff < ethers.parseEther("0.1")).to.be.true;
    });
  });

  describe("bidAuctionERC20", function () {
    it("should place an ERC20 bid", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseUnits("100", 18),
        0,
        3600,
        await myERC20.getAddress(),
        false
      );

      await myERC20.connect(bidder1).approve(await auctionHouse.getAddress(), ethers.parseUnits("200", 18));
      await auctionHouse.connect(bidder1).bidAuctionERC20(0, ethers.parseUnits("200", 18));

      const auction = await auctionHouse.auctionData(0);
      expect(auction.highestBidder).to.equal(await bidder1.getAddress());
      expect(auction.highestBid).to.equal(ethers.parseUnits("200", 18));
    });

    it("should reject low ERC20 bids", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseUnits("100", 18),
        0,
        3600,
        await myERC20.getAddress(),
        false
      );

      await myERC20.connect(bidder1).approve(await auctionHouse.getAddress(), ethers.parseUnits("200", 18));
      await auctionHouse.connect(bidder1).bidAuctionERC20(0, ethers.parseUnits("200", 18));

      await myERC20.connect(bidder2).approve(await auctionHouse.getAddress(), ethers.parseUnits("150", 18));
      try {
        await auctionHouse.connect(bidder2).bidAuctionERC20(0, ethers.parseUnits("150", 18));
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e).to.exist;
      }
    });
  });

  describe("endAuction", function () {
    it("should end auction with winner", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        100,
        ethers.ZeroAddress,
        true
      );

      await auctionHouse.connect(bidder1).bidAuction(0, { value: ethers.parseEther("2") });

      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      await auctionHouse.connect(owner).endAuction(0);

      const auction = await auctionHouse.auctionData(0);
      expect(auction.isActive).to.be.false;
      expect(await myNFT.ownerOf(0)).to.equal(await bidder1.getAddress());
    });

    it("should return NFT to seller if no bids", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        100,
        ethers.ZeroAddress,
        true
      );

      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      await auctionHouse.connect(owner).endAuction(0);

      expect(await myNFT.ownerOf(0)).to.equal(await seller.getAddress());
    });

    it("should clear NFT to auction mapping after end", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        100,
        ethers.ZeroAddress,
        true
      );

      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      await auctionHouse.connect(owner).endAuction(0);

      const auctionId = await auctionHouse.nftToken2AuctionId(await myNFT.getAddress(), 0);
      expect(Number(auctionId)).to.equal(0);
    });
  });

  describe("cancelAuction", function () {
    it("should cancel auction before it starts", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        futureTime,
        3600,
        ethers.ZeroAddress,
        true
      );

      await auctionHouse.connect(seller).cancelAuction(0);

      const auction = await auctionHouse.auctionData(0);
      expect(auction.isActive).to.be.false;
      expect(await myNFT.ownerOf(0)).to.equal(await seller.getAddress());
    });

    it("should reject cancellation after auction starts", async function () {
      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        0,
        3600,
        ethers.ZeroAddress,
        true
      );

      try {
        await auctionHouse.connect(seller).cancelAuction(0);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e).to.exist;
      }
    });

    it("should reject cancellation by non-seller", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        futureTime,
        3600,
        ethers.ZeroAddress,
        true
      );

      try {
        await auctionHouse.connect(bidder1).cancelAuction(0);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e).to.exist;
      }
    });

    it("should clear NFT to auction mapping after cancellation", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      await auctionHouse.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        ethers.parseEther("1"),
        futureTime,
        3600,
        ethers.ZeroAddress,
        true
      );

      await auctionHouse.connect(seller).cancelAuction(0);

      const auctionId = await auctionHouse.nftToken2AuctionId(await myNFT.getAddress(), 0);
      expect(Number(auctionId)).to.equal(0);
    });
  });

  describe("UUPS Upgrade", function () {
    it("should upgrade contract", async function () {
      const AuctionHouseV2 = await ethers.getContractFactory("AuctionHouseV2");
      const upgraded = await upgrades.upgradeProxy(await auctionHouse.getAddress(), AuctionHouseV2);

      expect(await upgraded.getVersion).to.exist;
    });
  });
});
