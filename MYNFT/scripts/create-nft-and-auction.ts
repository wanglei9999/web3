import { ethers } from "hardhat";

async function main() {
  // 加载已部署的合约
  const myNFTAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const auctionHouseAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';

  // 获取签名者
  const [deployer] = await ethers.getSigners();
  console.log('Using account:', deployer.address);

  // 加载合约实例
  const MyNFT = await ethers.getContractFactory('MyNFT');
  const myNFT = await MyNFT.attach(myNFTAddress);

  const AuctionHouse = await ethers.getContractFactory('AuctionHouse');
  const auctionHouse = await AuctionHouse.attach(auctionHouseAddress);

  // 1. 创建NFT
  console.log('Creating NFT...');
  const tokenURI = 'https://example.com/nft/1';
  const mintTx = await myNFT.safeMint(deployer.address, tokenURI);
  await mintTx.wait();
  console.log('NFT created successfully!');

  // 2. 授权AuctionHouse转移NFT
  console.log('Approving AuctionHouse to transfer NFT...');
  const approveTx = await myNFT.setApprovalForAll(auctionHouseAddress, true);
  await approveTx.wait();
  console.log('Approval granted!');

  // 3. 创建拍卖
  console.log('Creating auction...');
  const tokenId = 0; // 第一个NFT的tokenId
  const startingPrice = ethers.utils.parseEther('1'); // 起拍价1 ETH
  const startTime = 0; // 立即开始
  const duration = 3600; // 拍卖持续1小时
  const paymentToken = ethers.constants.AddressZero; // 使用ETH
  const isETH = true; // 是ETH拍卖

  const createAuctionTx = await auctionHouse.createAuction(
    myNFTAddress,
    tokenId,
    startingPrice,
    startTime,
    duration,
    paymentToken,
    isETH
  );
  await createAuctionTx.wait();
  console.log('Auction created successfully!');

  // 验证拍卖是否创建成功
  const auction = await auctionHouse.auctionData(0);
  console.log('Auction details:', {
    auctionId: auction.auctionId.toString(),
    seller: auction.seller,
    nftContract: auction.nftContract,
    tokenId: auction.tokenId.toString(),
    startingPrice: ethers.utils.formatEther(auction.startingPrice),
    startTime: auction.startTime.toString(),
    endTime: auction.endTime.toString(),
    highestBidder: auction.highestBidder,
    highestBid: ethers.utils.formatEther(auction.highestBid),
    isActive: auction.isActive,
    paymentToken: auction.paymentToken,
    isETH: auction.isETH
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});