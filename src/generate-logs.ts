import { supabase } from './services/supabase';

async function generateLogs() {
  console.log('='.repeat(80));
  console.log('MEMPOOL MONITORING LOGS');
  console.log('='.repeat(80));
  console.log();

  const { data: pending } = await supabase
    .from('pending_transactions')
    .select('*')
    .order('detected_at', { ascending: true });

  const { data: classifications } = await supabase
    .from('transaction_classifications')
    .select('*')
    .order('classified_at', { ascending: true });

  const { data: mined } = await supabase
    .from('mined_transactions')
    .select('*')
    .order('mined_at', { ascending: true });

  const { data: metrics } = await supabase
    .from('analysis_metrics')
    .select('*')
    .order('analyzed_at', { ascending: true });

  console.log('--- PENDING TRANSACTIONS DETECTED ---\n');
  pending?.forEach(tx => {
    console.log(`[${tx.detected_at}] [INFO] [MempoolMonitor] Pending transaction detected`);
    console.log(`  TX Hash: ${tx.tx_hash}`);
    console.log(`  From: ${tx.from_address}`);
    console.log(`  To: ${tx.to_address || 'CONTRACT_DEPLOY'}`);
    console.log(`  Gas Price: ${tx.gas_price} wei`);
    console.log(`  Gas Limit: ${tx.gas_limit}`);
    console.log();
  });

  console.log('\n--- TRANSACTION CLASSIFICATIONS ---\n');
  classifications?.forEach(cls => {
    const isHot = ['swap', 'add_liquidity', 'create_pair', 'contract_deploy'].includes(cls.classification_type);
    const logLevel = isHot ? 'INFO' : 'DEBUG';
    const label = isHot ? 'HOT transaction detected' : 'Transaction classified';

    console.log(`[${cls.classified_at}] [${logLevel}] [TransactionClassifier] ${label}`);
    console.log(`  TX Hash: ${cls.tx_hash}`);
    console.log(`  Type: ${cls.classification_type}`);
    console.log(`  Confidence: ${(cls.confidence * 100).toFixed(1)}%`);
    console.log(`  Method: ${cls.method_signature}`);
    if (cls.router_address) {
      console.log(`  Router: ${cls.router_address}`);
    }
    console.log();
  });

  console.log('\n--- MINED TRANSACTIONS ---\n');
  mined?.forEach(tx => {
    console.log(`[${tx.mined_at}] [INFO] [MempoolMonitor] Transaction mined`);
    console.log(`  TX Hash: ${tx.tx_hash}`);
    console.log(`  Block: ${tx.block_number}`);
    console.log(`  Status: ${tx.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Gas Used: ${tx.gas_used}`);
    console.log();
  });

  console.log('\n--- ANALYSIS METRICS ---\n');
  metrics?.forEach(metric => {
    console.log(`[${metric.analyzed_at}] [DEBUG] [MempoolMonitor] Metrics calculated`);
    console.log(`  TX Hash: ${metric.tx_hash}`);
    console.log(`  Predicted: ${metric.predicted_type}`);
    console.log(`  Actual: ${metric.actual_type || 'N/A'}`);
    console.log(`  Correct: ${metric.prediction_correct ? 'YES' : metric.was_mined ? 'NO' : 'UNMINED'}`);
    if (metric.latency_ms) {
      console.log(`  Latency: ${metric.latency_ms}ms`);
      console.log(`  Mempool Time: ${(metric.mempool_time_ms / 1000).toFixed(2)}s`);
    }
    console.log();
  });

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log();

  const totalPending = pending?.length || 0;
  const totalMined = mined?.length || 0;
  const totalCorrect = metrics?.filter(m => m.prediction_correct).length || 0;
  const totalPredicted = metrics?.filter(m => m.was_mined).length || 0;

  console.log(`Total Transactions Detected: ${totalPending}`);
  console.log(`Total Transactions Mined: ${totalMined}`);
  console.log(`Total Predictions Made: ${totalPredicted}`);
  console.log(`Correct Predictions: ${totalCorrect}`);
  console.log(`Accuracy: ${totalPredicted > 0 ? ((totalCorrect / totalPredicted) * 100).toFixed(2) : 0}%`);

  const avgLatency = metrics?.filter(m => m.latency_ms).reduce((sum, m) => sum + m.latency_ms!, 0) / (metrics?.filter(m => m.latency_ms).length || 1);
  console.log(`Average Latency: ${avgLatency.toFixed(0)}ms`);
  console.log();
}

generateLogs().catch(console.error);
