import React, { useState, useEffect } from 'react';
import { analysisCacheService } from '../../services/analysisCache';

interface CompactCacheStatsProps {
  className?: string;
}

const CompactCacheStats: React.FC<CompactCacheStatsProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState({
    size: 0,
    hitRate: 0,
    oldestEntry: 0,
    newestEntry: 0
  });

  // Check if cache stats should be shown based on user preference
  const [shouldShow, setShouldShow] = useState(() => {
    const saved = localStorage.getItem('showCacheStats');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Listen for changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('showCacheStats');
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
      loadStats();
    }
  }, [isVisible, shouldShow]);

  const loadStats = () => {
    const currentStats = analysisCacheService.getCacheStats();
    setStats(currentStats);
  };

  const handleClearCache = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ cache? Điều này sẽ làm chậm các lần phân tích tiếp theo.')) {
      analysisCacheService.clearCache();
      loadStats();
    }
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

  // Don't render anything if user has disabled cache stats
  if (!shouldShow) {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={`fixed bottom-16 left-4 w-10 h-10 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors z-40 ${className}`}
        title="Hiện thống kê cache"
      >
        <i className="fa-solid fa-database text-sm"></i>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-16 left-4 bg-slate-800/95 backdrop-blur border border-slate-600 rounded-xl p-4 min-w-[300px] z-40 shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <i className="fa-solid fa-database text-blue-400"></i>
          Cache Statistics
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="w-6 h-6 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
        >
          <i className="fa-solid fa-times text-xs"></i>
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Entries:</span>
          <span className={`font-mono ${getCacheSizeColor(stats.size)}`}>
            {stats.size}/100
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-slate-400">Hit Rate:</span>
          <span className="font-mono text-slate-200">
            {stats.hitRate.toFixed(1)}%
          </span>
        </div>

        {stats.oldestEntry > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Oldest:</span>
            <span className="font-mono text-slate-300 text-xs">
              {formatDate(stats.oldestEntry)}
            </span>
          </div>
        )}

        {stats.newestEntry > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Newest:</span>
            <span className="font-mono text-slate-300 text-xs">
              {formatDate(stats.newestEntry)}
            </span>
          </div>
        )}


      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={loadStats}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
        >
          <i className="fa-solid fa-refresh mr-1"></i>
          Refresh
        </button>
        
        <button
          onClick={handleClearCache}
          disabled={stats.size === 0}
          className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:text-slate-400 text-white text-xs rounded transition-colors"
        >
          <i className="fa-solid fa-trash mr-1"></i>
          Clear
        </button>
      </div>

      {stats.size > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          💡 Cache giúp tăng tốc phân tích cho cùng JD & trọng số
        </div>
      )}
    </div>
  );
};

export default CompactCacheStats;