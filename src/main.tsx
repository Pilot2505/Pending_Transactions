import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { MempoolMonitor } from './services/mempool-monitor';

const rpcUrl = import.meta.env.VITE_ETH_RPC_URL;
const wsUrl = import.meta.env.VITE_ETH_WS_URL;

if (rpcUrl && wsUrl) {
  const monitor = new MempoolMonitor({
    rpcUrl,
    wsUrl,
    hotTransactionThreshold: 7,
  });

  monitor.start().catch((error) => {
    console.error('Failed to start mempool monitor:', error);
  });
} else {
  console.warn('ETH RPC/WS URLs not configured. Mempool monitoring disabled.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
