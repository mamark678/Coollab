import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ChevronRight, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { Activity } from '../../services/activity';

interface ReadingPlayerProps {
  activity: Activity;
  onComplete: (score: number) => void;
  onClose: () => void;
}

export const ReadingPlayer: React.FC<ReadingPlayerProps> = ({ activity, onComplete, onClose }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const readingData = activity.readingData;

  const handleSelectAnswer = (qIdx: number, oIdx: number) => {
    if (showResults) return;
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleSubmit = () => {
    if (!readingData) return;
    let correctCount = 0;
    readingData.questions.forEach((q: any, idx: number) => {
      if (selectedAnswers[idx] === q.correctAnswer) {
        correctCount++;
      }
    });
    
    const finalScore = Math.round((correctCount / readingData.questions.length) * (activity.points || 10));
    setScore(finalScore);
    setShowResults(true);
  };

  const handleComplete = () => {
    onComplete(score);
  };

  if (!readingData) {
    return (
      <div className="fixed inset-0 z-[10000] bg-[var(--theme-background)] flex flex-col items-center justify-center p-6 text-[var(--theme-text-primary)] font-sans antialiased">
        <div className="max-w-md w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl p-10 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "color-mix(in srgb, var(--theme-error) 10%, transparent)", color: "var(--theme-error)" }}>
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-semibold text-[var(--theme-text-primary)] opacity-90 mb-3 tracking-tight">Missing Reading Data</h2>
          <p className="text-sm text-[var(--theme-text-secondary)] opacity-80 leading-relaxed mb-8">
            We couldn't load the text passage for this activity. Please contact your instructor to ensure the activity was configured correctly.
          </p>
          <button 
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] font-medium hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    if (Object.keys(selectedAnswers).length > 0 && !showResults) {
      if (window.confirm("You have unsaved answers. Are you sure you want to close? Your progress will be lost.")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = readingData.questions.length;
  const progressPercent = (answeredCount / totalQuestions) * 100;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  return (
    <div className="fixed inset-0 z-[10000] bg-[var(--theme-background)] flex flex-col h-screen overflow-hidden text-[var(--theme-text-primary)] font-sans antialiased">
      {/* Header */}
      <div className="h-20 border-b border-[var(--theme-border)] flex items-center justify-between px-8 shrink-0 bg-[var(--theme-background)]">
        <div className="flex items-center gap-5 min-w-0 flex-1 pr-6">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--theme-text-primary)] tracking-tight truncate">{activity.title}</h2>
          </div>
        </div>
        <button onClick={handleClose} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Reading Passage */}
        <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-[var(--theme-border)] bg-[var(--theme-background)]">
          <div className="max-w-[750px] w-full mx-auto py-10 px-12 pb-20">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-4 h-4 border border-[var(--theme-border)] rounded-sm flex items-center justify-center text-[var(--theme-text-secondary)]">
                <BookOpen size={10} />
              </div>
              <span className="text-[11px] font-semibold text-[var(--theme-text-secondary)] uppercase tracking-widest">
                Reading Passage
              </span>
            </div>
            
            <h1 className="text-[24px] font-semibold mb-8 text-[var(--theme-text-primary)]">
              {activity.title}
            </h1>
            
            <div className="text-[15px] leading-[2] text-[var(--theme-text-secondary)] font-normal whitespace-pre-wrap">
              {readingData.passage}
            </div>
          </div>
        </div>

        {/* Right: Questions */}
        <div className="w-[500px] bg-[var(--theme-surface)] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '0 1.5rem' }}>
            <div className="flex items-center border-b border-[var(--theme-border)]" style={{ padding: '1.25rem 0', gap: '0.5rem' }}>
              <div className="w-4 h-4 border border-[var(--theme-border)] rounded-sm flex items-center justify-center text-[var(--theme-text-secondary)]">
                <CheckCircle2 size={10} />
              </div>
              <span className="text-[11px] font-semibold text-[var(--theme-text-secondary)] uppercase tracking-widest">
                Comprehension Check
              </span>
            </div>

            <div className="flex flex-col pb-12">
              {readingData.questions.map((q: any, qIdx: number) => {
                const isAnswered = selectedAnswers[qIdx] !== undefined;
                const isCorrect = isAnswered && selectedAnswers[qIdx] === q.correctAnswer;
                
                return (
                  <div key={qIdx} className="flex flex-col border-b border-[var(--theme-border)] last:border-b-0" style={{ padding: '1.25rem 0' }}>
                    <div className="flex flex-col gap-[6px] mb-4">
                      <p className="text-[11px] text-[var(--theme-text-secondary)] font-medium">
                        Question {qIdx + 1} of {totalQuestions}
                      </p>
                      <h4 className="text-[15px] font-medium text-[var(--theme-text-primary)] leading-snug">
                        {q.question}
                      </h4>
                    </div>
                    
                    <div className="space-y-[8px]">
                      {q.options.map((opt: string, oIdx: number) => {
                        const isSelected = selectedAnswers[qIdx] === oIdx;
                        const isThisCorrect = oIdx === q.correctAnswer;
                        
                        let borderClass = "border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,var(--theme-surface))] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_6%,var(--theme-surface))]";
                        let textClass = "text-[var(--theme-text-secondary)] group-hover:text-[var(--theme-text-primary)]";
                        let radioClass = "border-[var(--theme-border)] group-hover:border-[var(--theme-text-secondary)]";
                        
                        if (isSelected && !showResults) {
                          borderClass = "border-[var(--theme-primary)] bg-[color-mix(in_srgb,var(--theme-primary)_8%,var(--theme-surface))]";
                          textClass = "text-[var(--theme-text-primary)]";
                          radioClass = "border-[var(--theme-primary)]";
                        } else if (showResults) {
                          if (isThisCorrect) {
                            borderClass = "border-[var(--theme-success)] bg-[color-mix(in_srgb,var(--theme-success)_10%,var(--theme-surface))]";
                            textClass = "text-[var(--theme-success)]";
                            radioClass = "border-[var(--theme-success)]";
                          } else if (isSelected && !isThisCorrect) {
                            borderClass = "border-[var(--theme-error)] bg-[color-mix(in_srgb,var(--theme-error)_10%,var(--theme-surface))]";
                            textClass = "text-[var(--theme-error)]";
                            radioClass = "border-[var(--theme-error)]";
                          } else {
                            borderClass = "border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-background)_20%,var(--theme-surface))] opacity-40";
                            textClass = "text-[var(--theme-text-secondary)]";
                            radioClass = "border-[var(--theme-border)]";
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectAnswer(qIdx, oIdx)}
                            disabled={showResults}
                            className={`group w-full text-left min-h-[44px] rounded-lg border transition-all duration-200 flex items-center ${borderClass}`}
                            style={{ padding: '12px 16px', gap: '12px' }}
                          >
                            <div className={`w-[18px] h-[18px] shrink-0 rounded-full border-[1.5px] transition-colors flex items-center justify-center ${radioClass}`}>
                              {(isSelected || (showResults && isThisCorrect)) && <div className="w-[6px] h-[6px] rounded-full bg-current" />}
                            </div>
                            <span className={`flex-1 text-[14px] leading-[1.5] font-normal transition-colors text-left break-words ${textClass}`}>
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Action */}
          <div className="h-[80px] border-t border-[var(--theme-border)] bg-[var(--theme-surface)] flex items-center justify-between px-10 shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-[12px] text-[var(--theme-text-secondary)] font-medium whitespace-nowrap">
                {answeredCount} of {totalQuestions} answered
              </span>
              <div className="w-32 h-[3px] bg-[var(--theme-border)] rounded-full overflow-hidden shrink-0">
                <div 
                  className="h-full bg-[var(--theme-primary)] transition-all duration-300 ease-out" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            {!showResults ? (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className={`shrink-0 whitespace-nowrap px-6 py-2.5 rounded-lg border text-[13px] font-semibold transition-all ${
                  allAnswered 
                    ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)] text-[var(--theme-on-primary)] hover:opacity-90' 
                    : 'border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[var(--theme-text-secondary)] cursor-not-allowed'
                }`}
              >
                Submit
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="shrink-0 whitespace-nowrap px-6 py-2.5 rounded-lg bg-[var(--theme-success)] text-[var(--theme-background)] text-[13px] font-bold hover:opacity-90 shadow-[0_4px_12px_color-mix(in_srgb,var(--theme-success)_30%,transparent)] transition-all flex items-center gap-2"
              >
                Finish & Claim {score} XP
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
