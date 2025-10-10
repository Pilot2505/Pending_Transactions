import { MempoolMonitor } from './mempool-monitor';

const monitor = new MempoolMonitor({
  rpcUrl: import.meta.env.VITE_ETH_RPC_URL,
  wsUrl: import.meta.env.VITE_ETH_WS_URL,
  hotTransactionThreshold: 7,
});

await monitor.start();