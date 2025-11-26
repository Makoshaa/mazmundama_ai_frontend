import React, { useState, useEffect } from 'react';
import { BookOpen, Upload, Trash2, Eye, User, LogOut, FileText, Calendar, Download } from 'lucide-react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';

interface Book {
  id: number;
  title: string;
  s3_key: string;
  uploaded_at: string;
  total_pages: number;
  total_sentences: number;
  translated_sentences: number;
}

interface DashboardProps {
  onOpenBook: (bookId: number, title: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onOpenBook }) => {
  const { username, logout, token } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'in-progress' | 'completed'>('in-progress');

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/books/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Ошибка загрузки книг');

      const data = await response.json();
      setBooks(data.books || []);
    } catch (err: any) {
      console.error('Ошибка загрузки книг:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      alert('Пожалуйста, загрузите файл формата .docx');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/books/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка при загрузке файла');
      }

      const data = await response.json();

      if (data.success) {
        // Обновляем список книг
        await loadBooks();
        alert('Книга успешно загружена!');
        // Сбрасываем input
        e.target.value = '';
      } else {
        throw new Error('Неожиданный ответ от сервера');
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке файла:', error);
      setError(error.message || 'Не удалось загрузить файл');
      alert(`Ошибка: ${error.message || 'Не удалось загрузить файл'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBook = async (bookId: number, title: string) => {
    if (!confirm(`Вы уверены, что хотите удалить книгу "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Ошибка удаления книги');

      // Обновляем список
      await loadBooks();
      alert('Книга удалена');
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      alert('Не удалось удалить книгу');
    }
  };

  const handleDownloadBook = async (bookId: number, title: string) => {
    try {
      setDownloading(bookId);
      const response = await fetch(`${API_URL}/api/books/${bookId}/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Ошибка скачивания книги');

      const data = await response.json();
      
      // Декодируем base64 в blob
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });
      
      // Создаем временную ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      
      // Очищаем
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Ошибка скачивания:', err);
      alert('Не удалось скачать книгу');
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-gradient-to-b from-purple-900 via-purple-800 to-blue-900 text-white flex flex-col shadow-2xl">
        {/* Logo */}
        <div className="p-6 border-b border-purple-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MAZMUNDAMA.AI</h1>
              <p className="text-xs text-purple-300">Система перевода</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-purple-700/50">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-purple-300 font-medium">Аккаунт</p>
                <p className="text-sm font-bold text-white truncate">{username}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-purple-700/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-300">Всего книг</span>
              <span className="text-xl font-bold text-white">{books.length}</span>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Logout */}
        <div className="p-6 border-t border-purple-700/50">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-semibold">Выйти</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Мои книги</h2>
            <p className="text-gray-600">Управляйте своими документами и переводами</p>
          </div>

          {/* Upload Section */}
          <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border-2 border-dashed border-purple-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Загрузить новую книгу</h3>
                  <p className="text-sm text-gray-600">Поддерживаются файлы формата DOCX</p>
                </div>
              </div>
              <label className="cursor-pointer">
                <div className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105">
                  {uploading ? 'Загрузка...' : 'Выбрать файл'}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
            <button
              onClick={() => setActiveTab('in-progress')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'in-progress'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>В прогрессе</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'in-progress'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {books.filter(book => {
                  const progress = book.total_sentences > 0 
                    ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                    : 0;
                  return progress < 100;
                }).length}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'completed'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span>Завершено</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'completed'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {books.filter(book => {
                  const progress = book.total_sentences > 0 
                    ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                    : 0;
                  return progress === 100;
                }).length}
              </span>
            </button>
          </div>

          {/* Books List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 font-medium">Загрузка книг...</p>
              </div>
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">Нет загруженных книг</h3>
              <p className="text-gray-500">Загрузите свою первую книгу для начала работы</p>
            </div>
          ) : (
            <>
              {/* Контент для активной вкладки */}
              {activeTab === 'in-progress' && (
                books.filter(book => {
                  const progress = book.total_sentences > 0 
                    ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                    : 0;
                  return progress < 100;
                }).length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-10 h-10 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">Нет книг в процессе</h3>
                    <p className="text-gray-500">Все книги переведены или загрузите новую</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {books.filter(book => {
                      const progress = book.total_sentences > 0 
                        ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                        : 0;
                      return progress < 100;
                    }).map((book) => {
                const progress = book.total_sentences > 0 
                  ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                  : 0;
                
                return (
                  <div
                    key={book.id}
                    className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all p-6"
                  >
                    <div className="flex items-center gap-6">
                      {/* Circular Progress Bar */}
                      <div className="relative flex-shrink-0">
                        <svg className="w-20 h-20 transform -rotate-90">
                          {/* Background circle */}
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="#e5e7eb"
                            strokeWidth="6"
                            fill="none"
                          />
                          {/* Progress circle */}
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="url(#gradient)"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 32}`}
                            strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress / 100)}`}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#9333ea" />
                              <stop offset="100%" stopColor="#3b82f6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">{progress}%</span>
                        </div>
                      </div>

                      {/* Book Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 truncate" title={book.title}>
                          {book.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{book.total_pages} страниц</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>•</span>
                            <span>{book.translated_sentences} / {book.total_sentences} предложений</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(book.uploaded_at)}</span>
                          </div>
                        </div>
                        
                        {/* Progress bar (linear) */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div 
                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {progress === 100 ? 'Перевод завершен' : progress === 0 ? 'Начните переводить' : 'В процессе перевода'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => onOpenBook(book.id, book.title)}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105"
                        >
                          <Eye className="w-5 h-5" />
                          <span>Открыть</span>
                        </button>
                        <button
                          onClick={() => handleDownloadBook(book.id, book.title)}
                          disabled={downloading === book.id}
                          className="px-4 py-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={downloading === book.id ? "Скачивание..." : "Скачать"}
                        >
                          {downloading === book.id ? (
                            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id, book.title)}
                          className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-200"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
                  </div>
                )
              )}

              {/* Контент для завершенных */}
              {activeTab === 'completed' && (
                books.filter(book => {
                  const progress = book.total_sentences > 0 
                    ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                    : 0;
                  return progress === 100;
                }).length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">Нет завершенных книг</h3>
                    <p className="text-gray-500">Завершите перевод хотя бы одной книги</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {books.filter(book => {
                      const progress = book.total_sentences > 0 
                        ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                        : 0;
                      return progress === 100;
                    }).map((book) => {
                const progress = book.total_sentences > 0 
                  ? Math.round((book.translated_sentences / book.total_sentences) * 100) 
                  : 0;
                
                return (
                  <div
                    key={book.id}
                    className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all p-6"
                  >
                    <div className="flex items-center gap-6">
                      {/* Circular Progress Bar */}
                      <div className="relative flex-shrink-0">
                        <svg className="w-20 h-20 transform -rotate-90">
                          {/* Background circle */}
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="#e5e7eb"
                            strokeWidth="6"
                            fill="none"
                          />
                          {/* Progress circle - зеленый для завершенных */}
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="url(#gradient-complete)"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 32}`}
                            strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress / 100)}`}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                          <defs>
                            <linearGradient id="gradient-complete" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">{progress}%</span>
                        </div>
                      </div>

                      {/* Book Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 truncate" title={book.title}>
                          {book.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{book.total_pages} страниц</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>•</span>
                            <span>{book.translated_sentences} / {book.total_sentences} предложений</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(book.uploaded_at)}</span>
                          </div>
                        </div>
                        
                        {/* Progress bar (linear) - зеленый для завершенных */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div 
                            className="bg-gradient-to-r from-green-600 to-emerald-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-green-600 font-semibold">
                          ✓ Перевод завершен
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => onOpenBook(book.id, book.title)}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105"
                        >
                          <Eye className="w-5 h-5" />
                          <span>Открыть</span>
                        </button>
                        <button
                          onClick={() => handleDownloadBook(book.id, book.title)}
                          disabled={downloading === book.id}
                          className="px-4 py-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={downloading === book.id ? "Скачивание..." : "Скачать"}
                        >
                          {downloading === book.id ? (
                            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id, book.title)}
                          className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-200"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
