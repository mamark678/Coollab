import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  List,
  RotateCcw,
  Sparkles,
  X,
  Zap,
  BrainCircuit,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { generateFlashcards, type FlashcardDeck } from '../../services/groq';
import './Flashcards.css';

interface FlashcardPanelProps {
  /** The plain-text content of the currently open document */
  documentContent: string;
  /** The title of the currently open document */
  documentTitle: string;
  /** Called when the user closes the panel */
  onClose: () => void;
}

type Difficulty = 'beginner' | 'medium' | 'hard';
type ViewMode = 'card' | 'list' | 'quiz';
type QuestionFormat = 'mcq' | 'tf' | 'typed';

export const FlashcardPanel: React.FC<FlashcardPanelProps> = ({
  documentContent,
  documentTitle,
  onClose,
}) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [reviewedCards, setReviewedCards] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Quiz State
  const [quizState, setQuizState] = useState<'not_started' | 'in_progress' | 'results'>('not_started');
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<any[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [quizStep, setQuizStep] = useState<'question' | 'reveal'>('question');
  const [currentSubmission, setCurrentSubmission] = useState<{userAnswer: string, isCorrect: boolean} | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!documentContent.trim()) {
      setError('No document content available. Please open a document with content first.');
      return;
    }

    setLoading(true);
    setError(null);
    setDeck(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewedCards(new Set());

    try {
      const result = await generateFlashcards(documentContent, difficulty, documentTitle);
      setDeck(result);
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  }, [documentContent, difficulty, documentTitle]);

  const handleReset = useCallback(() => {
    setDeck(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewedCards(new Set());
    setError(null);
    setQuizState('not_started');
    setViewMode('card');
  }, []);

  const startQuiz = useCallback(() => {
    if (!deck) return;
    
    // Shuffle cards
    const shuffledCards = [...deck.cards].sort(() => Math.random() - 0.5);
    
    const questions = shuffledCards.map(card => {
      const formats: QuestionFormat[] = ['mcq', 'tf', 'typed'];
      const format = formats[Math.floor(Math.random() * formats.length)];
      
      let options: string[] | undefined;
      let tfStatement: string | undefined;
      let tfIsCorrect: boolean | undefined;
      
      if (format === 'mcq') {
        const otherBacks = deck.cards.filter(c => c.id !== card.id).map(c => c.back);
        const shuffledOthers = [...otherBacks].sort(() => Math.random() - 0.5);
        const distractors = shuffledOthers.slice(0, 3);
        options = [card.back, ...distractors].sort(() => Math.random() - 0.5);
      } else if (format === 'tf') {
        tfIsCorrect = Math.random() > 0.5;
        if (tfIsCorrect || deck.cards.length <= 1) {
          tfStatement = card.back;
          tfIsCorrect = true;
        } else {
          const otherBacks = deck.cards.filter(c => c.id !== card.id).map(c => c.back);
          tfStatement = otherBacks[Math.floor(Math.random() * otherBacks.length)];
        }
      }
      
      return {
        cardId: card.id,
        front: card.front,
        correctAnswer: card.back,
        format,
        options,
        tfStatement,
        tfIsCorrect,
      };
    });
    
    setQuizQuestions(questions);
    setQuizCurrentIndex(0);
    setQuizAnswers([]);
    setQuizState('in_progress');
    setTypedAnswer('');
    setQuizStep('question');
    setCurrentSubmission(null);
  }, [deck]);

  const goToCard = useCallback((index: number) => {
    if (!deck) return;
    setCurrentIndex(index);
    setIsFlipped(false);
    setReviewedCards((prev) => new Set([...prev, currentIndex]));
  }, [deck, currentIndex]);

  const goNext = useCallback(() => {
    if (!deck || currentIndex >= deck.cards.length - 1) return;
    goToCard(currentIndex + 1);
  }, [deck, currentIndex, goToCard]);

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    goToCard(currentIndex - 1);
  }, [currentIndex, goToCard]);

  // Keyboard navigation
  useEffect(() => {
    if (!deck) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'a') goPrev();
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deck, goNext, goPrev]);

  const currentCard = deck?.cards[currentIndex];
  const allReviewed = deck ? reviewedCards.size >= deck.cards.length : false;

  // ── Setup Screen ─────────────────────────────────────────────────────────
  if (!deck && !loading) {
    return (
      <div className={`flashcard-panel ${isFullscreen ? 'flashcard-panel--fullscreen' : ''}`}>
        <div className="flashcard-panel__header">
          <div className="flashcard-panel__header-left">
            <div className="flashcard-panel__icon">
              <Layers size={16} />
            </div>
            <span className="flashcard-panel__title">Flashcards</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="flashcard-panel__close" onClick={() => setIsFullscreen(v => !v)} title="Toggle Fullscreen" type="button">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="flashcard-panel__close" onClick={onClose} title="Close" type="button">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flashcard-setup">
          <div className="flashcard-setup__section">
            <span className="flashcard-setup__label">Difficulty</span>
            <div className="flashcard-setup__difficulty-grid">
              {(['beginner', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={`flashcard-setup__difficulty-btn ${difficulty === d ? 'flashcard-setup__difficulty-btn--active' : ''}`}
                  onClick={() => setDifficulty(d)}
                  type="button"
                >
                  <span className="flashcard-setup__difficulty-emoji">
                    {d === 'beginner' ? '🌱' : d === 'medium' ? '🔥' : '💎'}
                  </span>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flashcard-setup__section">
            <span className="flashcard-setup__label">Source Content</span>
            <div className="flashcard-setup__content-preview">
              {documentContent.trim()
                ? documentContent.substring(0, 300) + (documentContent.length > 300 ? '…' : '')
                : 'No content available. Open a document first.'}
            </div>
          </div>

          {error && (
            <div className="flashcard-error">
              <span className="flashcard-error__icon">⚠️</span>
              <span className="flashcard-error__message">{error}</span>
              <button className="flashcard-error__retry" onClick={() => setError(null)} type="button">
                Dismiss
              </button>
            </div>
          )}

          <button
            className="flashcard-setup__generate-btn"
            onClick={handleGenerate}
            disabled={!documentContent.trim()}
            type="button"
          >
            <Sparkles size={16} />
            Generate Flashcards
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Screen ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flashcard-panel ${isFullscreen ? 'flashcard-panel--fullscreen' : ''}`}>
        <div className="flashcard-panel__header">
          <div className="flashcard-panel__header-left">
            <div className="flashcard-panel__icon">
              <Layers size={16} />
            </div>
            <span className="flashcard-panel__title">Flashcards</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="flashcard-panel__close" onClick={() => setIsFullscreen(v => !v)} title="Toggle Fullscreen" type="button">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="flashcard-panel__close" onClick={onClose} title="Close" type="button">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flashcard-loading">
          <div className="flashcard-loading__spinner" />
          <span className="flashcard-loading__text">Generating flashcards with AI…</span>
        </div>
      </div>
    );
  }

  // ── Error Screen (post-generation) ───────────────────────────────────────
  if (error) {
    return (
      <div className={`flashcard-panel ${isFullscreen ? 'flashcard-panel--fullscreen' : ''}`}>
        <div className="flashcard-panel__header">
          <div className="flashcard-panel__header-left">
            <div className="flashcard-panel__icon">
              <Layers size={16} />
            </div>
            <span className="flashcard-panel__title">Flashcards</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="flashcard-panel__close" onClick={() => setIsFullscreen(v => !v)} title="Toggle Fullscreen" type="button">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="flashcard-panel__close" onClick={onClose} title="Close" type="button">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flashcard-error" style={{ flex: 1, justifyContent: 'center' }}>
          <span className="flashcard-error__icon">❌</span>
          <span className="flashcard-error__message">{error}</span>
          <button className="flashcard-error__retry" onClick={handleReset} type="button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Completion Screen ────────────────────────────────────────────────────
  if (allReviewed && viewMode === 'card') {
    return (
      <div className={`flashcard-panel ${isFullscreen ? 'flashcard-panel--fullscreen' : ''}`}>
        <div className="flashcard-panel__header">
          <div className="flashcard-panel__header-left">
            <div className="flashcard-panel__icon">
              <Layers size={16} />
            </div>
            <span className="flashcard-panel__title">Flashcards</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="flashcard-panel__close" onClick={() => setIsFullscreen(v => !v)} title="Toggle Fullscreen" type="button">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="flashcard-panel__close" onClick={onClose} title="Close" type="button">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flashcard-complete">
          <span className="flashcard-complete__icon">🎉</span>
          <span className="flashcard-complete__title">Deck Complete!</span>
          <span className="flashcard-complete__subtitle">
            You've reviewed all {deck?.total_cards || deck?.cards.length} cards in "{deck?.deck_title}".
          </span>
          <div className="flashcard-complete__actions">
            <button className="flashcard-complete__btn flashcard-complete__btn--secondary" onClick={handleReset} type="button">
              New Deck
            </button>
            <button
              className="flashcard-complete__btn flashcard-complete__btn--primary"
              onClick={() => {
                setReviewedCards(new Set());
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              type="button"
            >
              <RotateCcw size={14} style={{ marginRight: 4 }} />
              Review Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Study Screen ─────────────────────────────────────────────────────────
  return (
    <div className={`flashcard-panel ${isFullscreen ? 'flashcard-panel--fullscreen' : ''}`}>
      <div className="flashcard-panel__header">
        <div className="flashcard-panel__header-left">
          <div className="flashcard-panel__icon">
            <Layers size={16} />
          </div>
          <span className="flashcard-panel__title">Flashcards</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="flashcard-panel__close" onClick={() => setIsFullscreen(v => !v)} title="Toggle Fullscreen" type="button">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="flashcard-panel__close" onClick={onClose} title="Close" type="button">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flashcard-study__toolbar">
        <div className="flashcard-study__toolbar-left">
          <span className="flashcard-study__deck-title" title={deck?.deck_title}>
            {deck?.deck_title}
          </span>
          <span className="flashcard-study__badge">
            {deck?.difficulty}
          </span>
        </div>
        <button className="flashcard-study__reset-btn" onClick={handleReset} type="button">
          New Deck
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="flashcard-list-toggle">
        <button
          className={`flashcard-list-toggle__btn ${viewMode === 'card' ? 'flashcard-list-toggle__btn--active' : ''}`}
          onClick={() => setViewMode('card')}
          type="button"
        >
          <Zap size={12} style={{ marginRight: 4 }} />
          Study
        </button>
        <button
          className={`flashcard-list-toggle__btn ${viewMode === 'list' ? 'flashcard-list-toggle__btn--active' : ''}`}
          onClick={() => setViewMode('list')}
          type="button"
        >
          <List size={12} style={{ marginRight: 4 }} />
          All Cards
        </button>
        <button
          className={`flashcard-list-toggle__btn ${viewMode === 'quiz' ? 'flashcard-list-toggle__btn--active' : ''}`}
          onClick={() => {
            setViewMode('quiz');
            if (quizState === 'not_started') startQuiz();
          }}
          type="button"
        >
          <BrainCircuit size={12} style={{ marginRight: 4 }} />
          Quiz
        </button>
      </div>

      {/* Progress */}
      <div className="flashcard-progress">
        <div className="flashcard-progress__bar">
          <div
            className="flashcard-progress__fill"
            style={{ width: `${((currentIndex + 1) / (deck?.cards.length || 1)) * 100}%` }}
          />
        </div>
        <div className="flashcard-progress__text">
          <span>Card {currentIndex + 1} of {deck?.cards.length}</span>
          <span>{reviewedCards.size} reviewed</span>
        </div>
      </div>

      {viewMode === 'card' ? (
        <>
          {/* Card Area */}
          <div className="flashcard-card-area" onClick={() => setIsFlipped((v) => !v)}>
            {currentCard && (
              <div className={`flashcard-card ${isFlipped ? 'flashcard-card--flipped' : ''}`}>
                {/* Front */}
                <div className="flashcard-card__face flashcard-card__front">
                  <span className="flashcard-card__label">
                    ❓ Question
                  </span>
                  <span className="flashcard-card__text">{currentCard.front}</span>
                  <span className="flashcard-card__type-badge">{currentCard.type}</span>
                  <span className="flashcard-card__flip-hint">Click to flip</span>
                </div>
                {/* Back */}
                <div className="flashcard-card__face flashcard-card__back">
                  <span className="flashcard-card__label">
                    ✅ Answer
                  </span>
                  <span className="flashcard-card__text">{currentCard.back}</span>
                  <div className="flashcard-card__tags">
                    {currentCard.tags.map((tag, i) => (
                      <span key={i} className="flashcard-card__tag">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flashcard-nav">
            <button
              className="flashcard-nav__btn"
              onClick={goPrev}
              disabled={currentIndex <= 0}
              title="Previous (← or A)"
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="flashcard-nav__counter">
              <span>{currentIndex + 1}</span> / {deck?.cards.length}
            </span>
            <button
              className="flashcard-nav__btn"
              onClick={goNext}
              disabled={currentIndex >= (deck?.cards.length || 1) - 1}
              title="Next (→ or D)"
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Keyboard Hints */}
          <div className="flashcard-kbd-hints">
            <span className="flashcard-kbd-hint"><kbd>←</kbd> Prev</span>
            <span className="flashcard-kbd-hint"><kbd>Space</kbd> Flip</span>
            <span className="flashcard-kbd-hint"><kbd>→</kbd> Next</span>
          </div>
        </>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="flashcard-list">
          {deck?.cards.map((card, i) => (
            <div
              key={card.id}
              className={`flashcard-list-item ${i === currentIndex ? 'flashcard-list-item--active' : ''}`}
              onClick={() => {
                setCurrentIndex(i);
                setIsFlipped(false);
                setViewMode('card');
              }}
            >
              <div className="flashcard-list-item__front">{card.front}</div>
              <div className="flashcard-list-item__meta">
                <span className="flashcard-list-item__type">{card.type}</span>
                <span className="flashcard-list-item__id">#{card.id}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Quiz View */
        (() => {
          if (quizState === 'not_started') {
            return (
              <div className="flashcard-quiz-start">
                <button className="flashcard-complete__btn flashcard-complete__btn--primary" onClick={startQuiz} type="button">
                  Start Quiz
                </button>
              </div>
            );
          }
          
          if (quizState === 'results') {
            const score = quizAnswers.filter(a => a.isCorrect).length;
            return (
              <div className="flashcard-quiz-results">
                <h2 className="flashcard-quiz-results__title">Quiz Results</h2>
                <div className="flashcard-quiz-results__score">{score} / {quizQuestions.length}</div>
                <div className="flashcard-quiz-results__list">
                  {quizQuestions.map((q, i) => {
                    const ans = quizAnswers[i];
                    return (
                      <div key={i} className={`flashcard-quiz-results__item ${ans.isCorrect ? 'flashcard-quiz-results__item--correct' : 'flashcard-quiz-results__item--wrong'}`}>
                        <div className="flashcard-quiz-results__item-q">{q.front}</div>
                        {!ans.isCorrect && (
                          <>
                            <div className="flashcard-quiz-results__item-wrong">Your answer: {ans.userAnswer}</div>
                            <div className="flashcard-quiz-results__item-correct">Correct answer: {q.correctAnswer}</div>
                          </>
                        )}
                        {ans.isCorrect && (
                          <div className="flashcard-quiz-results__item-correct">✓ {q.correctAnswer}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button className="flashcard-complete__btn flashcard-complete__btn--primary" style={{marginTop: 16}} onClick={startQuiz} type="button">
                  Restart Quiz
                </button>
              </div>
            );
          }
          
          // In Progress
          const q = quizQuestions[quizCurrentIndex];
          
          const handleAnswer = (userAnswer: string, isCorrect: boolean) => {
            setCurrentSubmission({ userAnswer, isCorrect });
            setQuizAnswers(prev => [...prev, { cardId: q.cardId, isCorrect, userAnswer }]);
            setQuizStep('reveal');
          };
          
          const handleNextQuestion = () => {
            setQuizStep('question');
            setCurrentSubmission(null);
            setTypedAnswer('');
            if (quizCurrentIndex < quizQuestions.length - 1) {
              setQuizCurrentIndex(i => i + 1);
            } else {
              setQuizState('results');
            }
          };
      
          return (
            <div className="flashcard-quiz-active">
              <div className="flashcard-quiz-header">
                <span>Question {quizCurrentIndex + 1} of {quizQuestions.length}</span>
              </div>
              <div className="quiz-timer-bar">
                <div key={quizCurrentIndex} className="quiz-timer-fill" />
              </div>
              
              <div className="flashcard-quiz-question">
                {q.front}
              </div>
              
              <div className="flashcard-quiz-options">
                {q.format === 'mcq' && q.options?.map((opt: string, i: number) => {
                  let btnClass = "flashcard-quiz-btn";
                  if (quizStep === 'reveal') {
                    if (opt === q.correctAnswer) btnClass += " flashcard-quiz-btn--reveal-correct";
                    else if (opt === currentSubmission?.userAnswer) btnClass += " flashcard-quiz-btn--reveal-wrong";
                  }
                  return (
                    <button 
                      key={i} 
                      className={btnClass}
                      onClick={() => { if (quizStep === 'question') handleAnswer(opt, opt === q.correctAnswer) }}
                      type="button"
                      disabled={quizStep === 'reveal'}
                    >
                      {opt}
                    </button>
                  );
                })}
                
                {q.format === 'tf' && (
                  <div className="flashcard-quiz-tf">
                    <div className="flashcard-quiz-tf-statement">"{q.tfStatement}"</div>
                    <div style={{display: 'flex', gap: 8, marginTop: 16}}>
                      {['True', 'False'].map((opt) => {
                        let btnClass = "flashcard-quiz-btn";
                        if (quizStep === 'reveal') {
                          const isOptCorrect = (opt === 'True' ? q.tfIsCorrect === true : q.tfIsCorrect === false);
                          if (isOptCorrect) btnClass += " flashcard-quiz-btn--reveal-correct";
                          else if (opt === currentSubmission?.userAnswer) btnClass += " flashcard-quiz-btn--reveal-wrong";
                        }
                        return (
                          <button 
                            key={opt}
                            className={btnClass}
                            onClick={() => { if (quizStep === 'question') handleAnswer(opt, opt === 'True' ? q.tfIsCorrect === true : q.tfIsCorrect === false) }}
                            type="button"
                            disabled={quizStep === 'reveal'}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {q.format === 'typed' && (
                  <div className="flashcard-quiz-typed">
                    <input 
                      type="text" 
                      className="flashcard-quiz-input"
                      placeholder="Type your answer..."
                      value={typedAnswer}
                      onChange={e => setTypedAnswer(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter' && typedAnswer.trim() && quizStep === 'question') {
                          const isCorrect = typedAnswer.trim().toLowerCase() === q.correctAnswer.toLowerCase();
                          handleAnswer(typedAnswer.trim(), isCorrect);
                        }
                      }}
                      onKeyUp={e => e.stopPropagation()}
                      autoFocus
                      disabled={quizStep === 'reveal'}
                    />
                    
                    {quizStep === 'reveal' && currentSubmission && (
                      <div className={`flashcard-quiz-typed-reveal ${currentSubmission.isCorrect ? 'flashcard-quiz-typed-reveal--correct' : 'flashcard-quiz-typed-reveal--wrong'}`}>
                        <div className="flashcard-quiz-typed-reveal__user">
                          Your answer: <span>{currentSubmission.userAnswer}</span> {currentSubmission.isCorrect ? '✓' : '✗'}
                        </div>
                        {!currentSubmission.isCorrect && (
                          <div className="flashcard-quiz-typed-reveal__correct">
                            Correct answer: <span>{q.correctAnswer}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {quizStep === 'question' && (
                      <button 
                        className="flashcard-quiz-btn flashcard-quiz-btn--primary"
                        onClick={() => {
                          if (typedAnswer.trim()) {
                            const isCorrect = typedAnswer.trim().toLowerCase() === q.correctAnswer.toLowerCase();
                            handleAnswer(typedAnswer.trim(), isCorrect);
                          }
                        }}
                        disabled={!typedAnswer.trim()}
                        type="button"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {quizStep === 'reveal' && (
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="flashcard-quiz-btn flashcard-quiz-btn--primary"
                    style={{ width: 'auto', padding: '10px 24px' }}
                    onClick={handleNextQuestion}
                    type="button"
                  >
                    Next ➜
                  </button>
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
};

export default FlashcardPanel;
