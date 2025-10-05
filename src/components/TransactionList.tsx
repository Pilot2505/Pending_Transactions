import { Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { RecentTransaction } from '../hooks/useRecentTransactions';

interface TransactionListProps {
  transactions: RecentTransaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      contract_deploy: 'bg-orange-100 text-orange-700',
      add_liquidity: 'bg-green-100 text-green-700',
      create_pair: 'bg-emerald-100 text-emerald-700',
      swap: 'bg-blue-100 text-blue-700',
      token_transfer: 'bg-gray-100 text-gray-700',
      token_approval: 'bg-slate-100 text-slate-700',
      unknown: 'bg-gray-100 text-gray-500',
    };
    return colors[type] || colors.unknown;
  };

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        <p className="text-sm text-gray-500 mt-1">Live mempool monitoring results</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <tr key={tx.tx_hash} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-gray-900">
                      {formatTxHash(tx.tx_hash)}
                    </code>
                    <a
                      href={`https://etherscan.io/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  {tx.metadata?.router && (
                    <div className="text-xs text-gray-500 mt-1">
                      {tx.metadata.router as string}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(tx.classification_type)}`}>
                    {tx.classification_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 w-16">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${tx.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 font-medium">
                      {Math.round(tx.confidence * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {tx.was_mined === undefined ? (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      Pending
                    </span>
                  ) : tx.was_mined ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Mined
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="w-4 h-4" />
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {tx.latency_ms ? (
                    <span className="text-sm text-gray-900 font-medium">
                      {(tx.latency_ms / 1000).toFixed(2)}s
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatTimeAgo(tx.detected_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {transactions.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No transactions detected yet</p>
            <p className="text-sm text-gray-400 mt-1">Waiting for mempool activity...</p>
          </div>
        )}
      </div>
    </div>
  );
}
