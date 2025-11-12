import React, { useState, useEffect } from 'react';
import { analysisCacheService } from '../../services/analysisCache';
import { cvFilterHistoryService } from '../../services/analysisHistory';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [cacheStats, setCacheStats] = useState({
    size: 0,
    hitRate: 0,
    oldestEntry: 0,
    newestEntry: 0
  });
  
  const [historyStats, setHistoryStats] = useState({
    totalSessions: 0,
    lastSession: null as string | null,
    thisWeekCount: 0,
    thisMonthCount: 0
  });

  const [recentHistory, setRecentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      const currentStats = analysisCacheService.getCacheStats();
      setCacheStats(currentStats);
      
      const currentHistoryStats = cvFilterHistoryService.getHistoryStats();
      setHistoryStats(currentHistoryStats);
      
      const recent = cvFilterHistoryService.getRecentHistory();
      setRecentHistory(recent);
    }
  }, [isOpen]);

  const handleClearCache = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ cache? Điều này sẽ làm chậm các lần phân tích tiếp theo.')) {
      analysisCacheService.clearCache();
      setCacheStats({
        size: 0,
        hitRate: 0,
        oldestEntry: 0,
        newestEntry: 0
      });
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử lọc CV? Hành động này không thể hoàn tác.')) {
      cvFilterHistoryService.clearHistory();
      setHistoryStats({
        totalSessions: 0,
        lastSession: null,
        thisWeekCount: 0,
        thisMonthCount: 0
      });
      setRecentHistory([]);
    }
  };

  const refreshStats = () => {
    const currentStats = analysisCacheService.getCacheStats();
    setCacheStats(currentStats);
  };

  const refreshHistoryStats = () => {
    const currentHistoryStats = cvFilterHistoryService.getHistoryStats();
    setHistoryStats(currentHistoryStats);
    const recent = cvFilterHistoryService.getRecentHistory();
    setRecentHistory(recent);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('vi-VN');
  };

  const getCacheSizeColor = (size: number) => {
    if (size < 20) return 'text-green-400';
    if (size < 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800/95 backdrop-blur border border-slate-600 rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-600">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <i className="fa-solid fa-history text-green-400"></i>
              Lịch sử & Thống kê
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Cache Statistics Section */}
            <div>
              <h3 className="text-md font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-database text-blue-400"></i>
                Cache Statistics
              </h3>
              
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Entries</div>
                    <div className={`text-lg font-mono font-bold ${getCacheSizeColor(cacheStats.size)}`}>
                      {cacheStats.size}<span className="text-sm text-slate-400">/100</span>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Hit Rate</div>
                    <div className="text-lg font-mono font-bold text-slate-200">
                      {cacheStats.hitRate.toFixed(1)}<span className="text-sm">%</span>
                    </div>
                  </div>
                </div>

                {(cacheStats.oldestEntry > 0 || cacheStats.newestEntry > 0) && (
                  <div className="border-t border-slate-700 pt-3 space-y-2">
                    {cacheStats.oldestEntry > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Oldest Entry:</span>
                        <span className="text-slate-300 font-mono">
                          {formatDate(cacheStats.oldestEntry)}
                        </span>
                      </div>
                    )}

                    {cacheStats.newestEntry > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Newest Entry:</span>
                        <span className="text-slate-300 font-mono">
                          {formatDate(cacheStats.newestEntry)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={refreshStats}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-refresh"></i>
                    Refresh
                  </button>
                  
                  <button
                    onClick={handleClearCache}
                    disabled={cacheStats.size === 0}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:text-slate-400 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-trash"></i>
                    Clear
                  </button>
                </div>

                {cacheStats.size > 0 && (
                  <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
                    💡 Cache giúp tăng tốc phân tích cho cùng JD & trọng số
                  </div>
                )}
              </div>
            </div>

            {/* CV Filter History Section */}
            <div>
              <h3 className="text-md font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-history text-green-400"></i>
                Lịch sử Lọc CV
              </h3>
              
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Tổng lần lọc</div>
                    <div className="text-lg font-mono font-bold text-blue-400">
                      {historyStats.totalSessions}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Tuần này</div>
                    <div className="text-lg font-mono font-bold text-yellow-400">
                      {historyStats.thisWeekCount}
                    </div>
                  </div>
                </div>

                {historyStats.lastSession && (
                  <div className="border-t border-slate-700 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Lần lọc gần nhất:</span>
                      <span className="text-slate-300 font-mono text-xs">
                        {historyStats.lastSession}
                      </span>
                    </div>
                  </div>
                )}

                {recentHistory.length > 0 && (
                  <div className="border-t border-slate-700 pt-3">
                    <div className="text-xs text-slate-400 mb-2">Lịch sử gần đây:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {recentHistory.slice(0, 8).map((entry, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-slate-300 truncate max-w-[160px]">
                            {entry.jobPosition}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {entry.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={refreshHistoryStats}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-refresh"></i>
                    Refresh
                  </button>
                  
                  <button
                    onClick={handleClearHistory}
                    disabled={historyStats.totalSessions === 0}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:text-slate-400 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-trash"></i>
                    Clear
                  </button>
                </div>

                {historyStats.totalSessions > 0 && (
                  <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
                    📝 Ghi lại các lần bạn đã lọc CV
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HistoryModal;