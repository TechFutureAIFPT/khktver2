import React, { useState } from 'react';
import { Home, FileText, Sliders, Upload, Sparkles, History, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppStep, HistoryEntry } from '../../types';

interface SidebarProps {
  activeStep: AppStep;
  setActiveStep: (step: AppStep) => void;
  completedSteps: AppStep[];
  onReset: () => void;
  onLogout?: () => void;
  userEmail?: string;
  onLoginRequest?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onShowSettings?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStep, setActiveStep, completedSteps, onReset, onLogout, userEmail, onLoginRequest, isOpen = true, onClose, onShowSettings, onCollapsedChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  // Sync collapsed state on mount
  React.useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(isCollapsed);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev: boolean) => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
      if (onCollapsedChange) {
        onCollapsedChange(newState);
      }
      return newState;
    });
  };
  
  // Hàm xử lý khi click vào menu item
  const handleStepClick = (step: AppStep) => {
    if (isStepEnabled(step)) {
      setActiveStep(step);
      
      // Tự động đóng sidebar trên mobile sau khi chọn menu
      if (typeof window !== 'undefined' && window.innerWidth < 768 && onClose) {
        onClose();
      }
    }
  };
  const steps: { key: AppStep; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { key: 'home', icon: Home, label: 'Trang chủ' },
    { key: 'jd', icon: FileText, label: 'Mô tả Công việc' },
    { key: 'weights', icon: Sliders, label: 'Phân bổ Trọng số' },
    { key: 'upload', icon: Upload, label: 'Tải lên CV' },
    { key: 'analysis', icon: Sparkles, label: 'Phân Tích AI' },
  ];
  

  const isStepEnabled = (step: AppStep): boolean => {
    if (step === 'home') return true;
    if (step === 'jd') return true;
    if (step === 'weights') return completedSteps.includes('jd');
    if (step === 'upload') return completedSteps.includes('jd') && completedSteps.includes('weights');
    if (step === 'analysis') return completedSteps.includes('jd') && completedSteps.includes('weights') && completedSteps.includes('upload');
    if (step === 'process') return true;
    return false;
  };
  
  const renderStep = (step: { key: AppStep; icon: React.ComponentType<{ className?: string }>; label: string }) => {
    const isActive = activeStep === step.key;
    const isEnabled = isStepEnabled(step.key);
    const isCompleted = completedSteps.includes(step.key);
    const Icon = step.icon;

    const getIconColor = (stepKey: AppStep) => {
      if (isCompleted) return 'text-green-400';
      if (isActive) return 'text-cyan-400';
      if (!isEnabled) return 'text-slate-500';

      switch (stepKey) {
        case 'home': return 'text-cyan-400';
        case 'jd': return 'text-blue-400';
        case 'weights': return 'text-purple-400';
        case 'upload': return 'text-green-400';
        case 'analysis': return 'text-amber-400';
        default: return 'text-slate-400';
      }
    };

    const iconColor = getIconColor(step.key);

    return (
      <li className="w-full" key={step.key}>
        <button
          className={`w-full relative flex items-center gap-3 px-3 py-2.5 transition-all duration-200 group
            ${isActive ? 'bg-slate-800/80 text-white' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'} 
            ${!isEnabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            ${isCollapsed ? 'md:justify-center' : ''}`}
          disabled={!isEnabled}
          onClick={() => handleStepClick(step.key)}
          title={isCollapsed ? step.label : ''}
        >
          <div className={`flex items-center justify-center transition-colors ${iconColor}`}> 
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-sm font-medium whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>{step.label}</span>
          {isCompleted && !isActive && (
            <span className={`ml-auto w-1.5 h-1.5 bg-green-400 rounded-full ${isCollapsed ? 'md:hidden' : ''}`} />
          )}
        </button>
      </li>
    );
  }

  return (
    <>
      {/* Overlay cho mobile khi sidebar mở */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside 
        id="cv-sidebar" 
        className={`flex flex-col fixed top-0 left-0 h-screen bg-slate-900/95 border-r border-slate-800 shadow-xl z-50 backdrop-blur-sm transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } w-64 ${isCollapsed ? 'md:w-16' : 'md:w-64'}`}
        style={{ overflow: 'visible' }}
      >
        {/* Logo và Brand */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 transition-all duration-300 ${isCollapsed ? 'md:justify-center md:px-0' : ''}`}>
          {/* Logo - Khi collapsed sẽ trở thành nút mở */}
          <button
            onClick={isCollapsed ? toggleCollapse : undefined}
            className={`flex items-center justify-center w-10 h-10 bg-white rounded-lg border border-slate-700 transition-all duration-300 overflow-hidden ${
              isCollapsed ? 'md:cursor-pointer md:hover:border-slate-600 md:hover:scale-105' : 'cursor-default flex-shrink-0'
            }`}
            title={isCollapsed ? 'Mở sidebar' : ''}
          >
            <img 
              src="/images/logos/logo.jpg" 
              alt="Support HR Logo" 
              className="w-full h-full object-contain"
            />
          </button>
          
          {/* Text và nút đóng - Chỉ hiện khi expanded */}
          <div className={`flex items-center justify-between flex-1 overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:hidden' : ''}`}>
            <span className="text-[#60A5FA] font-semibold text-lg whitespace-nowrap">Support HR</span>
            <button
              onClick={toggleCollapse}
              className="hidden md:flex items-center justify-center w-7 h-7 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all duration-300 hover:scale-105"
              title="Thu gọn sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nút Quy Trình Lọc CV Mới - Ngay dưới header */}
        <div className={`pt-3 pb-2 border-b border-slate-800/50 ${isCollapsed ? 'md:px-2 px-3' : 'px-3'}`}>
          <button
            onClick={() => {
              if (completedSteps.includes('upload')) {
                onReset();
                if (typeof window !== 'undefined' && window.innerWidth < 768 && onClose) {
                  onClose();
                }
              }
            }}
            disabled={!completedSteps.includes('upload')}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              completedSteps.includes('upload')
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] cursor-pointer'
                : 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'
            } ${isCollapsed ? 'md:justify-center md:px-2' : ''}`}
            title={isCollapsed ? 'Quy Trình Lọc CV Mới' : ''}
          >
            <i className="fa-solid fa-plus text-base"></i>
            <span className={`text-sm whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>
              Quy Trình Lọc CV Mới
            </span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <ul className={`flex flex-col gap-1 ${isCollapsed ? 'md:px-2 px-3' : 'px-3'}`}>
            {steps.map(renderStep)}
          </ul>
        </nav>
        
        {/* User Profile Section - At Bottom (includes History) */}
        <UserProfileSection 
          userEmail={userEmail}
          onLogout={onLogout}
          onLoginRequest={onLoginRequest}
          isCollapsed={isCollapsed}
          onClose={onClose}
          onShowSettings={onShowSettings}
        />
      </aside>
    </>
  );
};

// User Profile Component
const UserProfileSection: React.FC<{
  userEmail?: string;
  onLogout?: () => void;
  onLoginRequest?: () => void;
  isCollapsed: boolean;
  onClose?: () => void;
  onShowSettings?: () => void;
}> = ({ userEmail, onLogout, onLoginRequest, isCollapsed, onClose, onShowSettings }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [userAvatar, setUserAvatar] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState<string>('');

  // Load avatar and user name
  React.useEffect(() => {
    if (userEmail) {
      const loadUserData = async () => {
        try {
          const { onAuthStateChanged } = await import('firebase/auth');
          const { auth } = await import('../../src/firebase');
          const { UserProfileService } = await import('../../services/userProfileService');
          
          const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && user.email === userEmail) {
              // Set display name from Google
              if (user.displayName) {
                setUserName(user.displayName);
              } else {
                setUserName(userEmail.split('@')[0]);
              }

              // Load avatar - ưu tiên Google photoURL
              if (user.photoURL) {
                // Đăng nhập Google - lấy avatar từ Google
                setUserAvatar(user.photoURL);
              } else {
                // Không có Google photoURL - kiểm tra database hoặc localStorage
                try {
                  const profile = await UserProfileService.getUserProfile(user.uid);
                  if (profile?.avatar) {
                    setUserAvatar(profile.avatar);
                  } else {
                    const localAvatar = localStorage.getItem(`avatar_${userEmail}`);
                    setUserAvatar(localAvatar);
                  }
                } catch {
                  const localAvatar = localStorage.getItem(`avatar_${userEmail}`);
                  setUserAvatar(localAvatar);
                }
              }
            }
          });
          return () => unsubscribe();
        } catch (error) {
          console.error('Error loading user data:', error);
          setUserName(userEmail.split('@')[0]);
        }
      };
      loadUserData();
    }
  }, [userEmail]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };
  
  const getAvatarColor = (email: string) => {
    const colors = ['bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
    return colors[email.charCodeAt(0) % colors.length];
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && userEmail) {
      if (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const avatarDataUrl = e.target?.result as string;
          setUserAvatar(avatarDataUrl);
          
          try {
            const { auth } = await import('../../src/firebase');
            const { UserProfileService } = await import('../../services/userProfileService');
            const currentUser = auth.currentUser;
            
            if (currentUser) {
              await UserProfileService.updateUserAvatar(currentUser.uid, avatarDataUrl);
            } else {
              localStorage.setItem(`avatar_${userEmail}`, avatarDataUrl);
            }
          } catch {
            localStorage.setItem(`avatar_${userEmail}`, avatarDataUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  if (!userEmail) {
    return onLoginRequest ? (
      <div className={`border-t border-slate-800 ${isCollapsed ? 'md:p-2 p-3' : 'p-3'}`}>
        <button
          onClick={onLoginRequest}
          className={`w-full flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white rounded-lg transition-all duration-200 ${isCollapsed ? 'md:justify-center' : ''}`}
          title={isCollapsed ? 'Đăng nhập' : ''}
        >
          <i className="fa-solid fa-right-to-bracket text-sm"></i>
          <span className={`text-sm font-medium ${isCollapsed ? 'md:hidden' : ''}`}>Đăng nhập</span>
        </button>
      </div>
    ) : null;
  }

  return (
    <div className={`border-t border-slate-800 ${isCollapsed ? 'md:p-2 p-3' : 'p-3'}`}>
      <div className="relative">
        {/* Avatar with Email when expanded */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-full flex items-center gap-3 py-2.5 px-2 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? userEmail : ''}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-cyan-400/50 overflow-hidden flex-shrink-0 hover:border-cyan-400 transition-colors">
            {userAvatar ? (
              <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full ${getAvatarColor(userEmail)} flex items-center justify-center`}>
                {getInitials(userName || userEmail)}
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">{userName || userEmail.split('@')[0]}</p>
            </div>
          )}
        </button>

        {/* Dropdown Menu - ChatGPT style: bên ngoài khi collapsed, bên trong khi expanded */}
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowMenu(false)}
            />
            <div className={`absolute bottom-full mb-2 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-2xl ring-2 ring-cyan-400/30 z-50 overflow-hidden transition-all duration-200
              ${isCollapsed ? '-left-2 w-72' : 'left-0 right-0 mx-2'}`}>
              {/* User Info Header - Non-clickable */}
              <div className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 pointer-events-none select-none">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/50 overflow-hidden flex-shrink-0">
                    {userAvatar ? (
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${getAvatarColor(userEmail)} flex items-center justify-center text-base`}>
                        {getInitials(userName || userEmail)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{userName || userEmail.split('@')[0]}</p>
                    <p className="text-xs text-white/80">{userEmail}</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2 bg-slate-800/50 backdrop-blur-sm">
                {/* History */}
                {onShowSettings && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onShowSettings();
                      if (typeof window !== 'undefined' && window.innerWidth < 768 && onClose) {
                        onClose();
                      }
                    }}
                    className="w-full flex items-center px-4 py-3 text-sm text-white hover:bg-cyan-500/20 transition-colors border-b border-slate-700/50"
                  >
                    <i className="fa-solid fa-clock-rotate-left w-5 text-center mr-3 text-cyan-400"></i>
                    <span className="font-medium">Lịch sử</span>
                  </button>
                )}

                {/* Logout */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onLogout?.();
                    if (typeof window !== 'undefined' && window.innerWidth < 768 && onClose) {
                      onClose();
                    }
                  }}
                  className="w-full flex items-center px-4 py-3 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <i className="fa-solid fa-right-from-bracket w-5 text-center mr-3"></i>
                  <span className="font-medium">Đăng xuất</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;