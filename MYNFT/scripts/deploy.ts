import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();
  await myNFT.waitForDeployment();
  console.log("MyNFT deployed to:", await myNFT.getAddress());

  const MyERC20 = await ethers.getContractFactory("MyERC20");
  const myERC20 = await MyERC20.deploy();
  await myERC20.waitForDeployment();
  console.log("MyERC20 deployed to:", await myERC20.getAddress());

  const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await upgrades.deployProxy(AuctionHouse, [ETH_USD_FEED], {
    initializer: "initialize",
  });
  await auctionHouse.waitForDeployment();
  console.log("AuctionHouse deployed to:", await auctionHouse.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
