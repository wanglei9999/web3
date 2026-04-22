import { useState, useEffect } from 'react';
import { config, chains } from './lib/wagmi';
import { WagmiConfig, useAccount, useConnect, useDisconnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import CreateNFT from './components/CreateNFT';
import CreateAuction from './components/CreateAuction';
import AuctionList from './components/AuctionList';
import './App.css';

function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({
    connector: new InjectedConnector({ chains }),
  });
  const { disconnect } = useDisconnect();

  return (
    <div className="app">
      <header className="app-header">
        <h1>NFT拍卖市场</h1>
        <div className="wallet-connect">
          {isConnected ? (
            <div className="connected">
              <span>{address?.substring(0, 6)}...{address?.substring(address.length - 4)}</span>
              <button onClick={disconnect}>断开连接</button>
            </div>
          ) : (
            <button onClick={() => connect()}>连接钱包</button>
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
            <button onClick={() => connect()}>连接钱包</button>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>© 2026 NFT拍卖市场</p>
      </footer>
    </div>
  );
}

function AppWithProviders() {
  return (
    <WagmiConfig config={config}>
      <App />
    </WagmiConfig>
  );
}

export default AppWithProviders;
