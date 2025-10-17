import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FileText, ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Edit3, MessageCircle, Sparkles, History, Check, Copy, X, Languages, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthContext';

const API_URL = 'http://127.0.0.1:8080';

interface DocxViewerProps {
  bookId: number;
  bookTitle: string;
  onBack: () => void;
}

const PageThumbnail = React.memo(({ page, index, isActive, onClick }: any) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Устанавливаем видимость в зависимости от того, виден ли элемент
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.01, rootMargin: '100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  // Показываем контент только если миниатюра видна ИЛИ активна
  const shouldShowContent = isVisible || isActive;

  return (
    <div ref={ref} className={`flex flex-col items-center p-1.5 rounded-lg transition-all ${
      isActive ? 'bg-purple-100 shadow-md' : 'bg-transparent'
    }`}>
      <button
        onClick={onClick}
        className={`w-full transition-transform ${
          isActive
            ? 'ring-2 ring-purple-500 shadow-lg scale-105'
            : 'hover:ring-2 hover:ring-purple-200 shadow'
        } rounded-lg overflow-hidden`}
        style={{ willChange: isActive ? 'transform' : 'auto' }}
      >
        <div className="bg-white" style={{ height: '120px' }}>
          {shouldShowContent ? (
            <div className="h-full p-1.5 thumbnail overflow-hidden" style={{
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden' as const
            }}>
              <div dangerouslySetInnerHTML={{ __html: page }} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <div className="text-gray-400 text-xs">·</div>
            </div>
          )}
        </div>
      </button>
      <p className={`text-xs mt-1.5 font-medium transition-colors ${
        isActive ? 'text-purple-700' : 'text-gray-600'
      }`}>
        Страница {index + 1}
      </p>
    </div>
  );
}, (prevProps, nextProps) => {
  // Оптимизация: перерисовываем только при изменении активности или индекса
  return prevProps.isActive === nextProps.isActive &&
         prevProps.index === nextProps.index;
});

PageThumbnail.displayName = 'PageThumbnail';

export default function DocxViewer({ bookId, bookTitle, onBack }: DocxViewerProps) {
  const { token, username } = useAuth();
  
  const [pages, setPages] = useState<string[]>([]); // Переведенные страницы (для правой колонки)
  const [originalPages, setOriginalPages] = useState<string[]>([]); // Оригинальные страницы (для левой колонки)
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showHighlights, setShowHighlights] = useState(true);
  const [translationModel, setTranslationModel] = useState<'kazllm' | 'claude' | 'chatgpt'>('kazllm');
  const [error, setError] = useState('');
  const [hoveredSentenceId, setHoveredSentenceId] = useState<string | null>(null);
  const [buttonPosition, setButtonPosition] = useState<{x: number, y: number} | null>(null);
  const [hoveredSentenceRect, setHoveredSentenceRect] = useState<any>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const originalContentRef = useRef<HTMLDivElement | null>(null);
  const translatedContentRef = useRef<HTMLDivElement | null>(null);
  const isButtonHoveredRef = useRef(false);
  const translatingIdsRef = useRef(new Set<string>());
  const clearTimeoutRef = useRef<number | null>(null);
  const currentActiveSentenceRef = useRef<string | null>(null);

  const [translations, setTranslations] = useState<Record<number, Record<string, string>>>({});
  const [translationHistory, setTranslationHistory] = useState<Record<string, Array<{text: string, timestamp: number, model?: string}>>>({});
  const [approvedTranslations, setApprovedTranslations] = useState<Set<string>>(new Set());
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [editedTranslation, setEditedTranslation] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [improvementPrompt, setImprovementPrompt] = useState('');
  const [improvementResult, setImprovementResult] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const BUTTON_OFFSET_X = 10;
  const GUARD_VERTICAL_PADDING = 12;
  const GUARD_EXTRA_WIDTH = 80;

  // Load book on mount
  useEffect(() => {
    const loadBook = async () => {
      try {
        setLoading(true);
        setLoadingProgress(30);

        const response = await fetch(`${API_URL}/api/books/${bookId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        setLoadingProgress(70);

        if (!response.ok) {
          throw new Error('Ошибка загрузки книги');
        }

        const data = await response.json();

        setLoadingProgress(90);
        
        console.log('[DEBUG] Loaded book data:', {
          pages: data.pages?.length,
          translations: Object.keys(data.translations || {}).length,
          translationsData: data.translations
        });

        if (data.pages && data.pages.length > 0) {
          // Load translations
          const translationsMap: Record<number, Record<string, string>> = {};
          const approvedSet = new Set<string>();
          
          if (data.translations) {
            Object.entries(data.translations).forEach(([sentenceId, translation]: [string, any]) => {
              const pageNum = translation.page_number - 1; // Backend uses 1-indexed pages
              if (!translationsMap[pageNum]) {
                translationsMap[pageNum] = {};
              }
              translationsMap[pageNum][sentenceId] = translation.current_translation;
              
              if (translation.is_approved) {
                approvedSet.add(sentenceId);
              }
            });
          }
          
          console.log('[DEBUG] Processed translations:', {
            translationsMap,
            approvedCount: approvedSet.size
          });
          
          // Apply translations to pages HTML
          const pagesWithTranslations = data.pages.map((pageHtml: string, pageIndex: number) => {
            const pageTranslations = translationsMap[pageIndex] || {};
            console.log(`[DEBUG] Page ${pageIndex + 1} has ${Object.keys(pageTranslations).length} translations`);
            
            if (Object.keys(pageTranslations).length === 0) {
              return pageHtml; // No translations for this page
            }
            
            // Apply translations to this page
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageHtml, 'text/html');
            
            let appliedCount = 0;
            Object.entries(pageTranslations).forEach(([sentenceId, translatedText]) => {
              const element = doc.querySelector(`[data-sentence-id="${sentenceId}"]`);
              if (element) {
                console.log(`[DEBUG] Applying translation for ${sentenceId}: "${element.textContent?.substring(0, 30)}" -> "${translatedText.substring(0, 30)}"`);
                element.textContent = translatedText;
                element.classList.add('translated-sentence');
                if (approvedSet.has(sentenceId)) {
                  element.classList.add('approved-sentence');
                }
                appliedCount++;
              } else {
                console.warn(`[DEBUG] Element not found for sentence ${sentenceId}`);
              }
            });
            
            console.log(`[DEBUG] Applied ${appliedCount} translations to page ${pageIndex + 1}`);
            return doc.body.innerHTML;
          });
          
          setOriginalPages(data.pages); // Сохраняем оригинальные страницы (без переводов)
          setPages(pagesWithTranslations); // Сохраняем переведенные страницы (с переводами)
          setTranslations(translationsMap);
          setApprovedTranslations(approvedSet);
          setCurrentPage(0);
        } else {
          throw new Error('Книга не содержит страниц');
        }

        setLoadingProgress(100);
      } catch (error: any) {
        console.error('Ошибка загрузки книги:', error);
        setError(error.message || 'Не удалось загрузить книгу');
        alert(`Ошибка: ${error.message || 'Не удалось загрузить книгу'}`);
      } finally {
        setLoading(false);
        setTimeout(() => setLoadingProgress(0), 500);
      }
    };

    loadBook();
  }, [bookId, token]);

  const addToHistory = useCallback((sentenceId: string, text: string, model?: string) => {
    setTranslationHistory(prev => ({
      ...prev,
      [sentenceId]: [
        ...(prev[sentenceId] || []),
        { text, timestamp: Date.now(), model }
      ]
    }));
  }, []);

  const saveTranslation = useCallback(async (sentenceId: string, text: string, model?: string) => {
    // Сохраняем локально
    setTranslations(prev => ({
      ...prev,
      [currentPage]: {
        ...(prev[currentPage] || {}),
        [sentenceId]: text,
      },
    }));
    addToHistory(sentenceId, text, model);
    setEditedTranslation(text);
    
    // Обновляем HTML страницы чтобы перевод сохранился при переключении
    setPages(prevPages => {
      const updatedPages = [...prevPages];
      const pageHtml = updatedPages[currentPage];
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(pageHtml, 'text/html');
      const element = doc.querySelector(`[data-sentence-id="${sentenceId}"]`);
      
      if (element) {
        element.textContent = text;
        if (!element.classList.contains('translated-sentence')) {
          element.classList.add('translated-sentence');
        }
        updatedPages[currentPage] = doc.body.innerHTML;
      }
      
      return updatedPages;
    });

    // Сохраняем в БД
    if (token) {
      try {
        const originalSentence = document.querySelector(`[data-sentence-id="${sentenceId}"]`);
        const originalText = originalSentence?.textContent || '';

        await fetch(`${API_URL}/api/books/translation/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            book_id: bookId,
            page_number: currentPage + 1,
            sentence_id: sentenceId,
            original_text: originalText,
            translation: text,
            model: model || translationModel
          })
        });
      } catch (error) {
        console.error('Ошибка сохранения в БД:', error);
        // Не показываем ошибку пользователю, т.к. локально уже сохранено
      }
    }
  }, [currentPage, bookId, token, translationModel, addToHistory]);

  const approveTranslation = useCallback(async (sentenceId: string) => {
    setApprovedTranslations(prev => new Set([...prev, sentenceId]));
    
    // Обновляем HTML страницы для добавления класса approved
    setPages(prevPages => {
      const updatedPages = [...prevPages];
      const pageHtml = updatedPages[currentPage];
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(pageHtml, 'text/html');
      const element = doc.querySelector(`[data-sentence-id="${sentenceId}"]`);
      
      if (element) {
        element.classList.add('approved-sentence');
        updatedPages[currentPage] = doc.body.innerHTML;
      }
      
      return updatedPages;
    });

    // Сохраняем статус в БД
    if (token) {
      try {
        await fetch(`${API_URL}/api/books/translation/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            book_id: bookId,
            sentence_id: sentenceId
          })
        });
      } catch (error) {
        console.error('Ошибка одобрения в БД:', error);
      }
    }
  }, [bookId, token, currentPage]);

  const openDetailsPanel = useCallback((sentenceId: string) => {
    const translation = translations[currentPage]?.[sentenceId] || '';
    setSelectedSentenceId(sentenceId);
    setEditedTranslation(translation);
    setExplanation('');
    setImprovementPrompt('');
    setImprovementResult('');
    setShowHistory(false);
    setDetailsPanelOpen(true);
  }, [translations, currentPage]);

  const closeDetailsPanel = useCallback(() => {
    setDetailsPanelOpen(false);
    setSelectedSentenceId(null);
    setExplanation('');
    setImprovementPrompt('');
    setImprovementResult('');
    setShowHistory(false);
  }, []);

  const explainTranslation = useCallback(async () => {
    if (!selectedSentenceId) return;
    
    const sentence = document.querySelector(`[data-sentence-id="${selectedSentenceId}"]`);
    if (!sentence) return;
    
    const originalText = sentence.textContent || '';
    const translatedText = editedTranslation;
    
    // Определяем API endpoint: kazllm не поддерживает объяснения, используем chatgpt
    const apiModel = translationModel === 'kazllm' ? 'chatgpt' : translationModel;
    const apiEndpoint = apiModel === 'claude' ? '/api/claude' : '/api/chatgpt';
    const modelName = apiModel === 'claude' ? 'claude-sonnet-4-5-20250929' : 'gpt-4';
    
    setIsExplaining(true);
    try {
      const response = await fetch(`${API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Кратко объясни этот перевод (максимум 3-4 предложения):\n\nОригинал (English): "${originalText}"\nПеревод (Kazakh): "${translatedText}"\n\nОбъясни почему выбраны именно эти слова и главные нюансы. Будь лаконичен.`,
          model: modelName,
          temperature: 0.7
        })
      });
      
      if (!response.ok) throw new Error('Ошибка API');
      const data = await response.json();
      setExplanation(data.message);
    } catch (error) {
      console.error('Ошибка объяснения:', error);
      alert('Не удалось получить объяснение');
    } finally {
      setIsExplaining(false);
    }
  }, [selectedSentenceId, editedTranslation, translationModel]);

  const improveTranslation = useCallback(async () => {
    if (!selectedSentenceId || !improvementPrompt.trim()) return;
    
    const sentence = document.querySelector(`[data-sentence-id="${selectedSentenceId}"]`);
    if (!sentence) return;
    
    const originalText = sentence.textContent || '';
    
    // Определяем API endpoint: kazllm не поддерживает улучшение, используем chatgpt
    const apiModel = translationModel === 'kazllm' ? 'chatgpt' : translationModel;
    const apiEndpoint = apiModel === 'claude' ? '/api/claude' : '/api/chatgpt';
    const modelName = apiModel === 'claude' ? 'claude-sonnet-4-5-20250929' : 'gpt-4';
    
    setIsImproving(true);
    try {
      const response = await fetch(`${API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Улучши перевод согласно запросу:\n\nОригинал (English): "${originalText}"\nТекущий перевод (Kazakh): "${editedTranslation}"\nЗапрос: ${improvementPrompt}\n\nПредоставь от 1 до 5 улучшенных вариантов перевода на казахском языке. Каждый вариант начинай с новой строки с номером (1., 2., и т.д.). Никаких объяснений, только варианты переводов.`,
          model: modelName,
          temperature: 0.8
        })
      });
      
      if (!response.ok) throw new Error('Ошибка API');
      const data = await response.json();
      setImprovementResult(data.message);
    } catch (error) {
      console.error('Ошибка улучшения:', error);
      alert('Не удалось получить улучшенный вариант');
    } finally {
      setIsImproving(false);
    }
  }, [selectedSentenceId, editedTranslation, improvementPrompt, translationModel]);

  // @ts-ignore - unused but may be used in future
  const applyImprovement = useCallback(() => {
    if (!selectedSentenceId || !improvementResult) return;
    saveTranslation(selectedSentenceId, improvementResult, translationModel);
    setImprovementResult('');
    setImprovementPrompt('');
  }, [selectedSentenceId, improvementResult, translationModel, saveTranslation]);



  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);



  // Левая колонка - всегда оригинал (без изменений)
  const originalPageHTML = useMemo(() => {
    if (originalPages.length === 0) return '';
    return originalPages[currentPage];
  }, [originalPages, currentPage]);
  
  // Правая колонка - переведенная версия
  const translatedPageHTML = useMemo(() => {
    if (pages.length === 0) return '';
    return pages[currentPage];
  }, [pages, currentPage]);

  const clearHoverState = useCallback((sentenceId: string | null, immediate: boolean = false) => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    
    const doClear = () => {
      // КРИТИЧНО: Не очищаем если предложение переводится
      if (sentenceId && translatingIdsRef.current.has(sentenceId)) {
        return;
      }
      
      // Не очищаем если кнопка наведена
      if (isButtonHoveredRef.current) {
        return;
      }
      
      currentActiveSentenceRef.current = null;
      setHoveredSentenceId(null);
      setButtonPosition(null);
      setHoveredSentenceRect(null);
      
      // Удаляем класс active-sentence только если предложение точно не переводится
      requestAnimationFrame(() => {
        document.querySelectorAll('.sentence.active-sentence').forEach((el) => {
          const elId = el.getAttribute('data-sentence-id');
          // Не удаляем класс если это предложение переводится или это миниатюра
          if (el.closest('.thumbnail') || (elId && translatingIdsRef.current.has(elId))) {
            return;
          }
          el.classList.remove('active-sentence');
        });
      });
    };
    
    if (immediate) {
      doClear();
    } else {
      clearTimeoutRef.current = setTimeout(doClear, 25);
    }
  }, []);

  useEffect(() => {
    const orig = originalContentRef.current;
    const trans = translatedContentRef.current;

    if (!orig && !trans) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const sentence = target?.closest?.('.sentence') as HTMLElement | null;
      
      if (sentence?.closest('.thumbnail')) {
        return;
      }
      
      if (sentence) {
        const id = sentence.getAttribute('data-sentence-id');
        if (id && translations[currentPage]?.[id]) {
          // Если это переведенное предложение, открываем панель деталей
          openDetailsPanel(id);
        }
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const sentence = target?.closest?.('.sentence') as HTMLElement | null;
      
      if (sentence?.closest('.thumbnail')) {
        return;
      }
      
      const isInTranslationColumn = sentence?.closest('.translation-column');
      
      if (sentence) {
        const id = sentence.getAttribute('data-sentence-id');
        if (id) {
          if (clearTimeoutRef.current) {
            clearTimeout(clearTimeoutRef.current);
            clearTimeoutRef.current = null;
          }
          
          if (id === currentActiveSentenceRef.current && id === hoveredSentenceId) {
            return;
          }
          
          currentActiveSentenceRef.current = id;
          
          requestAnimationFrame(() => {
            document.querySelectorAll('.sentence.active-sentence').forEach((el) => {
              if (!el.closest('.thumbnail')) {
                el.classList.remove('active-sentence');
              }
            });
            
            document.querySelectorAll(`[data-sentence-id="${id}"]`).forEach((el) => {
              if (!el.closest('.thumbnail')) {
                el.classList.add('active-sentence');
              }
            });
          });
          
          const rect = sentence.getBoundingClientRect();
          setHoveredSentenceId(id);
          setHoveredSentenceRect({
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            height: rect.height,
          });
          
          // Проверяем есть ли перевод для этого предложения
          const hasTranslation = translations[currentPage]?.[id];
          
          // Логика показа кнопок:
          // - В левой колонке (оригинал): показываем кнопку "Перевести" только если нет перевода
          // - Переведенные предложения теперь кликабельны сами по себе, кнопка не нужна
          if (!isInTranslationColumn && !hasTranslation) {
            // Левая колонка, нет перевода → показываем кнопку "Перевести"
            setButtonPosition({ x: rect.right + BUTTON_OFFSET_X, y: rect.top });
          } else {
            // Все остальные случаи - не показываем кнопку
            setButtonPosition(null);
          }
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = (e.relatedTarget as HTMLElement) || null;
      
      if (related?.closest('.translate-button') || 
          related?.closest('.details-button') || 
          related?.closest('.translate-guard')) {
        return;
      }
      
      const stillInsideOrig = related && orig ? orig.contains(related) : false;
      const stillInsideTrans = related && trans ? trans.contains(related) : false;
      const overSentence = related?.closest?.('.sentence');
      
      if (!stillInsideOrig && !stillInsideTrans) {
        clearHoverState(currentActiveSentenceRef.current, false);
      } else if (!overSentence) {
        clearHoverState(currentActiveSentenceRef.current, false);
      }
    };

    orig?.addEventListener('mouseover', handleMouseOver);
    orig?.addEventListener('mouseout', handleMouseOut);
    orig?.addEventListener('click', handleClick);
    trans?.addEventListener('mouseover', handleMouseOver);
    trans?.addEventListener('mouseout', handleMouseOut);
    trans?.addEventListener('click', handleClick);

    return () => {
      orig?.removeEventListener('mouseover', handleMouseOver);
      orig?.removeEventListener('mouseout', handleMouseOut);
      orig?.removeEventListener('click', handleClick);
      trans?.removeEventListener('mouseover', handleMouseOver);
      trans?.removeEventListener('mouseout', handleMouseOut);
      trans?.removeEventListener('click', handleClick);
      
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    };
  }, [pages, currentPage, translatedPageHTML, BUTTON_OFFSET_X, clearHoverState, hoveredSentenceId, translations, openDetailsPanel]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const allSentences = document.querySelectorAll('.sentence:not(.thumbnail .sentence)');
      allSentences.forEach((el) => {
        el.classList.remove('active-sentence');
      });
      
      if (hoveredSentenceId) {
        const targetSentences = document.querySelectorAll(`[data-sentence-id="${hoveredSentenceId}"]`);
        targetSentences.forEach((el) => {
          if (!el.closest('.thumbnail')) {
            el.classList.add('active-sentence');
          }
        });
      }
    });
    
    return () => cancelAnimationFrame(frame);
  }, [hoveredSentenceId]);

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden" style={{ maxHeight: '100vh' }}>
      <style>{`
        .document-content {
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          padding: 32px 24px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.45;
          color: #000;
          overflow: visible;
        }

        .scroll-container {
          overflow-y: auto;
          overflow-x: hidden;
        }

        .scroll-container::-webkit-scrollbar {
          width: 8px;
        }

        .scroll-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .scroll-container::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }

        .scroll-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        
        .document-content h1,
        .document-content h1.heading-1,
        .document-content h1.title {
          font-size: 20pt;
          font-weight: bold;
          margin: 20px 0 14px 0;
          line-height: 1.3;
          text-align: center;
          page-break-after: avoid;
        }
        
        .document-content h2,
        .document-content h2.heading-2,
        .document-content h2.subtitle {
          font-size: 16pt;
          font-weight: bold;
          margin: 16px 0 10px 0;
          line-height: 1.3;
          text-align: left;
          page-break-after: avoid;
        }
        
        .document-content h3,
        .document-content h3.heading-3 {
          font-size: 13pt;
          font-weight: bold;
          margin: 14px 0 8px 0;
          line-height: 1.3;
          text-align: left;
          page-break-after: avoid;
        }
        
        .document-content p {
          margin: 0 0 0 0;
          text-align: left;
          orphans: 2;
          widows: 2;
        }
        
        .document-content p + p {
          margin-top: 12pt;
        }
        
        .document-content p.normal {
          text-align: left;
        }
        
        .document-content p.body-text {
          text-align: justify;
          text-indent: 0;
        }
        
        .document-content p.list-paragraph {
          margin-left: 36pt;
        }
        
        .document-content [style*="text-indent"] {
          text-indent: inherit !important;
        }
        
        .document-content [style*="line-height"] {
          line-height: inherit !important;
        }
        
        .document-content ul, .document-content ol {
          margin: 12pt 0;
          padding-left: 48pt;
        }
        
        .document-content ul {
          list-style-type: disc;
        }
        
        .document-content ol {
          list-style-type: decimal;
        }
        
        .document-content li {
          margin-bottom: 6pt;
          text-align: left;
        }
        
        .document-content li p {
          margin: 0;
          display: inline;
        }
        
        .document-content strong, .document-content b {
          font-weight: bold;
        }
        
        .document-content em, .document-content i {
          font-style: italic;
        }
        
        .document-content u {
          text-decoration: underline;
        }
        
        .document-content blockquote {
          margin: 16pt 0 16pt 36pt;
          padding-left: 16pt;
          border-left: 3px solid #ccc;
          font-style: italic;
        }
        
        .document-content p:empty::before {
          content: '\\00a0';
        }
        
        .sentence {
          display: inline;
          cursor: pointer;
          position: relative;
          padding: 3px 4px;
          margin: 0 -2px;
          line-height: 1.85;
          border-radius: 4px;
          background-color: transparent;
          transition: none;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          will-change: background-color;
        }
        
        .sentence.translated-sentence {
          background-color: ${showHighlights ? '#fef08a' : 'transparent'};
          transition: background-color 0.2s ease-out;
          cursor: pointer;
        }
        
        .sentence.translated-sentence:hover {
          background-color: #fde047 !important;
          outline: 1px solid #facc15;
          outline-offset: -1px;
        }
        
        .sentence.approved-sentence {
          background-color: ${showHighlights ? '#bbf7d0' : 'transparent'} !important;
          transition: background-color 0.2s ease-out;
        }
        
        .sentence.active-sentence {
          background-color: #e0e7ff !important;
          outline: 1px solid #818cf8;
          outline-offset: -1px;
          transition: none !important;
        }
        
        .sentence.translated-sentence.active-sentence {
          background-color: #fbbf24 !important;
          outline: 1px solid #f59e0b;
          outline-offset: -1px;
          transition: none !important;
        }
        
        .sentence.approved-sentence.active-sentence {
          background-color: #86efac !important;
          outline: 1px solid #22c55e;
          outline-offset: -1px;
          transition: none !important;
        }
        
        .thumbnail .sentence {
          cursor: default;
          pointer-events: none;
          background-color: transparent !important;
          box-shadow: none !important;
          padding: 0;
          margin: 0;
        }
        
        .thumbnail .sentence:hover,
        .thumbnail .sentence.active-sentence,
        .thumbnail .sentence.translated-sentence {
          background-color: transparent !important;
          box-shadow: none !important;
        }
        
        .translate-guard {
          position: fixed;
          z-index: 999;
          pointer-events: auto;
          background: transparent;
        }
        
        .translate-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          box-shadow: 
            0 4px 14px rgba(102, 126, 234, 0.4),
            0 2px 8px rgba(118, 75, 162, 0.3),
            0 1px 2px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInSlide 0.25s ease-out;
          white-space: nowrap;
          user-select: none;
          -webkit-user-select: none;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.2px;
        }
        
        .translate-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          transition: left 0.6s ease;
        }
        
        .translate-button:hover::before {
          left: 100%;
        }
        
        .translate-button:hover {
          background: linear-gradient(135deg, #5568d3 0%, #6a3a8a 100%);
          box-shadow: 
            0 6px 20px rgba(102, 126, 234, 0.55),
            0 4px 12px rgba(118, 75, 162, 0.45),
            0 2px 4px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transform: translateY(-3px) scale(1.02);
        }
        
        .translate-button:active {
          transform: translateY(-1px) scale(0.99);
          box-shadow: 
            0 4px 14px rgba(102, 126, 234, 0.45),
            0 2px 8px rgba(118, 75, 162, 0.35),
            0 1px 2px rgba(0, 0, 0, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }
        
        .translate-button:disabled {
          cursor: wait;
          opacity: 0.7;
          transform: translateY(-1px);
        }
        
        .translate-button svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
        }
        
        .details-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 14px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          box-shadow: 
            0 4px 14px rgba(16, 185, 129, 0.4),
            0 2px 8px rgba(5, 150, 105, 0.3),
            0 1px 2px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInSlide 0.25s ease-out;
          white-space: nowrap;
          user-select: none;
          -webkit-user-select: none;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.2px;
        }
        
        .details-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          transition: left 0.6s ease;
        }
        
        .details-button:hover::before {
          left: 100%;
        }
        
        .details-button:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          box-shadow: 
            0 6px 20px rgba(16, 185, 129, 0.55),
            0 4px 12px rgba(5, 150, 105, 0.45),
            0 2px 4px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transform: translateY(-3px) scale(1.02);
        }
        
        .details-button:active {
          transform: translateY(-1px) scale(0.99);
          box-shadow: 
            0 4px 14px rgba(16, 185, 129, 0.45),
            0 2px 8px rgba(5, 150, 105, 0.35),
            0 1px 2px rgba(0, 0, 0, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }
        
        @keyframes fadeInSlide {
          0% {
            opacity: 0;
            transform: translateX(-8px) scale(0.92);
          }
          60% {
            transform: translateX(1px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes slideInFromRight {
          0% {
            opacity: 0;
            transform: translateX(100%);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideOutToRight {
          0% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        .animate-slideInRight {
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .thumbnail {
          font-family: 'Times New Roman', Times, serif;
          font-size: 2pt;
          line-height: 1.2;
          overflow: hidden;
          color: #333;
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          will-change: transform;
        }

        .thumbnail * {
          pointer-events: none !important;
          user-select: none !important;
        }
        
        .thumbnail h1 {
          font-size: 4.5pt;
          font-weight: bold;
          margin: 1.5px 0;
          text-align: center !important;
        }

        .thumbnail h2 {
          font-size: 3.5pt;
          font-weight: bold;
          margin: 1.5px 0;
          text-align: left !important;
        }

        .thumbnail h3 {
          font-size: 3pt;
          font-weight: bold;
          margin: 1px 0;
          text-align: left !important;
        }

        .thumbnail p {
          margin: 0.5px 0;
          text-align: left !important;
        }

        .thumbnail [style*="text-align: center"] {
          text-align: center !important;
        }
        
        .thumbnail [style*="text-align: right"] {
          text-align: right !important;
        }
        
        .thumbnail [style*="text-align: justify"] {
          text-align: justify !important;
        }
        
        .thumbnail ul, .thumbnail ol {
          margin: 1px 0 1px 4px;
          padding-left: 3px;
        }
        
        .thumbnail strong, .thumbnail b {
          font-weight: bold;
        }
        
        .thumbnail em, .thumbnail i {
          font-style: italic;
        }

        .document-content table {
          border-collapse: collapse;
          margin: 16pt 0;
          width: auto;
          border: 1px solid #000;
        }
        
        .document-content td, .document-content th {
          border: 1px solid #000;
          padding: 6pt 8pt;
          vertical-align: top;
          text-align: left;
        }
        
        .document-content th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        
        .document-content a {
          color: #0563c1;
          text-decoration: underline;
        }
        
        .document-content [style*="text-align: center"],
        .document-content .center {
          text-align: center !important;
        }
        
        .document-content [style*="text-align: right"],
        .document-content .right {
          text-align: right !important;
        }
        
        .document-content [style*="text-align: justify"],
        .document-content .justify {
          text-align: justify !important;
        }
        
        .document-content [style*="margin-left"],
        .document-content [style*="padding-left"] {
          margin-left: inherit;
          padding-left: inherit;
        }
      `}</style>

      <div className="bg-white shadow-sm px-4 py-2 z-10 border-b flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Вернуться к списку"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium text-sm hidden md:inline">Назад</span>
            </button>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <FileText className="w-6 h-6 text-purple-600" />
            <div>
              <h1 className="text-base font-bold text-gray-800">{bookTitle}</h1>
              <p className="text-xs text-gray-600">Страница {currentPage + 1} из {pages.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {username && (
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {username[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{username}</span>
              </div>
            )}

            <select
              value={translationModel}
              onChange={(e) => setTranslationModel(e.target.value as 'kazllm' | 'claude' | 'chatgpt')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors cursor-pointer"
            >
              <option value="kazllm">KazLLM</option>
              <option value="claude">Claude</option>
              <option value="chatgpt">ChatGPT</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {pages.length > 0 && (
          <>
            <div
              className={`absolute left-0 top-0 bottom-0 bg-gray-50 shadow-lg w-[160px] transition-transform duration-500 ease-out z-30 ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              style={{
                willChange: sidebarOpen ? 'auto' : 'transform'
              }}
            >
              <div
                className="h-full overflow-y-auto"
                style={{
                  visibility: sidebarOpen ? 'visible' : 'hidden',
                  transition: sidebarOpen ? 'visibility 0s linear 0s' : 'visibility 0s linear 0.5s'
                }}
              >
                <div className="p-2">
                  <div className="space-y-2.5">
                    {originalPages.map((page, idx) => (
                      <PageThumbnail
                        key={idx}
                        page={page}
                        index={idx}
                        isActive={idx === currentPage}
                        onClick={() => handlePageChange(idx)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div
              className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500 z-40 ${
                sidebarOpen ? 'left-[135px]' : 'left-[-25px]'
              }`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Скрыть панель' : 'Показать страницы'}
              style={{
                willChange: 'left'
              }}
            >
              <div className="relative">
                <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 rounded-full shadow-2xl w-12 h-12 flex items-center justify-center transition-all hover:scale-110 border-2 border-purple-400">
                  <div className="text-white">
                    {sidebarOpen ? (
                      <ChevronLeft className="w-6 h-6 stroke-[3]" />
                    ) : (
                      <ChevronRight className="w-6 h-6 stroke-[3]" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className={`flex-1 bg-gray-100 flex flex-col overflow-hidden ${
          sidebarOpen ? 'pl-[160px]' : 'pl-0'
        }`}>

          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                <p className="mt-4 text-gray-600 font-medium">Обработка документа на сервере...</p>
                <div className="mt-2 w-64 bg-gray-200 rounded-full h-2 mx-auto">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{loadingProgress}%</p>
              </div>
            </div>
          )}

          {!loading && pages.length > 0 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className={`grid ${showTranslation ? 'grid-cols-2' : 'grid-cols-1'} gap-4 px-4 py-4 flex-shrink-0`}>
                <div className="flex items-center justify-between bg-white px-4 py-3 border-b shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-700">Оригинал</h2>
                </div>
                
                {showTranslation && (
                  <div className="flex items-center justify-between bg-white px-4 py-3 border-b shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-700">Перевод (Қазақша)</h2>
                    <button
                      onClick={() => {
                        setShowHighlights(!showHighlights);
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title={showHighlights ? "Скрыть выделение переводов" : "Показать выделение переводов"}
                    >
                      {showHighlights ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="scroll-container flex-1 overflow-y-auto px-4 pb-20">
                <div className={`grid ${showTranslation ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  <div className="original-column">
                    <div className="document-content">
                      <div ref={originalContentRef} dangerouslySetInnerHTML={{ __html: originalPageHTML }} />
                    </div>
                  </div>

                  {showTranslation && (
                    <div className="translation-column">
                      <div className="document-content">
                        <div ref={translatedContentRef} dangerouslySetInnerHTML={{ __html: translatedPageHTML }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!showTranslation && (
                <div className="fixed right-6 bottom-24 z-30">
                  <button
                    onClick={() => setShowTranslation(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-105"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="font-medium text-sm">Показать перевод</span>
                  </button>
                </div>
              )}

              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-white/95 backdrop-blur-md rounded-full shadow-lg px-3 py-2 flex items-center gap-2 border border-gray-200">
                  <button
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 disabled:hover:scale-100"
                    title="Предыдущая страница"
                  >
                    <ChevronLeft className="w-4 h-4 text-white stroke-[3]" />
                  </button>

                  <div className="px-3 text-xs font-semibold text-gray-700">
                    {currentPage + 1} / {pages.length}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
                    disabled={currentPage === pages.length - 1}
                    className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 disabled:hover:scale-100"
                    title="Следующая страница"
                  >
                    <ChevronRight className="w-4 h-4 text-white stroke-[3]" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && pages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                <h2 className="text-xl font-bold text-gray-700 mb-2">
                  Документ не загружен
                </h2>
                <p className="text-gray-500">
                  Нажмите кнопку "Загрузить" чтобы начать просмотр
                </p>
                {error && (
                  <p className="text-red-500 mt-4">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {(() => {
          if (!detailsPanelOpen || !selectedSentenceId) return null;
          const originalSentence = document.querySelector(`[data-sentence-id="${selectedSentenceId}"]`);
          const originalText = originalSentence?.textContent || '';
          const history = translationHistory[selectedSentenceId] || [];
          const isApproved = approvedTranslations.has(selectedSentenceId);
          
          return (
            <div 
              className={`bg-white shadow-2xl overflow-hidden flex-shrink-0 transition-all duration-500 ease-out ${
                detailsPanelOpen ? 'w-[400px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full pointer-events-none'
              }`}
              style={{
                animation: detailsPanelOpen ? 'slideInFromRight 0.5s ease-out' : 'slideOutToRight 0.4s ease-in',
                overflowY: detailsPanelOpen ? 'auto' : 'hidden'
              }}
            >
              <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2.5 flex items-center justify-between shadow-lg z-10 border-b border-purple-500">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Редактор перевода
                </h2>
                <button 
                  onClick={closeDetailsPanel}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  title="Закрыть панель"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Оригинал</h3>
                  </div>
                  <p className="text-gray-900 leading-relaxed text-sm">{originalText}</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Перевод</h3>
                  </div>
                  <textarea
                    value={editedTranslation}
                    onChange={(e) => setEditedTranslation(e.target.value)}
                    className="w-full h-28 px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-all"
                    placeholder="Введите перевод..."
                  />
                  <button
                    onClick={() => selectedSentenceId && saveTranslation(selectedSentenceId, editedTranslation, translationModel)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-[0.98] transition-all text-sm font-semibold shadow-md hover:shadow-lg"
                  >
                    <Copy className="w-4 h-4" />
                    Сохранить изменения
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-5 space-y-3">
                  <button
                    onClick={explainTranslation}
                    disabled={isExplaining}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 active:scale-[0.98] transition-all border-2 border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {isExplaining ? 'Получение объяснения...' : 'Объяснить перевод'}
                  </button>
                  
                  {explanation && (
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Объяснение</h4>
                      </div>
                      <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">{explanation}</p>
                    </div>
                  )}

                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Улучшить перевод</h4>
                    </div>
                    <div className="space-y-2 mb-3">
                      <textarea
                        value={improvementPrompt}
                        onChange={(e) => setImprovementPrompt(e.target.value)}
                        placeholder="Например: сделай более формальным, используй разговорный стиль, упрости, добавь вежливости..."
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all resize-none"
                        rows={3}
                      />
                      <button
                        onClick={improveTranslation}
                        disabled={isImproving || !improvementPrompt.trim()}
                        className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isImproving ? 'Обработка...' : 'Улучшить с помощью AI'}
                      </button>
                    </div>
                    
                    {improvementResult && (() => {
                      // Парсим результат на варианты (по номерам 1., 2., 3. и т.д.)
                      const variants = improvementResult
                        .split(/\n(?=\d+\.)/)
                        .map(v => v.trim())
                        .filter(v => v.length > 0)
                        .map(v => v.replace(/^\d+\.\s*/, ''));
                      
                      return (
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border-2 border-purple-200 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <h5 className="text-xs font-bold text-purple-800 uppercase tracking-wide">
                              Варианты улучшений ({variants.length})
                            </h5>
                          </div>
                          <div className="space-y-2">
                            {variants.map((variant, idx) => (
                              <div 
                                key={idx} 
                                className="bg-white p-3 rounded-lg border border-purple-200 hover:border-purple-400 transition-all group cursor-pointer"
                                onClick={() => {
                                  saveTranslation(selectedSentenceId!, variant, translationModel);
                                  setImprovementResult('');
                                  setImprovementPrompt('');
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <p className="text-sm text-gray-900 leading-relaxed flex-1">{variant}</p>
                                  <Check className="w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              setImprovementResult('');
                              setImprovementPrompt('');
                            }}
                            className="w-full px-3 py-2 text-xs text-gray-600 hover:text-gray-800 font-medium transition-colors"
                          >
                            Закрыть варианты
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 active:scale-[0.98] transition-all border-2 border-gray-200 text-sm font-semibold"
                  >
                    <History className="w-4 h-4" />
                    История версий ({history.length})
                  </button>
                  
                  {showHistory && history.length > 0 && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 shadow-sm">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Timeline версий
                      </h4>
                      <div className="relative">
                        {/* Вертикальная линия timeline */}
                        <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-400 via-purple-300 to-purple-200"></div>
                        
                        <div className="space-y-6">
                          {history.map((item: {text: string, timestamp: number, model?: string}, idx: number) => {
                            const isLatest = idx === history.length - 1;
                            return (
                              <div key={idx} className="relative pl-8">
                                {/* Точка на timeline */}
                                <div className={`absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-3 border-white shadow-md z-10 ${
                                  isLatest 
                                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 ring-4 ring-purple-200' 
                                    : 'bg-gradient-to-br from-purple-400 to-purple-500'
                                }`}>
                                  {isLatest && (
                                    <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-75"></div>
                                  )}
                                </div>
                                
                                {/* Карточка версии */}
                                <div className={`bg-white rounded-lg p-3 shadow-sm border transition-all hover:shadow-md ${
                                  isLatest 
                                    ? 'border-purple-300 ring-1 ring-purple-200' 
                                    : 'border-gray-200'
                                }`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs text-gray-600 font-semibold">
                                        {new Date(item.timestamp).toLocaleString('ru-RU', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                      {isLatest && (
                                        <span className="px-2 py-0.5 bg-purple-500 text-white rounded-full text-xs font-bold">
                                          Текущая
                                        </span>
                                      )}
                                      {item.model && (
                                        <span className="px-2 py-0.5 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-semibold border border-purple-300">
                                          {item.model}
                                        </span>
                                      )}
                                    </div>
                                    {!isLatest && (
                                      <button
                                        onClick={() => {
                                          // Восстанавливаем версию без создания новой записи в истории
                                          setTranslations(prev => ({
                                            ...prev,
                                            [currentPage]: {
                                              ...(prev[currentPage] || {}),
                                              [selectedSentenceId!]: item.text,
                                            },
                                          }));
                                          setEditedTranslation(item.text);
                                          // Сбрасываем статус "одобрено" при восстановлении старой версии
                                          setApprovedTranslations(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(selectedSentenceId!);
                                            return newSet;
                                          });
                                        }}
                                        className="flex items-center justify-center w-7 h-7 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all hover:scale-110 border border-purple-200 hover:border-purple-300"
                                        title="Восстановить эту версию"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-900 leading-relaxed">{item.text}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (selectedSentenceId) {
                        approveTranslation(selectedSentenceId);
                        closeDetailsPanel();
                      }
                    }}
                    disabled={isApproved}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all text-sm shadow-md ${
                      isApproved
                        ? 'bg-green-100 text-green-700 border-2 border-green-300 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] hover:shadow-lg'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                    {isApproved ? 'Перевод утверждён' : 'Утвердить перевод'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {hoveredSentenceId && buttonPosition && hoveredSentenceRect && (() => {
        const hasTranslation = translations[currentPage]?.[hoveredSentenceId];
        
        // Показываем кнопку только для НЕпереведенных предложений
        if (hasTranslation) {
          return null;
        }
        
        return (
        <>
          <div
            className="translate-guard"
            style={{
              left: `${hoveredSentenceRect.right}px`,
              top: `${Math.max(hoveredSentenceRect.top - GUARD_VERTICAL_PADDING, 0)}px`,
              width: `${Math.max(buttonPosition.x - hoveredSentenceRect.right, 0) + GUARD_EXTRA_WIDTH}px`,
              height: `${hoveredSentenceRect.height + GUARD_VERTICAL_PADDING * 2}px`,
            }}
            onMouseEnter={() => {
              if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
                clearTimeoutRef.current = null;
              }
            }}
            onMouseLeave={(event) => {
              const relatedTarget = event.relatedTarget as HTMLElement | null;
              
              if (relatedTarget?.closest('.translate-button') || 
                  relatedTarget?.closest(`.sentence[data-sentence-id="${hoveredSentenceId}"]`)) {
                return;
              }
              
              clearHoverState(hoveredSentenceId, false);
            }}
          />
          
          <button
            className="translate-button"
            disabled={isTranslating}
            style={{
              position: 'fixed',
              left: `${buttonPosition.x}px`,
              top: `${buttonPosition.y}px`,
              zIndex: 1000,
              pointerEvents: 'auto',
              opacity: isTranslating ? 0.7 : 1,
              cursor: isTranslating ? 'wait' : 'pointer',
            }}
            onMouseEnter={() => {
              if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
                clearTimeoutRef.current = null;
              }
              isButtonHoveredRef.current = true;
            }}
            onMouseLeave={(event) => {
              const relatedTarget = event.relatedTarget as HTMLElement | null;
              isButtonHoveredRef.current = false;
              
              if (relatedTarget?.closest('.translate-guard') || 
                  relatedTarget?.closest(`.sentence[data-sentence-id="${hoveredSentenceId}"]`)) {
                return;
              }
              
              clearHoverState(hoveredSentenceId, false);
            }}
            onClick={async () => {
              if (isTranslating) return;
              
              const sentenceId = hoveredSentenceId;
              if (!sentenceId) return;
              
              // КРИТИЧНО: Добавляем в translatingIdsRef СРАЗУ, до любых других операций
              // Это предотвратит очистку выделения событиями mouseout
              translatingIdsRef.current.add(sentenceId);
              
              const sentence = document.querySelector(`[data-sentence-id="${sentenceId}"]`);
              if (!sentence) {
                translatingIdsRef.current.delete(sentenceId);
                return;
              }
              
              const text = sentence.textContent || '';
              
              // Форсируем сохранение активного класса
              requestAnimationFrame(() => {
                document.querySelectorAll(`[data-sentence-id="${sentenceId}"]`).forEach((el) => {
                  if (!el.closest('.thumbnail')) {
                    el.classList.add('active-sentence');
                  }
                });
              });
              
              setIsTranslating(true);
              
              // Периодически восстанавливаем выделение во время перевода
              const keepAliveInterval = setInterval(() => {
                if (translatingIdsRef.current.has(sentenceId)) {
                  document.querySelectorAll(`[data-sentence-id="${sentenceId}"]`).forEach((el) => {
                    if (!el.closest('.thumbnail')) {
                      el.classList.add('active-sentence');
                    }
                  });
                }
              }, 50);
              
              try {
                const response = await fetch(`${API_URL}/api/translate`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    text: text,
                    model: translationModel,
                  }),
                });
                
                if (!response.ok) {
                  throw new Error('Ошибка при переводе');
                }
                
                const data = await response.json();
                
                // Сохраняем перевод (это обновит и локальное состояние, и БД)
                await saveTranslation(sentenceId, data.text, translationModel);
                
                translatingIdsRef.current.delete(sentenceId);
                
                // Очищаем интервал
                clearInterval(keepAliveInterval);
                
                isButtonHoveredRef.current = false;
                
                setTimeout(() => {
                  clearHoverState(sentenceId, true);
                }, 150);
                
              } catch (error) {
                console.error('Ошибка перевода:', error);
                alert('Не удалось выполнить перевод');
                translatingIdsRef.current.delete(sentenceId);
                clearInterval(keepAliveInterval);
              } finally {
                setIsTranslating(false);
              }
            }}
          >
            {isTranslating ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Перевод...
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" />
                Перевести
              </>
            )}
          </button>
        </>
        );
      })()}
      </div>
    </div>
  );
}