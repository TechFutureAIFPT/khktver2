import { GoogleGenAI, Type } from '@google/genai';
import PQueue from 'p-queue';
import type { Candidate, HardFilters, WeightCriteria, MainCriterion, SubCriterion, AnalysisRunData, ChatMessage } from '../types';
import { processFileToText } from './ocrService';
import { MODEL_NAME } from '../constants';
import { analysisCacheService } from './analysisCache';

// Lazily initialize the AI client to allow the app to load even if the API key is not immediately available.
let ai: GoogleGenAI | null = null;
let currentKeyIndex = 0;
const apiKeys = [
  (import.meta as any).env?.VITE_GEMINI_API_KEY_1,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_2,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_3,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_4,
].filter(Boolean); // Filter out undefined

// Queue for managing concurrent API calls
const apiQueue = new PQueue({ concurrency: 2 }); // Limit to 2 concurrent requests

function getAi(): GoogleGenAI {
  if (!ai) {
    if (apiKeys.length === 0) {
      throw new Error("No GEMINI_API_KEY environment variables set.");
    }
    // Try the current key
    const key = apiKeys[currentKeyIndex];
    if (!key) {
      throw new Error("API_KEY environment variable not set.");
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

function switchToNextKey() {
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  ai = null; // Reset to force re-init with new key
}


async function generateContentWithFallback(model: string, contents: any, config: any): Promise<any> {
  const startTime = Date.now();
  const params = { model, contents: typeof contents === 'string' ? contents.substring(0, 100) + '...' : 'complex', config };

  try {
    const result = await apiQueue.add(async () => {
      for (let attempt = 0; attempt < apiKeys.length; attempt++) {
        try {
          const aiInstance = getAi();
          const response = await aiInstance.models.generateContent({
            model,
            contents,
            config,
          });
          return response;
        } catch (error) {
          console.warn(`API key ${currentKeyIndex + 1} failed:`, error);
          switchToNextKey();
        }
      }
      throw new Error("All API keys failed. Please check your API keys and quota.");
    });

    console.log('generateContent success:', Date.now() - startTime);
    return result;
  } catch (error) {
    console.error('generateContent error:', params, null, Date.now() - startTime, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}


/**
 * Intelligently filters and structures raw JD text using AI.
 * Keeps only three main sections and returns a structured JSON or throws an error.
 * @param rawJdText The raw text extracted from a JD file.
 * @returns A promise that resolves to a formatted string of the structured JD.
 */
export const filterAndStructureJD = async (rawJdText: string, file?: File): Promise<string> => {
  const jdSchema = {
    type: Type.OBJECT,
    properties: {
      "MucDichCongViec": { type: Type.STRING, description: "Nội dung mục đích công việc, hoặc chuỗi rỗng nếu không tìm thấy." },
      "MoTaCongViec": { type: Type.STRING, description: "Nội dung mô tả công việc, hoặc chuỗi rỗng nếu không tìm thấy." },
      "YeuCauCongViec": { type: Type.STRING, description: "Nội dung yêu cầu công việc, hoặc chuỗi rỗng nếu không tìm thấy." },
    },
    required: ["MucDichCongViec", "MoTaCongViec", "YeuCauCongViec"]
  };

  const prompt = `
    Bạn là một AI chuyên gia xử lý văn bản JD. Nhiệm vụ của bạn là phân tích văn bản JD thô (có thể chứa lỗi OCR) và trích xuất, làm sạch, và cấu trúc lại nội dung một cách CHÍNH XÁC.

    QUY TẮC:
    1.  **Làm sạch văn bản:** Sửa lỗi chính tả, bỏ ký tự thừa, chuẩn hóa dấu câu và viết hoa cho đúng chuẩn tiếng Việt.
    2.  **BẢO TOÀN NỘI DUNG GỐC:** Giữ nguyên văn phong và ý nghĩa của các câu trong JD gốc. Chỉ sửa lỗi chính tả và định dạng, không được diễn giải lại hay tóm tắt làm thay đổi ý.
    3.  **Trích xuất 3 phần cốt lõi:** Chỉ giữ lại nội dung cho 3 mục: "Mục đích công việc", "Mô tả công việc", và "Yêu cầu công việc".
    4.  **Linh hoạt:** Hiểu các tiêu đề đồng nghĩa. Ví dụ: "Nhiệm vụ" là "Mô tả công việc"; "Yêu cầu ứng viên" là "Yêu cầu công việc".
    5.  **Loại bỏ nội dung thừa:** Xóa bỏ tất cả các phần không liên quan như giới thiệu công ty, phúc lợi, lương thưởng, thông tin liên hệ.
    6.  **Xử lý mục bị thiếu:** Nếu không tìm thấy nội dung cho một mục, trả về một chuỗi rỗng ("") cho mục đó trong JSON.
    7.  **Kết quả:** Luôn trả về một đối tượng JSON với 3 khóa bắt buộc: \`MucDichCongViec\`, \`MoTaCongViec\`, \`YeuCauCongViec\`.
    
    Văn bản JD thô cần xử lý:
    ---
    ${rawJdText.slice(0, 4000)}
    ---
  `;

  try {
    const response = await generateContentWithFallback(MODEL_NAME, prompt, {
      responseMimeType: "application/json",
      responseSchema: jdSchema,
      temperature: 0, // deterministic
      topP: 0,
      topK: 1,
    });

    const resultJson = JSON.parse(response.text);

    const hasContent = resultJson.MucDichCongViec?.trim() || resultJson.MoTaCongViec?.trim() || resultJson.YeuCauCongViec?.trim();
    if (!hasContent) {
        throw new Error("Không thể trích xuất bất kỳ nội dung có ý nghĩa nào từ JD. Vui lòng kiểm tra file.");
    }

    let formattedString = '';
    if (resultJson.MucDichCongViec?.trim()) {
        formattedString += `MỤC ĐÍCH CÔNG VIỆC\n${resultJson.MucDichCongViec.trim()}\n\n`;
    }
    if (resultJson.MoTaCongViec?.trim()) {
        formattedString += `MÔ TẢ CÔNG VIỆC\n${resultJson.MoTaCongViec.trim()}\n\n`;
    }
    if (resultJson.YeuCauCongViec?.trim()) {
        formattedString += `YÊU CẦU CÔNG VIỆC\n${resultJson.YeuCauCongViec.trim()}\n\n`;
    }

    const finalResult = formattedString.trim();

    return finalResult;

  } catch (error) {
    console.error("Lỗi khi lọc và cấu trúc JD:", error);
    if (error instanceof Error && error.message.includes("Không thể trích xuất")) {
        throw error;
    }
    throw new Error("AI không thể phân tích cấu trúc JD. Vui lòng thử lại.");
  }
};


export const extractJobPositionFromJD = async (jdText: string): Promise<string> => {
  if (!jdText || jdText.trim().length < 20) {
    return '';
  }

  // Enhanced prompt with multiple extraction strategies
  const prompt = `Bạn là chuyên gia phân tích JD với khả năng trích xuất và SUY LUẬN chức danh chính xác cao. Nhiệm vụ: Tìm và trả về CHÍNH XÁC tên chức danh công việc từ văn bản JD.

CHIẾN LƯỢC TRÍCH XUẤT (theo thứ tự ưu tiên):

1. **TRÍCH XUẤT TRỰC TIẾP** - Tìm chức danh có sẵn:
   - "Vị trí tuyển dụng", "Chức danh", "Position", "Job Title", "Tuyển dụng", "Cần tuyển"
   - "Tuyển dụng [Chức danh]", "Vị trí: [Chức danh]", "We are looking for [Job Title]"

2. **SUY LUẬN TỪ MÔ TẢ CÔNG VIỆC** - Nếu không có chức danh rõ ràng:
   
   **Công nghệ/Kỹ thuật:**
   - Frontend: React, Vue, Angular, HTML, CSS, JavaScript → "Frontend Developer"
   - Backend: Node.js, Java, Python, API, Database → "Backend Developer"  
   - Fullstack: Frontend + Backend → "Fullstack Developer"
   - Mobile: React Native, Flutter, iOS, Android → "Mobile Developer"
   - DevOps: Docker, Kubernetes, CI/CD, AWS, Azure → "DevOps Engineer"
   - Data: SQL, Python, Analytics, Machine Learning → "Data Analyst/Engineer"
   - QA/Test: Testing, Automation, Quality → "QA Engineer"

   **Quản lý/Business:**
   - Quản lý dự án, team lead, coordinate → "Project Manager"
   - Marketing, campaign, brand → "Marketing Specialist"
   - Sales, bán hàng, customer → "Sales Executive"
   - HR, tuyển dụng, nhân sự → "HR Specialist"
   - Thiết kế, design, UI/UX → "UI/UX Designer"

3. **XÁC ĐỊNH CẤP BẬC** từ yêu cầu kinh nghiệm:
   - 0-1 năm → "Junior"
   - 2-4 năm → "Mid-level" hoặc không prefix
   - 5+ năm → "Senior"  
   - Lead team, quản lý → "Lead" hoặc "Manager"

NGUYÊN TẮC SUY LUẬN:
- Đọc kỹ mô tả công việc và yêu cầu kỹ năng
- Dựa vào công nghệ chính để xác định chức danh
- Kết hợp kinh nghiệm để định cấp bậc
- Ưu tiên thuật ngữ phổ biến trong ngành

QUY TẮC ĐẦU RA:
- CHỈ trả về tên chức danh, KHÔNG có thêm text nào khác
- Độ dài: 3-50 ký tự
- Ví dụ tốt: "Senior Frontend Developer", "Mobile Developer", "Product Manager", "Data Engineer"
- LUÔN trả về kết quả, ngay cả khi phải suy luận

PHÂN TÍCH VĂN BẢN JD:
---
${jdText.slice(0, 2000)}
---

Chức danh công việc:`;

  try {
    const response = await generateContentWithFallback(MODEL_NAME, prompt, {
      temperature: 0.3, // Tăng temperature để AI suy luận linh hoạt hơn
      topP: 0.7,
      topK: 10,
      thinkingConfig: { thinkingBudget: 0 },
    });

    console.log('🤖 Gemini raw response for job position:', response.text); // Debug log

    let position = response.text.trim();
    
    // Post-processing to clean up the result
    position = position
      .replace(/^["'`]+|["'`]+$/g, '') // Remove quotes
      .replace(/^(chức danh|vị trí|position|job title)[:\s]*/i, '') // Remove labels
      .replace(/[\n\r]+/g, ' ') // Replace newlines with space
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Validate result
    if (position.length >= 3 && position.length <= 80) {
      // Expanded validation: should contain meaningful job-related words or common job patterns
      const jobKeywords = [
        // Technical roles
        'developer', 'engineer', 'programmer', 'architect', 'devops', 'qa', 'tester',
        // Business roles  
        'manager', 'analyst', 'specialist', 'coordinator', 'assistant', 'executive', 'consultant',
        // Design/Creative
        'designer', 'artist', 'creative', 'content', 'marketing', 'brand',
        // Leadership
        'senior', 'junior', 'lead', 'director', 'head', 'chief', 'supervisor',
        // Vietnamese terms
        'kỹ sư', 'chuyên viên', 'quản lý', 'trưởng', 'phó', 'nhân viên', 'giám đốc',
        // Common job patterns
        'frontend', 'backend', 'fullstack', 'mobile', 'web', 'software', 'data', 'product',
        'sales', 'hr', 'admin', 'support', 'service', 'operations', 'finance'
      ];
      const lowerPosition = position.toLowerCase();
      
      // Check if contains job keywords OR looks like a job title (contains common patterns)
      if (jobKeywords.some(keyword => lowerPosition.includes(keyword)) || 
          /\b(intern|internship|trainee|entry|mid|senior|lead|head|chief|director|manager|specialist|developer|engineer|analyst|designer|coordinator|assistant|executive|consultant)\b/i.test(position)) {
        return position;
      }
      
      // If no keywords found but has reasonable length and structure, still return it (AI inference result)
      if (position.length >= 5 && position.length <= 50 && !/\d{4,}/.test(position) && !/(công ty|company|ltd|inc|corp)/i.test(position)) {
        console.log('🤖 Returning inferred job position:', position);
        return position;
      }
    }
    
    return '';
  } catch (error) {
    console.error("Lỗi khi trích xuất chức danh công việc từ AI:", error);
    return '';
  }
};


const detailedScoreSchema = {
    type: Type.OBJECT,
    properties: {
        "Tiêu chí": { type: Type.STRING },
        "Điểm": { type: Type.STRING, description: "Score for the criterion, format: 'score/weight_percentage' (e.g., '12.5/15' for 15% weight)" },
        "Công thức": { type: Type.STRING, description: "Formula used, format: 'subscore X/weight_Y% = X points'" },
        "Dẫn chứng": { type: Type.STRING, description: "Direct quote from the CV as evidence. Must be in Vietnamese." },
        "Giải thích": { type: Type.STRING, description: "Brief explanation of the score. Must be in Vietnamese." },
    },
    required: ["Tiêu chí", "Điểm", "Công thức", "Dẫn chứng", "Giải thích"]
};

const analysisSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      candidateName: { type: Type.STRING },
      phone: { type: Type.STRING, description: "Candidate's phone number, if found." },
      email: { type: Type.STRING, description: "Candidate's email address, if found." },
      fileName: { type: Type.STRING },
      jobTitle: { type: Type.STRING },
      industry: { type: Type.STRING },
      department: { type: Type.STRING },
      experienceLevel: { type: Type.STRING },
      hardFilterFailureReason: { type: Type.STRING, description: "Reason for failing a mandatory hard filter, in Vietnamese." },
      softFilterWarnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of warnings for non-mandatory filters that were not met, in Vietnamese." },
      detectedLocation: { type: Type.STRING },
      analysis: {
        type: Type.OBJECT,
        properties: {
            "Tổng điểm": { type: Type.INTEGER },
            "Hạng": { type: Type.STRING },
            "Chi tiết": {
                type: Type.ARRAY,
                items: detailedScoreSchema,
            },
            "Điểm mạnh CV": { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3-5 key strengths from the CV." },
            "Điểm yếu CV": { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3-5 key weaknesses from the CV." },
            "educationValidation": {
                type: Type.OBJECT,
                properties: {
                    "standardizedEducation": { type: Type.STRING, description: "Standardized education info format: 'School Name - Degree - Major - Period'" },
                    "validationNote": { type: Type.STRING, description: "'Hợp lệ' or 'Không hợp lệ – cần HR kiểm tra lại'" },
                    "warnings": { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of validation warnings or issues found" }
                },
                required: ["standardizedEducation", "validationNote"]
            },
        },
        required: ["Tổng điểm", "Hạng", "Chi tiết", "Điểm mạnh CV", "Điểm yếu CV"]
      }
    },
    required: ["candidateName", "fileName", "analysis"]
  }
};

const buildCompactCriteria = (weights: WeightCriteria): string => {
    return Object.values(weights).map((c: MainCriterion) => {
        const totalWeight = c.children?.reduce((sum, child) => sum + child.weight, 0) || c.weight || 0;
        return `${c.name}: ${totalWeight}%`;
    }).join('\n');
};

const createAnalysisPrompt = (
    jdText: string,
    weights: WeightCriteria,
    hardFilters: HardFilters
): string => {
    const compactJD = jdText.replace(/\s+/g, ' ').trim().slice(0, 5000);
    const compactWeights = buildCompactCriteria(weights);

    return `
      ADVANCED CV ANALYSIS SYSTEM. Role: AI Recruiter với khả năng phân tích sâu và chính xác cao. Language: VIETNAMESE ONLY. Output: STRICT JSON ARRAY.

      **NHIỆM VỤ:** Phân tích CV với độ chính xác cao, tập trung vào sự phù hợp thực tế với JD và đánh giá toàn diện ứng viên.

      **JOB DESCRIPTION (YÊU CẦU CÔNG VIỆC):**
      ${compactJD}

      **TIÊU CHÍ ĐÁNH GIÁ & TRỌNG SỐ:**
      Phân tích 9 tiêu chí với trọng số:
      ${compactWeights}

      **BỘ LỌC CỨNG:**
      Địa điểm: ${hardFilters.location || 'Linh hoạt'} (Bắt buộc: ${hardFilters.locationMandatory ? 'Có' : 'Không'})
      Kinh nghiệm tối thiểu: ${hardFilters.minExp || 'Không yêu cầu'} năm (Bắt buộc: ${hardFilters.minExpMandatory ? 'Có' : 'Không'})
      Cấp độ: ${hardFilters.seniority || 'Linh hoạt'} (Bắt buộc: ${hardFilters.seniorityMandatory ? 'Có' : 'Không'})
      Thông tin liên hệ: (Bắt buộc: ${hardFilters.contactMandatory ? 'Có' : 'Không'})

      **PHƯƠNG PHÁP ĐÁNH GIÁ TIÊN TIẾN:**

      **1. PHÂN TÍCH CHI TIẾT TỪNG TIÊU CHÍ:**
      - Đánh giá trực tiếp trên thang điểm trọng số của từng tiêu chí
      - Nếu tiêu chí có trọng số W%, chấm từ 0 đến W (không phải 0-100)
      - VD: "Phù hợp JD" 15% → chấm X/15 với X từ 0-15
      - VD: "Kinh nghiệm" 20% → chấm Y/20 với Y từ 0-20
      - Dựa trên mức độ phù hợp thực tế giữa CV và yêu cầu JD
      - Áp dụng CONTEXTUAL MATCHING: So sánh ngữ cảnh, không chỉ từ khóa

      **2. CÔNG THỨC ĐIỂM SỐ:**
      - Điểm tiêu chí = Điểm phụ (đã được weighted)
      - Format: "subscore X/weight_Y% = X points"
      - Tổng điểm cơ sở: 100 điểm

      **3. HỆ THỐNG PHẠT/THƯỞNG THÔNG MINH:**
      
      **Phạt Bộ Lọc Cứng:**
      - Vi phạm bộ lọc bắt buộc thông thường: -5 điểm/lần
      - Vi phạm 3 bộ lọc đặc biệt (Địa điểm, Kinh nghiệm, Cấp độ): -10 điểm/lần
      
      **Thưởng Ưu Tiên:**
      - Kinh nghiệm vượt mức: +1 điểm/năm thừa (tối đa +5)
      - Khớp kỹ năng cốt lõi: +1 điểm/kỹ năng khớp (tối đa +5)
      - Chứng chỉ liên quan: +2 điểm/chứng chỉ quan trọng (tối đa +4)
      - Dự án phù hợp: +1 điểm/dự án relevance cao (tối đa +3)
      
      **Thưởng Chất Lượng:**
      - CV được cấu trúc tốt, rõ ràng: +2 điểm
      - Thông tin chi tiết, đầy đủ: +2 điểm
      - Portfolio/Github chất lượng: +3 điểm

      **HỆ THỐNG XỬ LÝ HỌC VẤN TIÊN TIẾN:**

      **1. Trích Xuất Dữ Liệu Học Vấn:**
      - Thu thập đầy đủ: tên trường, bậc học, chuyên ngành, thời gian học
      - Chuẩn hóa format: "Tên trường - Bậc học - Ngành học - Thời gian"
      - Phát hiện học vấn đa bậc và xếp hạng theo độ phù hợp

      **2. Validation Trường Học Thông Minh:**
      - Kiểm tra tính hợp lệ và uy tín của trường
      - Cảnh báo các trường hợp bất thường:
        * Nền tảng tuyển dụng: TopCV, VietnamWorks, JobStreet, etc.
        * Tên công ty: FPT Software, Viettel, VNPT, Samsung, etc.
        * Website: facebook.com, google.com, linkedin.com, etc.
        * Dữ liệu không hợp lệ: "Không có", "N/A", text ngẫu nhiên
      - Phân loại trường: Đại học công lập, tư thục, quốc tế, học viện chuyên ngành

      **3. Phát Hiện Mâu Thuẫn Nâng Cao:**
      - Bậc học không khớp tên trường (VD: "Đại học" nhưng trường THPT)
      - Thời gian học không hợp lý (VD: học 50 năm, thời gian âm)
      - Chuyên ngành không khớp bậc học
      - Tuổi không phù hợp với trình độ học vấn
      - Chồng chéo thời gian học nhiều nơi

      **4. Tính Điểm Theo Chất Lượng:**
      - Học vấn hợp lệ + phù hợp JD: Điểm đầy đủ
      - Học vấn khả nghi: -30% điểm
      - Học vấn có mâu thuẫn rõ ràng: -60% điểm
      - Không có thông tin học vấn: -20% điểm
      - Trường danh tiếng + chuyên ngành phù hợp: +20% bonus

      **5. Định Dạng Kết Quả:**
      - Format chuẩn: "Đại học Bách khoa Hà Nội - Cử nhân - CNTT - 2015-2019"
      - Đánh giá: "Hợp lệ", "Khả nghi - cần kiểm tra", "Không hợp lệ"
      - KHÔNG tự động sửa, chỉ gắn cờ để HR review

      **HƯỚNG DẪN ĐÁNH GIÁ NÂNG CAO:**

      **A. CONTEXTUAL MATCHING (So khớp ngữ cảnh):**
      - Không chỉ tìm từ khóa mà hiểu ngữ cảnh sử dụng
      - VD: "JavaScript" trong dự án web > "JavaScript" chỉ liệt kê
      - Đánh giá mức độ thành thạo qua mô tả chi tiết và thời gian sử dụng

      **B. EXPERIENCE DEPTH ANALYSIS:**
      - 0-1 năm: Fresher/Entry level
      - 1-3 năm: Junior với foundation skills
      - 3-5 năm: Mid-level với specialized skills
      - 5+ năm: Senior với leadership/architecture skills
      - Kiểm tra consistency giữa số năm kinh nghiệm và mức độ công việc

      **C. SKILL VERIFICATION:**
      - Kỹ năng có được back up bằng dự án/kinh nghiệm cụ thể: Điểm cao
      - Kỹ năng chỉ liệt kê không có context: Điểm thấp
      - Kỹ năng outdated so với JD requirements: Trừ điểm
      - Kỹ năng trending/in-demand: Cộng điểm

      **D. PROJECT QUALITY ASSESSMENT:**
      - Dự án có mô tả chi tiết, kết quả cụ thể: Điểm cao
      - Dự án liên quan trực tiếp đến JD: Bonus points
      - Portfolio/Github links hoạt động: Cộng điểm
      - Dự án đa dạng về technology stack: Cộng điểm

      **QUY TẮC ĐẦU RA (CRITICAL):**
      1. Tạo JSON object cho mỗi CV theo đúng schema
      2. Tính điểm chi tiết cho 9 tiêu chí theo thang trọng số
      3. **"Tổng điểm"** = Điểm cơ sở + Tổng điểm tiêu chí + Bonus - Penalty (0-100)
      4. **"Hạng" dựa trên "Tổng điểm" cuối:**
         - A: 75-100 điểm (Xuất sắc - Highly recommended)
         - B: 50-74 điểm (Tốt - Good fit với training)
         - C: 0-49 điểm (Chưa phù hợp - Needs significant development)
      5. **"Chi tiết"** chứa breakdown từng tiêu chí với evidence
      6. **BỘ LỌC BẮT BUỘC:** Vi phạm → penalty và có thể hạ xuống C
      7. **CV không đọc được:** Tạo FAILED entry với lý do cụ thể
      8. **QUAN TRỌNG:** Điểm số phải realistic và có evidence support!
    `;
};

const getFileContentPart = async (file: File, onProgress?: (message: string) => void): Promise<{text: string} | null> => {
    try {
        // Enhanced progress reporting
        const progressCallback = (message: string) => {
            if (onProgress) {
                onProgress(`${file.name}: ${message}`);
            }
        };

        const textContent = await processFileToText(file, progressCallback);
        
        // Smart content optimization for AI processing
        const optimizedContent = optimizeContentForAI(textContent, file.name);
        
        return { text: `--- CV: ${file.name} ---\n${optimizedContent}` };
    } catch(e) {
        console.error(`Could not process file ${file.name} for Gemini`, e);
        return null;
    }
};

/**
 * Enhance and validate candidate data from AI response
 */
const enhanceAndValidateCandidate = (candidate: any): any => {
  // Ensure required fields exist
  const enhanced = {
    ...candidate,
    candidateName: candidate.candidateName || 'Không xác định',
    phone: candidate.phone || '',
    email: candidate.email || '',
    fileName: candidate.fileName || 'Unknown',
    jobTitle: candidate.jobTitle || '',
    industry: candidate.industry || '',
    department: candidate.department || '',
    experienceLevel: candidate.experienceLevel || '',
    detectedLocation: candidate.detectedLocation || '',
  };

  // Validate and normalize analysis scores
  if (enhanced.analysis) {
    // Ensure total score is within valid range
    if (typeof enhanced.analysis['Tổng điểm'] === 'number') {
      enhanced.analysis['Tổng điểm'] = Math.max(0, Math.min(100, enhanced.analysis['Tổng điểm']));
    } else {
      enhanced.analysis['Tổng điểm'] = 0;
    }

    // Validate grade
    const validGrades = ['A', 'B', 'C'];
    if (!validGrades.includes(enhanced.analysis['Hạng'])) {
      const score = enhanced.analysis['Tổng điểm'];
      enhanced.analysis['Hạng'] = score >= 75 ? 'A' : score >= 50 ? 'B' : 'C';
    }

    // Ensure detailed scores exist
    if (!Array.isArray(enhanced.analysis['Chi tiết'])) {
      enhanced.analysis['Chi tiết'] = [];
    }

    // Ensure strengths and weaknesses exist
    if (!Array.isArray(enhanced.analysis['Điểm mạnh CV'])) {
      enhanced.analysis['Điểm mạnh CV'] = [];
    }
    if (!Array.isArray(enhanced.analysis['Điểm yếu CV'])) {
      enhanced.analysis['Điểm yếu CV'] = [];
    }
  }

  return enhanced;
};

/**
 * Attempt to recover partial JSON results from malformed AI response
 */
const attemptPartialJsonRecovery = (text: string): any[] | null => {
  try {
    // Try to find JSON array bounds
    const startIndex = text.indexOf('[');
    const lastIndex = text.lastIndexOf(']');
    
    if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
      const jsonPart = text.substring(startIndex, lastIndex + 1);
      
      // Try to parse the extracted part
      try {
        return JSON.parse(jsonPart);
      } catch {
        // Try to fix common JSON issues
        let fixed = jsonPart
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']')
          .replace(/}\s*{/g, '},{') // Add missing commas between objects
          .replace(/]\s*\[/g, '],[');
        
        return JSON.parse(fixed);
      }
    }
    
    return null;
  } catch (error) {
    console.warn('JSON recovery failed:', error);
    return null;
  }
};

/**
 * Optimize CV content for AI analysis - keep most important information
 */
const optimizeContentForAI = (text: string, fileName: string): string => {
    const MAX_CHARS = 10000; // Increased limit for better analysis
    
    if (text.length <= MAX_CHARS) {
        return text;
    }
    
    // Priority sections for CV analysis
    const prioritySections = [
        /(?:thông tin cá nhân|personal info|contact)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
        /(?:mục tiêu|objective|career objective)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
        /(?:kinh nghiệm|experience|work history|employment)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
        /(?:kỹ năng|skills|technical skills|competencies)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
        /(?:học vấn|education|qualifications)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
        /(?:dự án|projects|portfolio)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
        /(?:chứng chỉ|certificates|certifications)[\s\S]*?(?=\n[A-Z]|\n\s*\n|$)/gi,
    ];
    
    let priorityContent = '';
    let remainingChars = MAX_CHARS;
    
    // Extract priority sections first
    for (const pattern of prioritySections) {
        const matches = text.match(pattern);
        if (matches && remainingChars > 0) {
            for (const match of matches) {
                if (remainingChars > match.length) {
                    priorityContent += match + '\n\n';
                    remainingChars -= match.length;
                } else {
                    priorityContent += match.substring(0, remainingChars) + '...';
                    remainingChars = 0;
                    break;
                }
            }
        }
        if (remainingChars <= 0) break;
    }
    
    // If we still have space, add remaining content
    if (remainingChars > 200 && priorityContent.length < text.length) {
        const remainingText = text.replace(new RegExp(prioritySections.map(p => p.source).join('|'), 'gi'), '');
        if (remainingText.length > remainingChars) {
            priorityContent += '\n\n--- Additional Info ---\n' + remainingText.substring(0, remainingChars - 50) + '...';
        } else {
            priorityContent += '\n\n--- Additional Info ---\n' + remainingText;
        }
    }
    
    return priorityContent || text.substring(0, MAX_CHARS) + '...';
};


export async function* analyzeCVs(
  jdText: string,
  weights: WeightCriteria,
  hardFilters: HardFilters,
  cvFiles: File[]
): AsyncGenerator<Candidate | { status: 'progress'; message: string }> {

  // Generate analysis parameter hashes for caching
  const { jdHash, weightsHash, filtersHash } = analysisCacheService.generateAnalysisHashes(
    jdText, weights, hardFilters
  );

  // Check cache for existing results
  const { cached, uncached } = await analysisCacheService.batchCheckCache(
    cvFiles, jdHash, weightsHash, filtersHash
  );

  // Yield cached results first
  if (cached.length > 0) {
    yield { status: 'progress', message: `Tìm thấy ${cached.length} kết quả đã cache, đang load...` };
    
    for (const { file, result } of cached) {
      yield { status: 'progress', message: `Đã load từ cache: ${file.name}` };
      yield result;
    }
  }

  // Process uncached files
  if (uncached.length === 0) {
    yield { status: 'progress', message: 'Tất cả CV đã có trong cache. Hoàn thành!' };
    return;
  }

  const mainPrompt = createAnalysisPrompt(jdText, weights, hardFilters);
  const contents: any[] = [{ text: mainPrompt }];
  
  // Enhanced progress tracking
  let processedCount = 0;
  const totalFiles = uncached.length;
  const BATCH_SIZE = 3; // Process files in small batches for better performance

  yield { status: 'progress', message: `Cần phân tích ${totalFiles} CV mới. Bắt đầu xử lý...` };

  // Process uncached files in batches to avoid overwhelming the system
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, Math.min(i + BATCH_SIZE, uncached.length));
    
    yield { 
      status: 'progress', 
      message: `Đang xử lý batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(cvFiles.length/BATCH_SIZE)} (${batch.length} files)` 
    };
    
    // Process batch in parallel for faster processing
    const batchPromises = batch.map(async (file) => {
      const progressCallback = (msg: string) => {
        // Progress callback for individual files
      };
      
      try {
        const contentPart = await getFileContentPart(file, progressCallback);
        return { file, contentPart, error: null };
      } catch (error) {
        return { file, contentPart: null, error };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      processedCount++;
      
      if (result.status === 'fulfilled') {
        const { file, contentPart, error } = result.value;
        
        yield { 
          status: 'progress', 
          message: `Đã xử lý ${processedCount}/${totalFiles}: ${file.name}` 
        };
        
        if (contentPart) {
          contents.push(contentPart);
        } else {
          yield {
            id: `${file.name}-error-${Date.now()}`,
            status: 'FAILED' as 'FAILED',
            error: error ? `Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}` : 'Không thể đọc tệp',
            candidateName: 'Lỗi Xử Lý Tệp',
            fileName: file.name,
            jobTitle: '',
            industry: '',
            department: '',
            experienceLevel: '',
            detectedLocation: '',
            phone: '',
            email: ''
          };
        }
      } else {
        // Handle rejected promise
        const fileName = batch[batchResults.indexOf(result)]?.name || 'Unknown file';
        yield {
          id: `${fileName}-error-${Date.now()}`,
          status: 'FAILED' as 'FAILED',
          error: `Lỗi xử lý file: ${result.reason}`,
          candidateName: 'Lỗi Xử Lý Tệp',
          fileName: fileName,
          jobTitle: '',
          industry: '',
          department: '',
          experienceLevel: '',
          detectedLocation: '',
          phone: '',
          email: ''
        };
      }
    }
    
    // Small delay between batches to prevent overwhelming
    if (i + BATCH_SIZE < uncached.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  yield { status: 'progress', message: `Hoàn tất xử lý ${totalFiles} files. Đang gửi đến AI để phân tích toàn diện...` };
  
  try {
    // Enhanced AI configuration for more reliable results
    const aiConfig = {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      temperature: 0.1, // Slight randomness for more natural analysis
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 0 },
    };

    yield { status: 'progress', message: 'Gửi yêu cầu phân tích đến AI với cấu hình tối ưu...' };
    
    const response = await generateContentWithFallback(MODEL_NAME, { parts: contents }, aiConfig);
    
    yield { status: 'progress', message: 'AI đã phản hồi. Đang xử lý và validate kết quả...' };

    const resultText = response.text.trim();
    let candidates: Omit<Candidate, 'id' | 'status'>[] = [];
    
    try {
        candidates = JSON.parse(resultText);
        
        // Validate and enhance results
        candidates = candidates.map(candidate => enhanceAndValidateCandidate(candidate));
        
        yield { status: 'progress', message: `Đã validate ${candidates.length} kết quả phân tích từ AI` };
        
    } catch (e) {
        console.error("Lỗi phân tích JSON từ AI:", e);
        console.error("Dữ liệu thô từ AI (1000 ký tự đầu):", resultText.substring(0, 1000));
        
        // Try to recover partial results
        try {
          const partialResults = attemptPartialJsonRecovery(resultText);
          if (partialResults && partialResults.length > 0) {
            candidates = partialResults;
            yield { status: 'progress', message: `Khôi phục được ${candidates.length} kết quả từ phản hồi AI` };
          } else {
            throw new Error("Không thể khôi phục dữ liệu từ AI");
          }
        } catch (recoveryError) {
          throw new Error("AI trả về dữ liệu không hợp lệ và không thể khôi phục. Vui lòng thử lại.");
        }
    }
    
  // Stable hash function for deterministic IDs
  const stableHash = (input: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };

  const finalCandidates = candidates.map(c => {
    const basis = `${c.fileName || ''}|${c.candidateName || ''}|${c.jobTitle || ''}|${c.experienceLevel || ''}`;
    return {
      ...c,
      id: `cand_${stableHash(basis)}`,
      status: 'SUCCESS' as 'SUCCESS',
    };
  });

  // Stable ordering: sort by provided total score desc then filename asc
  finalCandidates.sort((a,b) => {
    const sa = typeof a.analysis?.['Tổng điểm'] === 'number' ? a.analysis['Tổng điểm'] : -1;
    const sb = typeof b.analysis?.['Tổng điểm'] === 'number' ? b.analysis['Tổng điểm'] : -1;
    if (sb !== sa) return sb - sa;
    return (a.fileName||'').localeCompare(b.fileName||'');
  });


    // Cache new results and yield them
    for (let i = 0; i < finalCandidates.length; i++) {
      const candidate = finalCandidates[i];
      
      // Find corresponding file for caching
      const correspondingFile = uncached[i];
      if (correspondingFile) {
        await analysisCacheService.cacheAnalysis(
          correspondingFile,
          candidate,
          jdHash,
          weightsHash,
          filtersHash
        );
      }
      
      yield candidate;
    }

    // Final progress message
    const cacheStats = analysisCacheService.getCacheStats();
    yield { 
      status: 'progress', 
      message: `✅ Hoàn tất! Cache hiện có ${cacheStats.size} entries để tăng tốc lần sau.` 
    };

  } catch (error) {
     console.error("Lỗi phân tích từ AI:", error);
     const friendlyMessage = "AI không thể hoàn tất phân tích. Vui lòng thử lại sau. (Lỗi giao tiếp với máy chủ AI)";
     throw new Error(friendlyMessage);
  }
}

// --- New Chatbot Service ---

const chatbotResponseSchema = {
  type: Type.OBJECT,
  properties: {
    "responseText": { type: Type.STRING, description: "The natural language response to the user's query." },
    "candidateIds": {
      type: Type.ARRAY,
      description: "An array of candidate IDs that are relevant to the response, if any.",
      items: { type: Type.STRING }
    },
  },
  required: ["responseText", "candidateIds"]
};

export const getChatbotAdvice = async (
  analysisData: AnalysisRunData,
  userInput: string
): Promise<{ responseText: string; candidateIds: string[] }> => {
  const successfulCandidates = analysisData.candidates.filter(c => c.status === 'SUCCESS');
  
  // Sanitize candidate data to remove PII and reduce token count
  const sanitizedCandidates = successfulCandidates.map(c => ({
    id: c.id,
    name: c.candidateName,
    rank: c.analysis?.['Hạng'],
    totalScore: c.analysis?.['Tổng điểm'],
    jdFitPercent: c.analysis?.['Chi tiết']?.find(item => item['Tiêu chí'].startsWith('Phù hợp JD')) 
                  ? parseInt(c.analysis['Chi tiết'].find(item => item['Tiêu chí'].startsWith('Phù hợp JD'))!['Điểm'].split('/')[0], 10) 
                  : 0,
    title: c.jobTitle,
    level: c.experienceLevel
  }));

  const summary = {
      total: successfulCandidates.length,
      countA: successfulCandidates.filter(c => c.analysis?.['Hạng'] === 'A').length,
      countB: successfulCandidates.filter(c => c.analysis?.['Hạng'] === 'B').length,
      countC: successfulCandidates.filter(c => c.analysis?.['Hạng'] === 'C').length,
  };

  const prompt = `
    You are a helpful AI recruitment assistant. Your goal is to help the user analyze and select the best candidates based on the provided data.
    Your language MUST BE Vietnamese.

    **CONTEXT DATA:**
    - Job Position: ${analysisData.job.position}
    - Location: ${analysisData.job.locationRequirement}
    - Summary: ${JSON.stringify(summary)}
    - Candidate List (sanitized): ${JSON.stringify(sanitizedCandidates.slice(0, 20))}
    
    **USER QUERY:** "${userInput}"

    **YOUR TASKS:**
    1.  Analyze the user's query and the context data.
    2.  Provide a concise, helpful, and natural response in Vietnamese.
    3.  If the query asks you to suggest, filter, or identify candidates, you MUST include their unique 'id' values in the 'candidateIds' array in your JSON output.
    4.  If no specific candidates are relevant, return an empty 'candidateIds' array.
    5.  Common queries to handle:
        - "suggest", "gợi ý": Find the top candidates based on criteria like rank, score, or jdFit.
        - "compare", "so sánh": Provide a brief comparison of specified candidates.
        - "interview questions", "câu hỏi phỏng vấn": Generate 5-8 specific interview questions based on JD requirements, candidate weaknesses, and industry best practices. Questions should be practical, specific to the role, and help differentiate between candidates.
        - "phân biệt", "differentiate": Create questions that help distinguish between similar candidates.
        - "kỹ năng", "skills": Generate technical and soft skill assessment questions.
        - "lương", "salary", "mức lương": Provide market salary information for the job position and location. Mention that detailed salary analysis is available via the Salary Analysis feature, which uses real-time data from job-salary-data API (RapidAPI) to compare with Vietnam market. Include general salary ranges based on experience level and suggest using the dedicated salary analysis tool for specific candidates.

    **SALARY GUIDANCE:**
    When asked about salary ("lương", "mức lương", "salary"):
    - Provide general market salary range estimates for ${analysisData.job.position} in ${analysisData.job.locationRequirement || 'Vietnam'}
    - Mention experience levels affect salary (Junior: 8-15tr, Mid: 15-30tr, Senior: 30-60tr, Lead: 60-100tr VND/month)
    - Recommend using the dedicated "Salary Analysis" feature for accurate, real-time market data from job-salary-data API
    - Suggest candidates can be evaluated individually with the salary analysis tool

    **OUTPUT FORMAT:**
    You must respond with a single, valid JSON object that matches this schema:
    {
      "responseText": "Your Vietnamese language answer here.",
      "candidateIds": ["id-of-candidate-1", "id-of-candidate-2", ...]
    }
  `;

  try {
    const aiInstance = getAi();
    const response = await generateContentWithFallback(MODEL_NAME, prompt, {
      responseMimeType: "application/json",
      responseSchema: chatbotResponseSchema,
      temperature: 0, // deterministic responses (can adjust later if creative variance desired)
      topP: 0,
      topK: 1,
    });

    return JSON.parse(response.text);

  } catch (error) {
    console.error("Error getting chatbot advice from AI:", error);
    throw new Error("AI chatbot is currently unavailable.");
  }
};

// Single-Tab Action Logic cho Gemini
// Đảm bảo chỉ 1 tab thực thi hành động tại 1 thời điểm

const LOCK_NAME = "gemini-action-lock";
const CHANNEL_NAME = "gemini_action_channel";
const LOCK_TTL = 10000; // 10s
const HEARTBEAT_INTERVAL = 2000; // 2s
const LOCK_KEY = "gemini_action_lock";

let tabId = generateTabId();
let heartbeatTimer: number | null = null;
let isLocked = false;
let broadcastChannel: BroadcastChannel | null = null;

function generateTabId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function supportsWebLocks(): boolean {
  return 'locks' in navigator;
}

function createBroadcastChannel(): BroadcastChannel | null {
  if ('BroadcastChannel' in window) {
    return new BroadcastChannel(CHANNEL_NAME);
  }
  return null;
}

function broadcastStatus(busy: boolean) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "status", payload: { busy } });
  }
}

function updateUI(busy: boolean, isSelf: boolean = false) {
  const btn = document.querySelector('#btn') as HTMLButtonElement;
  const status = document.querySelector('#status') as HTMLElement;
  if (btn) {
    btn.disabled = busy;
  }
  if (status) {
    if (busy) {
      status.textContent = isSelf ? "Đang xử lý tại tab này…" : "Đang xử lý ở tab khác…";
    } else {
      status.textContent = "Sẵn sàng";
    }
  }
}

async function performAction(): Promise<void> {
  // Stub: Gọi backend proxy đến Gemini
  // Không lộ API key, gọi qua endpoint backend
  try {
    const response = await fetch('/api/proxy-to-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* data */ })
    });
    if (!response.ok) throw new Error('API failed');
    // Xử lý kết quả
  } catch (error) {
    console.error('performAction error:', error);
    throw error;
  }
}

async function runExclusive(fn: () => Promise<void>): Promise<void> {
  if (supportsWebLocks()) {
    return navigator.locks.request(LOCK_NAME, { mode: "exclusive" }, async (lock) => {
      if (lock) {
        broadcastStatus(true);
        updateUI(true, true);
        try {
          await fn();
        } finally {
          broadcastStatus(false);
          updateUI(false);
        }
      } else {
        updateUI(true, false);
      }
    });
  } else {
    return fallbackRunExclusive(fn);
  }
}

async function fallbackRunExclusive(fn: () => Promise<void>): Promise<void> {
  if (tryAcquireLock()) {
    broadcastStatus(true);
    updateUI(true, true);
    startHeartbeat();
    try {
      await fn();
    } finally {
      stopHeartbeat();
      releaseLock();
      broadcastStatus(false);
      updateUI(false);
    }
  } else {
    updateUI(true, false);
  }
}

function tryAcquireLock(): boolean {
  const now = Date.now();
  const lockData = localStorage.getItem(LOCK_KEY);
  if (lockData) {
    const lock = JSON.parse(lockData);
    if (lock.owner !== tabId && lock.expiresAt > now) {
      return false; // Lock đang sống và không phải của tab này
    }
  }
  // Chiếm lock
  localStorage.setItem(LOCK_KEY, JSON.stringify({ owner: tabId, expiresAt: now + LOCK_TTL }));
  isLocked = true;
  return true;
}

function renewLock() {
  const now = Date.now();
  const lockData = localStorage.getItem(LOCK_KEY);
  if (lockData) {
    const lock = JSON.parse(lockData);
    if (lock.owner === tabId) {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ owner: tabId, expiresAt: now + LOCK_TTL }));
    }
  }
}

function releaseLock() {
  const lockData = localStorage.getItem(LOCK_KEY);
  if (lockData) {
    const lock = JSON.parse(lockData);
    if (lock.owner === tabId) {
      localStorage.removeItem(LOCK_KEY);
    }
  }
  isLocked = false;
}

function startHeartbeat() {
  heartbeatTimer = window.setInterval(renewLock, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function bindUI() {
  broadcastChannel = createBroadcastChannel();
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === "status") {
        updateUI(payload.busy, false);
      }
    };
  }

  // Lắng nghe storage event cho fallback nếu không có BroadcastChannel
  if (!broadcastChannel) {
    window.addEventListener('storage', (event) => {
      if (event.key === LOCK_KEY) {
        const lockData = event.newValue;
        if (lockData) {
          const lock = JSON.parse(lockData);
          const busy = lock.owner !== tabId && lock.expiresAt > Date.now();
          updateUI(busy, false);
        } else {
          updateUI(false, false);
        }
      }
    });
  }

  // Giải phóng lock khi tab unload
  window.addEventListener('beforeunload', () => {
    if (isLocked) {
      releaseLock();
      broadcastStatus(false);
    }
  });

  // Khởi tạo UI
  updateUI(false);
}

/**
 * Helper function to convert language certificates to CEFR levels
 */
const convertLanguageLevelToCEFR = (text: string): string | null => {
  const upperText = text.toUpperCase();
  
  // IELTS conversion
  if (upperText.includes('IELTS')) {
    const match = upperText.match(/IELTS\s*(\d+\.?\d*)/);
    if (match) {
      const score = parseFloat(match[1]);
      if (score >= 8.0) return 'C2';
      if (score >= 7.0) return 'C1';
      if (score >= 5.5) return 'B2';
      if (score >= 4.0) return 'B1';
    }
  }
  
  // TOEIC conversion
  if (upperText.includes('TOEIC')) {
    const match = upperText.match(/TOEIC\s*(\d+)/);
    if (match) {
      const score = parseInt(match[1]);
      if (score >= 945) return 'C2';
      if (score >= 785) return 'C1';
      if (score >= 550) return 'B2';
      if (score >= 225) return 'B1';
    }
  }
  
  // TOEFL iBT conversion
  if (upperText.includes('TOEFL')) {
    const match = upperText.match(/TOEFL\s*(\d+)/);
    if (match) {
      const score = parseInt(match[1]);
      if (score >= 110) return 'C2';
      if (score >= 87) return 'C1';
      if (score >= 57) return 'B2';
      if (score >= 42) return 'B1';
    }
  }
  
  // Cambridge exams
  if (upperText.includes('CPE') || upperText.includes('PROFICIENCY')) return 'C2';
  if (upperText.includes('CAE') || upperText.includes('ADVANCED')) return 'C1';
  if (upperText.includes('FCE') || upperText.includes('FIRST')) return 'B2';
  if (upperText.includes('PET') || upperText.includes('PRELIMINARY')) return 'B1';
  
  // Vietnamese descriptions
  if (upperText.includes('THÀNH THẠO') || upperText.includes('XUẤT SẮC')) return 'C1';
  if (upperText.includes('GIAO TIẾP TỐT') || upperText.includes('KHÁ')) return 'B2';
  if (upperText.includes('CƠ BẢN') || upperText.includes('TRUNG BÌNH')) return 'B1';
  
  return null;
};

/**
 * Extract hard filters from JD text using AI.
 * @param jdText The job description text
 * @returns Promise<Partial<HardFilters>> containing extracted filter values
 */
export const extractHardFiltersFromJD = async (jdText: string): Promise<Partial<any>> => {
  if (!jdText || jdText.trim().length < 50) {
    return {};
  }

  const hardFiltersSchema = {
    type: Type.OBJECT,
    properties: {
      "location": { 
        type: Type.STRING, 
        description: "Địa điểm làm việc từ danh sách: Hà Nội, Hải Phòng, Đà Nẵng, Thành phố Hồ Chí Minh, Remote. Trả về chuỗi rỗng nếu không tìm thấy hoặc không khớp." 
      },
      "minExp": { 
        type: Type.STRING, 
        description: "Kinh nghiệm tối thiểu từ danh sách: '1', '2', '3', '5' (số năm). Trả về chuỗi rỗng nếu không yêu cầu." 
      },
      "seniority": { 
        type: Type.STRING, 
        description: "Cấp bậc từ danh sách: Intern, Junior, Mid-level, Senior, Lead. Trả về chuỗi rỗng nếu không xác định được." 
      },
      "education": { 
        type: Type.STRING, 
        description: "Bằng cấp từ danh sách: High School (Tốt nghiệp THPT), Associate (Cao đẳng), Bachelor (Cử nhân), Master (Thạc sĩ), PhD (Tiến sĩ). Trả về chuỗi rỗng nếu không yêu cầu." 
      },
      "language": { 
        type: Type.STRING, 
        description: "Ngôn ngữ yêu cầu (ví dụ: Tiếng Anh, Tiếng Nhật). Trả về chuỗi rỗng nếu không yêu cầu." 
      },
      "languageLevel": { 
        type: Type.STRING, 
        description: "Trình độ ngôn ngữ từ danh sách: B1, B2, C1, C2. Trả về chuỗi rỗng nếu không xác định." 
      },
      "certificates": { 
        type: Type.STRING, 
        description: "Chứng chỉ yêu cầu (ví dụ: PMP, IELTS 7.0). Trả về chuỗi rỗng nếu không yêu cầu." 
      },
      "workFormat": { 
        type: Type.STRING, 
        description: "Hình thức làm việc từ danh sách: Onsite, Hybrid, Remote. Trả về chuỗi rỗng nếu không xác định." 
      },
      "contractType": { 
        type: Type.STRING, 
        description: "Loại hợp đồng từ danh sách: Full-time, Part-time, Intern, Contract. Trả về chuỗi rỗng nếu không xác định." 
      }
    },
    required: []
  };

  const prompt = `Bạn là chuyên gia phân tích JD thông minh. Nhiệm vụ: Trích xuất và CHUYỂN ĐỔI thông tin tiêu chí lọc từ văn bản JD.

HƯỚNG DẪN TRÍCH XUẤT THÔNG MINH:

1. **Địa điểm (location)**: Tìm thông tin địa điểm làm việc
   - Chỉ chọn từ: Hà Nội, Hải Phòng, Đà Nẵng, Thành phố Hồ Chí Minh, Remote
   - Ví dụ: "Làm việc tại HN" → "Hà Nội", "HCM" → "Thành phố Hồ Chí Minh", "WFH" → "Remote"

2. **Kinh nghiệm (minExp)**: Tìm yêu cầu kinh nghiệm tối thiểu
   - Chỉ chọn từ: "1", "2", "3", "5" (số năm)
   - Ví dụ: "3-5 năm" → "3", "Trên 2 năm" → "2", "Fresher" → "1"
   - Nếu có range, lấy số nhỏ nhất

3. **Cấp bậc (seniority)**: Xác định level từ yêu cầu
   - Chỉ chọn từ: Intern, Junior, Mid-level, Senior, Lead
   - Ví dụ: "Fresher" → "Junior", "Middle" → "Mid-level", "Trưởng nhóm" → "Lead"

4. **Học vấn (education)**: Yêu cầu về bằng cấp
   - Chỉ chọn từ: High School, Associate, Bachelor, Master, PhD
   - Ví dụ: "Đại học" → "Bachelor", "Kỹ sư" → "Bachelor", "Cao đẳng" → "Associate", "THPT" → "High School"

5. **Ngôn ngữ (language)**: Ngôn ngữ yêu cầu
   - Ví dụ: "English" → "Tiếng Anh", "Japanese" → "Tiếng Nhật"
   - Nếu có nhiều ngôn ngữ, ưu tiên ngôn ngữ chính

6. **Trình độ ngôn ngữ (languageLevel)**: Mức độ yêu cầu - QUAN TRỌNG!
   - Chỉ chọn từ: B1, B2, C1, C2
   - LOGIC CHUYỂN ĐỔI THÔNG MINH:
     * IELTS 6.0-6.5 → "B2"
     * IELTS 7.0-7.5 → "C1"
     * IELTS 8.0+ → "C2"
     * TOEIC 550-750 → "B1"
     * TOEIC 750-900 → "B2"
     * TOEIC 900+ → "C1"
     * TOEFL 57-86 → "B2"
     * TOEFL 87-109 → "C1"
     * Cambridge FCE → "B2"
     * Cambridge CAE → "C1"
     * Cambridge CPE → "C2"
     * "Giao tiếp tốt" → "B2"
     * "Thành thạo" → "C1"
     * "Cơ bản" → "B1"

7. **Chứng chỉ (certificates)**: Chứng chỉ cần thiết
   - Ví dụ: "PMP", "AWS", "IELTS 7.0", "JLPT N3"
   - Liệt kê tất cả chứng chỉ tìm thấy, phân cách bằng dấu phẩy

8. **Hình thức làm việc (workFormat)**: Cách thức làm việc
   - Chỉ chọn từ: Onsite, Hybrid, Remote
   - Ví dụ: "Làm việc tại văn phòng" → "Onsite", "WFH" → "Remote", "Flexible" → "Hybrid"

9. **Loại hợp đồng (contractType)**: Loại hình tuyển dụng
   - Chỉ chọn từ: Full-time, Part-time, Intern, Contract
   - Ví dụ: "Toàn thời gian" → "Full-time", "Thực tập" → "Intern", "Thời vụ" → "Contract"

QUY TẮC QUAN TRỌNG:
- CHỈ trả về giá trị có trong danh sách cho phép
- ÁP DỤNG LOGIC CHUYỂN ĐỔI thông minh (VD: IELTS 6.5 → B2)
- Nếu không tìm thấy hoặc không chắc chắn → trả về chuỗi rỗng ""
- Ưu tiên thông tin rõ ràng, nhưng CÓ THỂ SUY LUẬN hợp lý

PHÂN TÍCH VĂN BẢN JD:
---
${jdText.slice(0, 3000)}
---

Trả về JSON với các trường đã trích xuất và chuyển đổi:`;

  try {
    const response = await generateContentWithFallback(MODEL_NAME, prompt, {
      temperature: 0.1,
      topP: 0.3,
      topK: 5,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: hardFiltersSchema,
      },
    });

    let result = response.text.trim();
    
    // Remove any markdown formatting
    result = result.replace(/```json\s*|\s*```/g, '');
    
    const hardFilters = JSON.parse(result);
    
    // Validate and clean the response
    const validatedFilters: any = {};
    
    // Location validation with smart mapping
    const validLocations = ['Hà Nội', 'Hải Phòng', 'Đà Nẵng', 'Thành phố Hồ Chí Minh', 'Remote'];
    const locationMap: Record<string, string> = {
      'HN': 'Hà Nội',
      'Hanoi': 'Hà Nội',
      'Ha Noi': 'Hà Nội',
      'HCM': 'Thành phố Hồ Chí Minh',
      'TP.HCM': 'Thành phố Hồ Chí Minh',
      'Sai Gon': 'Thành phố Hồ Chí Minh',
      'Saigon': 'Thành phố Hồ Chí Minh',
      'Da Nang': 'Đà Nẵng',
      'Hai Phong': 'Hải Phòng',
      'WFH': 'Remote',
      'Work from home': 'Remote'
    };
    
    if (hardFilters.location) {
      const loc = hardFilters.location.trim();
      if (validLocations.includes(loc)) {
        validatedFilters.location = loc;
      } else if (locationMap[loc]) {
        validatedFilters.location = locationMap[loc];
      }
    }
    
    // Experience validation with smart parsing
    const validExp = ['1', '2', '3', '5'];
    if (hardFilters.minExp) {
      const exp = hardFilters.minExp.toString().trim();
      if (validExp.includes(exp)) {
        validatedFilters.minExp = exp;
      } else {
        // Try to extract number from string like "3-5 years" or "trên 2 năm"
        const match = exp.match(/(\d+)/);
        if (match) {
          const num = match[1];
          // Round to nearest valid value
          if (num === '0' || num === '1') validatedFilters.minExp = '1';
          else if (num === '2') validatedFilters.minExp = '2';
          else if (num === '3' || num === '4') validatedFilters.minExp = '3';
          else if (parseInt(num) >= 5) validatedFilters.minExp = '5';
        }
      }
    }
    
    // Seniority validation with smart mapping
    const validSeniority = ['Intern', 'Junior', 'Mid-level', 'Senior', 'Lead'];
    const seniorityMap: Record<string, string> = {
      'Fresher': 'Junior',
      'Entry': 'Junior',
      'Entry-level': 'Junior',
      'Middle': 'Mid-level',
      'Mid': 'Mid-level',
      'Staff': 'Senior',
      'Principal': 'Lead',
      'Manager': 'Lead',
      'Tech Lead': 'Lead',
      'Team Lead': 'Lead'
    };
    
    if (hardFilters.seniority) {
      const sen = hardFilters.seniority.trim();
      if (validSeniority.includes(sen)) {
        validatedFilters.seniority = sen;
      } else if (seniorityMap[sen]) {
        validatedFilters.seniority = seniorityMap[sen];
      }
    }
    
    // Education validation with smart mapping
    const validEducation = ['High School', 'Associate', 'Bachelor', 'Master', 'PhD'];
    const educationMap: Record<string, string> = {
      'THPT': 'High School',
      'Tốt nghiệp THPT': 'High School',
      'Cao đẳng': 'Associate',
      'College': 'Associate',
      'Đại học': 'Bachelor',
      'Cử nhân': 'Bachelor',
      'Kỹ sư': 'Bachelor',
      'University': 'Bachelor',
      'Thạc sĩ': 'Master',
      'Tiến sĩ': 'PhD',
      'Doctorate': 'PhD'
    };
    
    if (hardFilters.education) {
      const edu = hardFilters.education.trim();
      if (validEducation.includes(edu)) {
        validatedFilters.education = edu;
      } else if (educationMap[edu]) {
        validatedFilters.education = educationMap[edu];
      }
    }
    
    // Language validation (free text but clean and normalize)
    if (hardFilters.language && typeof hardFilters.language === 'string' && hardFilters.language.trim()) {
      const lang = hardFilters.language.trim();
      // Normalize common language names
      const langMap: Record<string, string> = {
        'English': 'Tiếng Anh',
        'Vietnamese': 'Tiếng Việt',
        'Japanese': 'Tiếng Nhật',
        'Korean': 'Tiếng Hàn',
        'Chinese': 'Tiếng Trung',
        'French': 'Tiếng Pháp',
        'German': 'Tiếng Đức'
      };
      validatedFilters.language = langMap[lang] || lang;
    }
    
    // Language level validation with SMART CONVERSION
    const validLangLevels = ['B1', 'B2', 'C1', 'C2'];
    if (hardFilters.languageLevel) {
      const level = hardFilters.languageLevel.trim().toUpperCase();
      if (validLangLevels.includes(level)) {
        validatedFilters.languageLevel = level;
      }
    }
    
    // If languageLevel not set but certificates contain language scores, try to extract
    if (!validatedFilters.languageLevel && hardFilters.certificates) {
      const cefrLevel = convertLanguageLevelToCEFR(hardFilters.certificates);
      if (cefrLevel) {
        validatedFilters.languageLevel = cefrLevel;
      }
    }
    
    // If still no languageLevel, try to extract from full JD text
    if (!validatedFilters.languageLevel) {
      const cefrLevel = convertLanguageLevelToCEFR(jdText);
      if (cefrLevel) {
        validatedFilters.languageLevel = cefrLevel;
      }
    }
    
    // Certificates validation (free text but clean)
    if (hardFilters.certificates && typeof hardFilters.certificates === 'string' && hardFilters.certificates.trim()) {
      validatedFilters.certificates = hardFilters.certificates.trim();
    }
    
    // Work format validation with smart mapping
    const validWorkFormats = ['Onsite', 'Hybrid', 'Remote'];
    const workFormatMap: Record<string, string> = {
      'Office': 'Onsite',
      'Văn phòng': 'Onsite',
      'Tại văn phòng': 'Onsite',
      'WFH': 'Remote',
      'Work from home': 'Remote',
      'Làm từ xa': 'Remote',
      'Flexible': 'Hybrid',
      'Linh hoạt': 'Hybrid',
      'Kết hợp': 'Hybrid'
    };
    
    if (hardFilters.workFormat) {
      const wf = hardFilters.workFormat.trim();
      if (validWorkFormats.includes(wf)) {
        validatedFilters.workFormat = wf;
      } else if (workFormatMap[wf]) {
        validatedFilters.workFormat = workFormatMap[wf];
      }
    }
    
    // Contract type validation with smart mapping
    const validContractTypes = ['Full-time', 'Part-time', 'Intern', 'Contract'];
    const contractMap: Record<string, string> = {
      'Toàn thời gian': 'Full-time',
      'Bán thời gian': 'Part-time',
      'Thực tập': 'Intern',
      'Thời vụ': 'Contract',
      'Freelance': 'Contract',
      'Permanent': 'Full-time'
    };
    
    if (hardFilters.contractType) {
      const ct = hardFilters.contractType.trim();
      if (validContractTypes.includes(ct)) {
        validatedFilters.contractType = ct;
      } else if (contractMap[ct]) {
        validatedFilters.contractType = contractMap[ct];
      }
    }
    
    return validatedFilters;
    
  } catch (error) {
    console.error("Lỗi khi trích xuất hard filters từ JD:", error);
    return {};
  }
};

// Xuất các hàm cần thiết
export { runExclusive, bindUI, performAction };
