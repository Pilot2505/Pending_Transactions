import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface AnalyticsData {
  totalPending: number;
  totalMined: number;
  totalAnalyzed: number;
  avgLatencyMs: number;
  accuracy: number;
  hotTransactions: number;
  typeBreakdown: Record<string, number>;
  accuracyByType: Record<string, { correct: number; total: number; accuracy: number }>;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    totalPending: 0,
    totalMined: 0,
    totalAnalyzed: 0,
    avgLatencyMs: 0,
    accuracy: 0,
    hotTransactions: 0,
    typeBreakdown: {},
    accuracyByType: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAnalytics() {
    try {
      const [
        pendingCount,
        minedCount,
        metricsData,
        classificationData,
      ] = await Promise.all([
        supabase.from('pending_transactions').select('id', { count: 'exact', head: true }),
        supabase.from('mined_transactions').select('id', { count: 'exact', head: true }),
        supabase.from('analysis_metrics').select('*'),
        supabase.from('transaction_classifications').select('classification_type, confidence'),
      ]);

      const typeBreakdown: Record<string, number> = {};
      const accuracyByType: Record<string, { correct: number; total: number; accuracy: number }> = {};

      if (classificationData.data) {
        for (const item of classificationData.data) {
          typeBreakdown[item.classification_type] = (typeBreakdown[item.classification_type] || 0) + 1;
        }
      }

      let totalCorrect = 0;
      let totalAnalyzed = 0;
      let totalLatency = 0;
      let hotCount = 0;

      if (metricsData.data) {
        for (const metric of metricsData.data) {
          totalAnalyzed++;

          if (metric.prediction_correct) {
            totalCorrect++;
          }

          if (metric.latency_ms) {
            totalLatency += metric.latency_ms;
          }

          const type = metric.predicted_type;
          if (!accuracyByType[type]) {
            accuracyByType[type] = { correct: 0, total: 0, accuracy: 0 };
          }

          accuracyByType[type].total++;
          if (metric.prediction_correct) {
            accuracyByType[type].correct++;
          }
        }

        for (const type in accuracyByType) {
          const stats = accuracyByType[type];
          stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
        }
      }

      if (classificationData.data) {
        hotCount = classificationData.data.filter(
          item => ['contract_deploy', 'add_liquidity', 'create_pair'].includes(item.classification_type)
        ).length;
      }

      setData({
        totalPending: pendingCount.count || 0,
        totalMined: minedCount.count || 0,
        totalAnalyzed,
        avgLatencyMs: totalAnalyzed > 0 ? Math.round(totalLatency / totalAnalyzed) : 0,
        accuracy: totalAnalyzed > 0 ? (totalCorrect / totalAnalyzed) * 100 : 0,
        hotTransactions: hotCount,
        typeBreakdown,
        accuracyByType,
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      setLoading(false);
    }
  }

  return { data, loading, error, refresh: fetchAnalytics };
}
