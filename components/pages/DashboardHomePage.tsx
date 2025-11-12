import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { auth } from '../../src/firebase';
import { User } from 'firebase/auth';
import type { AppStep } from '../../types';

interface DashboardHomePageProps {
  setActiveStep: (step: AppStep) => void;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
  completedSteps: AppStep[];
}

interface QuickStat {
  icon: string;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

const DashboardHomePage: React.FC<DashboardHomePageProps> = memo(({ setActiveStep, isLoggedIn, onLoginRequest, completedSteps }) => {
  const [recentSessions, setRecentSessions] = useState(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Load recent sessions count from localStorage
    try {
      const stored = localStorage.getItem('cvAnalysis.latest');
      if (stored) {
        const data = JSON.parse(stored);
        setRecentSessions(data.candidates?.length || 0);
      }
    } catch (e) {
      console.warn('Could not load recent sessions', e);
    }

    // Monitor auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Memoize expensive calculations
  const quickStats: QuickStat[] = useMemo(() => [
    {
      icon: 'fa-solid fa-rocket',
      label: 'Phiên gần nhất',
      value: recentSessions > 0 ? `${recentSessions} CV` : 'Chưa có',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: 'fa-solid fa-chart-line', 
      label: 'Hiệu quả AI',
      value: '99.2%',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    {
      icon: 'fa-solid fa-clock',
      label: 'Tiết kiệm thời gian',
      value: '~85%',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    {
      icon: 'fa-solid fa-star',
      label: 'Độ chính xác',
      value: '96.8%',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10'
    }
  ], [recentSessions]);

  // Memoize process steps
  const processSteps = useMemo(() => [
    { 
      step: '01', 
      title: 'Job Description', 
      desc: 'Nhập mô tả công việc chi tiết', 
      icon: 'fa-clipboard-list', 
      color: 'text-blue-400',
      bgGradient: 'from-blue-500/20 to-cyan-500/20'
    },
    { 
      step: '02', 
      title: 'Cấu hình thông minh', 
      desc: 'Tùy chỉnh trọng số & bộ lọc', 
      icon: 'fa-sliders', 
      color: 'text-purple-400',
      bgGradient: 'from-purple-500/20 to-pink-500/20'
    },
    { 
      step: '03', 
      title: 'Upload CV hàng loạt', 
      desc: 'Kéo thả nhiều file PDF cùng lúc', 
      icon: 'fa-file-arrow-up', 
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-500/20 to-teal-500/20'
    },
    { 
      step: '04', 
      title: 'AI Phân tích', 
      desc: 'Thuật toán AI xử lý thông minh', 
      icon: 'fa-robot', 
      color: 'text-orange-400',
      bgGradient: 'from-orange-500/20 to-red-500/20'
    },
    { 
      step: '05', 
      title: 'Kết quả chi tiết', 
      desc: 'Báo cáo và ranking ứng viên', 
      icon: 'fa-chart-line', 
      color: 'text-pink-400',
      bgGradient: 'from-pink-500/20 to-rose-500/20'
    }
  ], []);

  // Memoize button handlers
  const handleStartScreening = useCallback(() => {
    isLoggedIn ? setActiveStep('jd') : onLoginRequest();
  }, [isLoggedIn, setActiveStep, onLoginRequest]);

  const handleOptimizeJD = useCallback(() => {
    window.open('https://parse-jd.vercel.app/', '_blank');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-transparent bg-clip-text mb-4">
              Chào mừng trở lại
            </h1>
            
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {isLoggedIn ? (
                <>
                  <span className="text-blue-400 font-medium">Chào mừng bạn trở lại!</span> Sẵn sàng để sàng lọc CV thông minh hơn?
                </>
              ) : (
                <>
                  Khám phá hệ thống sàng lọc CV thông minh với AI. 
                  <button 
                    onClick={onLoginRequest}
                    className="text-blue-400 font-medium hover:text-blue-300 underline underline-offset-2 transition-colors"
                  >
                    Đăng nhập để bắt đầu!
                  </button>
                </>
              )}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 px-4">
              <button
                onClick={handleStartScreening}
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/50"
              >
                <div className="flex items-center justify-center gap-3">
                  <i className="fa-solid fa-rocket text-xl group-hover:animate-bounce"></i>
                  <div className="text-left">
                    <div className="text-lg">Bắt đầu lọc CV</div>
                    <div className="text-sm opacity-90 hidden sm:block">Sàng lọc CV thông minh</div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleOptimizeJD}
                className="group px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
              >
                <div className="flex items-center justify-center gap-3">
                  <i className="fa-solid fa-sparkles text-xl group-hover:animate-pulse"></i>
                  <div className="text-left">
                    <div className="text-lg">Tối ưu JD</div>
                    <div className="text-sm opacity-90 hidden sm:block">Cải thiện mô tả công việc</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Enhanced Process Overview */}
          <div className="bg-gradient-to-r from-slate-800/40 to-slate-700/40 backdrop-blur-sm border border-slate-600/50 rounded-3xl p-4 sm:p-6 md:p-10 mb-12 shadow-2xl overflow-hidden">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4 flex items-center gap-3 justify-center">
                <i className="fa-solid fa-route text-purple-400 text-2xl"></i>
                Quy trình thông minh
              </h2>
              <p className="text-slate-300 text-lg max-w-3xl mx-auto hidden sm:block">
                Hệ thống AI tiên tiến giúp bạn sàng lọc CV một cách chính xác và hiệu quả nhất
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 lg:gap-8">
              {processSteps.map((item, index) => (
                <div key={index} className="text-center group">
                  <div className="relative mb-6">
                    <div className={`w-20 h-20 mx-auto bg-gradient-to-br ${item.bgGradient} backdrop-blur-sm border border-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg`}>
                      <i className={`fa-solid ${item.icon} text-2xl ${item.color}`}></i>
                    </div>
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-700 border-2 border-slate-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-sm font-bold text-white">{item.step}</span>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed hidden sm:block">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>



          {/* Enhanced Quick Stats Dashboard */}
          <div className="mb-12 overflow-hidden">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4 flex items-center gap-3 justify-center">
                <i className="fa-solid fa-chart-line text-emerald-400"></i>
                Dashboard Thống Kê
              </h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto hidden sm:block">
                Hiệu suất và chỉ số hoạt động của hệ thống AI sàng lọc CV
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {quickStats.map((stat, index) => (
                <div 
                  key={index}
                  className="group relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-4 md:p-6 hover:border-emerald-500/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl overflow-hidden"
                >
                  {/* Background gradient effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Header with icon and status */}
                  <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className={`w-14 h-14 rounded-2xl ${stat.bgColor} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <i className={`${stat.icon} text-2xl ${stat.color}`}></i>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400 font-medium">Live</span>
                    </div>
                  </div>
                  
                  {/* Stats content */}
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors duration-300">
                      {stat.value}
                    </h3>
                    <p className="text-sm text-slate-400 font-medium mb-4">{stat.label}</p>
                    
                    {/* Progress bar simulation */}
                    <div className="w-full bg-slate-700/50 rounded-full h-2 mb-2">
                      <div 
                        className={`h-2 rounded-full bg-gradient-to-r ${
                          index === 0 ? 'from-blue-500 to-blue-600' :
                          index === 1 ? 'from-emerald-500 to-emerald-600' :
                          index === 2 ? 'from-purple-500 to-purple-600' :
                          'from-yellow-500 to-yellow-600'
                        } transition-all duration-1000 group-hover:scale-x-105`}
                        style={{ 
                          width: index === 0 ? (recentSessions > 0 ? '85%' : '5%') :
                                 index === 1 ? '99%' :
                                 index === 2 ? '85%' : '97%'
                        }}
                      ></div>
                    </div>
                    
                    {/* Trend indicator */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Xu hướng</span>
                      <div className="flex items-center gap-1 text-green-400">
                        <i className="fa-solid fa-arrow-trend-up"></i>
                        <span>+{index === 0 ? '12' : index === 1 ? '0.3' : index === 2 ? '5' : '2.1'}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Additional dashboard metrics */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Hoạt động hôm nay</h4>
                  <i className="fa-solid fa-calendar-day text-blue-400"></i>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">CV được phân tích</span>
                    <span className="text-white font-semibold">{recentSessions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Thời gian trung bình</span>
                    <span className="text-white font-semibold">2.3s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Tỉ lệ thành công</span>
                    <span className="text-emerald-400 font-semibold">100%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Hiệu suất AI</h4>
                  <i className="fa-solid fa-robot text-emerald-400"></i>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Độ chính xác</span>
                    <span className="text-white font-semibold">96.8%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Phân loại F1-Score</span>
                    <span className="text-white font-semibold">94.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Latency trung bình</span>
                    <span className="text-purple-400 font-semibold">1.8s</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-600/40 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Tối ưu hóa</h4>
                  <i className="fa-solid fa-bolt text-yellow-400"></i>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Tiết kiệm thời gian</span>
                    <span className="text-white font-semibold">~85%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Chi phí giảm</span>
                    <span className="text-white font-semibold">~70%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Tự động hóa</span>
                    <span className="text-emerald-400 font-semibold">99.5%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Partners Section */}
          <div className="mb-12 overflow-hidden">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 justify-center">
              <i className="fa-solid fa-handshake text-blue-400"></i>
              Đối tác hỗ trợ
            </h2>
            
            <div className="relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl py-8 pointer-events-none w-full">
              <div className="flex items-center">
                <div className="flex animate-scroll-double-speed gap-12 min-w-full">
                  {/* First set of logos */}
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/fpt.png" 
                      alt="FPT" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/topcv-1.png" 
                      alt="TopCV" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/vinedimex-1.png" 
                      alt="Vinedimex" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/hb.png" 
                      alt="HB" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/mì_ai.png" 
                      alt="Mì AI" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/2.1.png" 
                      alt="2.1" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  
                  {/* Duplicate set for seamless loop */}
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/fpt.png" 
                      alt="FPT" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/topcv-1.png" 
                      alt="TopCV" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/vinedimex-1.png" 
                      alt="Vinedimex" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/hb.png" 
                      alt="HB" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/mì_ai.png" 
                      alt="Mì AI" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-[140px] h-20 px-6">
                    <img 
                      src="/images/logos/2.1.png" 
                      alt="2.1" 
                      className="max-h-16 max-w-full object-contain brightness-100 contrast-100 saturate-100 transition-all duration-300" 
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Add display name for debugging
DashboardHomePage.displayName = 'DashboardHomePage';

export default DashboardHomePage;