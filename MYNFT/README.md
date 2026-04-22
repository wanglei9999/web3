# NFT Auction Market

一个基于 Hardhat 的 NFT 拍卖市场项目，支持 ETH 和 ERC20 代币出价，集成 Chainlink 预言机进行价格计算，并使用 UUPS 代理模式实现合约升级。

## 项目结构

```
├── contracts/
│   ├── MyNFT.sol          # ERC721 NFT 合约
│   ├── MyERC20.sol        # ERC20 测试代币
│   ├── AuctionHouse.sol   # 拍卖合约 V1
│   └── AuctionHouseV2.sol # 拍卖合约 V2 (用于升级测试)
├── test/
│   └── AuctionHouse.ts    # 测试文件
├── scripts/
│   └── deploy.ts          # 部署脚本
├── .env                   # 环境变量配置
├── hardhat.config.ts      # Hardhat 配置
└── package.json           # 项目依赖
```

## 功能特性

### NFT 合约 (MyNFT)
- ERC721 标准实现
- 支持铸造和转移
- 支持 URI 存储

### 拍卖合约 (AuctionHouse)
- 创建拍卖：允许用户将 NFT 上架拍卖
- ETH 出价：支持以太币出价
- ERC20 出价：支持 ERC20 代币出价
- 结束拍卖：自动转移 NFT 和资金
- 自动退款：当更高出价出现时自动退款给前出价者

### Chainlink 预言机集成
- ETH/USD 价格获取
- ERC20/USD 价格获取
- USD 金额转换

### 合约升级
- UUPS 代理模式
- 安全的升级授权机制

## 安装依赖

```bash
npm install --legacy-peer-deps
```

## 测试

```bash
npx hardhat test
```

## 部署

### 本地测试

```bash
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

### 测试网部署 (Sepolia)

首先配置 `.env` 文件：

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
SEPOLIA_PRIVATE_KEY=your-private-key
ETHERSCAN_API_KEY=your-etherscan-api-key
```

然后部署：

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## 合约地址 (测试网)

部署后会输出以下合约地址：
- MyNFT
- MyERC20  
- AuctionHouse (代理地址)

## 使用说明

### 创建拍卖

```solidity
auctionHouse.createAuction(
    nftContract,    // NFT 合约地址
    tokenId,        // NFT ID
    startingPrice,  // 起拍价
    duration,       // 拍卖时长(秒)
    paymentToken,   // ERC20 代币地址 (ETH 传 0x0)
    isETH           // 是否 ETH 拍卖
);
```

### 出价

```solidity
// ETH 出价
auctionHouse.placeBidETH(auctionId, { value: bidAmount });

// ERC20 出价
auctionHouse.placeBidERC20(auctionId, bidAmount);
```

### 结束拍卖

```solidity
auctionHouse.endAuction(auctionId);
```

## Chainlink 预言机地址

- Sepolia ETH/USD Feed: `0x694AA1769357215DE4FAC081bf1f309aDC325306`

## 技术栈

- Hardhat 2.x
- OpenZeppelin Contracts 4.9.3
- Chainlink Contracts 0.8.0
- Solidity 0.8.24
- TypeScript

## 许可证

MIT
