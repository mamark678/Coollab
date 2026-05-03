import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Check, RefreshCw, Loader2, SkipForward, Ban } from 'lucide-react';
import { collection, getDocs, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { ShareService } from '../../services/share';
import { FirebaseService } from '../../services/firebase';
import { chatWithActivityAgent, ActivitySchema } from '../../services/groq';
import './ActivityAIAgent.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  activityPreview?: ActivitySchema | null;
}

interface SequentialState {
  active: boolean;
  total: number;
  current: number;
  basePrompt: string;
}

interface ActivityAIAgentProps {
  projectId: string;
}

export const ActivityAIAgent: React.FC<ActivityAIAgentProps> = ({ projectId }) => {
  const { state: { user } } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<'admin' | 'student'>('student');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedActivities, setSavedActivities] = useState<Set<string>>(new Set());
  const [savingActivities, setSavingActivities] = useState<Set<string>>(new Set());
  const [sequentialState, setSequentialState] = useState<SequentialState | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initialize role
  useEffect(() => {
    if (!user || !projectId) return;
    ShareService.getInstance().getUserPermission(projectId, user.uid).then(permission => {
      // If owner or admin, they are admin. Else student.
      if (permission === 'owner' || permission === 'admin') {
        setRole('admin');
        setMessages([{
          id: '1',
          role: 'system',
          content: 'Hello! I am your AI Activity Assistant. As an admin, you can ask me to generate learning activities. Describe what you want the students to do.'
        }]);
      } else {
        setRole('student');
        setMessages([{
          id: '1',
          role: 'system',
          content: 'Hello! I am your AI Guide. Need help understanding an activity? Ask me anything!'
        }]);
      }
    });
  }, [projectId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateActivityStep = async (historyForGroq: any[], isSequential: boolean, currentNum: number, totalNum: number) => {
    setIsLoading(true);
    try {
      const responseContent = await chatWithActivityAgent(historyForGroq, role);

      // Check if response contains JSON (Activity preview)
      let parsedActivity: ActivitySchema | null = null;
      let displayContent = responseContent;

      if (role === 'admin') {
        try {
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedActivity = JSON.parse(jsonMatch[0]) as ActivitySchema;
            displayContent = responseContent.replace(jsonMatch[0], '').trim();
            if (!displayContent) {
              displayContent = isSequential 
                ? `Here is activity ${currentNum} of ${totalNum}:`
                : 'Here is the generated activity preview:';
            }
          }
        } catch (e) {
          // Not valid JSON, just show text
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: displayContent,
        activityPreview: parsedActivity
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Error: ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    
    // Calculate new history locally
    const newHistory = [...messages, newMsg];
    setMessages(newHistory);

    // Check for sequential request
    const match = text.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+activit(?:y|ies)\b/i);
    let totalRequested = 1;
    let isSeq = false;
    
    if (match) {
      const numStr = match[1].toLowerCase();
      const wordToNum: Record<string, number> = { 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10 };
      totalRequested = wordToNum[numStr] || parseInt(numStr);
      if (!isNaN(totalRequested) && totalRequested > 1) {
        isSeq = true;
      }
    }

    let actualPrompt = text;
    if (isSeq) {
      setSequentialState({
        active: true,
        total: totalRequested,
        current: 1,
        basePrompt: text
      });
      actualPrompt = `${text}\n\n(System Note: Generate ONLY activity 1 of ${totalRequested} right now. Do not generate the others yet.)`;
    } else {
      setSequentialState(null);
    }

    const historyForGroq = newHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user'|'assistant', content: m.content }));
      
    if (isSeq) {
      historyForGroq[historyForGroq.length - 1].content = actualPrompt;
    }

    await generateActivityStep(historyForGroq, isSeq, 1, totalRequested);
  };

  const triggerNextSequentialActivity = async (currentNum: number, totalNum: number, basePrompt: string) => {
    const promptText = `(System Note: The previous activity was saved/skipped successfully. Please generate activity ${currentNum} of ${totalNum} based on my original request: "${basePrompt}")`;
    
    const newHistory = [...messagesRef.current];
    const historyForGroq = newHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user'|'assistant', content: m.content }));
      
    historyForGroq.push({ role: 'user', content: promptText });
    
    await generateActivityStep(historyForGroq, true, currentNum, totalNum);
  };

  const progressToNextActivity = (actionLabel: string) => {
    if (sequentialState?.active) {
      if (sequentialState.current < sequentialState.total) {
        const nextNum = sequentialState.current + 1;
        setSequentialState(prev => prev ? { ...prev, current: nextNum } : null);
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `${actionLabel} Generating activity ${nextNum} of ${sequentialState.total}...`
        }]);
        
        setTimeout(() => {
          triggerNextSequentialActivity(nextNum, sequentialState.total, sequentialState.basePrompt);
        }, 500);
      } else {
        setSequentialState(null);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `All ${sequentialState.total} activities have been processed successfully! ✓`
        }]);
      }
    } else {
      if (actionLabel.includes('saved')) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Activity saved to project successfully!'
        }]);
      }
    }
  };

  const handleSkipActivity = (messageId: string) => {
    if (!sequentialState?.active) return;
    setSavedActivities(prev => new Set(prev).add(messageId)); // Disable interactions
    progressToNextActivity(`Skipped activity ${sequentialState.current}.`);
  };

  const handleCancelRemaining = (messageId: string) => {
    if (!sequentialState?.active) return;
    setSavedActivities(prev => new Set(prev).add(messageId)); // Disable interactions
    setSequentialState(null);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: `Sequential generation cancelled.`
    }]);
  };

  const handleSaveActivity = async (activity: ActivitySchema, messageId: string) => {
    // Prevent duplicate saves
    if (savedActivities.has(messageId) || savingActivities.has(messageId)) return;

    // Mark as saving (show loading spinner on button)
    setSavingActivities(prev => new Set(prev).add(messageId));

    try {
      const db = FirebaseService.getInstance().db;
      
      const activitiesRef = collection(db, 'notes', projectId, 'activities');
      const snap = await getDocs(activitiesRef);
      const sequenceNumber = snap.size + 1;

      // 2. Build the document with ALL required fields
      const activityData = {
        title: activity.title || 'Untitled Activity',
        description: activity.description || '',
        difficulty: activity.difficulty || 'medium',
        workspace_zone: activity.workspace_zone || 'document',
        instructions: activity.instructions || ['Follow the activity details.'],
        timer_config: {
          duration_seconds: activity.timer_config?.duration_seconds || 300,
          on_timeout: activity.timer_config?.on_timeout || 'auto_submit',
          grace_period_seconds: activity.timer_config?.grace_period_seconds || 30,
          max_retries: activity.timer_config?.max_retries || 1
        },
        points: activity.points || 10,
        tags: activity.tags || [],
        sequenceNumber
      };

      // 3. Write to Firestore directly to the exact path
      const docRef = await addDoc(activitiesRef, {
        ...activityData,
        createdAt: serverTimestamp(),
        assignedBy: 'ai',
        status: 'active'
      });
      console.log('Activity saved with ID:', docRef.id);

      // 4. Verify the write by reading back the document
      const verifySnap = await getDoc(docRef);
      if (!verifySnap.exists()) {
        throw new Error('Write verification failed — document not found after saving.');
      }

      // 5. Mark this activity as saved (disables the button)
      setSavedActivities(prev => new Set(prev).add(messageId));

      // 6. Trigger Activity Builder Panel refresh so it appears immediately
      window.dispatchEvent(new CustomEvent('activity-list-updated', { detail: { projectId } }));

      // 7. Handle sequential progression or regular success message
      const prefix = sequentialState?.active 
        ? `Activity ${sequentialState.current} of ${sequentialState.total} saved!` 
        : 'Activity saved to project successfully!';
      progressToNextActivity(prefix);

    } catch (err: any) {
      // Show error feedback and keep button active for retry
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Failed to save activity: ${err.message}`
      }]);
    } finally {
      // Always clear the saving state
      setSavingActivities(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  if (error) return null;

  return (
    <div className="activity-agent-wrapper">
      {isOpen && (
        <div className="activity-agent-panel">
          <div className="activity-agent-header">
            <div className="activity-agent-title">
              <Sparkles size={16} color="#9485f5" />
              AI Assistant
              <span className="activity-agent-role">{role}</span>
            </div>
            <button className="activity-agent-close" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>
          
          <div className="activity-agent-messages">
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className={`activity-agent-message activity-agent-message--${msg.role}`}>
                  {msg.content}
                </div>
                {msg.activityPreview && role === 'admin' && (
                  <div className="activity-agent-preview">
                    <h4>{msg.activityPreview.title}</h4>
                    <pre>{JSON.stringify(msg.activityPreview, null, 2)}</pre>
                    <div className="activity-agent-preview-actions" style={{ flexWrap: 'wrap' }}>
                      <button 
                        className={`activity-agent-preview-btn activity-agent-preview-btn--save ${savedActivities.has(msg.id) ? 'activity-agent-preview-btn--saved' : ''}`}
                        onClick={() => handleSaveActivity(msg.activityPreview!, msg.id)}
                        disabled={savedActivities.has(msg.id) || savingActivities.has(msg.id)}
                      >
                        {savingActivities.has(msg.id) ? (
                          <>
                            <Loader2 size={12} className="activity-agent-spin" style={{ marginRight: 4 }} /> Saving...
                          </>
                        ) : savedActivities.has(msg.id) ? (
                          <>
                            <Check size={12} style={{ marginRight: 4 }} /> Added ✓
                          </>
                        ) : (
                          <>
                            <Check size={12} style={{ marginRight: 4 }} /> Add to Project
                          </>
                        )}
                      </button>
                      
                      {!savedActivities.has(msg.id) && sequentialState?.active && (
                        <>
                          <button 
                            className="activity-agent-preview-btn activity-agent-preview-btn--regen"
                            onClick={() => handleSkipActivity(msg.id)}
                            disabled={savingActivities.has(msg.id)}
                          >
                            <SkipForward size={12} style={{ marginRight: 4 }} /> Skip this activity
                          </button>
                          <button 
                            className="activity-agent-preview-btn activity-agent-preview-btn--regen"
                            onClick={() => handleCancelRemaining(msg.id)}
                            disabled={savingActivities.has(msg.id)}
                            style={{ color: '#e66b7a', borderColor: 'rgba(230, 107, 122, 0.2)' }}
                          >
                            <Ban size={12} style={{ marginRight: 4 }} /> Cancel remaining
                          </button>
                        </>
                      )}

                      {!sequentialState?.active && !savedActivities.has(msg.id) && (
                        <button 
                          className="activity-agent-preview-btn activity-agent-preview-btn--regen"
                          onClick={() => {
                            setInput('Please regenerate that activity differently.');
                            setTimeout(handleSend, 100);
                          }}
                        >
                          <RefreshCw size={12} style={{ marginRight: 4 }} /> Regenerate
                        </button>
                      )}
                    </div>
                    
                    {sequentialState?.active && !savedActivities.has(msg.id) && (
                      <div style={{ fontSize: 11, color: '#a0a4b8', marginTop: 12, textAlign: 'center', fontStyle: 'italic' }}>
                        Activity {sequentialState.current} of {sequentialState.total} — Click 'Add to Project' to save and continue
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="activity-agent-message activity-agent-message--assistant">
                <div className="activity-agent-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="activity-agent-input">
            <input
              type="text"
              placeholder="Ask the AI assistant..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={isLoading || sequentialState?.active}
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim() || sequentialState?.active}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button className="activity-agent-bubble" onClick={() => setIsOpen(!isOpen)} title="AI Assistant">
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
};
