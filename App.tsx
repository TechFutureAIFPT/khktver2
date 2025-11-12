import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { detectIndustryFromJD } from './services/industryDetector';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/firebase';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import WebVitalsReporter from './components/ui/WebVitalsReporter';
import BundleAnalyzer from './components/ui/BundleAnalyzer';

import { UserProfileService } from './services/userProfileService';
import type { AppStep, Candidate, HardFilters, WeightCriteria, AnalysisRunData } from './types';
import { initialWeights } from './constants';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import ProgressBar from './components/ui/ProgressBar';
import HistoryModal from './components/ui/HistoryModal';

// Lazy load pages for code-splitting
const ScreenerPage = lazy(() => import('./components/pages/ScreenerPage'));
const ProcessPage = lazy(() => import('./components/pages/ProcessPage'));
const DashboardHomePage = lazy(() => import('./components/pages/DashboardHomePage'));
const AchievementsContactPage = lazy(() => import('./components/pages/AchievementsContactPage'));
const LoginPage = lazy(() => import('./components/pages/LoginPage'));
const DetailedAnalyticsPage = lazy(() => import('./components/pages/DetailedAnalyticsPage'));
// HistoryPage removed from UI (still saving to Firestore silently)
import { saveHistorySession } from './services/historyService';
import { cvFilterHistoryService } from './services/analysisHistory';
 
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }); 
  return ref.current;
}

const App: React.FC = () => {
  return (
    <HashRouter>
      <MainApp />
    </HashRouter>
  );
};

const MainApp: React.FC = () => {
  // Initialize state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [resetKey, setResetKey] = useState(Date.now());
  const [isInitializing, setIsInitializing] = useState(true);
  
  const handleLogin = async (email: string) => {
    // The actual authentication is handled by Firebase in LoginPage
    // This is just for UI state management
    setShowLoginModal(false);
  };
  
  const handleFullReset = () => {
    setResetKey(Date.now());
  };

  const handleLoginRequest = () => {
    setShowLoginModal(true);
  };

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      setCurrentUser(user);
      setIsLoggedIn(!!user);
      
      if (user) {
        // Sync localStorage authEmail with Firebase auth
        localStorage.setItem('authEmail', user.email || '');
        
        try {
          // Save/update user profile in Firestore
          await UserProfileService.saveUserProfile(
            user.uid,
            user.email!,
            user.displayName || undefined
          );
          
          // Migrate local data to Firebase if needed
          await UserProfileService.migrateLocalDataToFirebase(user.uid, user.email!);
        } catch (error) {
          console.error('Error syncing user profile:', error);
        }
      } else {
        // Clear localStorage when logged out
        localStorage.removeItem('authEmail');
      }
      
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  // Fallback to localStorage for compatibility with existing code
  useEffect(() => {
    if (!isInitializing && !currentUser) {
      const syncLoginState = () => {
        try {
          const authEmail = localStorage.getItem('authEmail') || '';
          const wasLoggedIn = !!(authEmail && authEmail.length > 0);
          if (wasLoggedIn && !isLoggedIn) {
            setIsLoggedIn(wasLoggedIn);
          }
        } catch {}
      };
      
      syncLoginState();
      window.addEventListener('storage', syncLoginState);
      const interval = setInterval(syncLoginState, 5000);
      
      return () => {
        window.removeEventListener('storage', syncLoginState);
        clearInterval(interval);
      };
    }
  }, [isInitializing, currentUser, isLoggedIn]);

  return (
    <>
      <MainLayout 
        key={resetKey} 
        onResetRequest={handleFullReset} 
        isLoggedIn={isLoggedIn}
        onLoginRequest={handleLoginRequest}
      />
      {showLoginModal && (
        <div className="fixed inset-0 z-50">
          <button
            onClick={() => setShowLoginModal(false)}
            className="absolute top-4 right-4 w-12 h-12 bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors z-10"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
          <LoginPage onLogin={handleLogin} />
        </div>
      )}
    </>
  );
};


interface MainLayoutProps {
  onResetRequest: () => void;
  className?: string;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ onResetRequest, className, isLoggedIn, onLoginRequest }) => {
  const [userEmail, setUserEmail] = useState<string>(() => {
    // attempt to get from auth current user if available
    return (typeof window !== 'undefined' && (window as any).localStorage?.getItem('authEmail')) || '';
  });
  const [completedSteps, setCompletedSteps] = useState<AppStep[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    // Mặc định luôn đóng sidebar
    const saved = localStorage.getItem('sidebarOpen');
    
    // Nếu đã có trạng thái đã lưu, sử dụng nó
    if (saved !== null) {
      return JSON.parse(saved);
    }
    
    // Mặc định: luôn đóng
    return false;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    try { localStorage.removeItem('authEmail'); } catch {}
    window.location.reload();
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarOpen', JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Theo dõi thay đổi kích thước màn hình để tự động đóng sidebar trên mobile
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setSidebarOpen(false);
      }
    };

    // Chỉ thêm listener nếu đang ở browser
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);
  const [jdText, setJdText] = useState<string>('');
  const [jobPosition, setJobPosition] = useState<string>('');
  const [weights, setWeights] = useState<WeightCriteria>(initialWeights);
  const [hardFilters, setHardFilters] = useState<HardFilters>({
    location: '',
    minExp: '',
    seniority: '',
    education: '',
      industry: '',
    language: '',
    languageLevel: '',
    certificates: '',
    salaryMin: '',
    salaryMax: '',
    workFormat: '',
    contractType: '',
    locationMandatory: true,
    minExpMandatory: true,
    seniorityMandatory: true,
    educationMandatory: false,
    contactMandatory: false,
    industryMandatory: true,
    languageMandatory: false,
    certificatesMandatory: false,
    salaryMandatory: false,
    workFormatMandatory: false,
    contractTypeMandatory: false,
  });
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  
  // Đồng bộ lại email nếu ban đầu rỗng hoặc thay đổi ở tab khác
  useEffect(() => {
    const syncEmail = () => {
      try {
        const stored = localStorage.getItem('authEmail') || '';
        setUserEmail(prev => (prev && prev.length > 0) ? prev : stored);
      } catch {}
    };
    syncEmail();
    window.addEventListener('storage', syncEmail);
    const interval = setInterval(syncEmail, 5000); // phòng trường hợp storage event không bắn
    return () => {
      window.removeEventListener('storage', syncEmail);
      clearInterval(interval);
    };
  }, []);


  

  const handleRestore = useCallback((payload: any) => {
    if (!payload) return;
    try {
      setJdText(payload.jdText || '');
      setJobPosition(payload.jobPosition || '');
      if (payload.weights) setWeights(payload.weights);
      if (payload.hardFilters) setHardFilters(payload.hardFilters);
      if (payload.candidates) setAnalysisResults(payload.candidates);
      setCompletedSteps(['jd','weights','upload','analysis']);
      navigate('/analysis');
    } catch (e) {
      console.warn('Restore failed', e);
    }
  }, [navigate]);
  

  const prevIsLoading = usePrevious(isLoading);

  // Auto-detect industry from JD whenever jdText changes significantly (throttle by length change)
  useEffect(() => {
    if (!jdText || jdText.length < 80) return; // avoid too-early detection
    setHardFilters(prev => {
      // If user already typed a custom industry different from last detected one, don't overwrite
      if (prev.industry && prev.industryManual) return prev as any; // we will extend type dynamically
      const detected = detectIndustryFromJD(jdText);
      if (detected && detected !== prev.industry) {
        return { ...prev, industry: detected } as HardFilters & { industryManual?: boolean };
      }
      return prev;
    });
  }, [jdText]);

  // Mark manual edits to industry (listener could be added where HardFilterPanel handles changes)
  // Quick patch: wrap original setHardFilters to flag manual change when id==='industry'
  const originalSetHardFilters = setHardFilters;
  const setHardFiltersWithFlag: typeof setHardFilters = (update) => {
    if (typeof update === 'function') {
      originalSetHardFilters(prev => {
        const next = (update as any)(prev);
        if (next.industry !== prev.industry && next._lastIndustryAuto !== true) {
          (next as any).industryManual = true;
        }
        return next;
      });
    } else {
      if (update.industry !== (hardFilters as any).industry) (update as any).industryManual = true;
      originalSetHardFilters(update);
    }
  };

  useEffect(() => {
    if (prevIsLoading && !isLoading && analysisResults.length > 0) {
      const successfulCandidates = analysisResults.filter(c => c.status === 'SUCCESS');
      if (successfulCandidates.length > 0) {
        // Add unique IDs to candidates before saving
        const candidatesWithIds = successfulCandidates.map(c => ({
          ...c,
          id: c.id || `${c.fileName}-${c.candidateName}-${Math.random()}`
        }));

        const analysisRun: AnalysisRunData = {
          timestamp: Date.now(),
          job: {
            position: jobPosition,
            locationRequirement: hardFilters.location || 'Không có',
          },
          candidates: candidatesWithIds,
        };
        localStorage.setItem('cvAnalysis.latest', JSON.stringify(analysisRun));
        
        // Save to CV filter history (always enabled)
        try {
          cvFilterHistoryService.addFilterSession(
            jobPosition || 'Không rõ vị trí'
          );
        } catch (error) {
          console.warn('Failed to save filter history:', error);
        }
        
        // Firestore persistence (best-effort)
        saveHistorySession({
          jdText,
          jobPosition,
          locationRequirement: hardFilters.location || 'Không có',
          candidates: candidatesWithIds,
          userEmail: userEmail || 'anonymous',
          weights,
          hardFilters,
        }).catch(err => console.warn('Save history failed', err));
      }
    }
  }, [isLoading, prevIsLoading, analysisResults, jobPosition, hardFilters.location, jdText, userEmail, weights, hardFilters]);

  const activeStep = useMemo((): AppStep => {
    switch(location.pathname) {
      case '/process': return 'process';
      case '/jd': return 'jd';
      case '/weights': return 'weights';
      case '/upload': return 'upload';
      case '/analysis': return 'analysis';
      case '/dashboard': return 'dashboard';
      case '/detailed-analytics': return 'dashboard'; // Show dashboard as active for detailed analytics page
      case '/':
      default:
        return 'home';
    }
  }, [location.pathname]);

  const setActiveStep = useCallback((step: AppStep) => {
    const pathMap: Partial<Record<AppStep, string>> = {
      home: '/',
      jd: '/jd',
      weights: '/weights',
      upload: '/upload',
      analysis: '/analysis',
      dashboard: '/dashboard',
      process: '/process'
    };
    if (pathMap[step]) navigate(pathMap[step]!);
  }, [navigate]);

  const markStepAsCompleted = useCallback((step: AppStep) => {
    setCompletedSteps(prev => [...new Set([...prev, step])]);
  }, []);



  const screenerPageProps = {
    jdText, setJdText,
    jobPosition, setJobPosition,
    weights, setWeights,
    hardFilters, setHardFilters,
    cvFiles, setCvFiles,
    analysisResults, setAnalysisResults,
    isLoading, setIsLoading,
    loadingMessage, setLoadingMessage,
    activeStep, setActiveStep,
    completedSteps, markStepAsCompleted,
  };

  return (
     <div className={`min-h-screen text-slate-200 flex flex-col overflow-x-hidden ${className || ''}`}>
      <Sidebar 
        activeStep={activeStep} 
        setActiveStep={setActiveStep} 
        completedSteps={completedSteps}
        onReset={onResetRequest}
        onLogout={handleLogout}
        userEmail={userEmail}
        onLoginRequest={onLoginRequest}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onShowSettings={() => setHistoryModalOpen(true)}
        onCollapsedChange={setSidebarCollapsed}
      />
      
      {/* Mobile Menu Toggle Button - Floating */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-30 w-10 h-10 rounded-lg flex items-center justify-center text-white bg-slate-800/90 backdrop-blur-sm border border-slate-700 hover:bg-slate-700 transition-all duration-200 shadow-lg"
        title={sidebarOpen ? "Đóng menu" : "Mở menu"}
      >
        <i className={`fa-solid ${sidebarOpen ? 'fa-xmark' : 'fa-bars'} text-sm`}></i>
      </button>
      
      <main className={`main-content ml-0 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'} flex-1 flex flex-col min-h-0 overflow-x-hidden transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'md:w-[calc(100vw-4rem)]' : 'md:w-[calc(100vw-16rem)]'}`}>
        {activeStep !== 'home' && activeStep !== 'jd' && (
          <div className="pt-4">
            <ProgressBar activeStep={activeStep} completedSteps={completedSteps} />
          </div>
        )}
        <div className={`w-full overflow-x-hidden ${activeStep === 'weights' ? 'container-responsive' : (activeStep === 'home' || activeStep === 'jd') ? 'flex-1' : 'max-w-7xl px-4 sm:px-6 lg:px-8 mx-auto py-2'} ${(activeStep === 'home' || activeStep === 'jd') ? '' : 'py-2'} flex-1`}>
          <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>}>
            <Routes>
              <Route path="/" element={<DashboardHomePage setActiveStep={setActiveStep} isLoggedIn={isLoggedIn} onLoginRequest={onLoginRequest} completedSteps={completedSteps} />} />
              <Route path="/jd" element={isLoggedIn ? <ScreenerPage {...screenerPageProps} /> : <DashboardHomePage setActiveStep={setActiveStep} isLoggedIn={isLoggedIn} onLoginRequest={onLoginRequest} completedSteps={completedSteps} />} />
              <Route path="/weights" element={isLoggedIn ? <ScreenerPage {...screenerPageProps} /> : <DashboardHomePage setActiveStep={setActiveStep} isLoggedIn={isLoggedIn} onLoginRequest={onLoginRequest} completedSteps={completedSteps} />} />
              <Route path="/upload" element={isLoggedIn ? <ScreenerPage {...screenerPageProps} /> : <DashboardHomePage setActiveStep={setActiveStep} isLoggedIn={isLoggedIn} onLoginRequest={onLoginRequest} completedSteps={completedSteps} />} />
              <Route path="/analysis" element={isLoggedIn ? <ScreenerPage {...screenerPageProps} /> : <DashboardHomePage setActiveStep={setActiveStep} isLoggedIn={isLoggedIn} onLoginRequest={onLoginRequest} completedSteps={completedSteps} />} />

              <Route path="/detailed-analytics" element={isLoggedIn ? <DetailedAnalyticsPage candidates={analysisResults} jobPosition={jobPosition} /> : <DashboardHomePage setActiveStep={setActiveStep} isLoggedIn={isLoggedIn} onLoginRequest={onLoginRequest} completedSteps={completedSteps} />} />
              <Route path="/process" element={<ProcessPage />} />
            </Routes>
          </Suspense>
        </div>
        {/* Footer chỉ hiển thị ở trang chủ */}
        {activeStep === 'home' && <Footer />}
      </main>
      
      {/* History Modal */}
      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
      />
      
      {/* Vercel Analytics & Speed Insights for performance monitoring */}
      <Analytics />
      <SpeedInsights />
      <WebVitalsReporter />
      {/* <BundleAnalyzer /> */}
    </div>
  );
};  

export default App;
