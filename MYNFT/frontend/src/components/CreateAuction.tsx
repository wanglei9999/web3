import { useState } from 'react';
import { useContractWrite, useWaitForTransaction } from 'wagmi';
import { ethers } from 'ethers';
import { auctionHouseAbi, contractAddresses } from '../lib/contracts';

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

  const { write: createAuction, data: createData } = useContractWrite({
    address: contractAddresses.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'createAuction',
    args: [
      nftContract,
      tokenId,
      ethers.utils.parseEther(startingPrice),
      0, // 立即开始
      duration,
      paymentToken,
      isETH
    ],
  });

  const { isLoading: isCreating, isSuccess: isCreateSuccess } = useWaitForTransaction({
    hash: createData?.hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!nftContract || !tokenId || !startingPrice || !duration) {
        throw new Error('请填写所有必填字段');
      }

      createAuction();
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  if (isCreateSuccess) {
    setSuccess('拍卖创建成功！');
    setIsLoading(false);
  }

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
        <button type="submit" disabled={isLoading || isCreating}>
          {isLoading || isCreating ? '创建中...' : '创建拍卖'}
        </button>
      </form>
    </div>
  );
};

export default CreateAuction;
