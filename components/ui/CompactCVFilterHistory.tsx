import React, { useState, useEffect } from 'react';
import { cvFilterHistoryService } from '../../services/analysisHistory';

interface CompactCVFilterHistoryProps {
  className?: string;
}

const CompactCVFilterHistory: React.FC<CompactCVFilterHistoryProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [historyStats, setHistoryStats] = useState({
    totalSessions: 0,
    lastSession: null as string | null,
    thisWeekCount: 0,
    thisMonthCount: 0
  });
  const [recentHistory, setRecentHistory] = useState<any[]>([]);

  // Check if CV filter history should be shown based on user preference
  const [shouldShow, setShouldShow] = useState(() => {
    const saved = localStorage.getItem('showCVFilterHistory');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Listen for changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('showCVFilterHistory');
      setShouldShow(saved !== null ? JSON.parse(saved) : true);
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case it's changed in same tab
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isVisible && shouldShow) {
      const stats = cvFilterHistoryService.getHistoryStats();
      setHistoryStats(stats);
      const recent = cvFilterHistoryService.getRecentHistory();
      setRecentHistory(recent);
    }
  }, [isVisible, shouldShow]);

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
    const stats = cvFilterHistoryService.getHistoryStats();
    setHistoryStats(stats);
    const recent = cvFilterHistoryService.getRecentHistory();
    setRecentHistory(recent);
  };

  // Don't render anything if user has disabled analysis history
  if (!shouldShow) {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={`fixed bottom-4 left-16 w-10 h-10 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors z-40 ${className}`}
        title="Hiện lịch sử phân tích"
      >
        <i className="fa-solid fa-history text-sm"></i>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 left-16 bg-slate-800/95 backdrop-blur border border-slate-600 rounded-xl p-4 min-w-[320px] z-40 shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <i className="fa-solid fa-history text-green-400"></i>
          Lịch sử Lọc CV
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="w-6 h-6 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
        >
          <i className="fa-solid fa-times text-xs"></i>
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Tổng lần lọc</div>
            <div className="text-sm font-mono font-bold text-blue-400">
              {historyStats.totalSessions}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Tuần này</div>
            <div className="text-sm font-mono font-bold text-yellow-400">
              {historyStats.thisWeekCount}
            </div>
          </div>
        </div>

        {historyStats.lastSession && (
          <div className="flex justify-between">
            <span className="text-slate-400">Gần nhất:</span>
            <span className="font-mono text-slate-300 text-xs">
              {historyStats.lastSession}
            </span>
          </div>
        )}
      </div>

      {recentHistory.length > 0 && (
        <div className="mt-3 border-t border-slate-700 pt-2">
          <div className="text-xs text-slate-400 mb-1">Gần đây:</div>
          <div className="space-y-1 max-h-16 overflow-y-auto">
            {recentHistory.slice(0, 3).map((entry, index) => (
              <div key={index} className="text-xs">
                <span className="text-slate-300 truncate block">
                  {entry.jobPosition}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={refreshStats}
          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
        >
          <i className="fa-solid fa-refresh mr-1"></i>
          Refresh
        </button>
        
        <button
          onClick={handleClearHistory}
          disabled={historyStats.totalSessions === 0}
          className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:text-slate-400 text-white text-xs rounded transition-colors"
        >
          <i className="fa-solid fa-trash mr-1"></i>
          Clear
        </button>
      </div>

      {historyStats.totalSessions > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          � Ghi lại các lần đã lọc CV
        </div>
      )}
    </div>
  );
};

export default CompactCVFilterHistory;