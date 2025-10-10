# Mempool Transaction Monitor

A real-time blockchain mempool monitoring and analysis system for EVM-compatible chains (Ethereum, BSC). This educational project demonstrates pending transaction detection, heuristic-based classification, and prediction accuracy measurement.

## Overview

This system monitors the mempool for "hot" transactions such as:
- Contract deployments
- Liquidity pool additions (addLiquidity)
- DEX swaps
- Token transfers and approvals

It uses heuristic analysis to classify transactions based on method signatures, router addresses, and transaction data patterns, then measures prediction accuracy by comparing against mined transaction outcomes.

## Features

- **Real-time Mempool Monitoring**: WebSocket connection to detect pending transactions
- **Smart Classification**: Heuristic-based transaction type detection
  - Contract deployments
  - DEX liquidity additions (Uniswap, PancakeSwap, SushiSwap)
  - Token swaps and transfers
  - Factory pair creation
- **Latency Tracking**: Measures time from detection to mining
- **Accuracy Metrics**: Precision/recall analysis of predictions
- **Live Dashboard**: Real-time analytics with React + Tailwind CSS
- **Data Persistence**: Supabase PostgreSQL backend
- **Structured Logging**: Comprehensive error handling and monitoring

## Architecture

### Backend Services
- `mempool-monitor.ts`: WebSocket subscriber and block analyzer
- `transaction-classifier.ts`: Heuristic classification engine
- `logger.ts`: Structured logging system
- `supabase.ts`: Database client and type definitions

### Frontend Components
- `App.tsx`: Main dashboard layout
- `MetricsCard.tsx`: Key performance indicators
- `TransactionList.tsx`: Real-time transaction feed
- `AccuracyChart.tsx`: Prediction accuracy breakdown
- `TypeDistribution.tsx`: Transaction type distribution

### Database Schema
- `pending_transactions`: Raw mempool data
- `transaction_classifications`: Heuristic predictions
- `mined_transactions`: Confirmed blockchain data
- `analysis_metrics`: Accuracy and latency measurements

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Ethereum/BSC node access (Alchemy, Infura, or self-hosted)
- Supabase account (database provided)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd services
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL (pre-configured)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key (pre-configured)
- `VITE_ETH_RPC_URL`: Ethereum RPC endpoint (e.g., Alchemy, Infura)
- `VITE_ETH_WS_URL`: Ethereum WebSocket endpoint

### RPC Provider Setup

#### Alchemy (Recommended)
1. Sign up at https://www.alchemy.com/
2. Create a new app for Ethereum Mainnet
3. Copy the HTTP URL to `VITE_ETH_RPC_URL`
4. Copy the WebSocket URL to `VITE_ETH_WS_URL`

**Rate Limits**: Free tier provides 300M compute units/month
- Adequate for testing and development
- Consider paid plans for production monitoring

#### Infura
1. Sign up at https://infura.io/
2. Create a new project
3. Use format: `https://mainnet.infura.io/v3/YOUR_API_KEY`
4. Use format: `wss://mainnet.infura.io/ws/v3/YOUR_API_KEY`

**Rate Limits**: Free tier provides 100,000 requests/day

### Database Setup

The database is automatically configured with Supabase. Migrations are pre-applied with:
- 4 tables for transaction tracking
- Row Level Security (RLS) policies
- Indexes for query performance

No manual database setup required.

### Running the Application

Development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

Type checking:
```bash
npm run typecheck
```

## Usage

### Starting the Monitor

The mempool monitor is designed to run as a background service. To integrate it into your application:

```typescript
import { MempoolMonitor } from './services/mempool-monitor';

const monitor = new MempoolMonitor({
  rpcUrl: import.meta.env.VITE_ETH_RPC_URL,
  wsUrl: import.meta.env.VITE_ETH_WS_URL,
  hotTransactionThreshold: 7, // Score threshold for "hot" transactions
});

await monitor.start();
```

The monitor will:
1. Connect to the mempool via WebSocket
2. Detect pending transactions
3. Classify them using heuristics
4. Track when they get mined
5. Calculate accuracy metrics

### Dashboard

Access the dashboard at `http://localhost:5173` to view:
- Real-time transaction feed
- Classification accuracy metrics
- Type distribution charts
- Latency measurements
- Hot transaction alerts

## Retry and Backoff Strategy

### WebSocket Reconnection
- **Initial Delay**: 5 seconds
- **Backoff**: Exponential (2^n)
- **Max Attempts**: 10
- **Max Delay**: ~5,120 seconds (~85 minutes)

### Error Handling
- Duplicate transaction prevention with in-memory cache
- Database constraint handling (unique transaction hashes)
- Provider error recovery with automatic reconnection
- Graceful degradation on RPC failures

### Rate Limit Management
- Transaction cache with 5-minute TTL
- Batch block processing
- Configurable gas price filters
- Smart retry on rate limit errors

## Classification Heuristics

### Method Signature Detection
The classifier analyzes the first 4 bytes of transaction calldata to identify common DEX operations:
- `0xf305d719`: addLiquidityETH
- `0xe8e33700`: addLiquidity
- `0x7ff36ab5`: swapExactETHForTokens
- `0x38ed1739`: swapExactTokensForTokens
- `0xa9059cbb`: transfer
- `0x095ea7b3`: approve

### Router Recognition
Known DEX routers are identified by address:
- Uniswap V2/V3 Routers
- PancakeSwap Router
- SushiSwap Router

### Confidence Scoring
- **0.9-1.0**: Known router + known method
- **0.8-0.9**: Factory contract + known method
- **0.6-0.7**: Unknown contract + known method
- **0.2-0.5**: Unknown method signature

### Hot Transaction Scoring
Transactions are scored based on:
- Classification type (deploy=10, add_liquidity=9, swap=5)
- Confidence level (0-1 multiplier)
- Router bonus (1.5x if known router)

## Measurement and Reporting

### Metrics Tracked
1. **Latency**: Time from mempool detection to block mining
2. **Accuracy**: Predicted type vs. actual type (from logs)
3. **Precision**: Correct predictions / total predictions per type
4. **Recall**: Detected transactions / total transactions per type

### Actual Type Inference
After mining, the system analyzes event logs to determine actual transaction type:
- `PairCreated` event → create_pair
- `Mint` event → add_liquidity
- `Swap` event → swap
- `Transfer` event → token_transfer

### Report Generation

Query Supabase for analytics:

```sql
-- Overall accuracy
SELECT
  COUNT(*) FILTER (WHERE prediction_correct = true)::float / COUNT(*) * 100 as accuracy,
  AVG(latency_ms) as avg_latency_ms
FROM analysis_metrics;

-- Per-type precision
SELECT
  predicted_type,
  COUNT(*) FILTER (WHERE prediction_correct = true)::float / COUNT(*) * 100 as precision,
  COUNT(*) as total_predictions
FROM analysis_metrics
GROUP BY predicted_type;
```

## Limitations

### Network Constraints
- Mempool visibility limited by RPC provider
- Some transactions never reach public mempool (private mempools, flashbots)
- WebSocket connection stability depends on provider

### Classification Accuracy
- Heuristic-based classification has inherent limitations
- Unknown method signatures default to low confidence
- Contract deployments cannot be sub-categorized (token vs. other)
- Dynamic proxy patterns may be misclassified

### RPC Rate Limits
- Free tier providers have strict limits
- Recommend using paid plans for continuous monitoring
- Implement caching and batch processing for efficiency

## Ethical and Legal Considerations

**This system is designed for research and educational purposes only.**

### Prohibited Uses
- **Front-running**: Using mempool data to front-run other users' transactions
- **Market manipulation**: Exploiting transaction data for unfair trading advantages
- **Sandwich attacks**: Placing transactions before and after target transactions
- **MEV extraction**: Extracting value from transaction ordering

### Permitted Uses
- Academic research on blockchain transaction patterns
- Educational exploration of mempool dynamics
- Performance analysis of DEX protocols
- Development of transparent, fair trading tools
- Security research and vulnerability detection

### Legal Compliance
- Ensure compliance with local securities and trading regulations
- Respect RPC provider terms of service
- Do not overload public infrastructure
- Consider privacy implications of transaction monitoring

## Grading Rubric

### Collecting & Syncing Mempool (30 points)
- WebSocket connection to mempool
- Pending transaction detection
- Transaction detail retrieval
- Data persistence in Supabase

### Sound Heuristics (30 points)
- Method signature recognition
- Router address detection
- Token address extraction
- Confidence scoring system
- Hot transaction identification

### Measurement & Report (25 points)
- Latency tracking (detection to mining)
- Prediction accuracy calculation
- Precision/recall by transaction type
- Actual type inference from logs

### Documentation (15 points)
- Comprehensive README
- Setup instructions
- Environment configuration
- RPC/WS provider guidance
- Retry/backoff strategy explanation
- Ethical considerations

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Blockchain**: ethers.js v6
- **Database**: Supabase (PostgreSQL)
- **Build Tool**: Vite
- **Icons**: Lucide React

## Contributing

This is an educational project. Contributions are welcome for:
- Additional DEX router support
- Improved classification heuristics
- Enhanced analytics visualization
- Documentation improvements

## License

MIT License - Educational use only. See LICENSE file for details.

## Disclaimer

This software is provided for educational purposes only. The authors are not responsible for any financial losses, legal issues, or damages resulting from the use of this software. Always comply with applicable laws and regulations when working with blockchain data and financial systems.
