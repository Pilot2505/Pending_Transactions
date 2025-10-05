import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PendingTransaction {
  id?: number;
  tx_hash: string;
  from_address: string;
  to_address: string | null;
  value: string;
  gas_price: string | null;
  max_fee_per_gas: string | null;
  max_priority_fee_per_gas: string | null;
  gas_limit: string;
  input_data: string;
  nonce: number;
  detected_at: string;
  created_at?: string;
}

export interface TransactionClassification {
  id?: number;
  tx_hash: string;
  classification_type: string;
  confidence: number;
  method_signature: string | null;
  router_address: string | null;
  tokens_involved: string[];
  metadata: Record<string, unknown>;
  classified_at: string;
  created_at?: string;
}

export interface MinedTransaction {
  id?: number;
  tx_hash: string;
  block_number: number;
  block_hash: string;
  transaction_index: number;
  status: number;
  gas_used: string;
  effective_gas_price: string;
  mined_at: string;
  logs: unknown[];
  created_at?: string;
}

export interface AnalysisMetric {
  id?: number;
  tx_hash: string;
  predicted_type: string;
  actual_type: string | null;
  was_mined: boolean;
  latency_ms: number | null;
  prediction_correct: boolean | null;
  mempool_time_ms: number | null;
  analyzed_at: string;
  created_at?: string;
}
