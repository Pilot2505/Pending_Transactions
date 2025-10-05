import { Activity, TrendingUp, Clock, Target, Flame, Database } from 'lucide-react';
import { useAnalytics } from './hooks/useAnalytics';
import { useRecentTransactions } from './hooks/useRecentTransactions';
import { MetricsCard } from './components/MetricsCard';
import { TransactionList } from './components/TransactionList';
import { AccuracyChart } from './components/AccuracyChart';
import { TypeDistribution } from './components/TypeDistribution';

function App() {
  const { data: analytics, loading: analyticsLoading } = useAnalytics();
  const { transactions, loading: transactionsLoading } = useRecentTransactions(50);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Mempool Transaction Monitor
            </h1>
          </div>
          <p className="text-gray-600 ml-14">
            Real-time analysis of pending transactions with ML-based classification
          </p>
          <div className="mt-4 ml-14 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Research & Educational Purpose:</span> This system
              is designed for learning blockchain analysis techniques. Not for production trading
              or market manipulation.
            </p>
          </div>
        </header>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <MetricsCard
                title="Total Pending"
                value={analytics.totalPending.toLocaleString()}
                subtitle="Transactions in mempool"
                icon={Database}
                colorClass="bg-blue-50 text-blue-600"
              />
              <MetricsCard
                title="Total Mined"
                value={analytics.totalMined.toLocaleString()}
                subtitle="Confirmed transactions"
                icon={TrendingUp}
                colorClass="bg-green-50 text-green-600"
              />
              <MetricsCard
                title="Hot Transactions"
                value={analytics.hotTransactions.toLocaleString()}
                subtitle="Deploy/LP transactions"
                icon={Flame}
                colorClass="bg-orange-50 text-orange-600"
              />
              <MetricsCard
                title="Avg Latency"
                value={`${(analytics.avgLatencyMs / 1000).toFixed(2)}s`}
                subtitle="Detection to mining time"
                icon={Clock}
                colorClass="bg-purple-50 text-purple-600"
              />
              <MetricsCard
                title="Prediction Accuracy"
                value={`${analytics.accuracy.toFixed(1)}%`}
                subtitle={`${analytics.totalAnalyzed} predictions analyzed`}
                icon={Target}
                colorClass="bg-emerald-50 text-emerald-600"
              />
              <MetricsCard
                title="Classifications"
                value={Object.keys(analytics.typeBreakdown).length}
                subtitle="Unique transaction types"
                icon={Activity}
                colorClass="bg-slate-50 text-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <TypeDistribution typeBreakdown={analytics.typeBreakdown} />
              <AccuracyChart accuracyByType={analytics.accuracyByType} />
            </div>

            {transactionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <TransactionList transactions={transactions} />
            )}
          </>
        )}

        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="text-center text-sm text-gray-500">
            <p className="mb-2">
              Mempool monitoring connects via WebSocket to detect pending transactions in
              real-time. Classifications use heuristic analysis of transaction data, method
              signatures, and DEX router patterns.
            </p>
            <p>
              Data is persisted in Supabase for analysis. Metrics track prediction accuracy by
              comparing pending classifications with actual mined transaction outcomes.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
