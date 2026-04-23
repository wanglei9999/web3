import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("=== NFT拍卖市场升级脚本 ===\n");

  const proxyAddress = "0x9cCcf48B7FabafF7ad96d18a8611C5E478B11103";
  const v1Implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`代理合约地址: ${proxyAddress}`);
  console.log(`V1 实现合约地址: ${v1Implementation}`);

  console.log("\n正在升级到 AuctionHouse V2...");
  const AuctionHouseV2 = await ethers.getContractFactory("AuctionHouseV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, AuctionHouseV2);
  await upgraded.deployed();

  const v2Implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`V2 实现合约地址: ${v2Implementation}`);

  console.log("\n正在初始化 V2 版本...");
  const initTx = await upgraded.initializeV2();
  await initTx.wait();
  console.log("V2 初始化完成");

  console.log("\n正在验证升级结果...");
  const version = await upgraded.getVersion();
  console.log(`合约版本号: ${version}`);

  if (version === 2) {
    console.log("✅ 升级成功！");
  } else {
    console.log("❌ 升级失败！");
    process.exit(1);
  }

  console.log("\n=== 升级完成 ===");
  console.log(`AuctionHouse: ${proxyAddress} (代理合约)`);
  console.log(`V2 实现: ${v2Implementation}`);
  console.log(`当前版本: ${version}`);
  console.log("\n请更新 frontend/src/lib/contracts.ts 中的合约地址！");
}

main().catch((error) => {
  console.error("升级失败:", error);
  process.exitCode = 1;
});