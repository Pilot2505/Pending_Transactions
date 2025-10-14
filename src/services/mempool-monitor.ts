import { ethers } from 'ethers';
import { supabase, PendingTransaction, TransactionClassification } from './supabase';
import { TransactionClassifier } from './transaction-classifier';
import { createLogger } from './logger';

const logger = createLogger('MempoolMonitor');

export interface MempoolConfig {
  rpcUrl: string;
  wsUrl: string;
  minGasPrice?: string;
  hotTransactionThreshold?: number;
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
    await new Promise(res => setTimeout(res, delayMs));
  }
  return null;
}

export class MempoolMonitor {
private provider!: ethers.WebSocketProvider;
private classifier!: TransactionClassifier;
private config!: MempoolConfig;
private isRunning = false;
private reconnectAttempts = 0;
private maxReconnectAttempts = 10;
private reconnectDelay = 5000;
private pendingTxCache = new Map<string, number>();

constructor(config: MempoolConfig) {
  this.config = config;
  this.classifier = new TransactionClassifier();
  // Provider will be initialized in start()
}

  private setupProviderListeners() {
    this.provider.on('error', (error) => {
      logger.error('WebSocket error', { error: (error as Error).message });
      this.handleReconnect();
    });

    const wsProvider = this.provider as any;
    const rawSocket = wsProvider._websocket || wsProvider.websocket || null;

    if (rawSocket && rawSocket.on) {
      rawSocket.on('close', () => {
        logger.warn('WebSocket connection closed');
        if (this.isRunning) {
          this.handleReconnect();
        }
      });
    } else {
      logger.warn('No raw websocket available for close event');
    }
  }


  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.isRunning = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {

      await this.start();

      this.reconnectAttempts = 0;
      logger.info('Reconnected successfully');
    } catch (error) {
      logger.error('Reconnection failed', { error });
      this.handleReconnect();
    }
  }


  async start() { 
    if (this.isRunning) {
      logger.warn('Monitor already running');
      return;
    }

    this.isRunning = true;

    logger.info('Starting mempool monitor', {
      wsUrl: this.config.wsUrl,
      threshold: this.config.hotTransactionThreshold,
    });

    // ✅ Create the provider here instead of the constructor
    this.provider = new ethers.WebSocketProvider(this.config.wsUrl);


    // ✅ Set up listeners on the fresh provider
    this.setupProviderListeners();

    this.provider.on('pending', async (txHash) => {
      try {
        await this.handlePendingTransaction(txHash);
      } catch (error) {
        logger.error('Error handling pending transaction', {
          txHash,
          error: error instanceof Error ? error.message : error,
        });
      }
    });

    this.startBlockMonitor();
  }


  private async handlePendingTransaction(txHash: string) {
    if (this.pendingTxCache.has(txHash)) {
      logger.debug('Transaction already in cache', { txHash });
      return;
    }
    this.pendingTxCache.set(txHash, Date.now());

    try {
      // Retry more aggressively for pending tx
      let tx = await retry(() => this.provider.getTransaction(txHash), 10, 300);

      if (!tx) {
        logger.warn('Transaction not found', { txHash });
        return;
      }

      const detectedAt = new Date().toISOString();

      // Upsert pending transaction
      const pendingTx: PendingTransaction = {
        tx_hash: tx.hash,
        from_address: (tx.from ?? '0x0').toLowerCase(),
        to_address: tx.to?.toLowerCase() || null,
        value: tx.value?.toString() || '0',
        gas_price: tx.gasPrice?.toString() || null,
        max_fee_per_gas: tx.maxFeePerGas?.toString() || null,
        max_priority_fee_per_gas: tx.maxPriorityFeePerGas?.toString() || null,
        gas_limit: tx.gasLimit?.toString() || '0',
        input_data: tx.data || '0x',
        nonce: tx.nonce ?? 0,
        detected_at: detectedAt,
      };

      const { error: insertError } = await supabase
        .from('pending_transactions')
        .upsert(pendingTx, { onConflict: 'tx_hash' });

      if (insertError) {
        logger.error('Failed to insert pending transaction', { txHash, error: insertError.message });
      }

      // Classification
      const classification = this.classifier?.classifyTransaction?.(tx.to, tx.data) || {
        type: 'unknown',
        confidence: 0,
        methodSignature: null,
        routerAddress: null,
        tokensInvolved: [],
        metadata: {},
      };

      // Always log classification and score
      const hotScore = this.classifier?.getHotTransactionScore?.(classification) || 0;
      logger.debug('Hot score calculated', { txHash: tx.hash, score: hotScore, classification });
      logger.info('Transaction classified', {
        txHash,
        type: classification.type,
        confidence: classification.confidence,
        router: classification.routerAddress,
        tokens: classification.tokensInvolved,
        score: hotScore,
        threshold: this.config.hotTransactionThreshold || 0.1,
      });

      if (hotScore >= (this.config.hotTransactionThreshold || 0.1)) {
        logger.info('HOT transaction detected', {
          txHash,
          type: classification.type,
          confidence: classification.confidence,
          score: hotScore,
          router: classification.routerAddress,
        });
      }

      // Upsert classification
      const txClassification: TransactionClassification = {
        tx_hash: tx.hash,
        classification_type: classification.type,
        confidence: classification.confidence,
        method_signature: classification.methodSignature,
        router_address: classification.routerAddress,
        tokens_involved: classification.tokensInvolved,
        metadata: classification.metadata,
        classified_at: new Date().toISOString(),
      };

      const { error: classError } = await supabase
        .from('transaction_classifications')
        .upsert(txClassification, { onConflict: 'tx_hash' });

      if (classError) {
        logger.error('Failed to insert transaction classification', { txHash, error: classError.message });
      }

    } catch (err: any) {
      if (err?.code !== -32000 && !String(err.message).includes('transaction not found')) {
        logger.error('Error handling pending transaction', { txHash, error: err.message || err });
      }
    } finally {
      setTimeout(() => this.pendingTxCache.delete(txHash), 300000); // 5 min cache
    }
  }


  private startBlockMonitor() {
    this.provider.on('block', async (blockNumber) => {
      try {
        await this.analyzeBlock(blockNumber);
      } catch (error) {
        logger.error('Error analyzing block', {
          blockNumber,
          error: error instanceof Error ? error.message : error,
        });
      }
    });

    logger.info('Block monitor started');
  }

    private async analyzeBlock(blockNumber: number) {
      logger.info('Analyzing block', { blockNumber });
      try {
        const block = await retry(() => this.provider.getBlock(blockNumber, true), 5, 500);

        if (!block || !block.transactions || block.transactions.length === 0) {
          return;
        }

        const blockMinedAt = new Date(block.timestamp * 1000).toISOString();

      for (const txData of block.transactions) {
        let tx: ethers.TransactionResponse | null = null;

        if (typeof txData === 'string') {
          tx = await this.provider.getTransaction(txData);
        } else {
          tx = txData as ethers.TransactionResponse;
        }

        if (!tx) continue;

        const receipt = await retry(() => this.provider.getTransactionReceipt(tx.hash), 5, 500);
        if (!receipt) continue;

        const classification = this.classifier?.classifyTransaction?.(tx.to, tx.data) || {
          type: 'unknown',
          confidence: 0,
          methodSignature: null,
          routerAddress: null,
          tokensInvolved: [],
          metadata: {},
        };

        const hotScore = this.classifier?.getHotTransactionScore?.(classification) || 0;

        if (hotScore >= (this.config.hotTransactionThreshold || 0.1)) {
          logger.info('HOT transaction detected (from block)', {
            txHash: tx.hash,
            type: classification.type,
            confidence: classification.confidence,
            score: hotScore,
            router: classification.routerAddress,
          });
        }
      
        const minedTx = {
          tx_hash: tx.hash,
          block_number: blockNumber,
          block_hash: block.hash || '',
          transaction_index: (receipt as any).transactionIndex ?? 0,  // fallback
          status: receipt.status ?? 0,
          gas_used: receipt.gasUsed?.toString() || '0', 
          effective_gas_price: (receipt as any).effectiveGasPrice?.toString() || '0',
          mined_at: blockMinedAt,
          logs: receipt.logs?.map((log: any) => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
          })) || [],
        };

        const { error } = await supabase.from('mined_transactions').insert([minedTx]);

        if (error && !error.message.includes('duplicate')) {
          logger.error('Error inserting mined transaction', {
            txHash: tx.hash,
            error: error.message,
          });
          continue;
        }

        try {
          await this.calculateMetrics(tx.hash, blockMinedAt);
        } catch (metricErr) {
          logger.error('Error calculating metrics', { txHash: tx.hash, error: metricErr });
        }
      }
    } catch (err: any) {
      // ✅ Only log unexpected errors, skip the known "not found" / -32000
      if (
        err?.code !== -32000 &&
        !String(err.message).includes('not found')
      ) {
        logger.error('Block analysis failed', {
          blockNumber,
          error: err.message || err,
        });
      }
    }
  }


  private async calculateMetrics(txHash: string, minedAt: string) {
    const { data: pendingTx } = await supabase
      .from('pending_transactions')
      .select('detected_at')
      .eq('tx_hash', txHash)
      .maybeSingle();

    const { data: classification } = await supabase
      .from('transaction_classifications')
      .select('classification_type')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (!pendingTx || !classification) {
      logger.warn('Cannot calculate metrics, missing data', { txHash });
      return;
    }

    const detectedTime = new Date(pendingTx.detected_at).getTime();
    const minedTime = new Date(minedAt).getTime();
    const latencyMs = minedTime - detectedTime;

    const { data: minedTx } = await supabase
      .from('mined_transactions')
      .select('logs, status')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (!minedTx) {
      logger.warn('Cannot calculate metrics, mined transaction missing', { txHash });
      return;
    }

    const actualType = minedTx.status === 1
      ? this.inferActualType(minedTx.logs, classification.classification_type)
      : 'unknown';

    const metric = {
      tx_hash: txHash,
      predicted_type: classification.classification_type,
      actual_type: actualType,
      was_mined: true,
      latency_ms: latencyMs,
      prediction_correct: actualType === classification.classification_type,
      mempool_time_ms: latencyMs,
      analyzed_at: new Date().toISOString(),
    };

    const { error: metricError } = await supabase.from('analysis_metrics').insert(metric);

    if (metricError) {
      logger.error('Failed to insert analysis metric', { txHash, error: metricError.message });
    } else {
      logger.debug('Metrics inserted successfully', { txHash, latencyMs, predicted: classification.classification_type, actual: actualType });
    }
  }

  private inferActualType(logs: unknown[], predictedType: string): string {
    if (!Array.isArray(logs) || logs.length === 0) {
      return predictedType;
    }

    const logTopics = logs.map((log: any) => log.topics?.[0] || '').filter(Boolean);

    const PAIR_CREATED = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';
    const MINT = '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f';
    const SWAP = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
    const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    if (logTopics.includes(PAIR_CREATED)) return 'create_pair';
    if (logTopics.includes(MINT)) return 'add_liquidity';
    if (logTopics.includes(SWAP)) return 'swap';
    if (logTopics.includes(TRANSFER)) return 'token_transfer';

    return predictedType;
  }

  async stop() {
    this.isRunning = false;
    this.provider.removeAllListeners();
    // Close the underlying websocket connection
    if ((this.provider as any)._websocket?.terminate) {
      (this.provider as any)._websocket.terminate();
    } else if ((this.provider as any)._websocket?.close) {
      (this.provider as any)._websocket.close();
    }
    logger.info('Mempool monitor stopped');
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      cacheSize: this.pendingTxCache.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
