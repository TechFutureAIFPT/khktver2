import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: 'Facebook',
      icon: 'fa-brands fa-facebook',
      url: 'https://www.facebook.com/profile.php?id=61577736765345&locale=vi_VN',
      color: 'hover:text-blue-500'
    },
    {
      name: 'GitHub',
      icon: 'fa-brands fa-github',
      url: 'https://github.com/orgs/TechFutureAIFPT/dashboard',
      color: 'hover:text-gray-300'
    },
    {
      name: 'LinkedIn',
      icon: 'fa-brands fa-linkedin',
      url: 'https://www.linkedin.com/in/truong-minh-hoang-phuc-5ba70532b/',
      color: 'hover:text-blue-400'
    },
    {
      name: 'Discord',
      icon: 'fa-brands fa-discord',
      url: 'https://discord.gg/supporthr',
      color: 'hover:text-purple-400'
    }
  ];

  return (
    <footer className="bg-slate-900/50 border-t border-slate-700/50 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/images/logos/logo.jpg" 
                alt="SupportHR Logo" 
                className="w-10 h-10 rounded-lg object-cover border-2 border-blue-500/30"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  console.log('Logo not found, using fallback icon');
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallbackIcon = (e.target as HTMLImageElement).nextElementSibling;
                  if (fallbackIcon) {
                    (fallbackIcon as HTMLElement).classList.remove('hidden');
                  }
                }}
              />
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center hidden">
                <i className="fa-solid fa-users text-white text-sm"></i>
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                SupportHR
              </h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Nền tảng AI hỗ trợ tuyển dụng thông minh, giúp HR tối ưu hóa quy trình sàng lọc CV và tìm kiếm ứng viên phù hợp.
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-slate-200">Liên hệ</h4>
            <div className="space-y-3">
              <a 
                href="tel:0899280108" 
                className="flex items-center space-x-3 text-slate-400 hover:text-blue-400 transition-colors group"
              >
                <i className="fa-solid fa-phone w-4 text-center group-hover:scale-110 transition-transform"></i>
                <span className="text-sm">0899 280 108</span>
              </a>
              <a 
                href="mailto:support@supporthr.vn" 
                className="flex items-center space-x-3 text-slate-400 hover:text-blue-400 transition-colors group"
              >
                <i className="fa-solid fa-envelope w-4 text-center group-hover:scale-110 transition-transform"></i>
                <span className="text-sm">support@supporthr.vn</span>
              </a>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-slate-200">Kết nối</h4>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-10 h-10 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-400 ${social.color} transition-colors group hover:border-slate-600`}
                  title={social.name}
                >
                  <i className={`${social.icon} text-lg group-hover:scale-110 transition-transform`}></i>
                </a>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Theo dõi chúng tôi để cập nhật những tính năng mới nhất và xu hướng AI trong tuyển dụng.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-700/50 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-slate-400">
            © {currentYear} <span className="font-semibold text-slate-300">SupportHR</span>. Tất cả quyền được bảo lưu.
          </div>
          <div className="flex items-center space-x-6 text-xs text-slate-500">
            <span>Phiên bản 3.0</span>
            <span>•</span>
            <span>Được phát triển bởi TechFutureAI</span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <i className="fa-solid fa-heart text-red-500"></i>
              <span>Made in Vietnam</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 
