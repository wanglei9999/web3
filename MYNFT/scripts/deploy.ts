import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();
  await myNFT.deployed();
  console.log("MyNFT deployed to:", myNFT.address);

  const MyERC20 = await ethers.getContractFactory("MyERC20");
  const myERC20 = await MyERC20.deploy();
  await myERC20.deployed();
  console.log("MyERC20 deployed to:", myERC20.address);

  const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await upgrades.deployProxy(AuctionHouse, [ETH_USD_FEED], {
    initializer: "initialize",
  });
  await auctionHouse.deployed();
  console.log("AuctionHouse proxy deployed to:", auctionHouse.address);

  console.log("\n=== 部署完成 ===");
  console.log("请更新以下地址到 scripts/upgrade.ts 中的 proxyAddress:");
  console.log(`  AuctionHouse Proxy: ${auctionHouse.address}`);
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exitCode = 1;
});