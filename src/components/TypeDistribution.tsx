interface TypeDistributionProps {
  typeBreakdown: Record<string, number>;
}

export function TypeDistribution({ typeBreakdown }: TypeDistributionProps) {
  const types = Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a);
  const total = types.reduce((sum, [, count]) => sum + count, 0);

  const getTypeColor = (type: string, index: number) => {
    const colors: Record<string, string> = {
      contract_deploy: 'bg-orange-500',
      add_liquidity: 'bg-green-500',
      create_pair: 'bg-emerald-500',
      swap: 'bg-blue-500',
      token_transfer: 'bg-gray-500',
      token_approval: 'bg-slate-500',
      unknown: 'bg-gray-400',
    };
    return colors[type] || `bg-blue-${Math.min(900, 400 + index * 100)}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Transaction Type Distribution</h2>
      <p className="text-sm text-gray-500 mb-6">Breakdown of detected transaction types</p>

      {types.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No transaction data available yet
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-center h-8 rounded-lg overflow-hidden">
              {types.map(([type, count], index) => {
                const percentage = (count / total) * 100;
                return (
                  <div
                    key={type}
                    className={`h-full ${getTypeColor(type, index)} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                    title={`${type}: ${count} (${percentage.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {types.map(([type, count], index) => {
              const percentage = (count / total) * 100;
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${getTypeColor(type, index)}`}
                    />
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {percentage.toFixed(1)}%
                    </span>
                    <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <p className="text-sm text-gray-500 mt-1">Total Transactions Classified</p>
          </div>
        </>
      )}
    </div>
  );
}
