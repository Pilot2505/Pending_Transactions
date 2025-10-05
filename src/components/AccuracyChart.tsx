interface AccuracyChartProps {
  accuracyByType: Record<string, { correct: number; total: number; accuracy: number }>;
}

export function AccuracyChart({ accuracyByType }: AccuracyChartProps) {
  const types = Object.keys(accuracyByType).sort((a, b) =>
    accuracyByType[b].total - accuracyByType[a].total
  );

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-green-500';
    if (accuracy >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Prediction Accuracy by Type</h2>
      <p className="text-sm text-gray-500 mb-6">Classification performance breakdown</p>

      <div className="space-y-4">
        {types.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No classification data available yet
          </div>
        ) : (
          types.map((type) => {
            const stats = accuracyByType[type];
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {stats.correct}/{stats.total}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                      {stats.accuracy.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getAccuracyColor(stats.accuracy)}`}
                    style={{ width: `${stats.accuracy}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {types.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(accuracyByType).reduce((sum, s) => sum + s.correct, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {Object.values(accuracyByType).reduce(
                  (sum, s) => sum + (s.total - s.correct),
                  0
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">Incorrect</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Object.values(accuracyByType).reduce((sum, s) => sum + s.total, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
