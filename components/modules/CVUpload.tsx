import React, { useState, useCallback, memo } from 'react';
import type { Candidate, HardFilters, WeightCriteria, AppStep } from '../../types';
import { analyzeCVs } from '../../services/geminiService';

interface CVUploadProps {
  cvFiles: File[];
  setCvFiles: React.Dispatch<React.SetStateAction<File[]>>;
  jdText: string;
  weights: WeightCriteria;
  hardFilters: HardFilters;
  setAnalysisResults: React.Dispatch<React.SetStateAction<Candidate[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;
  onAnalysisStart: () => void;
  completedSteps: AppStep[];
}

const CVUpload: React.FC<CVUploadProps> = memo((props) => {
  const { cvFiles, setCvFiles, jdText, weights, hardFilters, setAnalysisResults, setIsLoading, setLoadingMessage, onAnalysisStart, completedSteps } = props;
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 12) {
        setError('Chỉ được phép tải lên tối đa 12 CV mỗi lần.');
        setCvFiles([]);
        return;
      }
      setError('');
      setCvFiles(files);
    }
  };

  const handleAnalyzeClick = async () => {
    const requiredSteps: AppStep[] = ['jd', 'weights'];
    const missingSteps = requiredSteps.filter(step => !completedSteps.includes(step));
    
    if (missingSteps.length > 0) {
      const stepNames = missingSteps.map(s => {
        if (s === 'jd') return 'Mô tả công việc';
        if (s === 'weights') return 'Phân bổ trọng số';
        return s;
      }).join(', ');
      setError(`Vui lòng hoàn thành các bước trước: ${stepNames}.`);
      return;
    }
    
    if (cvFiles.length === 0) {
      setError('Vui lòng chọn ít nhất một tệp CV để phân tích.');
      return;
    }

    setError('');
    setIsLoading(true);
    onAnalysisStart();
    setAnalysisResults([]);

    try {
      const analysisGenerator = analyzeCVs(jdText, weights, hardFilters, cvFiles);
      for await (const result of analysisGenerator) {
        if (result.status === 'progress') {
          setLoadingMessage(result.message);
        } else {
          setAnalysisResults(prev => [...prev, result as Candidate]);
        }
      }
    } catch (err) {
      console.error("Lỗi phân tích CV:", err);
      const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
      
      setError(message);
      
      setAnalysisResults(prev => {
        // Avoid adding duplicate system error cards
        if (prev.some(c => c.candidateName === 'Lỗi Hệ Thống')) return prev;
        return [...prev, {
          // FIX: Added the 'id' property to conform to the Candidate type for system error messages.
          id: `system-error-${Date.now()}`,
          status: 'FAILED',
          error: message,
          candidateName: 'Lỗi Hệ Thống',
          fileName: 'N/A',
          jobTitle: '',
          industry: '',
          department: '',
          experienceLevel: '',
          detectedLocation: '',
        }];
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage('Hoàn tất phân tích!');
    }
  };

  return (
    <section id="module-upload" className="module-pane active w-full">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/50 via-slate-800/80 to-slate-900/50 border border-slate-700/50 rounded-3xl shadow-2xl backdrop-blur-xl">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
        
        <div className="relative z-10 p-8 md:p-12 space-y-8">
          {/* Upload Area */}
          <div className="relative">
            <label 
              htmlFor="cv-files" 
              className="group block w-full cursor-pointer bg-gradient-to-br from-slate-800/50 via-slate-700/50 to-slate-800/50 border-2 border-dashed border-slate-600/50 hover:border-blue-500/50 rounded-2xl p-12 transition-all duration-300 hover:bg-gradient-to-br hover:from-blue-500/10 hover:via-purple-500/10 hover:to-pink-500/10"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  <i className="fa-solid fa-cloud-arrow-up text-white text-3xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Kéo thả hoặc nhấp để chọn file</h3>
                  <p className="text-slate-400 mb-3">Hỗ trợ định dạng: PDF, DOCX</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm font-medium">
                    <i className="fa-solid fa-info-circle"></i>
                    <span>Tối đa 12 CV mỗi lần phân tích</span>
                  </div>
                </div>
              </div>
            </label>
            <input 
              type="file" 
              id="cv-files" 
              multiple 
              accept=".pdf,.docx" 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>

          {/* File List */}
          {cvFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white">
                <i className="fa-solid fa-files text-blue-400"></i>
                <h4 className="font-semibold">Danh sách CV đã chọn ({cvFiles.length}/12)</h4>
              </div>
              <div className="grid gap-3 max-h-60 overflow-y-auto custom-scrollbar">
                {cvFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mr-4">
                      <i className="fa-regular fa-file-lines text-white"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{file.name}</p>
                      <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="text-green-400">
                      <i className="fa-solid fa-check-circle"></i>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span className="font-medium">Lỗi</span>
              </div>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Analyze Button */}
          <button
            id="analyze-button"
            onClick={handleAnalyzeClick}
            disabled={cvFiles.length === 0}
            className={`w-full h-16 font-bold text-xl rounded-2xl focus:outline-none focus:ring-4 transition-all duration-300 flex items-center justify-center gap-4 group relative overflow-hidden ${
              cvFiles.length > 0
                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 hover:shadow-2xl hover:shadow-blue-500/25 hover:-translate-y-1 focus:ring-blue-500/40 active:scale-95"
                : "bg-gradient-to-r from-gray-600 to-gray-500 text-gray-300 cursor-not-allowed"
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              cvFiles.length > 0 ? "bg-white/20 group-hover:scale-110" : "bg-gray-500/20"
            } transition-all duration-300`}>
              <i className="fa-solid fa-rocket text-2xl"></i>
            </div>
            <span>Bắt đầu Phân tích CV với AI</span>
            {cvFiles.length > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            )}
          </button>
        </div>
      </div>
    </section>
  );
});

CVUpload.displayName = 'CVUpload';

export default CVUpload;
