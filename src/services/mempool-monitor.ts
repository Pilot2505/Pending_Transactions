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

export class MempoolMonitor {
  private provider: ethers.WebSocketProvider;
  private classifier: TransactionClassifier;
  private config: MempoolConfig;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private pendingTxCache = new Map<string, number>();

  constructor(config: MempoolConfig) {
    this.config = config;
    this.provider = new ethers.WebSocketProvider(config.wsUrl);
    this.classifier = new TransactionClassifier();
    this.setupProviderListeners();
  }

  private setupProviderListeners() {
    this.provider.websocket.on('error', (error) => {
      logger.error('WebSocket error', { error: error.message });
      this.handleReconnect();
    });

    this.provider.websocket.on('close', () => {
      logger.warn('WebSocket connection closed');
      if (this.isRunning) {
        this.handleReconnect();
      }
    });
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
      this.provider = new ethers.WebSocketProvider(this.config.wsUrl);
      this.setupProviderListeners();
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
      return;
    }

    this.pendingTxCache.set(txHash, Date.now());

    try {
      const tx = await this.provider.getTransaction(txHash);

      if (!tx) {
        logger.debug('Transaction not found', { txHash });
        return;
      }

      const detectedAt = new Date().toISOString();

      const pendingTx: PendingTransaction = {
        tx_hash: tx.hash,
        from_address: tx.from.toLowerCase(),
        to_address: tx.to?.toLowerCase() || null,
        value: tx.value.toString(),
        gas_price: tx.gasPrice?.toString() || null,
        max_fee_per_gas: tx.maxFeePerGas?.toString() || null,
        max_priority_fee_per_gas: tx.maxPriorityFeePerGas?.toString() || null,
        gas_limit: tx.gasLimit.toString(),
        input_data: tx.data,
        nonce: tx.nonce,
        detected_at: detectedAt,
      };

      const { error: insertError } = await supabase
        .from('pending_transactions')
        .insert(pendingTx);

      if (insertError) {
        if (!insertError.message.includes('duplicate')) {
          logger.error('Error inserting pending transaction', {
            txHash,
            error: insertError.message,
          });
        }
        return;
      }

      const classification = this.classifier.classifyTransaction(tx.to, tx.data);
      const hotScore = this.classifier.getHotTransactionScore(classification);

      if (hotScore >= (this.config.hotTransactionThreshold || 7)) {
        logger.info('HOT transaction detected', {
          txHash,
          type: classification.type,
          confidence: classification.confidence,
          score: hotScore,
          router: classification.metadata.router,
        });
      }

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
        .insert(txClassification);

      if (classError && !classError.message.includes('duplicate')) {
        logger.error('Error inserting classification', {
          txHash,
          error: classError.message,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('transaction not found')) {
        return;
      }
      throw error;
    } finally {
      setTimeout(() => {
        this.pendingTxCache.delete(txHash);
      }, 300000);
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
    logger.debug('Analyzing block', { blockNumber });

    try {
      const block = await this.provider.getBlock(blockNumber, true);

      if (!block || !block.transactions || block.transactions.length === 0) {
        return;
      }

      const blockMinedAt = new Date(block.timestamp * 1000).toISOString();

      for (const txData of block.transactions) {
        if (typeof txData === 'string') continue;

        const tx = txData as ethers.TransactionResponse;
        const receipt = await this.provider.getTransactionReceipt(tx.hash);

        if (!receipt) continue;

        const minedTx = {
          tx_hash: tx.hash,
          block_number: blockNumber,
          block_hash: block.hash || '',
          transaction_index: receipt.index,
          status: receipt.status || 0,
          gas_used: receipt.gasUsed.toString(),
          effective_gas_price: receipt.gasPrice.toString(),
          mined_at: blockMinedAt,
          logs: receipt.logs.map(log => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
          })),
        };

        const { error } = await supabase
          .from('mined_transactions')
          .insert(minedTx);

        if (error && !error.message.includes('duplicate')) {
          logger.error('Error inserting mined transaction', {
            txHash: tx.hash,
            error: error.message,
          });
          continue;
        }

        await this.calculateMetrics(tx.hash, blockMinedAt);
      }
    } catch (error) {
      logger.error('Block analysis failed', {
        blockNumber,
        error: error instanceof Error ? error.message : error,
      });
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

    let actualType = 'unknown';
    if (minedTx && minedTx.status === 1) {
      actualType = this.inferActualType(minedTx.logs, classification.classification_type);
    }

    const predictionCorrect = actualType === classification.classification_type;

    const metric = {
      tx_hash: txHash,
      predicted_type: classification.classification_type,
      actual_type: actualType,
      was_mined: true,
      latency_ms: latencyMs,
      prediction_correct: predictionCorrect,
      mempool_time_ms: latencyMs,
      analyzed_at: new Date().toISOString(),
    };

    await supabase.from('analysis_metrics').insert(metric);

    logger.debug('Metrics calculated', {
      txHash,
      latencyMs,
      predicted: classification.classification_type,
      actual: actualType,
      correct: predictionCorrect,
    });
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
    await this.provider.destroy();
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
