import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import type { Candidate } from '../../types';
import { saveHistorySession } from '../../services/historyService';
import { auth } from '../../src/firebase';

interface DetailedAnalyticsPageProps {
  candidates: Candidate[];
  jobPosition: string;
}

const DetailedAnalyticsPage: React.FC<DetailedAnalyticsPageProps> = ({ candidates, jobPosition }) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleCompleteProcess = async () => {
    try {
      setIsSaving(true);
      
      // Lấy thông tin user
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        alert('Vui lòng đăng nhập để lưu lịch sử');
        return;
      }

      // Lấy JD text và location từ localStorage
      const jdText = localStorage.getItem('currentJD') || '';
      const locationRequirement = localStorage.getItem('currentLocation') || '';
      const weights = JSON.parse(localStorage.getItem('analysisWeights') || '{}');
      const hardFilters = JSON.parse(localStorage.getItem('hardFilters') || '{}');
      
      // Lưu lịch sử phân tích
      await saveHistorySession({
        jdText,
        jobPosition,
        locationRequirement,
        candidates,
        userEmail: currentUser.email,
        weights,
        hardFilters
      });

      // Thông báo thành công
      alert('Đã lưu lịch sử phân tích thành công!');
      
      // Quay về trang chủ
      window.location.hash = '#/';
    } catch (error) {
      console.error('Lỗi khi lưu lịch sử:', error);
      alert('Có lỗi xảy ra khi lưu lịch sử. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  // Xử lý dữ liệu phân tích
  const analyticsData = useMemo(() => {
    const successfulCandidates = candidates.filter(c => c.status === 'SUCCESS' && c.analysis);
    
    if (successfulCandidates.length === 0) {
      return null;
    }

    // Thống kê theo hạng
    const gradeStats = {
      A: successfulCandidates.filter(c => c.analysis?.['Hạng'] === 'A').length,
      B: successfulCandidates.filter(c => c.analysis?.['Hạng'] === 'B').length,
      C: successfulCandidates.filter(c => c.analysis?.['Hạng'] === 'C').length,
    };

    // Thống kê điểm theo từng tiêu chí
    const criteriaStats: Record<string, { total: number, count: number, scores: number[] }> = {};
    
    successfulCandidates.forEach(candidate => {
      if (candidate.analysis?.['Chi tiết']) {
        candidate.analysis['Chi tiết'].forEach(detail => {
          const criterion = detail['Tiêu chí'];
          const scoreText = detail['Điểm'];
          let score = 0;
          
          // Xử lý điểm số
          if (scoreText.includes('/')) {
            score = parseInt(scoreText.split('/')[0]) || 0;
          } else if (scoreText.includes('%')) {
            score = parseInt(scoreText.replace('%', '')) || 0;
          } else {
            score = parseInt(scoreText) || 0;
          }
          
          if (!criteriaStats[criterion]) {
            criteriaStats[criterion] = { total: 0, count: 0, scores: [] };
          }
          
          criteriaStats[criterion].total += score;
          criteriaStats[criterion].count += 1;
          criteriaStats[criterion].scores.push(score);
        });
      }
    });

    // Tính điểm trung bình cho từng tiêu chí
    const criteriaAverages = Object.entries(criteriaStats).map(([criterion, stats]) => ({
      criterion: criterion.length > 20 ? criterion.substring(0, 20) + '...' : criterion,
      fullCriterion: criterion,
      average: Math.round(stats.total / stats.count),
      count: stats.count,
      min: Math.min(...stats.scores),
      max: Math.max(...stats.scores),
      scores: stats.scores
    }));

    // Thống kê phân bố điểm
    const scoreDistribution = Array.from({ length: 10 }, (_, i) => {
      const range = `${i * 10}-${(i + 1) * 10}`;
      const count = successfulCandidates.filter(c => {
        const score = c.analysis?.['Tổng điểm'] || 0;
        return score >= i * 10 && score < (i + 1) * 10;
      }).length;
      return { range, count };
    }).filter(item => item.count > 0);

    // Radar chart data cho top 5 tiêu chí
    const topCriteria = criteriaAverages
      .sort((a, b) => b.average - a.average)
      .slice(0, 6)
      .map(c => ({
        subject: c.criterion,
        fullName: c.fullCriterion,
        score: c.average,
        fullMark: 100
      }));

    // Thống kê xu hướng theo thời gian (giả lập)
    const timeStats = successfulCandidates.map((c, index) => ({
      order: index + 1,
      score: c.analysis?.['Tổng điểm'] || 0,
      jdFit: parseInt(c.analysis?.['Chi tiết']?.find(d => d['Tiêu chí'].includes('Phù hợp JD'))?.['Điểm'].split('/')[0] || '0')
    }));

    return {
      gradeStats,
      criteriaAverages,
      scoreDistribution,
      topCriteria,
      timeStats,
      totalCandidates: successfulCandidates.length
    };
  }, [candidates]);

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="relative inline-block mb-6">
              <i className="fa-solid fa-chart-pie text-6xl text-slate-600"></i>
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full pulse-animation"></div>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
              Thống Kê Chi Tiết
            </h2>
            <p className="text-slate-400 text-lg max-w-md mx-auto">
              Chưa có dữ liệu phân tích để hiển thị. Vui lòng thực hiện phân tích CV trước.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];

  const gradeData = [
    { name: 'Hạng A', value: analyticsData.gradeStats.A, color: '#10B981' },
    { name: 'Hạng B', value: analyticsData.gradeStats.B, color: '#3B82F6' },
    { name: 'Hạng C', value: analyticsData.gradeStats.C, color: '#EF4444' }
  ].filter(item => item.value > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200 p-6 animate-fadeIn">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-chart-line text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Thống Kê Chi Tiết
              </h1>
              <p className="text-slate-400 mt-1">
                Phân tích sâu cho vị trí: <span className="font-medium text-slate-300">{jobPosition}</span>
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-users text-blue-400 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Tổng CV</p>
                  <p className="text-xl font-bold text-white">{analyticsData.totalCandidates}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-medal text-emerald-400 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Hạng A</p>
                  <p className="text-xl font-bold text-emerald-400">{analyticsData.gradeStats.A}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-star text-blue-400 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Hạng B</p>
                  <p className="text-xl font-bold text-blue-400">{analyticsData.gradeStats.B}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-triangle-exclamation text-red-400 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Hạng C</p>
                  <p className="text-xl font-bold text-red-400">{analyticsData.gradeStats.C}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pie Chart - Phân bố hạng */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-chart-pie text-blue-400"></i>
              Phân Bố Theo Hạng
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={gradeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {gradeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart - Phân bố điểm */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-chart-column text-blue-400"></i>
              Phân Bố Điểm Số
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="range" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }} 
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart - Top tiêu chí */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-radar text-blue-400"></i>
              Top 6 Tiêu Chí Đánh Giá
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={analyticsData.topCriteria}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <PolarRadiusAxis 
                  angle={0} 
                  domain={[0, 100]} 
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                />
                <Radar 
                  name="Điểm trung bình" 
                  dataKey="score" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }}
                  labelFormatter={(label, payload) => {
                    const item = analyticsData.topCriteria.find(c => c.subject === label);
                    return item ? item.fullName : label;
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart - Xu hướng điểm */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-chart-line text-blue-400"></i>
              Xu Hướng Điểm Theo CV
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.timeStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="order" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }} 
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="Tổng điểm"
                />
                <Line 
                  type="monotone" 
                  dataKey="jdFit" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Phù hợp JD (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Criteria Table */}
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <i className="fa-solid fa-table text-blue-400"></i>
            Chi Tiết Điểm Theo Tiêu Chí
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Tiêu Chí</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Điểm TB</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Điểm Min</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Điểm Max</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Số CV</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Đánh Giá</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.criteriaAverages
                  .sort((a, b) => b.average - a.average)
                  .map((criteria, index) => (
                    <tr key={criteria.fullCriterion} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-4 text-sm text-slate-200">
                        <div>
                          <div className="font-medium">{criteria.fullCriterion}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          criteria.average >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                          criteria.average >= 60 ? 'bg-blue-500/20 text-blue-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {criteria.average}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300">{criteria.min}</td>
                      <td className="py-3 px-4 text-center text-slate-300">{criteria.max}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{criteria.count}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          {criteria.average >= 80 ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <i className="fa-solid fa-thumbs-up text-sm"></i>
                              <span className="text-xs">Tốt</span>
                            </div>
                          ) : criteria.average >= 60 ? (
                            <div className="flex items-center gap-1 text-blue-400">
                              <i className="fa-solid fa-minus text-sm"></i>
                              <span className="text-xs">Trung bình</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-400">
                              <i className="fa-solid fa-thumbs-down text-sm"></i>
                              <span className="text-xs">Cần cải thiện</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Complete Process Button */}
        <div className="mt-8 text-center">
          <button 
            onClick={handleCompleteProcess}
            disabled={isSaving}
            className={`px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 mx-auto ${
              isSaving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Đang lưu...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check-circle"></i>
                Hoàn thành quy trình lọc
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailedAnalyticsPage;