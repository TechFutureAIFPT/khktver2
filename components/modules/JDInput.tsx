import React, { useState } from 'react';
import { extractTextFromJdFile } from '../../services/ocrService';
import { extractJobPositionFromJD, filterAndStructureJD, extractHardFiltersFromJD } from '../../services/geminiService';
import type { HardFilters } from '../../types';

interface JDInputProps {
  jdText: string;
  setJdText: React.Dispatch<React.SetStateAction<string>>;
  jobPosition: string;
  setJobPosition: React.Dispatch<React.SetStateAction<string>>;
  hardFilters: HardFilters;
  setHardFilters: React.Dispatch<React.SetStateAction<HardFilters>>;
  onComplete: () => void;
}

const JDInput: React.FC<JDInputProps> = ({ jdText, setJdText, jobPosition, setJobPosition, hardFilters, setHardFilters, onComplete }) => {
  const isCompleteEnabled = jdText.trim().length > 50 && jobPosition.trim().length > 3;
  const characterCount = jdText.length;

  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');
  const [ocrError, setOcrError] = useState('');
  
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState('');

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    setOcrError('');
    setSummarizeError('');
    setJdText(''); // Clear previous JD on new upload
    setJobPosition(''); // Clear previous position
    setOcrMessage('Bắt đầu xử lý file...');

    try {
      const rawText = await extractTextFromJdFile(file, (message) => {
        setOcrMessage(message);
      });

      if (!rawText || rawText.trim().length < 50) {
        throw new Error('Không thể trích xuất đủ nội dung từ file. Vui lòng thử file khác hoặc nhập thủ công.');
      }
      
      setOcrMessage('Đang cấu trúc JD...');
      const structuredJd = await filterAndStructureJD(rawText);
      setJdText(structuredJd);

      setOcrMessage('Đang trích xuất chức danh...');
      const extractedPosition = await extractJobPositionFromJD(structuredJd);
      let successMessage = '';
      
      console.log('🔍 Extracted position:', extractedPosition); // Debug log
      
      if (extractedPosition) {
        setJobPosition(extractedPosition);
        successMessage = `✓ Đã phát hiện chức danh: ${extractedPosition}`;
        console.log('✅ Job position set:', extractedPosition); // Debug log
      } else {
        console.log('❌ No job position extracted'); // Debug log
      }

      // Extract hard filters from structured JD with smart conversion
      setOcrMessage('Đang phân tích tiêu chí lọc...');
      const extractedFilters = await extractHardFiltersFromJD(structuredJd);
      if (extractedFilters && Object.keys(extractedFilters).length > 0) {
        // Auto-tick mandatory checkboxes for any extracted field
        const mandatoryUpdates: any = {};
        if (extractedFilters.location) mandatoryUpdates.locationMandatory = true;
        if (extractedFilters.minExp) mandatoryUpdates.minExpMandatory = true;
        if (extractedFilters.seniority) mandatoryUpdates.seniorityMandatory = true;
        if (extractedFilters.education) mandatoryUpdates.educationMandatory = true;
        if (extractedFilters.language) mandatoryUpdates.languageMandatory = true;
        if (extractedFilters.certificates) mandatoryUpdates.certificatesMandatory = true;
        if (extractedFilters.workFormat) mandatoryUpdates.workFormatMandatory = true;
        if (extractedFilters.contractType) mandatoryUpdates.contractTypeMandatory = true;
        
        setHardFilters(prev => ({ ...prev, ...extractedFilters, ...mandatoryUpdates }));
        const extractedInfo = Object.entries(extractedFilters)
          .filter(([_, value]) => value && value !== '')
          .map(([key, value]) => {
            const fieldNames: any = {
              location: 'Địa điểm',
              minExp: 'Kinh nghiệm',
              seniority: 'Cấp bậc',
              education: 'Học vấn',
              language: 'Ngôn ngữ',
              languageLevel: 'Trình độ',
              certificates: 'Chứng chỉ',
              workFormat: 'Hình thức',
              contractType: 'Loại hợp đồng'
            };
            return `${fieldNames[key] || key}: ${value}`;
          }).join(', ');
        
        if (extractedInfo) {
          const tickedCount = Object.keys(mandatoryUpdates).length;
          successMessage += successMessage ? ` | 🎯 Đã điền & tick ✓ ${tickedCount} tiêu chí: ${extractedInfo}` : `✓ 🎯 Đã tự động điền & tick ✓ ${tickedCount} tiêu chí: ${extractedInfo}`;
        }
      }
      
      if (successMessage) {
        setOcrMessage(successMessage);
        setTimeout(() => setOcrMessage(''), 7000);
      } else {
        setOcrMessage('⚠ Vui lòng nhập chức danh và kiểm tra tiêu chí lọc thủ công');
        setTimeout(() => setOcrMessage(''), 3000);
      }
      
    } catch (error) {
      console.error("Lỗi xử lý JD:", error);
      const errorMessage = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
      setOcrError(errorMessage);
      setJdText(''); // Clear text area on error
    } finally {
      setIsOcrLoading(false);
      setOcrMessage('');
    }
  };
  
  const handleSummarizeJD = async () => {
    if (jdText.trim().length < 200) {
      setSummarizeError("Nội dung JD quá ngắn để tóm tắt.");
      return;
    }
    
    setIsSummarizing(true);
    setSummarizeError('');
    setOcrError(''); // Clear other errors

    try {
      const structuredJd = await filterAndStructureJD(jdText);
      setJdText(structuredJd);

      const extractedPosition = await extractJobPositionFromJD(structuredJd);
      console.log('🔍 AI Optimizer extracted position:', extractedPosition); // Debug log
      
      if (extractedPosition) {
        setJobPosition(extractedPosition);
        console.log('✓ AI đã trích xuất chức danh:', extractedPosition);
      } else {
        console.log('❌ AI Optimizer: No job position extracted'); // Debug log
      }

      // Extract hard filters from optimized JD with smart conversion
      const extractedFilters = await extractHardFiltersFromJD(structuredJd);
      if (extractedFilters && Object.keys(extractedFilters).length > 0) {
        // Auto-tick mandatory checkboxes for any extracted field
        const mandatoryUpdates: any = {};
        if (extractedFilters.location) mandatoryUpdates.locationMandatory = true;
        if (extractedFilters.minExp) mandatoryUpdates.minExpMandatory = true;
        if (extractedFilters.seniority) mandatoryUpdates.seniorityMandatory = true;
        if (extractedFilters.education) mandatoryUpdates.educationMandatory = true;
        if (extractedFilters.language) mandatoryUpdates.languageMandatory = true;
        if (extractedFilters.certificates) mandatoryUpdates.certificatesMandatory = true;
        if (extractedFilters.workFormat) mandatoryUpdates.workFormatMandatory = true;
        if (extractedFilters.contractType) mandatoryUpdates.contractTypeMandatory = true;
        
        setHardFilters(prev => ({ ...prev, ...extractedFilters, ...mandatoryUpdates }));
        console.log('✓ AI đã tự động điền & tick tiêu chí lọc:', extractedFilters, 'Mandatory:', mandatoryUpdates);
      }

    } catch (error) {
      console.error("Lỗi tóm tắt JD:", error);
      const errorMessage = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định khi tóm tắt.";
      setSummarizeError(errorMessage);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <section id="module-jd" className="module-pane active w-full min-h-screen" aria-labelledby="jd-title">
      <div className="relative overflow-hidden w-full min-h-screen">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
        
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
          {/* Job Position Input */}
          <div className="mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                <label htmlFor="job-position" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-briefcase text-white text-sm"></i>
                  </div>
                  Chức danh công việc <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="job-position"
                  value={jobPosition}
                  onChange={(e) => setJobPosition(e.target.value)}
                  className="w-full text-lg px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-slate-500/70"
                  placeholder="VD: Senior Frontend Developer, Product Manager, Data Scientist..."
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* Job Description Input */}
          <div className="mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                <label htmlFor="job-description" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-file-text text-white text-sm"></i>
                  </div>
                  Mô tả Job Description <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <textarea
                    id="job-description"
                    className="w-full px-4 py-4 bg-slate-900/50 border border-slate-600/50 rounded-xl
                               min-h-[350px] md:min-h-[400px]
                               text-base text-white leading-relaxed placeholder-slate-400
                               resize-none 
                               focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 hover:border-slate-500/70
                               transition-all duration-300 whitespace-pre-wrap"
                    placeholder="📋 Dán nội dung JD đầy đủ tại đây...

• Mô tả công việc chi tiết
• Yêu cầu kinh nghiệm và kỹ năng
• Quyền lợi và phúc lợi
• Thông tin về công ty

💡 Hoặc sử dụng OCR để scan từ file PDF/DOCX (Word)"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  ></textarea>
                  
                  {isSummarizing && (
                    <div className="absolute top-3 right-3 flex items-center gap-2 text-purple-400 bg-slate-900/80 rounded-lg px-3 py-1 backdrop-blur-sm">
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span className="text-xs">AI đang rút gọn...</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 right-3 text-xs font-mono text-slate-400 pointer-events-none bg-slate-900/80 px-2 py-1 rounded-md">
                    {characterCount} ký tự
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 mt-2">
                  Nội dung càng chi tiết, AI càng có thể đánh giá ứng viên chính xác hơn
                </p>
              </div>
            </div>
          </div>
          
          {/* Error Messages */}
          {(ocrError || summarizeError) && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span className="font-medium">Lỗi xử lý</span>
              </div>
              <p className="text-red-300 text-sm mt-1">{ocrError || summarizeError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* OCR & AI Tools */}
            <div className="flex-1 flex gap-3">
              {isOcrLoading ? (
                <div className="flex-1 h-14 px-3 sm:px-6 flex items-center justify-center text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                  <i className="fa-solid fa-spinner fa-spin mr-2 sm:mr-3"></i>
                  <span className="truncate">{ocrMessage}</span>
                </div>
              ) : (
                <label
                  htmlFor="ocr-jd-input"
                  title="Nhận JD từ PDF/DOCX bằng OCR"
                  aria-label="Quét OCR JD"
                  className="flex-1 cursor-pointer h-14 px-3 sm:px-6 flex items-center justify-center text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl hover:from-blue-600 hover:to-cyan-700 hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5 transition-all duration-300 shadow-lg group"
                >
                  <i className="fa-solid fa-wand-magic-sparkles sm:mr-3 group-hover:scale-110 transition-transform"></i>
                  <span className="hidden sm:inline">OCR Smart Scan</span>
                  <span className="sm:hidden ml-2 text-xs">OCR</span>
                  <input
                    id="ocr-jd-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx"
                    onChange={handleOcrFileChange}
                    onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                    disabled={isOcrLoading || isSummarizing}
                  />
                </label>
              )}
              
              <button
                onClick={handleSummarizeJD}
                disabled={isOcrLoading || isSummarizing || jdText.trim().length < 200}
                title="Dùng AI để tóm tắt và cấu trúc lại JD đã dán"
                aria-label="Rút gọn ý chính JD"
                className="flex-1 h-14 px-3 sm:px-6 flex items-center justify-center text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 hover:shadow-xl hover:shadow-purple-500/25 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:bg-slate-600 disabled:hover:translate-y-0 shadow-lg group"
              >
                <i className="fa-solid fa-brain sm:mr-3 group-hover:scale-110 transition-transform"></i>
                <span className="hidden sm:inline">AI Optimizer</span>
                <span className="sm:hidden ml-2 text-xs">AI</span>
              </button>
            </div>
            
            {/* Complete Button */}
            <button
              onClick={onComplete}
              disabled={!isCompleteEnabled}
              className="h-14 px-8 text-base font-semibold flex items-center justify-center gap-3 rounded-xl text-slate-900 transition-all duration-300 ease-in-out shadow-xl bg-gradient-to-r from-cyan-400 to-green-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-400/25 active:scale-95 disabled:bg-slate-700/50 disabled:text-slate-400 disabled:translate-y-0 disabled:shadow-none group"
            >
              <span>Hoàn thành & Tiếp tục</span>
              <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JDInput;