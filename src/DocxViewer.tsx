import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FileText, ChevronLeft, ChevronRight, Eye, EyeOff, X, Languages, ArrowLeft, MessageCircle, Sparkles, Check } from 'lucide-react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';

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
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.01, rootMargin: '100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

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
  return prevProps.isActive === nextProps.isActive &&
         prevProps.index === nextProps.index;
});

PageThumbnail.displayName = 'PageThumbnail';

export default function DocxViewer({ bookId, bookTitle, onBack }: DocxViewerProps) {
  const { token, username } = useAuth();
  
  const [pages, setPages] = useState<string[]>([]);
  const [originalPages, setOriginalPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showHighlights, setShowHighlights] = useState(true);
  const [translationModel, setTranslationModel] = useState<'claude' | 'chatgpt'>('chatgpt');
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
  
  const translationsRef = useRef<Record<number, Record<string, string>>>({});
  const approvedTranslationsRef = useRef<Set<string>>(new Set());
  const currentPageRef = useRef<number>(0);
  const translationModelRef = useRef<'claude' | 'chatgpt'>('chatgpt');
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [modalSelectedText, setModalSelectedText] = useState('');
  const [modalSelectionStart, setModalSelectionStart] = useState(0);
  const [modalSelectionEnd, setModalSelectionEnd] = useState(0);
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [improvementPrompt, setImprovementPrompt] = useState('');
  const [improvementResult, setImprovementResult] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  
  const BUTTON_OFFSET_X = 10;
  const GUARD_VERTICAL_PADDING = 12;
  const GUARD_EXTRA_WIDTH = 80;

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
          const errorText = await response.text();
          console.error('Backend response error:', response.status, errorText);
          throw new Error(`Ошибка загрузки книги: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[DEBUG] Book data loaded:', { 
          hasPages: !!data.pages, 
          pagesCount: data.pages?.length, 
          hasTranslations: !!data.translations,
          hasVersions: !!data.versions 
        });

        setLoadingProgress(90);
        
        console.log('[DEBUG] Loaded book data:', {
          pages: data.pages?.length,
          translations: Object.keys(data.translations || {}).length,
          translationsData: data.translations,
          versions: data.versions
        });

        if (data.pages && data.pages.length > 0) {
          const translationsMap: Record<number, Record<string, string>> = {};
          const approvedSet = new Set<string>();
          
          if (data.translations) {
            Object.entries(data.translations).forEach(([sentenceId, translation]: [string, any]) => {
              const pageNum = translation.page_number - 1;
              if (!translationsMap[pageNum]) {
                translationsMap[pageNum] = {};
              }
              translationsMap[pageNum][sentenceId] = translation.current_translation;
              
              if (translation.is_approved) {
                approvedSet.add(sentenceId);
              }
            });
          }
          
          // Загружаем историю версий из БД
          const historyMap: Record<string, Array<{text: string, timestamp: number, model?: string}>> = {};
          if (data.versions) {
            console.log('[DEBUG FRONTEND] Versions from API:', data.versions);
            Object.entries(data.versions).forEach(([sentenceId, versions]: [string, any]) => {
              historyMap[sentenceId] = versions;
            });
            console.log('[DEBUG FRONTEND] historyMap created, sentences with history:', Object.keys(historyMap).length);
          } else {
            console.warn('[DEBUG FRONTEND] No versions in API response!');
          }
          
          console.log('[DEBUG] Processed translations:', {
            translationsMap,
            approvedCount: approvedSet.size,
            historyCount: Object.keys(historyMap).length
          });
          
          const pagesWithTranslations = data.pages.map((pageHtml: string, pageIndex: number) => {
            const pageTranslations = translationsMap[pageIndex] || {};
            console.log(`[DEBUG] Page ${pageIndex + 1} has ${Object.keys(pageTranslations).length} translations`);
            
            if (Object.keys(pageTranslations).length === 0) {
              return pageHtml;
            }
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageHtml, 'text/html');
            
            let appliedCount = 0;
            Object.entries(pageTranslations).forEach(([sentenceId, translatedText]) => {
              const element = doc.querySelector(`[data-sentence-id="${sentenceId}"]`);
              if (element && translatedText && typeof translatedText === 'string') {
                console.log(`[DEBUG] Applying translation for ${sentenceId}: "${element.textContent?.substring(0, 30)}" -> "${translatedText.substring(0, 30)}"`);
                element.textContent = translatedText;
                element.classList.add('translated-sentence');
                if (approvedSet.has(sentenceId)) {
                  element.classList.add('approved-sentence');
                }
                appliedCount++;
              } else {
                if (!element) {
                  console.warn(`[DEBUG] Element not found for sentence ${sentenceId}`);
                } else if (!translatedText) {
                  console.warn(`[DEBUG] No translation text for sentence ${sentenceId}`);
                } else {
                  console.warn(`[DEBUG] Invalid translation type for sentence ${sentenceId}:`, typeof translatedText);
                }
              }
            });
            
            console.log(`[DEBUG] Applied ${appliedCount} translations to page ${pageIndex + 1}`);
            return doc.body.innerHTML;
          });
          
          const originalPagesWithHighlight = data.pages.map((pageHtml: string, pageIndex: number) => {
            const pageTranslations = translationsMap[pageIndex] || {};
            
            if (Object.keys(pageTranslations).length === 0) {
              return pageHtml;
            }
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageHtml, 'text/html');
            
            Object.keys(pageTranslations).forEach((sentenceId) => {
              const element = doc.querySelector(`[data-sentence-id="${sentenceId}"]`);
              if (element) {
                element.classList.add('translated-sentence');
                if (approvedSet.has(sentenceId)) {
                  element.classList.add('approved-sentence');
                }
              }
            });
            
            return doc.body.innerHTML;
          });
          
          setOriginalPages(originalPagesWithHighlight);
          setPages(pagesWithTranslations);
          setTranslations(translationsMap);
          setApprovedTranslations(approvedSet);
          setTranslationHistory(historyMap);
          setCurrentPage(0);
        } else {
          throw new Error('Книга не содержит страниц');
        }

        setLoadingProgress(100);
      } catch (error: any) {
        console.error('Ошибка загрузки книги:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error, null, 2));
        const errorMsg = error.message || error.toString() || 'Не удалось загрузить книгу';
        setError(errorMsg);
        alert(`Ошибка загрузки книги: ${errorMsg}`);
      } finally {
        setLoading(false);
        setTimeout(() => setLoadingProgress(0), 500);
      }
    };

    loadBook();
  }, [bookId, token]);

  const addToHistory = useCallback((sentenceId: string, text: string, model?: string) => {
    setTranslationHistory(prev => {
      const newHistory = {
        ...prev,
        [sentenceId]: [
          ...(prev[sentenceId] || []),
          { text, timestamp: Date.now(), model }
        ]
      };
      return newHistory;
    });
  }, []);

  const saveTranslation = useCallback(async (sentenceId: string, text: string, model?: string) => {
    setTranslations(prev => ({
      ...prev,
      [currentPage]: {
        ...(prev[currentPage] || {}),
        [sentenceId]: text,
      },
    }));
    addToHistory(sentenceId, text, model);
    
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
    
    setOriginalPages(prevPages => {
      const updatedPages = [...prevPages];
      const pageHtml = updatedPages[currentPage];
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(pageHtml, 'text/html');
      const element = doc.querySelector(`[data-sentence-id="${sentenceId}"]`);
      
      if (element) {
        if (!element.classList.contains('translated-sentence')) {
          element.classList.add('translated-sentence');
        }
        updatedPages[currentPage] = doc.body.innerHTML;
      }
      
      return updatedPages;
    });

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
      }
    }
  }, [currentPage, bookId, token, translationModel, addToHistory]);

  const approveTranslation = useCallback(async (sentenceId: string) => {
    setApprovedTranslations(prev => new Set([...prev, sentenceId]));
    
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
    
    setOriginalPages(prevPages => {
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

  const startEditing = useCallback((sentenceId: string) => {
    setEditingSentenceId(sentenceId);
  }, []);

  const openDetailsModal = useCallback((sentenceId: string, selectedText: string, selStart: number, selEnd: number) => {
    setSelectedSentenceId(sentenceId);
    setModalSelectedText(selectedText);
    setModalSelectionStart(selStart);
    setModalSelectionEnd(selEnd);
    setExplanation('');
    setImprovementPrompt('');
    setImprovementResult('');
    setDetailsModalOpen(true);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setDetailsModalOpen(false);
    setModalSelectedText('');
    setExplanation('');
    setImprovementPrompt('');
    setImprovementResult('');
    
    // Проверяем, существует ли inline редактор после закрытия модального окна
    setTimeout(() => {
      const textarea = document.querySelector('.inline-editor-textarea') as HTMLTextAreaElement;
      if (textarea) {
        // Если редактор найден, восстанавливаем фокус
        textarea.focus();
      } else {
        // Если редактор закрылся, сбрасываем состояние
        setEditingSentenceId(null);
      }
    }, 100);
  }, []);

  const openHistoryModal = useCallback((sentenceId: string) => {
    setSelectedSentenceId(sentenceId);
    setHistoryModalOpen(true);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setHistoryModalOpen(false);
    
    // Проверяем, существует ли inline редактор после закрытия модального окна
    setTimeout(() => {
      const textarea = document.querySelector('.inline-editor-textarea') as HTMLTextAreaElement;
      if (textarea) {
        // Если редактор найден, восстанавливаем фокус
        textarea.focus();
      } else {
        // Если редактор закрылся, сбрасываем состояние
        setEditingSentenceId(null);
      }
    }, 100);
  }, []);

  // Функция для вычисления diff между двумя текстами
  const removeQuotes = useCallback((text: string): string => {
    let result = text.trim();
    // Удаляем кавычки из начала и конца, если они есть
    if ((result.startsWith('"') && result.endsWith('"')) || 
        (result.startsWith("'") && result.endsWith("'"))) {
      result = result.slice(1, -1).trim();
    }
    return result;
  }, []);

  const computeDiff = useCallback((oldText: string, newText: string) => {
    const oldWords = oldText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);
    
    const result: Array<{type: 'added' | 'removed' | 'unchanged', text: string}> = [];
    
    let i = 0, j = 0;
    while (i < oldWords.length || j < newWords.length) {
      if (i >= oldWords.length) {
        // Остались только новые слова
        result.push({type: 'added', text: newWords[j]});
        j++;
      } else if (j >= newWords.length) {
        // Остались только старые слова
        result.push({type: 'removed', text: oldWords[i]});
        i++;
      } else if (oldWords[i] === newWords[j]) {
        // Слова совпадают
        result.push({type: 'unchanged', text: oldWords[i]});
        i++;
        j++;
      } else {
        // Слова различаются - ищем совпадения дальше
        let foundMatch = false;
        
        // Проверяем, есть ли текущее старое слово в следующих новых словах
        for (let k = j + 1; k < Math.min(j + 5, newWords.length); k++) {
          if (oldWords[i] === newWords[k]) {
            // Нашли совпадение - значит слова между j и k были добавлены
            for (let l = j; l < k; l++) {
              result.push({type: 'added', text: newWords[l]});
            }
            j = k;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          // Проверяем, есть ли текущее новое слово в следующих старых словах
          for (let k = i + 1; k < Math.min(i + 5, oldWords.length); k++) {
            if (oldWords[k] === newWords[j]) {
              // Нашли совпадение - значит слова между i и k были удалены
              for (let l = i; l < k; l++) {
                result.push({type: 'removed', text: oldWords[l]});
              }
              i = k;
              foundMatch = true;
              break;
            }
          }
        }
        
        if (!foundMatch) {
          // Не нашли совпадений - считаем что слово было заменено
          result.push({type: 'removed', text: oldWords[i]});
          result.push({type: 'added', text: newWords[j]});
          i++;
          j++;
        }
      }
    }
    
    return result;
  }, []);

  const explainTranslation = useCallback(async () => {
    if (!selectedSentenceId || !modalSelectedText) return;
    
    const originalElement = document.querySelector(`.original-column [data-sentence-id="${selectedSentenceId}"]`);
    const originalText = originalElement?.textContent || '';
    const translatedText = modalSelectedText;
    
    const apiEndpoint = translationModel === 'claude' ? '/api/claude' : '/api/chatgpt';
    const modelName = translationModel === 'claude' ? 'claude-sonnet-4-5-20250929' : 'gpt-4';
    
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
      setExplanation(removeQuotes(data.message));
    } catch (error) {
      console.error('Ошибка объяснения:', error);
      alert('Не удалось получить объяснение');
    } finally {
      setIsExplaining(false);
    }
  }, [selectedSentenceId, modalSelectedText, translationModel]);

  const improveTranslation = useCallback(async () => {
    if (!selectedSentenceId || !improvementPrompt.trim() || !modalSelectedText) return;
    
    // Получаем полный текст перевода из textarea
    const textarea = document.querySelector('.inline-editor-textarea') as HTMLTextAreaElement;
    const fullTranslation = textarea?.value || translationsRef.current[currentPageRef.current]?.[selectedSentenceId] || '';
    
    // Получаем оригинальное предложение
    const originalSentenceElement = document.querySelector(`.original-column [data-sentence-id="${selectedSentenceId}"]`);
    const originalSentenceText = originalSentenceElement?.textContent || '';
    
    // Получаем оригинальный абзац (контекст)
    const originalParagraph = originalSentenceElement?.closest('p, h1, h2, h3, h4, h5, h6, li');
    let originalParagraphText = '';
    if (originalParagraph) {
      // Извлекаем весь текст абзаца без HTML тегов
      originalParagraphText = originalParagraph.textContent || '';
    }
    
    // Определяем: выделено всё предложение или только фрагмент
    const isFullSentenceSelected = modalSelectedText.trim() === fullTranslation.trim();
    
    const apiEndpoint = translationModel === 'claude' ? '/api/claude' : '/api/chatgpt';
    const modelName = translationModel === 'claude' ? 'claude-sonnet-4-5-20250929' : 'gpt-4';
    
    let promptMessage = '';
    
    if (isFullSentenceSelected) {
      // Выделено полное предложение - используем оригинальное предложение и контекст абзаца
      promptMessage = `Улучши перевод предложения согласно запросу:\n\nКонтекст абзаца (English): "${originalParagraphText}"\n\nОригинальное предложение (English): "${originalSentenceText}"\nТекущий перевод предложения (Kazakh): "${modalSelectedText}"\n\nЗапрос на улучшение: ${improvementPrompt}\n\nПредоставь от 1 до 5 улучшенных вариантов перевода ВСЕГО предложения на казахском языке, учитывая контекст абзаца. Каждый вариант начинай с новой строки с номером (1., 2., и т.д.). Никаких объяснений, только варианты переводов.`;
    } else {
      // Выделен фрагмент - используем только контекст абзаца
      promptMessage = `Улучши перевод выделенного фрагмента согласно запросу:\n\nКонтекст абзаца (English): "${originalParagraphText}"\n\nПолный текущий перевод предложения (Kazakh): "${fullTranslation}"\nВыделенный фрагмент для улучшения (Kazakh): "${modalSelectedText}"\n\nЗапрос на улучшение: ${improvementPrompt}\n\nПредоставь от 1 до 5 улучшенных вариантов ТОЛЬКО для выделенного фрагмента на казахском языке, которые будут хорошо вписываться в контекст предложения и абзаца. Каждый вариант начинай с новой строки с номером (1., 2., и т.д.). Никаких объяснений, только варианты переводов фрагмента.`;
    }
    
    setIsImproving(true);
    try {
      const response = await fetch(`${API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptMessage,
          model: modelName,
          temperature: 0.8
        })
      });
      
      if (!response.ok) throw new Error('Ошибка API');
      const data = await response.json();
      setImprovementResult(removeQuotes(data.message));
    } catch (error) {
      console.error('Ошибка улучшения:', error);
      alert('Не удалось получить улучшенный вариант');
    } finally {
      setIsImproving(false);
    }
  }, [selectedSentenceId, modalSelectedText, modalSelectionStart, modalSelectionEnd, improvementPrompt, translationModel]);



  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    setEditingSentenceId(null);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const originalPageHTML = useMemo(() => {
    if (originalPages.length === 0) return '';
    return originalPages[currentPage];
  }, [originalPages, currentPage]);
  
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
      if (sentenceId && translatingIdsRef.current.has(sentenceId)) {
        return;
      }
      
      if (isButtonHoveredRef.current) {
        return;
      }
      
      currentActiveSentenceRef.current = null;
      setHoveredSentenceId(null);
      setButtonPosition(null);
      setHoveredSentenceRect(null);
      
      requestAnimationFrame(() => {
        document.querySelectorAll('.sentence.active-sentence').forEach((el) => {
          const elId = el.getAttribute('data-sentence-id');
          if (el.closest('.thumbnail') || 
              (elId && translatingIdsRef.current.has(elId)) ||
              el.querySelector('.inline-editor-container')) {
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
      
      if (target?.closest('.inline-editor-container') || 
          target?.closest('.translate-guard') ||
          target?.closest('.translate-button') ||
          target?.closest('[class*="animate-slideInRight"]')) {
        return;
      }
      
      const sentence = target?.closest?.('.sentence') as HTMLElement | null;
      
      if (sentence?.closest('.thumbnail')) {
        return;
      }
      
      if (sentence) {
        const id = sentence.getAttribute('data-sentence-id');
        if (id && translations[currentPage]?.[id]) {
          if (editingSentenceId === id) return;
          startEditing(id);
        }
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      
      if (editingSentenceId) {
        return;
      }
      
      if (target?.closest('.inline-editor-container') || 
          target?.closest('[class*="animate-slideInRight"]')) {
        return;
      }
      
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
          
          const hasTranslation = translations[currentPage]?.[id];
          
          if (!isInTranslationColumn && !hasTranslation) {
            setButtonPosition({ x: rect.right + BUTTON_OFFSET_X, y: rect.top });
          } else {
            setButtonPosition(null);
          }
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = (e.relatedTarget as HTMLElement) || null;
      
      if (editingSentenceId) {
        return;
      }
      
      if (related?.closest('.translate-button') || 
          related?.closest('.details-button') || 
          related?.closest('.translate-guard') ||
          related?.closest('.inline-editor-container') ||
          related?.closest('[class*="animate-slideInRight"]')) {
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
  }, [pages, currentPage, translatedPageHTML, BUTTON_OFFSET_X, clearHoverState, hoveredSentenceId, translations, startEditing, editingSentenceId]);

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

  useEffect(() => {
    translationsRef.current = translations;
    approvedTranslationsRef.current = approvedTranslations;
    currentPageRef.current = currentPage;
    translationModelRef.current = translationModel;
  }, [translations, approvedTranslations, currentPage, translationModel]);

  useEffect(() => {
    if (!editingSentenceId) return;
    
    const sentenceElements = document.querySelectorAll(`[data-sentence-id="${editingSentenceId}"]`);
    if (sentenceElements.length === 0) return;
    
    const targetElement = Array.from(sentenceElements).find((el) => 
      el.closest('.translation-column') && !el.closest('.thumbnail')
    ) as HTMLElement | undefined;
    
    if (!targetElement || !targetElement.parentElement) return;
    
    if (targetElement.querySelector('.inline-editor-container')) {
      return;
    }
    
    const isApproved = approvedTranslationsRef.current.has(editingSentenceId);
    const initialText = translationsRef.current[currentPageRef.current]?.[editingSentenceId] || '';
    
    const editorContainer = document.createElement('div');
    editorContainer.className = 'inline-editor-container';
    editorContainer.setAttribute('data-editing-sentence', editingSentenceId);
    editorContainer.innerHTML = `
      <div class="inline-editor-textarea-wrapper">
        <textarea class="inline-editor-textarea" spellcheck="false">${initialText}</textarea>
      </div>
      <div class="inline-editor-tools">
        <button class="inline-editor-btn-tool inline-editor-btn-gpt" disabled title="Re-перевод выделенного текста через GPT">
          <svg class="w-3.5 h-3.5" viewBox="0 0 41 41" fill="none">
            <path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.8123 35.6322 8.76321 36.5013C10.7141 37.3704 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.4946 40.4998C24.6307 40.5054 26.7133 39.8321 28.4418 38.5772C30.1704 37.3223 31.4556 35.5506 32.1119 33.5179C33.5027 33.2332 34.8167 32.6547 35.9659 31.821C37.115 30.9874 38.0728 29.9178 38.7752 28.684C39.8458 26.8371 40.3023 24.6979 40.0789 22.5748C39.8556 20.4517 38.9639 18.4544 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9842 21.0707 29.9867 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.66048 26.0818 5.73461 26.1244L13.699 30.7248C13.8975 30.8408 14.1233 30.902 14.3532 30.902C14.583 30.902 14.8088 30.8408 15.0073 30.7248L24.731 25.1103V28.9979C24.7321 29.0177 24.7283 29.0376 24.7199 29.0556C24.7115 29.0736 24.6988 29.0893 24.6829 29.1012L16.6317 33.7497C14.9096 34.7416 12.8643 35.0097 10.9447 34.4954C9.02506 33.9811 7.38785 32.7263 6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19491 10.5228 8.19491 10.6071V19.808C8.19351 20.0378 8.25334 20.2638 8.36823 20.4629C8.48312 20.6619 8.64893 20.8267 8.84863 20.9404L18.5723 26.5542L15.206 28.4979C15.1894 28.5089 15.1703 28.5155 15.1505 28.5173C15.1307 28.5191 15.1107 28.516 15.0924 28.5082L7.04046 23.8557C5.32135 22.8601 4.06716 21.2235 3.55289 19.3046C3.03862 17.3858 3.30624 15.3413 4.29707 13.6194ZM31.955 20.0556L22.2312 14.4411L25.5976 12.4981C25.6142 12.4872 25.6333 12.4805 25.6531 12.4787C25.6729 12.4769 25.6928 12.4801 25.7111 12.4879L33.7631 17.1364C34.9967 17.849 36.0017 18.8982 36.6606 20.1613C37.3194 21.4244 37.6047 22.849 37.4832 24.2684C37.3617 25.6878 36.8382 27.0432 35.9743 28.1759C35.1103 29.3086 33.9415 30.1717 32.6047 30.6641C32.6047 30.5947 32.6047 30.4733 32.6047 30.3889V21.188C32.6066 20.9586 32.5474 20.7328 32.4332 20.5338C32.319 20.3348 32.154 20.1698 31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.069 14.8717L27.1045 10.2712C26.906 10.1554 26.6803 10.0943 26.4504 10.0943C26.2206 10.0943 25.9948 10.1554 25.7963 10.2712L16.0726 15.8858V11.9982C16.0715 11.9783 16.0753 11.9585 16.0837 11.9405C16.0921 11.9225 16.1048 11.9068 16.1207 11.8949L24.1719 7.25025C25.4053 6.53903 26.8158 6.19376 28.2383 6.25482C29.6608 6.31589 31.0364 6.78077 32.2044 7.59508C33.3723 8.40939 34.2842 9.53945 34.8334 10.8531C35.3826 12.1667 35.5464 13.6095 35.3055 15.0128ZM14.2424 21.9419L10.8752 19.9981C10.8576 19.9893 10.8423 19.9763 10.8309 19.9602C10.8195 19.9441 10.8122 19.9254 10.8098 19.9058V10.6071C10.8107 9.18295 11.2173 7.78848 11.9819 6.58696C12.7466 5.38544 13.8377 4.42659 15.1275 3.82264C16.4173 3.21869 17.8524 2.99464 19.2649 3.1767C20.6775 3.35876 22.0089 3.93941 23.1034 4.85067C23.0427 4.88379 22.937 4.94215 22.8668 4.98473L14.9024 9.58517C14.7025 9.69878 14.5366 9.86356 14.4215 10.0626C14.3065 10.2616 14.2466 10.4877 14.2479 10.7175L14.2424 21.9419ZM16.071 17.9991L20.4018 15.4978L24.7325 17.9975V22.9985L20.4018 25.4983L16.071 22.9985V17.9991Z" fill="currentColor"/>
          </svg>
          ChatGPT
        </button>
        <button class="inline-editor-btn-tool inline-editor-btn-claude" disabled title="Re-перевод выделенного текста через Claude">
          <svg class="w-3.5 h-3.5" viewBox="0 0 100 100" fill="none">
            <g transform="translate(50, 50)">
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(0)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(30)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(60)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(90)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(120)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(150)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(180)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(210)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(240)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(270)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(300)"/>
              <rect x="-3" y="-40" width="6" height="25" rx="3" fill="currentColor" transform="rotate(330)"/>
              <circle cx="0" cy="0" r="12" fill="currentColor"/>
            </g>
          </svg>
          Claude
        </button>
        <button class="inline-editor-btn-tool inline-editor-btn-details" disabled title="Детали выделенного текста (выделите текст)">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Детали
        </button>
        <button class="inline-editor-btn-tool inline-editor-btn-history" title="История переводов">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          История
        </button>
        <div class="inline-editor-tools-divider"></div>
        <button class="inline-editor-btn inline-editor-btn-save" title="Сохранить изменения">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
          </svg>
          Сохранить
        </button>
        <button class="inline-editor-btn inline-editor-btn-approve ${isApproved ? 'approved' : ''}" title="${isApproved ? 'Перевод утверждён' : 'Утвердить перевод'}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          ${isApproved ? 'Утверждено' : 'Утвердить'}
        </button>
      </div>
    `;
    
    const originalContent = targetElement.innerHTML;
    targetElement.innerHTML = '';
    targetElement.appendChild(editorContainer);
    
    const textarea = editorContainer.querySelector('.inline-editor-textarea') as HTMLTextAreaElement;
    const gptBtn = editorContainer.querySelector('.inline-editor-btn-gpt') as HTMLButtonElement;
    const claudeBtn = editorContainer.querySelector('.inline-editor-btn-claude') as HTMLButtonElement;
    const detailsBtn = editorContainer.querySelector('.inline-editor-btn-details') as HTMLButtonElement;
    const historyBtn = editorContainer.querySelector('.inline-editor-btn-history') as HTMLButtonElement;
    const saveBtn = editorContainer.querySelector('.inline-editor-btn-save') as HTMLButtonElement;
    const approveBtn = editorContainer.querySelector('.inline-editor-btn-approve') as HTMLButtonElement;
    
    // Локальная переменная для выделенного текста
    let currentSelectedText = '';
    let selectionStart = 0;
    let selectionEnd = 0;
    
    const handleInput = (e: Event) => {
      e.stopPropagation();
      const target = e.target as HTMLTextAreaElement;
      target.style.height = 'auto';
      target.style.height = target.scrollHeight + 'px';
    };
    
    const handleSelection = () => {
      if (!textarea) return;
      
      setTimeout(() => {
        if (!textarea) return;
        selectionStart = textarea.selectionStart;
        selectionEnd = textarea.selectionEnd;
        const text = textarea.value.substring(selectionStart, selectionEnd);
        currentSelectedText = text;
        
        // Активируем/деактивируем кнопки в зависимости от наличия выделенного текста
        const hasSelection = text.trim().length > 0;
        if (gptBtn) gptBtn.disabled = !hasSelection;
        if (claudeBtn) claudeBtn.disabled = !hasSelection;
        if (detailsBtn) detailsBtn.disabled = !hasSelection;
      }, 10);
    };
    
    const preventClose = (e: Event) => {
      e.stopPropagation();
    };
    
    if (textarea) {
      textarea.focus();
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
      textarea.addEventListener('input', handleInput);
      textarea.addEventListener('mouseup', handleSelection);
      textarea.addEventListener('keyup', handleSelection);
      textarea.addEventListener('click', preventClose);
    }
    
    const handleSave = async () => {
      if (!textarea) return;
      const text = textarea.value.trim();
      if (!text) return;
      await saveTranslation(editingSentenceId, text, translationModelRef.current);
      setEditingSentenceId(null);
    };
    
    const handleApprove = async () => {
      const currentlyApproved = approvedTranslationsRef.current.has(editingSentenceId);
      if (currentlyApproved) return;
      if (!textarea) return;
      const text = textarea.value.trim();
      if (text) {
        await saveTranslation(editingSentenceId, text, translationModelRef.current);
      }
      await approveTranslation(editingSentenceId);
      setEditingSentenceId(null);
    };
    
    const handleCancel = () => {
      setEditingSentenceId(null);
    };
    
    const handleRetranslate = async (model: 'gpt' | 'claude') => {
      if (!currentSelectedText || !textarea) return;
      
      // Добавляем волновую анимацию
      const textareaWrapper = textarea.closest('.inline-editor-textarea-wrapper');
      const overlay = document.createElement('div');
      overlay.className = 'retranslating-overlay';
      if (textareaWrapper) {
        textareaWrapper.appendChild(overlay);
      }
      textarea.classList.add('retranslating');
      
      // Деактивируем кнопки во время перевода
      if (gptBtn) gptBtn.disabled = true;
      if (claudeBtn) claudeBtn.disabled = true;
      
      try {
        // Получаем оригинальное предложение и абзац
        const originalSentenceElement = document.querySelector(`.original-column [data-sentence-id="${editingSentenceId}"]`);
        const originalSentenceText = originalSentenceElement?.textContent || '';
        
        const originalParagraph = originalSentenceElement?.closest('p, h1, h2, h3, h4, h5, h6, li');
        const originalParagraphText = originalParagraph?.textContent || '';
        
        // Определяем: выделено всё предложение или только фрагмент
        const fullTranslation = textarea.value;
        const isFullSentenceSelected = currentSelectedText.trim() === fullTranslation.trim();
        
        const apiEndpoint = model === 'claude' ? '/api/claude' : '/api/chatgpt';
        const modelName = model === 'claude' ? 'claude-sonnet-4-5-20250929' : 'gpt-4';
        
        let promptMessage = '';
        
        if (isFullSentenceSelected) {
          // Выделено полное предложение - переводим с учётом оригинального предложения и контекста
          promptMessage = `Переведи предложение с английского на казахский язык, учитывая контекст абзаца:\n\nКонтекст абзаца (English): "${originalParagraphText}"\n\nПредложение для перевода (English): "${originalSentenceText}"\n\nПредоставь ТОЛЬКО перевод на казахском языке без дополнительных объяснений.`;
        } else {
          // Выделен фрагмент - переводим только фрагмент с учётом контекста абзаца
          promptMessage = `Переведи выделенный фрагмент с английского на казахский язык:\n\nКонтекст абзаца (English): "${originalParagraphText}"\n\nТекущий полный перевод предложения (Kazakh): "${fullTranslation}"\nФрагмент текущего перевода для замены (Kazakh): "${currentSelectedText}"\n\nПереведи ТОЛЬКО этот фрагмент заново, чтобы он хорошо вписывался в контекст. Предоставь только перевод фрагмента без объяснений.`;
        }
        
        const response = await fetch(`${API_URL}${apiEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: promptMessage,
            model: modelName,
            temperature: 0.7
          })
        });
        
        if (!response.ok) throw new Error('\u041e\u0448\u0438\u0431\u043a\u0430 API');
        const data = await response.json();
        
        // \u0417\u0430\u043c\u0435\u043d\u044f\u0435\u043c \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0439 \u0442\u0435\u043a\u0441\u0442 \u0432 textarea
        const cleanedMessage = removeQuotes(data.message);
        const newValue = textarea.value.substring(0, selectionStart) + cleanedMessage + textarea.value.substring(selectionEnd);
        textarea.value = newValue;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        
        // \u0423\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u043c \u043a\u0443\u0440\u0441\u043e\u0440 \u0432 \u043a\u043e\u043d\u0435\u0446 \u0432\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u043d\u043e\u0433\u043e \u0442\u0435\u043a\u0441\u0442\u0430
        const newCursorPos = selectionStart + data.message.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
        
        // \u0421\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u043c \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0438 \u0434\u0435\u0430\u043a\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u043c \u043a\u043d\u043e\u043f\u043a\u0438
        currentSelectedText = '';
        if (gptBtn) gptBtn.disabled = true;
        if (claudeBtn) claudeBtn.disabled = true;
      } catch (error) {
        console.error('\u041e\u0448\u0438\u0431\u043a\u0430 re-\u043f\u0435\u0440\u0435\u0432\u043e\u0434\u0430:', error);
        alert('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c re-\u043f\u0435\u0440\u0435\u0432\u043e\u0434');
      } finally {
        // Удаляем волновую анимацию
        textarea.classList.remove('retranslating');
        if (overlay && overlay.parentElement) {
          overlay.remove();
        }
      }
    };
    
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const isInsideEditor = editorContainer.contains(target);
      const isInsideDetailsPanel = target.closest('[class*="animate-slideInRight"]');
      const isTextarea = target.tagName === 'TEXTAREA' && target.closest('.inline-editor-container');
      const isInsideModal = target.closest('.fixed.inset-0') || target.closest('[role="dialog"]');
      
      if (isInsideEditor || isInsideDetailsPanel || isTextarea || isInsideModal) {
        return;
      }
      
      const clickedSentence = target.closest('.sentence');
      if (clickedSentence) {
        const sentenceId = clickedSentence.getAttribute('data-sentence-id');
        if (sentenceId === editingSentenceId) {
          return;
        }
      }
      
      handleCancel();
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    
    const handleGptClick = (e: Event) => {
      e.stopPropagation();
      handleRetranslate('gpt');
    };
    
    const handleClaudeClick = (e: Event) => {
      e.stopPropagation();
      handleRetranslate('claude');
    };
    
    const handleDetailsClick = (e: Event) => {
      e.stopPropagation();
      openDetailsModal(editingSentenceId, currentSelectedText, selectionStart, selectionEnd);
    };
    
    const handleHistoryClick = (e: Event) => {
      e.stopPropagation();
      openHistoryModal(editingSentenceId);
    };
    
    const handleSaveClick = (e: Event) => {
      e.stopPropagation();
      handleSave();
    };
    
    const handleApproveClick = (e: Event) => {
      e.stopPropagation();
      handleApprove();
    };
    
    if (gptBtn) {
      gptBtn.addEventListener('click', handleGptClick);
    }
    
    if (claudeBtn) {
      claudeBtn.addEventListener('click', handleClaudeClick);
    }
    
    if (detailsBtn) {
      detailsBtn.addEventListener('click', handleDetailsClick);
    }
    
    if (historyBtn) {
      historyBtn.addEventListener('click', handleHistoryClick);
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveClick);
    }
    
    if (approveBtn && !isApproved) {
      approveBtn.addEventListener('click', handleApproveClick);
    }
    
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
    
    editorContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    return () => {
      if (textarea) {
        textarea.removeEventListener('input', handleInput);
        textarea.removeEventListener('mouseup', handleSelection);
        textarea.removeEventListener('keyup', handleSelection);
        textarea.removeEventListener('click', preventClose);
      }
      if (gptBtn) {
        gptBtn.removeEventListener('click', handleGptClick);
      }
      if (claudeBtn) {
        claudeBtn.removeEventListener('click', handleClaudeClick);
      }
      if (detailsBtn) {
        detailsBtn.removeEventListener('click', handleDetailsClick);
      }
      if (historyBtn) {
        historyBtn.removeEventListener('click', handleHistoryClick);
      }
      if (saveBtn) {
        saveBtn.removeEventListener('click', handleSaveClick);
      }
      if (approveBtn && !isApproved) {
        approveBtn.removeEventListener('click', handleApproveClick);
      }
      
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
      
      if (targetElement && targetElement.parentElement) {
        const editors = targetElement.querySelectorAll('.inline-editor-container');
        editors.forEach(editor => editor.remove());
        
        if (targetElement.innerHTML !== originalContent) {
          targetElement.innerHTML = originalContent;
        }
      }
    };
  }, [editingSentenceId, saveTranslation, approveTranslation, openDetailsModal, openHistoryModal]);

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
        
        .inline-editor-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 2px solid #7c3aed;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
          animation: fadeInScale 0.2s ease-out;
        }
        
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .inline-editor-textarea {
          width: 100%;
          min-height: 80px;
          padding: 10px 12px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.5;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          resize: none;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        .inline-editor-textarea::selection {
          background: #a78bfa;
          color: white;
        }
        
        .inline-editor-textarea::-moz-selection {
          background: #a78bfa;
          color: white;
        }
        
        .inline-editor-textarea:focus {
          outline: none;
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        
        .inline-editor-textarea-wrapper {
          position: relative;
        }
        
        .retranslating-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          border-radius: 8px;
          overflow: hidden;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(124, 58, 237, 0.15) 25%,
            rgba(167, 139, 250, 0.25) 50%,
            rgba(124, 58, 237, 0.15) 75%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: waveTranslation 2s ease-in-out infinite;
          z-index: 1;
        }
        
        @keyframes waveTranslation {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        
        .inline-editor-textarea.retranslating {
          position: relative;
          background: rgba(248, 250, 252, 0.8);
        }
        
        .inline-editor-tools {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        
        .inline-editor-btn-tool {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          border: 1px solid #cbd5e1;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
          color: #475569;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .inline-editor-btn-tool:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .inline-editor-btn-tool:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .inline-editor-btn-tool:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: #f1f5f9;
          color: #94a3b8;
        }
        
        .inline-editor-btn-tool svg {
          flex-shrink: 0;
        }
        
        .inline-editor-btn-gpt {
          background: white;
          border-color: #e5e7eb;
          color: #374151;
        }
        
        .inline-editor-btn-gpt:hover:not(:disabled) {
          background: white;
          border-color: #d1d5db;
          color: #1f2937;
        }
        
        .inline-editor-btn-gpt:disabled {
          background: #f9fafb;
          border-color: #e5e7eb;
          color: #9ca3af;
        }
        
        .inline-editor-btn-claude {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          border-color: #f97316;
          color: white;
        }
        
        .inline-editor-btn-claude:hover:not(:disabled) {
          background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
          border-color: #ea580c;
          color: white;
        }
        
        .inline-editor-btn-claude:disabled {
          background: linear-gradient(135deg, #fdba74 0%, #fb923c 100%);
          border-color: #fdba74;
          color: white;
          opacity: 0.5;
        }
        
        .inline-editor-tools-divider {
          width: 1px;
          height: 24px;
          background: #cbd5e1;
          margin: 0 8px 0 auto;
        }
        
        .inline-editor-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          white-space: nowrap;
        }
        
        .inline-editor-btn svg {
          flex-shrink: 0;
        }
        
        .inline-editor-btn-save {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          color: white;
        }
        
        .inline-editor-btn-save:hover {
          background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(124, 58, 237, 0.4);
        }
        
        .inline-editor-btn-save:active {
          transform: translateY(0);
        }
        
        .inline-editor-btn-approve {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .inline-editor-btn-approve:hover:not(.approved) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
        }
        
        .inline-editor-btn-approve:active:not(.approved) {
          transform: translateY(0);
        }
        
        .inline-editor-btn-approve.approved {
          background: linear-gradient(135deg, #86efac 0%, #6ee7b7 100%);
          color: #065f46;
          cursor: not-allowed;
          opacity: 0.8;
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

        .diff-added {
          background-color: #dcfce7;
          color: #166534;
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: 500;
        }
        
        .diff-removed {
          background-color: #fee2e2;
          color: #991b1b;
          text-decoration: line-through;
          padding: 2px 4px;
          border-radius: 3px;
          opacity: 0.8;
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
              onChange={(e) => setTranslationModel(e.target.value as 'claude' | 'chatgpt')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors cursor-pointer"
            >
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
                sidebarOpen ? 'left-[152px]' : 'left-0'
              }`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Скрыть панель' : 'Показать страницы'}
              style={{
                willChange: 'left'
              }}
            >
              <div className="relative">
                <div className={`relative bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 shadow-xl w-6 h-12 flex items-center justify-center transition-all hover:scale-105 border-2 border-purple-400 ${
                  sidebarOpen ? 'rounded-r-lg border-l-0' : 'rounded-r-lg border-l-0'
                }`}>
                  <div className="text-white">
                    {sidebarOpen ? (
                      <ChevronLeft className="w-5 h-5 stroke-[3]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 stroke-[3]" />
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

        {hoveredSentenceId && buttonPosition && hoveredSentenceRect && (() => {
        const hasTranslation = translations[currentPage]?.[hoveredSentenceId];
        
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
              
              translatingIdsRef.current.add(sentenceId);
              
              const sentence = document.querySelector(`[data-sentence-id="${sentenceId}"]`);
              if (!sentence) {
                translatingIdsRef.current.delete(sentenceId);
                return;
              }
              
              const text = sentence.textContent || '';
              
              requestAnimationFrame(() => {
                document.querySelectorAll(`[data-sentence-id="${sentenceId}"]`).forEach((el) => {
                  if (!el.closest('.thumbnail')) {
                    el.classList.add('active-sentence');
                  }
                });
              });
              
              setIsTranslating(true);
              
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
                
                await saveTranslation(sentenceId, data.text, translationModel);
                
                translatingIdsRef.current.delete(sentenceId);
                
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



        {/* Модальное окно деталей */}
        {detailsModalOpen && selectedSentenceId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] animate-fadeIn" onClick={closeDetailsModal}>
            <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Детали перевода
                </h2>
                <button 
                  onClick={closeDetailsModal}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-5">
                {modalSelectedText && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Выделенный текст
                    </h3>
                    <p className="text-sm text-blue-900 leading-relaxed font-semibold">{modalSelectedText}</p>
                  </div>
                )}

                <div className="space-y-3">
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
                        placeholder="Например: сделай более формальным, используй разговорный стиль, упрости..."
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all resize-none"
                        rows={3}
                        spellCheck={false}
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
                      const variants = improvementResult
                        .split(/\n(?=\d+\.)/)
                        .map(v => v.trim())
                        .filter(v => v.length > 0)
                        .map(v => removeQuotes(v.replace(/^\d+\.\s*/, '')));
                      
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
                                onClick={async () => {
                                  // Сначала закрываем модальное окно для быстрого отклика UI
                                  setImprovementResult('');
                                  setImprovementPrompt('');
                                  closeDetailsModal();
                                  
                                  // Затем выполняем обновление в фоне
                                  const editorContainer = document.querySelector(`[data-editing-sentence="${selectedSentenceId}"]`);
                                  const textarea = editorContainer?.querySelector('.inline-editor-textarea') as HTMLTextAreaElement;
                                  
                                  if (!textarea) {
                                    // Если textarea не найдена, обновляем перевод напрямую
                                    const currentTranslation = translationsRef.current[currentPageRef.current]?.[selectedSentenceId] || '';
                                    const newText = currentTranslation.substring(0, modalSelectionStart) + variant + currentTranslation.substring(modalSelectionEnd);
                                    
                                    await saveTranslation(selectedSentenceId, newText, translationModel);
                                    return;
                                  }
                                  
                                  // Заменяем только выделенную часть текста
                                  const fullText = textarea.value;
                                  const newText = fullText.substring(0, modalSelectionStart) + variant + fullText.substring(modalSelectionEnd);
                                  
                                  // Обновляем textarea
                                  textarea.value = newText;
                                  textarea.style.height = 'auto';
                                  textarea.style.height = textarea.scrollHeight + 'px';
                                  
                                  // Создаем и диспатчим событие input для обновления
                                  const inputEvent = new Event('input', { bubbles: true });
                                  textarea.dispatchEvent(inputEvent);
                                  
                                  // Сохраняем обновленный перевод в фоне
                                  await saveTranslation(selectedSentenceId, newText, translationModel);
                                  
                                  // Закрываем inline редактор после применения варианта
                                  setEditingSentenceId(null);
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно истории */}
        {historyModalOpen && selectedSentenceId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] animate-fadeIn" onClick={closeHistoryModal}>
            <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  История переводов
                </h2>
                <button 
                  onClick={closeHistoryModal}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {translationHistory[selectedSentenceId] && translationHistory[selectedSentenceId].length > 0 ? (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Timeline версий
                    </h4>
                    <div className="relative">
                      <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-400 via-indigo-300 to-indigo-200"></div>
                      
                      <div className="space-y-6">
                        {translationHistory[selectedSentenceId].map((item: {text: string, timestamp: number, model?: string}, idx: number) => {
                          const isLatest = idx === translationHistory[selectedSentenceId].length - 1;
                          return (
                            <div key={idx} className="relative pl-8">
                              <div className={`absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-3 border-white shadow-md z-10 ${
                                isLatest 
                                  ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 ring-4 ring-indigo-200' 
                                  : 'bg-gradient-to-br from-indigo-400 to-indigo-500'
                              }`}>
                                {isLatest && (
                                  <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75"></div>
                                )}
                              </div>
                              
                              <div className={`bg-white rounded-lg p-4 shadow-sm border transition-all hover:shadow-md ${
                                isLatest 
                                  ? 'border-indigo-300 ring-1 ring-indigo-200' 
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
                                      <span className="px-2 py-0.5 bg-indigo-500 text-white rounded-full text-xs font-bold">
                                        Текущая
                                      </span>
                                    )}
                                    {item.model && (
                                      <span className="px-2 py-0.5 bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-300">
                                        {item.model}
                                      </span>
                                    )}
                                  </div>
                                  {!isLatest && (
                                    <button
                                      onClick={() => {
                                        saveTranslation(selectedSentenceId, item.text, translationModel);
                                        
                                        const textarea = document.querySelector('.inline-editor-textarea') as HTMLTextAreaElement;
                                        if (textarea) {
                                          textarea.value = item.text;
                                          textarea.style.height = 'auto';
                                          textarea.style.height = textarea.scrollHeight + 'px';
                                        }
                                        
                                        setApprovedTranslations(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(selectedSentenceId);
                                          return newSet;
                                        });
                                      }}
                                      className="flex items-center justify-center w-8 h-8 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all hover:scale-110 border border-indigo-200 hover:border-indigo-300"
                                      title="Восстановить эту версию"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                <div className="text-sm text-gray-900 leading-relaxed">
                                  {idx > 0 ? (
                                    // Показываем diff с предыдущей версией
                                    <>
                                      {(() => {
                                        const previousVersion = translationHistory[selectedSentenceId][idx - 1];
                                        const diff = computeDiff(previousVersion.text, item.text);
                                        
                                        // Проверяем есть ли изменения
                                        const hasChanges = diff.some(part => part.type !== 'unchanged');
                                        
                                        if (!hasChanges) {
                                          // Если нет изменений, показываем обычный текст
                                          return <span>{item.text}</span>;
                                        }
                                        
                                        return diff.map((part, partIdx) => {
                                          if (part.type === 'added') {
                                            return <span key={partIdx} className="diff-added">{part.text}</span>;
                                          } else if (part.type === 'removed') {
                                            return <span key={partIdx} className="diff-removed">{part.text}</span>;
                                          } else {
                                            return <span key={partIdx}>{part.text}</span>;
                                          }
                                        });
                                      })()}
                                    </>
                                  ) : (
                                    // Первая версия - показываем как есть
                                    <span>{item.text}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-xl border border-gray-200 text-center">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600 font-medium">История переводов пока пуста</p>
                    <p className="text-gray-500 text-sm mt-1">Сохраните перевод чтобы начать отслеживать историю</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}