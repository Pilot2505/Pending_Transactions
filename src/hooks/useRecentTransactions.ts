import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface RecentTransaction {
  tx_hash: string;
  classification_type: string;
  confidence: number;
  detected_at: string;
  router_address: string | null;
  method_signature: string | null;
  metadata: Record<string, unknown>;
  was_mined?: boolean;
  latency_ms?: number | null;
}

export function useRecentTransactions(limit = 20) {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();

    const subscription = supabase
      .channel('transaction_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_classifications',
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [limit]);

  async function fetchTransactions() {
    try {
      const { data: classifications, error: classError } = await supabase
        .from('transaction_classifications')
        .select(`
          tx_hash,
          classification_type,
          confidence,
          router_address,
          method_signature,
          metadata
        `)
        .order('classified_at', { ascending: false })
        .limit(limit);

      if (classError) throw classError;

      if (!classifications) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      const txHashes = classifications.map(c => c.tx_hash);

      const [pendingData, metricsData] = await Promise.all([
        supabase
          .from('pending_transactions')
          .select('tx_hash, detected_at')
          .in('tx_hash', txHashes),
        supabase
          .from('analysis_metrics')
          .select('tx_hash, was_mined, latency_ms')
          .in('tx_hash', txHashes),
      ]);

      const pendingMap = new Map(
        pendingData.data?.map(p => [p.tx_hash, p.detected_at]) || []
      );

      const metricsMap = new Map(
        metricsData.data?.map(m => [m.tx_hash, m]) || []
      );

      const enriched: RecentTransaction[] = classifications.map(c => ({
        tx_hash: c.tx_hash,
        classification_type: c.classification_type,
        confidence: c.confidence,
        detected_at: pendingMap.get(c.tx_hash) || new Date().toISOString(),
        router_address: c.router_address,
        method_signature: c.method_signature,
        metadata: c.metadata as Record<string, unknown>,
        was_mined: metricsMap.get(c.tx_hash)?.was_mined,
        latency_ms: metricsMap.get(c.tx_hash)?.latency_ms,
      }));

      setTransactions(enriched);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      setLoading(false);
    }
  }

  return { transactions, loading, error, refresh: fetchTransactions };
}
