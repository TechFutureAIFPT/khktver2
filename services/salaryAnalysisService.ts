/**
 * Salary Analysis Service
 * Phân tích và so sánh mức lương với thị trường Việt Nam
 * Sử dụng API: job-salary-data.p.rapidapi.com
 */

interface SalaryData {
  job_title: string;
  location: string;
  publisher_name?: string;
  publisher_link?: string;
  salary_period?: string;
  salary_currency?: string;
  salary_from?: number;
  salary_to?: number;
  median_salary?: number;
  p25_salary?: number;
  p75_salary?: number;
}

interface SalaryApiResponse {
  status: string;
  request_id: string;
  parameters: {
    job_title: string;
    location: string;
    location_type: string;
    years_of_experience: string;
  };
  data: SalaryData[];
}

interface ExperienceLevel {
  years: string;
  level: string;
}

interface SalaryAnalysisInput {
  jobTitle: string;
  location?: string;
  yearsOfExperience?: number;
  currentSalary?: number;
  cvText?: string;
  jdText?: string;
}

interface SalaryAnalysisResult {
  summary: string;
  marketSalary: {
    p25: number;
    median: number;
    p75: number;
    currency: string;
    period: string;
  } | null;
  comparison?: {
    currentSalary: number;
    marketPosition: 'below' | 'reasonable' | 'above';
    difference: number;
    differencePercent: number;
  };
  recommendation: string;
  negotiationTips: string[];
  source: string;
  error?: string;
}

/**
 * Chuẩn hóa job title để phù hợp với API
 */
const normalizeJobTitle = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Remove Vietnamese diacritics for better API matching
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Chuẩn hóa địa điểm theo format API
 */
const normalizeLocation = (location?: string): string => {
  if (!location) return 'Vietnam';
  
  const locationMap: { [key: string]: string } = {
    'hà nội': 'Hanoi',
    'hanoi': 'Hanoi',
    'hải phòng': 'Hai Phong',
    'haiphong': 'Hai Phong',
    'đà nẵng': 'Da Nang',
    'danang': 'Da Nang',
    'thành phố hồ chí minh': 'Ho Chi Minh City',
    'hồ chí minh': 'Ho Chi Minh City',
    'ho chi minh': 'Ho Chi Minh City',
    'hcm': 'Ho Chi Minh City',
    'saigon': 'Ho Chi Minh City',
    'sài gòn': 'Ho Chi Minh City',
  };

  const normalized = location.toLowerCase().trim();
  return locationMap[normalized] || 'Vietnam';
};

/**
 * Xác định level kinh nghiệm từ số năm
 */
const getExperienceLevel = (years?: number): ExperienceLevel => {
  if (years === undefined || years === null) {
    return { years: 'ALL', level: 'All Levels' };
  }

  if (years <= 1) {
    return { years: '0-1', level: 'Junior' };
  } else if (years <= 4) {
    return { years: '2-4', level: 'Mid' };
  } else if (years <= 7) {
    return { years: '5-7', level: 'Senior' };
  } else {
    return { years: '8+', level: 'Lead' };
  }
};

/**
 * Trích xuất thông tin từ CV hoặc JD
 */
const extractInfoFromText = (text: string): {
  jobTitle?: string;
  location?: string;
  yearsOfExperience?: number;
  salary?: number;
} => {
  const result: any = {};

  // Extract job title (basic patterns)
  const titlePatterns = [
    /(?:vị trí|chức danh|position|job title)[:\s]+([^\n]+)/i,
    /tuyển dụng\s+([^\n]+)/i,
  ];

  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.jobTitle = match[1].trim();
      break;
    }
  }

  // Extract location
  const locationPatterns = [
    /(?:địa điểm|location)[:\s]+([^\n]+)/i,
    /làm việc tại\s+([^\n]+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.location = match[1].trim();
      break;
    }
  }

  // Extract years of experience
  const expPatterns = [
    /(\d+)\s*(?:\+)?\s*năm kinh nghiệm/i,
    /(\d+)\s*(?:\+)?\s*years?\s+(?:of\s+)?experience/i,
    /kinh nghiệm[:\s]+(\d+)/i,
  ];

  for (const pattern of expPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.yearsOfExperience = parseInt(match[1], 10);
      break;
    }
  }

  // Extract salary (VND)
  const salaryPatterns = [
    /(?:lương|salary|mức lương)[:\s]+(?:từ\s+)?(?:khoảng\s+)?(\d+(?:[.,]\d+)?)\s*(?:triệu|million|tr)/i,
    /(\d+(?:[.,]\d+)?)\s*(?:triệu|million|tr)\s*(?:VND|vnđ|đ)?/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      const salaryStr = match[1].replace(',', '.');
      result.salary = parseFloat(salaryStr) * 1_000_000; // Convert to VND
      break;
    }
  }

  return result;
};

/**
 * Gọi API lấy dữ liệu lương từ RapidAPI
 */
const fetchSalaryData = async (
  jobTitle: string,
  location: string,
  yearsOfExperience: string
): Promise<SalaryData[] | null> => {
  const apiKey = (import.meta as any).env?.VITE_RAPIDAPI_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ RAPIDAPI_KEY not configured. Using fallback estimation.');
    return null;
  }

  try {
    const params = new URLSearchParams({
      job_title: jobTitle,
      location: location,
      location_type: 'ANY',
      years_of_experience: yearsOfExperience,
    });

    const url = `https://job-salary-data.p.rapidapi.com/job-salary?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'job-salary-data.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data: SalaryApiResponse = await response.json();
    
    if (data.status === 'OK' && data.data && data.data.length > 0) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('❌ Salary API fetch error:', error);
    return null;
  }
};

/**
 * Ước tính mức lương nội bộ (fallback khi API không khả dụng)
 */
const estimateSalaryFallback = (
  jobTitle: string,
  location: string,
  yearsOfExperience?: number
): SalaryAnalysisResult['marketSalary'] => {
  // Basic salary estimation based on job title keywords and experience
  const titleLower = jobTitle.toLowerCase();
  
  let baseMin = 8; // 8 triệu VND
  let baseMedian = 15; // 15 triệu VND
  let baseMax = 25; // 25 triệu VND

  // Adjust based on job type
  if (titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('architect')) {
    baseMin = 25;
    baseMedian = 40;
    baseMax = 60;
  } else if (titleLower.includes('manager') || titleLower.includes('director')) {
    baseMin = 30;
    baseMedian = 50;
    baseMax = 80;
  } else if (titleLower.includes('junior') || titleLower.includes('fresher')) {
    baseMin = 6;
    baseMedian = 10;
    baseMax = 15;
  } else if (titleLower.includes('mid') || (yearsOfExperience && yearsOfExperience >= 2 && yearsOfExperience <= 4)) {
    baseMin = 12;
    baseMedian = 20;
    baseMax = 30;
  }

  // Technology premium
  const premiumTech = ['ai', 'ml', 'machine learning', 'blockchain', 'devops', 'cloud', 'architect'];
  if (premiumTech.some(tech => titleLower.includes(tech))) {
    baseMin *= 1.3;
    baseMedian *= 1.3;
    baseMax *= 1.3;
  }

  // Location adjustment
  if (location.includes('Ho Chi Minh') || location.includes('Hanoi')) {
    baseMin *= 1.1;
    baseMedian *= 1.1;
    baseMax *= 1.1;
  }

  // Experience adjustment
  if (yearsOfExperience !== undefined) {
    const expMultiplier = 1 + (yearsOfExperience * 0.08); // 8% per year
    baseMin *= expMultiplier;
    baseMedian *= expMultiplier;
    baseMax *= expMultiplier;
  }

  return {
    p25: Math.round(baseMin * 1_000_000),
    median: Math.round(baseMedian * 1_000_000),
    p75: Math.round(baseMax * 1_000_000),
    currency: 'VND',
    period: 'MONTHLY',
  };
};

/**
 * Format số tiền VND
 */
const formatVND = (amount: number): string => {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} tỷ VND`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} triệu VND`;
  }
  return `${amount.toLocaleString('vi-VN')} VND`;
};

/**
 * Tạo gợi ý thương lượng
 */
const generateNegotiationTips = (
  marketPosition: 'below' | 'reasonable' | 'above',
  currentSalary: number,
  marketMedian: number
): string[] => {
  const tips: string[] = [];

  if (marketPosition === 'below') {
    tips.push('💰 Mức lương hiện tại thấp hơn thị trường. Bạn có cơ sở để đàm phán tăng lương.');
    tips.push('📊 Chuẩn bị dữ liệu về thành tích và đóng góp của bạn cho công ty.');
    tips.push('🎯 Đề xuất mức lương gần với median thị trường (khoảng ' + formatVND(marketMedian) + ').');
    tips.push('⏰ Chọn thời điểm phù hợp như đánh giá định kỳ hoặc sau khi hoàn thành dự án lớn.');
    tips.push('🔄 Xem xét cơ hội ở công ty khác nếu không được điều chỉnh hợp lý.');
  } else if (marketPosition === 'reasonable') {
    tips.push('✅ Mức lương hiện tại phù hợp với thị trường.');
    tips.push('📈 Tập trung phát triển kỹ năng để tiến tới mức lương cao hơn (P75).');
    tips.push('🎓 Cân nhắc các lợi ích phi tài chính như đào tạo, thăng tiến, work-life balance.');
    tips.push('💡 Đề xuất review lương định kỳ hàng năm dựa trên hiệu suất.');
  } else {
    tips.push('⭐ Mức lương hiện tại cao hơn thị trường - rất tốt!');
    tips.push('🎯 Duy trì và nâng cao hiệu suất làm việc để xứng đáng với mức lương.');
    tips.push('🚀 Tập trung vào phát triển sự nghiệp dài hạn và xây dựng giá trị cá nhân.');
    tips.push('🤝 Chia sẻ kinh nghiệm với đồng nghiệp và đóng góp nhiều hơn cho team.');
  }

  return tips;
};

/**
 * So sánh mức lương
 */
const compareSalary = (
  currentSalary: number,
  marketSalary: SalaryAnalysisResult['marketSalary']
): SalaryAnalysisResult['comparison'] => {
  if (!marketSalary) return undefined;

  const { median } = marketSalary;
  const difference = currentSalary - median;
  const differencePercent = (difference / median) * 100;

  let marketPosition: 'below' | 'reasonable' | 'above';

  if (currentSalary < marketSalary.p25) {
    marketPosition = 'below';
  } else if (currentSalary > marketSalary.p75) {
    marketPosition = 'above';
  } else {
    marketPosition = 'reasonable';
  }

  return {
    currentSalary,
    marketPosition,
    difference,
    differencePercent: Math.round(differencePercent * 10) / 10,
  };
};

/**
 * Hàm chính: Phân tích mức lương
 */
export const analyzeSalary = async (
  input: SalaryAnalysisInput
): Promise<SalaryAnalysisResult> => {
  try {
    // 1. Extract and normalize data
    let { jobTitle, location, yearsOfExperience, currentSalary } = input;

    // Extract from CV/JD if provided and missing info
    if ((input.cvText || input.jdText) && (!jobTitle || !location || !yearsOfExperience)) {
      const extracted = extractInfoFromText(input.cvText || input.jdText || '');
      
      jobTitle = jobTitle || extracted.jobTitle || '';
      location = location || extracted.location;
      yearsOfExperience = yearsOfExperience ?? extracted.yearsOfExperience;
      currentSalary = currentSalary ?? extracted.salary;
    }

    // Validate required fields
    if (!jobTitle) {
      throw new Error('Không thể xác định chức danh công việc. Vui lòng cung cấp thông tin rõ ràng hơn.');
    }

    // 2. Normalize data
    const normalizedTitle = normalizeJobTitle(jobTitle);
    const normalizedLocation = normalizeLocation(location);
    const expLevel = getExperienceLevel(yearsOfExperience);

    // 3. Fetch salary data from API
    const salaryData = await fetchSalaryData(
      normalizedTitle,
      normalizedLocation,
      expLevel.years
    );

    let marketSalary: SalaryAnalysisResult['marketSalary'] = null;

    // 4. Process API response or use fallback
    if (salaryData && salaryData.length > 0) {
      const primary = salaryData[0];
      
      // Convert to VND if needed
      let multiplier = 1;
      if (primary.salary_currency && primary.salary_currency !== 'VND') {
        multiplier = 25000; // Rough USD to VND conversion
      }

      marketSalary = {
        p25: (primary.p25_salary || 0) * multiplier,
        median: (primary.median_salary || 0) * multiplier,
        p75: (primary.p75_salary || 0) * multiplier,
        currency: 'VND',
        period: primary.salary_period || 'MONTHLY',
      };

      // Validate data
      if (marketSalary.median <= 0) {
        console.warn('Invalid API data, using fallback');
        marketSalary = estimateSalaryFallback(jobTitle, normalizedLocation, yearsOfExperience);
      }
    } else {
      marketSalary = estimateSalaryFallback(jobTitle, normalizedLocation, yearsOfExperience);
    }

    // 5. Compare if current salary provided
    const comparison = currentSalary 
      ? compareSalary(currentSalary, marketSalary)
      : undefined;

    // 6. Generate summary and recommendations
    let summary = '';
    let recommendation = '';
    const negotiationTips: string[] = [];

    if (comparison) {
      // Has current salary - compare with market
      const { marketPosition, differencePercent } = comparison;
      
      if (marketPosition === 'below') {
        summary = `Mức lương hiện tại (${formatVND(currentSalary)}) thấp hơn thị trường khoảng ${Math.abs(differencePercent)}%. Đây là cơ hội tốt để đàm phán tăng lương.`;
        recommendation = `Bạn nên đề xuất tăng lương lên khoảng ${formatVND(marketSalary!.median)} (mức trung vị thị trường) hoặc tối thiểu ${formatVND(marketSalary!.p25)} (mức P25).`;
      } else if (marketPosition === 'reasonable') {
        summary = `Mức lương hiện tại (${formatVND(currentSalary)}) nằm trong khoảng hợp lý của thị trường (chênh lệch ${Math.abs(differencePercent)}% so với median).`;
        recommendation = `Mức lương của bạn phù hợp. Tập trung vào phát triển kỹ năng để tiến tới mức ${formatVND(marketSalary!.p75)} (P75 - top 25%).`;
      } else {
        summary = `Mức lương hiện tại (${formatVND(currentSalary)}) cao hơn thị trường khoảng ${Math.abs(differencePercent)}%. Đây là mức lương rất tốt!`;
        recommendation = `Mức lương của bạn xuất sắc. Hãy duy trì hiệu suất cao và tìm kiếm cơ hội phát triển sự nghiệp dài hạn.`;
      }

      negotiationTips.push(...generateNegotiationTips(marketPosition, currentSalary, marketSalary!.median));
    } else {
      // No current salary - provide market range
      summary = `Khoảng lương thị trường cho vị trí "${jobTitle}" tại ${normalizedLocation} với ${expLevel.level} level là từ ${formatVND(marketSalary!.p25)} đến ${formatVND(marketSalary!.p75)}.`;
      recommendation = `Mức lương xứng đáng đề xuất: ${formatVND(marketSalary!.median)} (median). Tùy vào kỹ năng và kinh nghiệm cụ thể, bạn có thể đàm phán trong khoảng này.`;
      
      negotiationTips.push(
        '💼 Đánh giá kỹ năng và kinh nghiệm của bạn so với yêu cầu công việc.',
        '📊 Median (${formatVND(marketSalary!.median)}) là mức an toàn để bắt đầu đàm phán.',
        '🎯 Nếu có kỹ năng nổi trội hoặc kinh nghiệm đặc biệt, hướng tới P75 (${formatVND(marketSalary!.p75)}).',
        '🔍 Xem xét thêm benefits như bảo hiểm, thưởng, training, career path.',
        '⚖️ Cân nhắc quy mô công ty, văn hóa làm việc, và cơ hội phát triển.'
      );
    }

    // 7. Source attribution
    const source = salaryData 
      ? 'Theo dữ liệu từ job-salary-data API (RapidAPI), thị trường Việt Nam.'
      : 'Ước tính dựa trên dữ liệu nội bộ và xu hướng thị trường Việt Nam (API không khả dụng).';

    return {
      summary,
      marketSalary,
      comparison,
      recommendation,
      negotiationTips,
      source,
    };

  } catch (error) {
    console.error('❌ Salary analysis error:', error);
    
    return {
      summary: 'Không thể phân tích mức lương do lỗi xử lý.',
      marketSalary: null,
      recommendation: 'Vui lòng kiểm tra lại thông tin đầu vào hoặc thử lại sau.',
      negotiationTips: [],
      source: 'N/A',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Batch analysis for multiple candidates
 */
export const analyzeSalaryBatch = async (
  inputs: SalaryAnalysisInput[]
): Promise<SalaryAnalysisResult[]> => {
  const results: SalaryAnalysisResult[] = [];
  
  // Process in small batches to avoid rate limiting
  const BATCH_SIZE = 3;
  
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, Math.min(i + BATCH_SIZE, inputs.length));
    const batchResults = await Promise.all(batch.map(input => analyzeSalary(input)));
    results.push(...batchResults);
    
    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};

export default {
  analyzeSalary,
  analyzeSalaryBatch,
};
