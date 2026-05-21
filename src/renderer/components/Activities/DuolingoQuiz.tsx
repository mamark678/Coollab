import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Check, 
  ChevronRight, 
  Star, 
  TrendingUp, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Activity } from '../../services/activity';

interface DuolingoQuizProps {
  activity: Activity;
  onComplete: (score: number) => void;
  onClose: () => void;
}

export const DuolingoQuiz: React.FC<DuolingoQuizProps> = ({ activity, onComplete, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [timer, setTimer] = useState<{ remaining: number; total: number; isLate?: boolean } | null>(null);
  const externalTickActive = React.useRef(false);

  useEffect(() => {
    const handleTimerTick = (e: any) => {
      externalTickActive.current = true;
      setTimer(e.detail);
    };
    window.addEventListener('activity-timer-tick', handleTimerTick);

    const config = activity.timer_config;
    let localInterval: any;

    if (config && config.duration_seconds > 0) {
      setTimer(prev => prev || { remaining: config.duration_seconds, total: config.duration_seconds, isLate: false });
      
      const startTime = Date.now();
      localInterval = setInterval(() => {
        if (externalTickActive.current) return;
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, config.duration_seconds - elapsed);
        setTimer({
          remaining,
          total: config.duration_seconds,
          isLate: remaining === 0
        });
      }, 1000);
    }

    return () => {
      window.removeEventListener('activity-timer-tick', handleTimerTick);
      if (localInterval) clearInterval(localInterval);
    };
  }, [activity]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerPercent = timer ? (timer.remaining / timer.total) * 100 : 100;
  const timerColor = timer?.isLate ? 'var(--theme-error)' : timerPercent < 20 ? 'var(--theme-error)' : timerPercent < 50 ? '#f59e0b' : 'var(--theme-primary)';

  const questions = activity.quizData?.questions || [];
  const currentQuestion = questions[currentIndex];

  const handleSelect = (index: number) => {
    if (isRevealed) return;
    setSelectedOption(index);
  };

  const handleCheck = () => {
    if (selectedOption === null) return;
    
    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    if (isCorrect) {
      setStreak(s => s + 1);
      setXpEarned(x => x + (activity.points / questions.length));
    } else {
      setStreak(0);
      setWrongAnswers(prev => [...prev, currentIndex]);
    }
    
    setIsRevealed(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsRevealed(false);
    } else {
      onComplete(Math.round(xpEarned));
    }
  };

  if (!currentQuestion) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--theme-background)',
      color: 'var(--theme-text-primary)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Top bar with timer and stats */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px  solid var(--theme-border)',
        flexShrink: 0
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`, border: 'none',
            color: 'var(--theme-text-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px'
          }}
        >
          ✕
        </button>

        {/* Progress bar */}
        <div style={{ flex: 1, margin: '0 16px' }}>
          <div style={{
            height: '6px', borderRadius: '999px',
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)`, overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${((currentIndex) / questions.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))',
              borderRadius: '999px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--theme-text-secondary)', fontWeight: 700 }}>
              {currentIndex} / {questions.length} Questions
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {timer && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '20px',
              background: timer.isLate ? 'color-mix(in srgb, var(--theme-error) 10%, transparent)' : 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
              border: `1px solid ${timer.isLate ? 'color-mix(in srgb, var(--theme-error) 30%, transparent)' : 'color-mix(in srgb, var(--theme-primary) 20%, transparent)'}`,
            }}>
              <span style={{ fontSize: '12px' }}>⏱</span>
              <span style={{
                fontSize: '13px', fontWeight: 800,
                color: timer.isLate ? 'var(--theme-error)' : 'var(--theme-secondary)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {formatTime(timer.remaining)}
              </span>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '20px',
            background: 'color-mix(in srgb, #e6c96e 10%, transparent)',
            border: '1px solid color-mix(in srgb, #e6c96e 25%, transparent)'
          }}>
            <span style={{ fontSize: '12px' }}>⭐</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#e6c96e' }}>{Math.round(xpEarned)}</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '20px',
            background: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--theme-primary) 20%, transparent)'
          }}>
            <span style={{ fontSize: '12px' }}>🔥</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--theme-secondary)' }}>{streak}</span>
          </div>
        </div>
      </div>

      {/* Timer progress bar */}
      {timer && (
        <div style={{ height: '3px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${timerPercent}%`,
            background: timerColor,
            transition: 'width 1s linear, background 0.3s ease'
          }} />
        </div>
      )}

      {/* Question area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', maxWidth: '680px',
        margin: '0 auto', width: '100%'
      }}>
        <div style={{
          fontSize: '22px', fontWeight: 800, color: 'var(--theme-text-primary)',
          textAlign: 'center', lineHeight: 1.4, marginBottom: '40px',
          fontFamily: 'Outfit, sans-serif'
        }}>
          {currentQuestion.question}
        </div>

        {/* Answer options */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px', width: '100%'
        }}>
          {currentQuestion.options.map((option: string, idx: number) => {
            const isOptionCorrect = isRevealed && idx === currentQuestion.correctAnswer;
            const isSelected = selectedOption === idx;
            const isWrong = isRevealed && isSelected && idx !== currentQuestion.correctAnswer;
            return (
              <button
                key={idx}
                onClick={() => !isRevealed && handleSelect(idx)}
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  border: `2px solid ${
                    isOptionCorrect ? 'var(--theme-success)' :
                    isWrong ? 'var(--theme-error)' :
                    isSelected ? 'var(--theme-primary)' :
                    'color-mix(in srgb, var(--theme-text-primary) 12%, transparent)'
                  }`,
                  background: isOptionCorrect ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' :
                    isWrong ? 'color-mix(in srgb, var(--theme-error) 10%, transparent)' :
                    isSelected ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' :
                    'color-mix(in srgb, var(--theme-text-primary) 3%, transparent)',
                  color: isOptionCorrect ? 'var(--theme-success)' :
                    isWrong ? 'var(--theme-error)' :
                    isSelected ? 'var(--theme-primary)' :
                    'color-mix(in srgb, var(--theme-text-primary) 70%, transparent)',
                  fontSize: '15px', fontWeight: 600,
                  cursor: isRevealed ? 'default' : 'pointer',
                  textAlign: 'left' as const,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '12px'
                }}
              >
                <span style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: isOptionCorrect ? 'color-mix(in srgb, var(--theme-success) 20%, transparent)' :
                    isWrong ? 'color-mix(in srgb, var(--theme-error) 20%, transparent)' :
                    isSelected ? 'color-mix(in srgb, var(--theme-primary) 30%, transparent)' :
                    'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 800,
                  color: isOptionCorrect ? 'var(--theme-success)' :
                    isWrong ? 'var(--theme-error)' :
                    isSelected ? 'var(--theme-primary)' :
                    'color-mix(in srgb, var(--theme-text-primary) 40%, transparent)'
                }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {isRevealed && currentQuestion.explanation && (
          <div style={{
            marginTop: '24px', width: '100%', padding: '16px 20px',
            borderRadius: '12px',
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.03 * 100}%, transparent)`,
            border: '1px  solid var(--theme-border)'
          }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <HelpCircle size={16} style={{ color: 'var(--theme-text-secondary)', marginTop: '2px', flexShrink: 0 }} />
              <p style={{ color: 'var(--theme-text-secondary)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                {currentQuestion.explanation}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom check button */}
      <div style={{
        padding: '20px 24px',
        borderTop: '1px  solid var(--theme-border)',
        maxWidth: '680px', margin: '0 auto', width: '100%',
        flexShrink: 0
      }}>
        <button
          onClick={isRevealed ? handleNext : handleCheck}
          disabled={selectedOption === null}
          style={{
            width: '100%', padding: '16px',
            borderRadius: '14px', border: 'none',
            background: selectedOption !== null ? 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)',
            color: selectedOption !== null ? 'var(--theme-on-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 20%, transparent)',
            fontSize: '15px', fontWeight: 800,
            cursor: selectedOption !== null ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            boxShadow: selectedOption !== null ? '0 8px 24px color-mix(in srgb, var(--theme-primary) 30%, transparent)' : 'none'
          }}
        >
          {isRevealed ? (currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Quiz ✓') : 'Check Answer'}
        </button>
      </div>
    </div>
  );
};
