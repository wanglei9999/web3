import { useState } from 'react';
import { ethers } from 'ethers';
import { auctionHouseAbi, myNFTAbi, contractAddresses } from '../lib/contracts';

const CreateAuction = () => {
  const [nftContract, setNftContract] = useState(contractAddresses.myNFT);
  const [tokenId, setTokenId] = useState('0');
  const [startingPrice, setStartingPrice] = useState('1');
  const [duration, setDuration] = useState('3600');
  const [isETH, setIsETH] = useState(true);
  const [paymentToken, setPaymentToken] = useState('0x0000000000000000000000000000000000000000');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error('请安装MetaMask钱包');
      }

      if (!nftContract || !tokenId || !startingPrice || !duration) {
        throw new Error('请填写所有必填字段');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signerAddress = await signer.getAddress();

      const nftContractInstance = new ethers.Contract(nftContract, myNFTAbi, signer);
      const auctionHouseContract = new ethers.Contract(contractAddresses.auctionHouse, auctionHouseAbi, signer);

      const owner = await nftContractInstance.ownerOf(tokenId);
      if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error('您不是该NFT的所有者');
      }

      const isApproved = await nftContractInstance.isApprovedForAll(signerAddress, contractAddresses.auctionHouse);
      if (!isApproved) {
        const approveTx = await nftContractInstance.setApprovalForAll(contractAddresses.auctionHouse, true);
        await approveTx.wait();
      }

      const tx = await auctionHouseContract.createAuction(
        nftContract,
        tokenId,
        ethers.utils.parseEther(startingPrice),
        0,
        duration,
        paymentToken,
        isETH
      );
      await tx.wait();

      setSuccess('拍卖创建成功！');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-auction">
      <h2>创建拍卖</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nftContract">NFT合约地址</label>
          <input
            type="text"
            id="nftContract"
            value={nftContract}
            onChange={(e) => setNftContract(e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="form-group">
          <label htmlFor="tokenId">Token ID</label>
          <input
            type="number"
            id="tokenId"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="startingPrice">起拍价 (ETH)</label>
          <input
            type="number"
            id="startingPrice"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            placeholder="1"
            step="0.1"
          />
        </div>
        <div className="form-group">
          <label htmlFor="duration">持续时间 (秒)</label>
          <input
            type="number"
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="3600"
          />
        </div>
        <div className="form-group">
          <label>支付方式</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                checked={isETH}
                onChange={() => setIsETH(true)}
              />
              ETH
            </label>
            <label>
              <input
                type="radio"
                checked={!isETH}
                onChange={() => setIsETH(false)}
              />
              ERC20
            </label>
          </div>
        </div>
        {!isETH && (
          <div className="form-group">
            <label htmlFor="paymentToken">ERC20代币地址</label>
            <input
              type="text"
              id="paymentToken"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              placeholder="0x..."
            />
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? '创建中...' : '创建拍卖'}
        </button>
      </form>
    </div>
  );
};

export default CreateAuction;
