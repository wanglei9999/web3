import { useState, useEffect } from 'react';
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
  const [selectedAuction, setSelectedAuction] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    if (!window.ethereum) return;

    setIsLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddresses.auctionHouse, auctionHouseAbi, provider);

      const counter = await contract.auctionCounter();
      const auctionsData: Auction[] = [];

      for (let i = 0; i < Number(counter); i++) {
        const auctionData = await contract.auctionData(i);
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
      }

      setAuctions(auctionsData);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBid = async (auctionId: string) => {
    if (!bidAmount || !window.ethereum) return;

    setActionLoading('bid');
    setMessage(null);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddresses.auctionHouse, auctionHouseAbi, signer);

      const tx = await contract.bidAuction(auctionId, {
        value: ethers.utils.parseEther(bidAmount)
      });
      await tx.wait();

      setMessage({ type: 'success', text: '出价成功！' });
      setSelectedAuction(null);
      setBidAmount('');
      fetchAuctions();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleEndAuction = async (auctionId: string) => {
    if (!window.ethereum) return;

    setActionLoading('end');
    setMessage(null);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddresses.auctionHouse, auctionHouseAbi, signer);

      const tx = await contract.endAuction(auctionId);
      await tx.wait();

      setMessage({ type: 'success', text: '拍卖已结束！' });
      fetchAuctions();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCancelAuction = async (auctionId: string) => {
    if (!window.ethereum) return;

    setActionLoading('cancel');
    setMessage(null);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddresses.auctionHouse, auctionHouseAbi, signer);

      const tx = await contract.cancelAuction(auctionId);
      await tx.wait();

      setMessage({ type: 'success', text: '拍卖已取消！' });
      fetchAuctions();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const isSeller = async (seller: string) => {
    if (!window.ethereum) return false;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    return address.toLowerCase() === seller.toLowerCase();
  };

  const isAuctionEnded = (endTime: string) => Date.now() / 1000 > Number(endTime);

  if (isLoading) {
    return <div className="auction-list">加载拍卖列表中...</div>;
  }

  return (
    <div className="auction-list">
      <h2>拍卖列表</h2>
      {message && (
        <p className={`message ${message.type}`}>{message.text}</p>
      )}
      {auctions.length === 0 ? (
        <p>暂无拍卖</p>
      ) : (
        <div className="auction-cards">
          {auctions.map((auction) => (
            <div key={auction.auctionId} className="auction-card">
              <div className="auction-header">
                <h3>拍卖 #{auction.auctionId}</h3>
                <span className={`status ${auction.isActive ? (isAuctionEnded(auction.endTime) ? 'ended' : 'active') : 'ended'}`}>
                  {auction.isActive ? (isAuctionEnded(auction.endTime) ? '已结束' : '进行中') : '已结束'}
                </span>
              </div>
              <div className="auction-details">
                <p><strong>NFT合约:</strong> {auction.nftContract.substring(0, 10)}...{auction.nftContract.substring(auction.nftContract.length - 4)}</p>
                <p><strong>Token ID:</strong> {auction.tokenId}</p>
                <p><strong>起拍价:</strong> {auction.startingPrice} {auction.isETH ? 'ETH' : 'ERC20'}</p>
                <p><strong>当前最高价:</strong> {auction.highestBid || '无'} {auction.isETH ? 'ETH' : 'ERC20'}</p>
                <p><strong>卖家:</strong> {auction.seller.substring(0, 10)}...{auction.seller.substring(auction.seller.length - 4)}</p>
                <p><strong>结束时间:</strong> {new Date(Number(auction.endTime) * 1000).toLocaleString()}</p>
              </div>
              <div className="auction-actions">
                {auction.isActive && !isAuctionEnded(auction.endTime) && (
                  <>
                    <button 
                      className="btn-bid"
                      onClick={() => setSelectedAuction(auction.auctionId)}
                      disabled={actionLoading !== null}
                    >
                      出价
                    </button>
                    <button 
                      className="btn-cancel"
                      onClick={() => handleCancelAuction(auction.auctionId)}
                      disabled={actionLoading !== null}
                    >
                      取消
                    </button>
                  </>
                )}
                {(auction.isActive && isAuctionEnded(auction.endTime)) && (
                  <button 
                    className="btn-end"
                    onClick={() => handleEndAuction(auction.auctionId)}
                    disabled={actionLoading !== null}
                  >
                    结束拍卖
                  </button>
                )}
              </div>
              {selectedAuction === auction.auctionId && auction.isETH && (
                <div className="bid-modal">
                  <h4>出价 #{auction.auctionId}</h4>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`最低出价: ${auction.highestBid || auction.startingPrice} ETH`}
                    step="0.01"
                  />
                  <div className="modal-actions">
                    <button 
                      onClick={() => handleBid(auction.auctionId)}
                      disabled={!bidAmount || actionLoading === 'bid'}
                    >
                      {actionLoading === 'bid' ? '出价中...' : '确认出价'}
                    </button>
                    <button onClick={() => setSelectedAuction(null)}>取消</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuctionList;
