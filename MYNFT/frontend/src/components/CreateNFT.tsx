import { useState } from 'react';
import { useContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { myNFTAbi, contractAddresses } from '../lib/contracts';

const CreateNFT = () => {
  const { address } = useAccount();
  const [tokenURI, setTokenURI] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { write: mintNFT, data: mintData } = useContractWrite({
    address: contractAddresses.myNFT,
    abi: myNFTAbi,
    functionName: 'safeMint',
    args: [address, tokenURI],
  });

  const { isLoading: isMinting, isSuccess: isMintSuccess } = useWaitForTransaction({
    hash: mintData?.hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!tokenURI) {
        throw new Error('请输入Token URI');
      }

      mintNFT();
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  if (isMintSuccess) {
    setSuccess('NFT创建成功！');
    setIsLoading(false);
    setTokenURI('');
  }

  return (
    <div className="create-nft">
      <h2>创建NFT</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="tokenURI">Token URI</label>
          <input
            type="text"
            id="tokenURI"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
            placeholder="https://example.com/nft/1"
          />
        </div>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit" disabled={isLoading || isMinting}>
          {isLoading || isMinting ? '创建中...' : '创建NFT'}
        </button>
      </form>
    </div>
  );
};

export default CreateNFT;
