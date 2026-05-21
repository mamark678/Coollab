// ─── Quick Switcher ────────────────────────────────────────────────────────
// Obsidian-style Ctrl+O / Ctrl+P file switcher overlay.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, FileText, Clock } from 'lucide-react';
import { FirebaseService, type DocumentSchema } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import './QuickSwitcher.css';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (docId: string, title: string, type?: 'document' | 'canvas' | 'base' | 'folder' | null) => void;
  recentDocIds?: string[];
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  onSelectDoc,
  recentDocIds = [],
}) => {
  const [query, setQuery] = useState('');
  const [allDocs, setAllDocs] = useState<DocumentSchema[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state: { user } } = useAuth();

  // Fetch documents
  useEffect(() => {
    if (!isOpen || !user) return;

    FirebaseService.getInstance()
      .listUserNotes(user.uid)
      .then(setAllDocs)
      .catch((err) => {
        console.error('[QuickSwitcher] Failed to load docs:', err);
      });
  }, [isOpen, user]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent docs when empty
      if (recentDocIds.length > 0) {
        return allDocs
          .filter((d) => recentDocIds.includes(d.id))
          .sort((a, b) => recentDocIds.indexOf(a.id) - recentDocIds.indexOf(b.id))
          .slice(0, 5);
      }
      return allDocs.slice(0, 5);
    }

    const q = query.toLowerCase();
    return allDocs
      .filter((d) => {
        const title = (d.title || 'Untitled Document').toLowerCase();
        return title.includes(q);
      })
      .slice(0, 8);
  }, [query, allDocs, recentDocIds]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          const doc = results[selectedIndex];
          onSelectDoc(doc.id, doc.title || 'Untitled Document', (doc.type as any) || 'document');
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, onSelectDoc, onClose]
  );

  // Global shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === 'o' || e.key === 'p') && !e.shiftKey) {
        e.preventDefault();
        // Toggle — if open, close; if closed, handled by App
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="quick-switcher__overlay" onClick={onClose}>
      <div
        className="quick-switcher"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Quick Switcher"
      >
        <div className="quick-switcher__input-wrapper">
          <Search size={16} className="quick-switcher__search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="quick-switcher__input"
            placeholder="Type to find a document..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            id="quick-switcher-input"
          />
        </div>

        <div className="quick-switcher__results">
          {!query.trim() && results.length > 0 && (
            <div className="quick-switcher__section-label">
              <Clock size={12} />
              Recent
            </div>
          )}

          {results.length === 0 && (
            <div className="quick-switcher__empty">
              <Search size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>No documents found</div>
            </div>
          )}

          {results.map((doc, i) => (
            <button
              key={doc.id}
              className={`quick-switcher__item ${i === selectedIndex ? 'quick-switcher__item--selected' : ''}`}
              onClick={() => {
                onSelectDoc(doc.id, doc.title || 'Untitled Document', (doc.type as any) || 'document');
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              type="button"
            >
              <FileText size={16} className="quick-switcher__item-icon" />
              <div className="quick-switcher__item-content">
                <span className="quick-switcher__item-title">
                  {highlightMatch(doc.title || 'Untitled Document', query)}
                </span>
              </div>
              {doc.updatedAt && (
                <span className="quick-switcher__item-time">
                  {formatRelativeTime(doc.updatedAt)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="quick-switcher__footer">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return text;

  return (
    <>
      {text.substring(0, idx)}
      <mark className="quick-switcher__highlight">{text.substring(idx, idx + query.length)}</mark>
      {text.substring(idx + query.length)}
    </>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
