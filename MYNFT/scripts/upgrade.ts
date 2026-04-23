import { ethers, upgrades } from "hardhat";

const SEPOLIA_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const LOCAL_ETH_USD_FEED = "0x0000000000000000000000000000000000000001";

async function main() {
  console.log("=== NFT拍卖市场部署升级脚本 ===\n");

  const network = await ethers.provider.getNetwork();
  const isLocal = network.chainId === 1337 || network.chainId === 31337;
  const ethUsdFeed = isLocal ? LOCAL_ETH_USD_FEED : SEPOLIA_ETH_USD_FEED;

  console.log(`当前网络: ${isLocal ? "本地测试网" : `Chain ID: ${network.chainId}`}`);
  console.log(`ETH/USD 价格预言机: ${ethUsdFeed}\n`);

  // ============ 1. 部署 NFT 合约 ============
  console.log("1. 部署 MyNFT 合约...");
  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();
  await myNFT.waitForDeployment();
  const myNFTAddress = await myNFT.getAddress();
  console.log(`MyNFT 合约地址: ${myNFTAddress}`);

  // ============ 2. 部署 ERC20 合约 ============
  console.log("\n2. 部署 MyERC20 合约...");
  const MyERC20 = await ethers.getContractFactory("MyERC20");
  const myERC20 = await MyERC20.deploy();
  await myERC20.waitForDeployment();
  const myERC20Address = await myERC20.getAddress();
  console.log(`MyERC20 合约地址: ${myERC20Address}`);

  // ============ 3. 部署 AuctionHouse V1 (UUPS 代理) ============
  console.log("\n3. 部署 AuctionHouse V1 (UUPS 代理模式)...");
  const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await upgrades.deployProxy(AuctionHouse, [ethUsdFeed], {
    kind: "uups",
  });
  await auctionHouse.waitForDeployment();

  const proxyAddress = await auctionHouse.getAddress();
  const v1Implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log(`代理合约地址: ${proxyAddress}`);
  console.log(`V1 实现合约地址: ${v1Implementation}`);

  // ============ 4. 升级到 AuctionHouse V2 ============
  console.log("\n4. 升级到 AuctionHouse V2...");
  const AuctionHouseV2 = await ethers.getContractFactory("AuctionHouseV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, AuctionHouseV2);
  await upgraded.waitForDeployment();

  const v2Implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`V2 实现合约地址: ${v2Implementation}`);

  // ============ 5. 初始化 V2 版本号 ============
  console.log("\n5. 初始化 V2 版本号...");
  const initTx = await upgraded.initializeV2();
  await initTx.wait();
  console.log("V2 初始化完成");

  // ============ 6. 验证升级结果 ============
  console.log("\n6. 验证升级结果...");
  const version = await upgraded.getVersion();
  console.log(`合约版本号: ${version}`);

  if (version === 2n) {
    console.log("✅ 升级成功！");
  } else {
    console.log("❌ 升级失败！");
    process.exit(1);
  }

  // ============ 7. 输出部署总结 ============
  console.log("\n=== 部署完成 ===");
  console.log("合约地址:");
  console.log(`  MyNFT:           ${myNFTAddress}`);
  console.log(`  MyERC20:         ${myERC20Address}`);
  console.log(`  AuctionHouse:    ${proxyAddress} (代理合约)`);
  console.log(`  V1 实现:         ${v1Implementation}`);
  console.log(`  V2 实现:         ${v2Implementation}`);
  console.log(`  当前版本:        ${version}`);
  console.log("\n请更新 frontend/src/lib/contracts.ts 中的合约地址！");
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exitCode = 1;
});
