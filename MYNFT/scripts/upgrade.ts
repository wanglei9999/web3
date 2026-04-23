import { ethers, upgrades } from "hardhat";

const SEPOLIA_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const LOCAL_ETH_USD_FEED = "0x0000000000000000000000000000000000000001";

async function main() {
  console.log("=== NFT拍卖市场部署升级脚本 ===\n");

  

  const proxyAddress = "0xf5059a5D33d5853360D16C683c16e67980206f36";
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
  console.log(`  AuctionHouse:    ${proxyAddress} (代理合约)`);
  console.log(`  V2 实现:         ${v2Implementation}`);
  console.log(`  当前版本:        ${version}`);
  console.log("\n请更新 frontend/src/lib/contracts.ts 中的合约地址！");
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exitCode = 1;
});
