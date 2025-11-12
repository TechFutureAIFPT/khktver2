import React, { useMemo, useState, useCallback, memo } from 'react';
// FIX: Import MainCriterion to explicitly type 'criterion' and resolve 'unknown' type errors.
import type { HardFilters, WeightCriteria, MainCriterion } from '../../types';
import HardFilterPanel from '../ui/HardFilterPanel';
import WeightTile from '../ui/WeightTile';
import TotalWeightDisplay from '../ui/TotalWeightDisplay';

interface WeightsConfigProps {
  weights: WeightCriteria;
  setWeights: React.Dispatch<React.SetStateAction<WeightCriteria>>;
  hardFilters: HardFilters;
  setHardFilters: React.Dispatch<React.SetStateAction<HardFilters>>;
  onComplete: () => void;
}

const WeightsConfig: React.FC<WeightsConfigProps> = memo(({ weights, setWeights, hardFilters, setHardFilters, onComplete }) => {
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);
  const [validationErrorFilters, setValidationErrorFilters] = useState<string | null>(null);
  const [validationErrorWeights, setValidationErrorWeights] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1); // 1: Tiêu chí Lọc, 2: Phân bổ Trọng số

  const totalWeight = useMemo(() => {
    // FIX: Explicitly type the accumulator 'total' as a number. The TypeScript compiler was incorrectly
    // inferring its type as 'unknown', which caused an error with the '+' operator.
    return Object.values(weights).reduce((total: number, criterion: MainCriterion) => {
      if (criterion.children) {
        return total + criterion.children.reduce((subTotal, child) => subTotal + child.weight, 0);
      }
      return total + (criterion.weight || 0);
    }, 0);
  }, [weights]);

  const validateFilters = useCallback((): boolean => {
    setValidationErrorFilters(null);
    const mandatoryFieldsForValidation = [
      { key: 'location', label: 'Địa điểm làm việc' },
      { key: 'minExp', label: 'Kinh nghiệm tối thiểu' },
      { key: 'seniority', label: 'Cấp độ' },
      { key: 'education', label: 'Học vấn' },
      { key: 'industry', label: 'Ngành nghề' },
      { key: 'language', label: 'Ngôn ngữ' },
      { key: 'certificates', label: 'Chứng chỉ' },
      { key: 'salary', label: 'Lương' },
      { key: 'workFormat', label: 'Hình thức làm việc' },
      { key: 'contractType', label: 'Hợp đồng' },
    ];
    const invalidField = mandatoryFieldsForValidation.find(field => {
      const mandatoryKey = `${field.key}Mandatory` as keyof HardFilters;
      if (!hardFilters[mandatoryKey]) return false;
      if (field.key === 'salary') return !hardFilters.salaryMin && !hardFilters.salaryMax;
      const valueKey = field.key as keyof HardFilters;
      return !hardFilters[valueKey];
    });
    if (invalidField) {
      setValidationErrorFilters(`Vui lòng điền giá trị cho tiêu chí bắt buộc: ${invalidField.label}.`);
      return false;
    }
    return true;
  }, [hardFilters]);

  const handleFiltersComplete = useCallback(() => {
    if (!validateFilters()) return;
    setStep(2);
    // Scroll to top of module when moving to step 2
    const el = document.getElementById('module-weights');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [validateFilters]);

  const handleWeightsComplete = useCallback(() => {
    setValidationErrorWeights(null);
    if (totalWeight !== 100) {
      setValidationErrorWeights('Tổng trọng số phải bằng 100% trước khi tiếp tục.');
      return;
    }
    onComplete();
  }, [totalWeight, onComplete]);

  return (
    <section id="module-weights" className="module-pane active w-full">
      <div className="flex items-center justify-center p-2 sm:p-3 lg:p-4">
        <div className="w-full max-w-7xl">

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  step === 1 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg transform scale-105' 
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1 ? 'bg-white/20' : 'bg-slate-600'
                }`}>
                  1
                </div>
                Tiêu chí Lọc
              </button>
              
              <div className="w-8 h-0.5 bg-slate-600 rounded-full">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  step === 2 ? 'w-full bg-gradient-to-r from-purple-500 to-pink-500' : 'w-0'
                }`}></div>
              </div>
              
              <button
                type="button"
                onClick={() => step === 2 && setStep(2)}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  step === 2 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105' 
                    : 'bg-slate-700/50 text-slate-300'
                } ${step === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600/50 hover:text-white'}`}
                disabled={step === 1}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2 ? 'bg-white/20' : 'bg-slate-600'
                }`}>
                  2
                </div>
                Trọng số Chấm điểm
              </button>
            </div>
          </div>

          {step === 1 && (
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/50 via-slate-800/80 to-slate-900/50 border border-slate-700/50 rounded-3xl shadow-2xl backdrop-blur-xl">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-teal-500/5"></div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-cyan-500/10 to-transparent rounded-full blur-3xl"></div>
              
              <div className="relative z-10 p-8 md:p-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                      <i className="fa-solid fa-filter text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">Tiêu chí Lọc ứng viên</h3>
                      <p className="text-slate-400 hidden sm:block">Thiết lập các điều kiện bắt buộc để lọc ứng viên phù hợp</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleFiltersComplete}
                    className="h-12 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-500/40 transition-all duration-300 text-sm flex items-center justify-center gap-2 active:scale-95 group"
                  >
                    <span className="hidden lg:inline">Hoàn thành Tiêu chí</span>
                    <span className="lg:hidden">Hoàn thành</span>
                    <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                  </button>
                </div>
                
                {validationErrorFilters && (
                  <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-red-400">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span className="font-medium">Lỗi xác thực</span>
                    </div>
                    <p className="text-red-300 text-sm mt-1">{validationErrorFilters}</p>
                  </div>
                )}
                
                <HardFilterPanel hardFilters={hardFilters} setHardFilters={setHardFilters} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/50 via-slate-800/80 to-slate-900/50 border border-slate-700/50 rounded-3xl shadow-2xl backdrop-blur-xl">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-cyan-500/5"></div>
              <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-radial from-cyan-500/10 to-transparent rounded-full blur-3xl"></div>
              
              <div className="relative z-10 p-8 md:p-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center">
                      <i className="fa-solid fa-balance-scale text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">Phân bổ Trọng số Chấm điểm</h3>
                      <p className="text-slate-400 hidden sm:block">Thiết lập tỷ trọng đánh giá cho từng tiêu chí quan trọng</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2">
                      <span className={`px-4 py-2 rounded-xl border font-semibold text-sm ${totalWeight === 100 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-red-500 text-red-400 bg-red-500/10'}`}>
                        Tổng: {totalWeight}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {Object.values(weights)
                    .filter((c: MainCriterion) => c.children)
                    .map((criterion: MainCriterion) => (
                      <WeightTile
                        key={criterion.key}
                        criterion={criterion}
                        weights={weights}
                        setWeights={setWeights}
                        isExpanded={expandedCriterion === criterion.key}
                        onToggle={() =>
                          setExpandedCriterion((prev) =>
                            prev === criterion.key ? null : criterion.key
                          )
                        }
                      />
                    ))}
                </div>
                
                <div className="mt-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                  <TotalWeightDisplay totalWeight={totalWeight} />
                </div>
                
                <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-12 px-6 bg-slate-700/60 text-slate-200 font-medium rounded-xl hover:bg-slate-600/80 hover:-translate-y-0.5 transition-all duration-300 text-sm active:scale-95 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                    Quay lại
                  </button>
                  
                  <button
                    onClick={handleWeightsComplete}
                    disabled={totalWeight !== 100}
                    className={`h-12 px-8 font-semibold rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 text-base flex items-center justify-center gap-2 active:scale-95 group ${
                      totalWeight === 100
                        ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600 hover:shadow-xl hover:shadow-purple-500/25 hover:-translate-y-0.5 focus:ring-purple-500/40"
                        : "bg-gradient-to-r from-gray-600 to-gray-500 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <span className="hidden md:inline">Hoàn thành Trọng số</span>
                    <span className="md:hidden">Hoàn thành</span>
                    <i className={`fa-solid fa-check ${totalWeight === 100 ? 'group-hover:scale-110' : ''} transition-transform`} />
                  </button>
                </div>
                
                {validationErrorWeights && (
                  <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-red-400">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span className="font-medium">Lỗi xác thực</span>
                    </div>
                    <p className="text-red-300 text-sm mt-1">{validationErrorWeights}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

WeightsConfig.displayName = 'WeightsConfig';

export default WeightsConfig;
