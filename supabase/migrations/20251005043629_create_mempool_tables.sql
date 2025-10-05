/*
  # Mempool Transaction Analysis Schema

  ## Overview
  This migration creates tables for monitoring and analyzing pending transactions from the Ethereum/BSC mempool,
  tracking their lifecycle from pending to mined, and measuring prediction accuracy.

  ## Tables Created

  ### 1. pending_transactions
  Stores raw pending transaction data from mempool subscription:
  - `id` (bigserial, primary key) - Auto-incrementing ID
  - `tx_hash` (text, unique, indexed) - Transaction hash
  - `from_address` (text) - Sender address
  - `to_address` (text, indexed) - Recipient address (null for contract deployments)
  - `value` (text) - ETH/BNB value in wei (stored as text to avoid precision loss)
  - `gas_price` (text) - Gas price in wei
  - `max_fee_per_gas` (text) - EIP-1559 max fee
  - `max_priority_fee_per_gas` (text) - EIP-1559 priority fee
  - `gas_limit` (text) - Gas limit
  - `input_data` (text) - Transaction calldata
  - `nonce` (integer) - Transaction nonce
  - `detected_at` (timestamptz) - When we first saw this tx in mempool
  - `created_at` (timestamptz) - Record creation time

  ### 2. transaction_classifications
  Stores heuristic-based classification of pending transactions:
  - `id` (bigserial, primary key)
  - `tx_hash` (text, foreign key, indexed) - Links to pending_transactions
  - `classification_type` (text) - Type: 'contract_deploy', 'add_liquidity', 'swap', 'token_transfer', 'unknown'
  - `confidence` (numeric) - Confidence score 0-1
  - `method_signature` (text) - First 4 bytes of calldata (function selector)
  - `router_address` (text) - DEX router address if applicable
  - `tokens_involved` (jsonb) - Array of token addresses detected
  - `metadata` (jsonb) - Additional classification metadata
  - `classified_at` (timestamptz) - Classification timestamp
  - `created_at` (timestamptz)

  ### 3. mined_transactions
  Stores confirmed transaction data after mining:
  - `id` (bigserial, primary key)
  - `tx_hash` (text, unique, indexed) - Transaction hash
  - `block_number` (bigint, indexed) - Block number
  - `block_hash` (text) - Block hash
  - `transaction_index` (integer) - Position in block
  - `status` (integer) - 1=success, 0=failed
  - `gas_used` (text) - Actual gas consumed
  - `effective_gas_price` (text) - Actual gas price paid
  - `mined_at` (timestamptz) - When block was mined
  - `logs` (jsonb) - Transaction logs/events
  - `created_at` (timestamptz)

  ### 4. analysis_metrics
  Stores analysis results comparing predictions vs actual outcomes:
  - `id` (bigserial, primary key)
  - `tx_hash` (text, foreign key, indexed) - Links to pending_transactions
  - `predicted_type` (text) - What we predicted
  - `actual_type` (text) - What actually happened (from logs)
  - `was_mined` (boolean) - Whether tx was actually mined
  - `latency_ms` (integer) - Time from detection to mining (milliseconds)
  - `prediction_correct` (boolean) - True/false prediction accuracy
  - `mempool_time_ms` (integer) - How long tx stayed in mempool
  - `analyzed_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public read access for analytics (research/learning purpose)
  - No write access through web clients (data written by backend services)

  ## Indexes
  - tx_hash indexes for fast lookups across tables
  - to_address index for filtering contract interactions
  - block_number index for temporal queries
  - classification_type index for filtering by prediction type

  ## Notes
  - Gas prices stored as text to avoid JavaScript number precision issues with large wei values
  - JSONB used for flexible metadata storage (tokens, logs, etc.)
  - Timestamps track both detection time and processing time for latency analysis
*/

-- Create pending_transactions table
CREATE TABLE IF NOT EXISTS pending_transactions (
  id bigserial PRIMARY KEY,
  tx_hash text UNIQUE NOT NULL,
  from_address text NOT NULL,
  to_address text,
  value text NOT NULL DEFAULT '0',
  gas_price text,
  max_fee_per_gas text,
  max_priority_fee_per_gas text,
  gas_limit text NOT NULL,
  input_data text NOT NULL DEFAULT '0x',
  nonce integer NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_tx_hash ON pending_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_pending_to_address ON pending_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_pending_detected_at ON pending_transactions(detected_at);

-- Create transaction_classifications table
CREATE TABLE IF NOT EXISTS transaction_classifications (
  id bigserial PRIMARY KEY,
  tx_hash text NOT NULL REFERENCES pending_transactions(tx_hash) ON DELETE CASCADE,
  classification_type text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  method_signature text,
  router_address text,
  tokens_involved jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  classified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_tx_hash ON transaction_classifications(tx_hash);
CREATE INDEX IF NOT EXISTS idx_classification_type ON transaction_classifications(classification_type);
CREATE INDEX IF NOT EXISTS idx_classification_router ON transaction_classifications(router_address);

-- Create mined_transactions table
CREATE TABLE IF NOT EXISTS mined_transactions (
  id bigserial PRIMARY KEY,
  tx_hash text UNIQUE NOT NULL,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  transaction_index integer NOT NULL,
  status integer NOT NULL,
  gas_used text NOT NULL,
  effective_gas_price text NOT NULL,
  mined_at timestamptz NOT NULL,
  logs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mined_tx_hash ON mined_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_mined_block_number ON mined_transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_mined_at ON mined_transactions(mined_at);

-- Create analysis_metrics table
CREATE TABLE IF NOT EXISTS analysis_metrics (
  id bigserial PRIMARY KEY,
  tx_hash text NOT NULL REFERENCES pending_transactions(tx_hash) ON DELETE CASCADE,
  predicted_type text NOT NULL,
  actual_type text,
  was_mined boolean NOT NULL,
  latency_ms integer,
  prediction_correct boolean,
  mempool_time_ms integer,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_tx_hash ON analysis_metrics(tx_hash);
CREATE INDEX IF NOT EXISTS idx_metrics_predicted_type ON analysis_metrics(predicted_type);
CREATE INDEX IF NOT EXISTS idx_metrics_prediction_correct ON analysis_metrics(prediction_correct);
CREATE INDEX IF NOT EXISTS idx_metrics_analyzed_at ON analysis_metrics(analyzed_at);

-- Enable Row Level Security
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mined_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_metrics ENABLE ROW LEVEL SECURITY;

-- Public read-only policies (for research/learning dashboard)
CREATE POLICY "Allow public read access to pending transactions"
  ON pending_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to classifications"
  ON transaction_classifications FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to mined transactions"
  ON mined_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to analysis metrics"
  ON analysis_metrics FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role only write policies (backend services only)
CREATE POLICY "Service role can insert pending transactions"
  ON pending_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert classifications"
  ON transaction_classifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert mined transactions"
  ON mined_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert analysis metrics"
  ON analysis_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update all tables"
  ON pending_transactions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can update classifications"
  ON transaction_classifications FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can update mined transactions"
  ON mined_transactions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can update metrics"
  ON analysis_metrics FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);