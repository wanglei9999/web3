import { useState, useEffect } from 'react';
import { useContractRead, useProvider } from 'wagmi';
import { ethers } from 'ethers';
import { auctionHouseAbi, contractAddresses } from '../lib/contracts';

interface Auction {
  auctionId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  startingPrice: string;
  startTime: string;
  endTime: string;
  highestBidder: string;
  highestBid: string;
  isActive: boolean;
  paymentToken: string;
  isETH: boolean;
}

const AuctionList = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const provider = useProvider();

  const { data: auctionCounter } = useContractRead({
    address: contractAddresses.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'auctionCounter',
  });

  useEffect(() => {
    const fetchAuctions = async () => {
      if (!auctionCounter) return;

      setIsLoading(true);
      const auctionsData: Auction[] = [];

      const auctionHouseContract = new ethers.Contract(
        contractAddresses.auctionHouse,
        auctionHouseAbi,
        provider
      );

      for (let i = 0; i < Number(auctionCounter); i++) {
        try {
          const auctionData = await auctionHouseContract.auctionData(i);
          auctionsData.push({
            auctionId: auctionData.auctionId.toString(),
            seller: auctionData.seller,
            nftContract: auctionData.nftContract,
            tokenId: auctionData.tokenId.toString(),
            startingPrice: ethers.utils.formatEther(auctionData.startingPrice),
            startTime: auctionData.startTime.toString(),
            endTime: auctionData.endTime.toString(),
            highestBidder: auctionData.highestBidder,
            highestBid: ethers.utils.formatEther(auctionData.highestBid),
            isActive: auctionData.isActive,
            paymentToken: auctionData.paymentToken,
            isETH: auctionData.isETH
          });
        } catch (error) {
          console.error('Error fetching auction data:', error);
        }
      }

      setAuctions(auctionsData);
      setIsLoading(false);
    };

    fetchAuctions();
  }, [auctionCounter, provider]);

  if (isLoading) {
    return <div className="auction-list">加载拍卖列表中...</div>;
  }

  return (
    <div className="auction-list">
      <h2>拍卖列表</h2>
      {auctions.length === 0 ? (
        <p>暂无拍卖</p>
      ) : (
        <div className="auction-cards">
          {auctions.map((auction) => (
            <div key={auction.auctionId} className="auction-card">
              <div className="auction-header">
                <h3>拍卖 #{auction.auctionId}</h3>
                <span className={`status ${auction.isActive ? 'active' : 'ended'}`}>
                  {auction.isActive ? '进行中' : '已结束'}
                </span>
              </div>
              <div className="auction-details">
                <p><strong>NFT合约:</strong> {auction.nftContract.substring(0, 10)}...{auction.nftContract.substring(auction.nftContract.length - 4)}</p>
                <p><strong>Token ID:</strong> {auction.tokenId}</p>
                <p><strong>起拍价:</strong> {auction.startingPrice} {auction.isETH ? 'ETH' : 'ERC20'}</p>
                <p><strong>当前最高价:</strong> {auction.highestBid} {auction.isETH ? 'ETH' : 'ERC20'}</p>
                <p><strong>卖家:</strong> {auction.seller.substring(0, 10)}...{auction.seller.substring(auction.seller.length - 4)}</p>
                <p><strong>结束时间:</strong> {new Date(Number(auction.endTime) * 1000).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuctionList;
