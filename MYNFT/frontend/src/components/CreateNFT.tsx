import { useState } from 'react';
import { ethers } from 'ethers';
import { myNFTAbi, contractAddresses } from '../lib/contracts';

const CreateNFT = () => {
  const [tokenURI, setTokenURI] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setMintedTokenId(null);
    setIsLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error('请安装MetaMask钱包');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddresses.myNFT, myNFTAbi, signer);

      const uri = tokenURI || 'https://example.com/nft/default';
      const tx = await contract.safeMint(await signer.getAddress(), uri);
      await tx.wait();

      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (receipt && receipt.logs.length > 0) {
        const transferEvent = receipt.logs.find(log => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
        if (transferEvent) {
          const tokenId = ethers.BigNumber.from(transferEvent.topics[3]).toString();
          setMintedTokenId(tokenId);
        }
      }

      setSuccess('NFT创建成功！');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCreate = async () => {
    setError('');
    setSuccess('');
    setMintedTokenId(null);
    setIsLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error('请安装MetaMask钱包');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddresses.myNFT, myNFTAbi, signer);

      const randomTokenId = Math.floor(Math.random() * 10000);
      const uri = `https://example.com/nft/${randomTokenId}`;
      setTokenURI(uri);

      const tx = await contract.safeMint(await signer.getAddress(), uri);
      await tx.wait();

      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (receipt && receipt.logs.length > 0) {
        const transferEvent = receipt.logs.find(log => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
        if (transferEvent) {
          const tokenId = ethers.BigNumber.from(transferEvent.topics[3]).toString();
          setMintedTokenId(tokenId);
        }
      }

      setSuccess('NFT创建成功！');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-nft">
      <h2>创建NFT</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="tokenURI">Token URI (可选)</label>
          <input
            type="text"
            id="tokenURI"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
            placeholder="留空则使用默认URI"
          />
        </div>
        {mintedTokenId && (
          <div className="success token-id">
            <span>✨ 已创建NFT</span>
            <p>Token ID: <strong>{mintedTokenId}</strong></p>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {success && !mintedTokenId && <p className="success">{success}</p>}
        <div className="button-group">
          <button type="submit" disabled={isLoading}>
            {isLoading ? '创建中...' : '创建NFT'}
          </button>
          <button type="button" onClick={handleQuickCreate} disabled={isLoading}>
            {isLoading ? '创建中...' : '快速创建'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateNFT;
