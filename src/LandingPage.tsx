import React from 'react';
import { BookOpen, Sparkles, Languages, Zap, Shield, Book, FileText, Library, BookMarked, Bookmark, GraduationCap, Newspaper, ScrollText, NotebookPen } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Soft gradient blobs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        
        {/* Animated floating books - Left Side */}
        <div className="absolute top-20 left-10 animate-float">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg shadow-2xl transform rotate-12 opacity-60 flex items-center justify-center">
            <Book className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <div className="absolute top-1/3 left-16 animate-float animation-delay-2000">
          <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-600 rounded-lg shadow-2xl transform -rotate-6 opacity-50 flex items-center justify-center">
            <BookMarked className="w-7 h-7 text-white" />
          </div>
        </div>
        
        <div className="absolute bottom-40 left-20 animate-float animation-delay-4000">
          <div className="w-18 h-18 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-lg shadow-2xl transform rotate-8 opacity-55 flex items-center justify-center">
            <NotebookPen className="w-9 h-9 text-white" />
          </div>
        </div>
        
        {/* Animated floating books - Right Side */}
        <div className="absolute top-40 right-20 animate-float animation-delay-1000">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-2xl transform -rotate-12 opacity-60 flex items-center justify-center">
            <FileText className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <div className="absolute top-1/4 right-16 animate-float animation-delay-3000">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg shadow-2xl transform rotate-15 opacity-50 flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="absolute bottom-32 right-24 animate-float animation-delay-5000">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-2xl transform -rotate-8 opacity-55 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
        </div>
        
        {/* Animated floating books - Center */}
        <div className="absolute bottom-32 left-1/4 animate-float animation-delay-2000">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg shadow-2xl transform rotate-6 opacity-60 flex items-center justify-center">
            <Library className="w-7 h-7 text-white" />
          </div>
        </div>
        
        <div className="absolute top-1/3 right-1/4 animate-float animation-delay-3000">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-pink-600 rounded-lg shadow-2xl transform -rotate-6 opacity-60 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="absolute bottom-20 right-1/3 animate-float animation-delay-4000">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg shadow-2xl transform rotate-3 opacity-60 flex items-center justify-center">
            <Languages className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <div className="absolute top-1/2 left-1/3 animate-float animation-delay-1500">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg shadow-2xl transform rotate-12 opacity-45 flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <div className="absolute top-2/3 right-1/5 animate-float animation-delay-2500">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-lg shadow-2xl transform -rotate-10 opacity-50 flex items-center justify-center">
            <ScrollText className="w-7 h-7 text-white" />
          </div>
        </div>
        
        {/* Small sparkles */}
        <div className="absolute top-1/4 left-1/3 animate-sparkle">
          <Sparkles className="w-6 h-6 text-purple-400 opacity-70" />
        </div>
        
        <div className="absolute top-2/3 right-1/3 animate-sparkle animation-delay-1500">
          <Sparkles className="w-5 h-5 text-blue-400 opacity-70" />
        </div>
        
        <div className="absolute top-1/2 left-1/4 animate-sparkle animation-delay-3000">
          <Sparkles className="w-4 h-4 text-indigo-400 opacity-70" />
        </div>
        
        <div className="absolute bottom-1/3 left-1/2 animate-sparkle animation-delay-2000">
          <Sparkles className="w-5 h-5 text-pink-400 opacity-60" />
        </div>
        
        <div className="absolute top-1/5 right-1/5 animate-sparkle animation-delay-4000">
          <Sparkles className="w-4 h-4 text-cyan-400 opacity-65" />
        </div>
        
        {/* Decorative particles */}
        <div className="absolute top-12 right-1/3 w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-1/4 right-12 w-3 h-3 bg-blue-400 rounded-full animate-pulse opacity-50 animation-delay-1000"></div>
        <div className="absolute bottom-1/4 left-12 w-2 h-2 bg-pink-400 rounded-full animate-pulse opacity-60 animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/6 w-2 h-2 bg-indigo-400 rounded-full animate-pulse opacity-55 animation-delay-3000"></div>
        <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-purple-400 rounded-full animate-pulse opacity-50 animation-delay-1500"></div>
        <div className="absolute top-3/4 left-1/3 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-60 animation-delay-2500"></div>
        
        {/* Decorative rings */}
        <div className="absolute top-24 left-1/2 w-20 h-20 border-2 border-purple-300 rounded-full animate-ping opacity-20"></div>
        <div className="absolute bottom-32 right-1/2 w-16 h-16 border-2 border-blue-300 rounded-full animate-ping opacity-20 animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/5 w-24 h-24 border-2 border-pink-300 rounded-full animate-ping opacity-15 animation-delay-4000"></div>
        
        {/* Floating lines */}
        <div className="absolute top-16 left-1/4 w-12 h-0.5 bg-gradient-to-r from-transparent via-purple-300 to-transparent animate-slide opacity-40"></div>
        <div className="absolute bottom-24 right-1/4 w-16 h-0.5 bg-gradient-to-r from-transparent via-blue-300 to-transparent animate-slide opacity-40 animation-delay-3000"></div>
        <div className="absolute top-2/3 left-1/6 w-10 h-0.5 bg-gradient-to-r from-transparent via-pink-300 to-transparent animate-slide opacity-40 animation-delay-1500"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="pt-8 pb-4 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-xl">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">MAZMUNDAMA.AI</span>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-5xl mx-auto text-center">
            {/* Main heading */}
            <div className="mb-8 animate-fadeIn">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 leading-tight drop-shadow-sm">
                MAZMUNDAMA.AI
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
                Интеллектуальная система перевода документов с английского на казахский язык
              </p>
            </div>

            {/* CTA Button */}
            <button
              onClick={onGetStarted}
              className="group relative inline-flex items-center gap-4 px-12 py-6 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-purple-500/60 transform hover:scale-105 transition-all duration-300 overflow-hidden"
            >
              <span className="relative z-10">KÍTAP AUDARU</span>
              <Sparkles className="relative z-10 w-7 h-7 animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300">
                <div className="absolute inset-0 bg-white animate-shimmer"></div>
              </div>
            </button>

            <p className="mt-6 text-gray-600 text-sm font-medium">
              Начните переводить ваши книги прямо сейчас
            </p>

            {/* Features */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-purple-200 hover:bg-white/90 hover:border-purple-300 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                  <Languages className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">AI Перевод</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Продвинутые модели искусственного интеллекта для точного перевода
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-blue-200 hover:bg-white/90 hover:border-blue-300 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Быстро</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Мгновенный перевод целых документов одним нажатием
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-indigo-200 hover:bg-white/90 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Безопасно</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ваши документы защищены и хранятся конфиденциально
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 px-6 text-center text-gray-600 text-sm">
          <p>© 2025 MAZMUNDAMA.AI</p>
        </footer>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        
        .animation-delay-1500 {
          animation-delay: 1.5s;
        }
        
        .animation-delay-3000 {
          animation-delay: 3s;
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg);
          }
        }
        
        .animate-sparkle {
          animation: sparkle 3s ease-in-out infinite;
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) rotate(45deg);
          }
          100% {
            transform: translateX(200%) rotate(45deg);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 1s ease-out;
        }
        
        @keyframes slide {
          0%, 100% {
            transform: translateX(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(200%);
          }
        }
        
        .animate-slide {
          animation: slide 8s ease-in-out infinite;
        }
        
        .animation-delay-2500 {
          animation-delay: 2.5s;
        }
        
        .animation-delay-5000 {
          animation-delay: 5s;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
