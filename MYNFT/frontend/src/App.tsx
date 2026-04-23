import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CreateNFT from './components/CreateNFT';
import CreateAuction from './components/CreateAuction';
import AuctionList from './components/AuctionList';
import './App.css';

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error checking wallet:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>NFT拍卖市场</h1>
        <div className="wallet-connect">
          {isConnected && address ? (
            <div className="connected">
              <span>{address.substring(0, 6)}...{address.substring(address.length - 4)}</span>
              <button onClick={disconnectWallet}>断开连接</button>
            </div>
          ) : (
            <button onClick={connectWallet}>连接钱包</button>
          )}
        </div>
      </header>

      <main className="app-main">
        {isConnected ? (
          <div className="dashboard">
            <CreateNFT />
            <CreateAuction />
            <AuctionList />
          </div>
        ) : (
          <div className="welcome">
            <h2>欢迎使用NFT拍卖市场</h2>
            <p>请连接钱包以开始使用</p>
            <button onClick={connectWallet}>连接钱包</button>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>© 2026 NFT拍卖市场</p>
      </footer>
    </div>
  );
}

export default App;
