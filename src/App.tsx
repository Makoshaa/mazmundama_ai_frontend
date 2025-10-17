import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import DocxViewer from './DocxViewer';
import './App.css';

type Page = 'landing' | 'login' | 'dashboard' | 'viewer';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>(isAuthenticated ? 'dashboard' : 'landing');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedBookTitle, setSelectedBookTitle] = useState<string>('');

  const handleGetStarted = () => {
    setCurrentPage('login');
  };

  const handleOpenBook = (bookId: number, title: string) => {
    setSelectedBookId(bookId);
    setSelectedBookTitle(title);
    setCurrentPage('viewer');
  };

  const handleBackToDashboard = () => {
    setSelectedBookId(null);
    setSelectedBookTitle('');
    setCurrentPage('dashboard');
  };

  // Redirect to dashboard after login
  if (isAuthenticated && currentPage === 'login') {
    setCurrentPage('dashboard');
  }

  // Redirect to landing if logged out
  if (!isAuthenticated && (currentPage === 'dashboard' || currentPage === 'viewer')) {
    setCurrentPage('landing');
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Landing Page */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          currentPage === 'landing'
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-10 pointer-events-none'
        }`}
      >
        <LandingPage onGetStarted={handleGetStarted} />
      </div>

      {/* Login Page */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          currentPage === 'login'
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <LoginPage />
      </div>

      {/* Dashboard */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          currentPage === 'dashboard' && isAuthenticated
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 translate-x-10 pointer-events-none'
        }`}
      >
        {currentPage === 'dashboard' && isAuthenticated && (
          <Dashboard onOpenBook={handleOpenBook} />
        )}
      </div>

      {/* Viewer */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          currentPage === 'viewer' && isAuthenticated && selectedBookId
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {currentPage === 'viewer' && isAuthenticated && selectedBookId && (
          <DocxViewer
            bookId={selectedBookId}
            bookTitle={selectedBookTitle}
            onBack={handleBackToDashboard}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
