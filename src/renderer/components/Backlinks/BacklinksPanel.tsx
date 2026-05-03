import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { FileText, Link2, Search, X, Loader2, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { FirebaseService, type DocumentSchema } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import './BacklinksPanel.css';

interface BacklinkMention {
  id: string; // unique id for mention
  docId: string;
  docTitle: string;
  context: string;
  updatedAt: number;
  isLinked: boolean;
}

interface GroupedMentions {
  docId: string;
  docTitle: string;
  updatedAt: number;
  mentions: BacklinkMention[];
}

interface CacheEntry {
  linked: BacklinkMention[];
  unlinked: BacklinkMention[];
  timestamp: number;
}

interface BacklinksPanelProps {
  currentDocId: string | null;
  currentDocTitle: string;
  onNavigateToDoc: (docId: string, title: string) => void;
  onClose: () => void;
  docType: 'document' | 'canvas' | 'base' | null;
}

/**
 * Extracts a sentence surrounding a match.
 */
function getContext(text: string, start: number, end: number): string {
  // Find sentence boundaries: . ! ? or \n
  const before = text.slice(0, start);
  const after = text.slice(end);

  const sentenceStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf('\n')
  ) + 1;

  let sentenceEnd = after.search(/[.!?\n]/);
  if (sentenceEnd === -1) sentenceEnd = after.length;

  let context = text.slice(sentenceStart, end + sentenceEnd).trim();

  // Truncate to 150 chars if needed
  if (context.length > 150) {
    const matchLen = end - start;
    const padding = Math.floor((150 - matchLen) / 2);
    const contextStart = Math.max(0, start - padding);
    const contextEnd = Math.min(text.length, end + padding);
    
    context = text.slice(contextStart, contextEnd).trim();
    if (contextStart > 0) context = '...' + context;
    if (contextEnd < text.length) context = context + '...';
  }

  return context;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  currentDocId,
  currentDocTitle,
  onNavigateToDoc,
  onClose,
  docType,
}) => {
  const { currentProjectId, projectMembers } = useAppStore();
  const { state: { user } } = useAuth();
  
  const [projectDocs, setProjectDocs] = useState<DocumentSchema[]>([]);
  const [linkedMentions, setLinkedMentions] = useState<BacklinkMention[]>([]);
  const [unlinkedMentions, setUnlinkedMentions] = useState<BacklinkMention[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Cache storage
  const cacheRef = useRef<Record<string, CacheEntry>>({});

  const userRole = useMemo(() => {
    const member = projectMembers.find(m => m.uid === user?.uid);
    return member?.role || 'Guest';
  }, [projectMembers, user]);

  const canLink = userRole === 'Owner' || userRole === 'Can Edit';

  // ── Cache & Recompute Logic ──────────────────────────────────────────
  const recomputeBacklinks = useCallback((docs: DocumentSchema[], force: boolean = false) => {
    if (!currentDocId || !currentDocTitle || docType !== 'document') {
      setLinkedMentions([]);
      setUnlinkedMentions([]);
      setLoading(false);
      return;
    }

    // Check cache (30s)
    const now = Date.now();
    const cached = cacheRef.current[currentDocId];
    if (!force && cached && now - cached.timestamp < 30000) {
      setLinkedMentions(cached.linked);
      setUnlinkedMentions(cached.unlinked);
      setLoading(false);
      return;
    }

    const linked: BacklinkMention[] = [];
    const unlinked: BacklinkMention[] = [];
    const escapedTitle = currentDocTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Linked regex: [[Title]]
    const linkedRegex = new RegExp(`\\[\\[(${escapedTitle})\\]\\]`, 'gi');
    // Unlinked regex: Title (plain text)
    const unlinkedRegex = new RegExp(`(?<!\\[\\[)${escapedTitle}(?!\\]\\])`, 'gi');

    docs.forEach(doc => {
      if (doc.id === currentDocId) return;
      const text = doc.searchText || '';
      if (!text) return;

      // 1. Find all linked mentions
      let match;
      while ((match = linkedRegex.exec(text)) !== null) {
        linked.push({
          id: `${doc.id}-linked-${match.index}`,
          docId: doc.id,
          docTitle: doc.title || 'Untitled',
          context: getContext(text, match.index, linkedRegex.lastIndex),
          updatedAt: doc.updatedAt || 0,
          isLinked: true
        });
      }

      // 2. Find unlinked mentions
      while ((match = unlinkedRegex.exec(text)) !== null) {
        unlinked.push({
          id: `${doc.id}-unlinked-${match.index}`,
          docId: doc.id,
          docTitle: doc.title || 'Untitled',
          context: getContext(text, match.index, unlinkedRegex.lastIndex),
          updatedAt: doc.updatedAt || 0,
          isLinked: false
        });
      }
    });

    // Update cache
    cacheRef.current[currentDocId] = {
      linked,
      unlinked,
      timestamp: now
    };

    setLinkedMentions(linked);
    setUnlinkedMentions(unlinked);
    setLoading(false);
  }, [currentDocId, currentDocTitle, docType]);

  // Grouping function
  const groupMentions = (mentions: BacklinkMention[]): GroupedMentions[] => {
    const groups: Record<string, GroupedMentions> = {};
    mentions.forEach(m => {
      if (!groups[m.docId]) {
        groups[m.docId] = {
          docId: m.docId,
          docTitle: m.docTitle,
          updatedAt: m.updatedAt,
          mentions: []
        };
      }
      groups[m.docId].mentions.push(m);
    });
    return Object.values(groups).sort((a, b) => b.updatedAt - a.updatedAt);
  };

  const groupedLinked = useMemo(() => groupMentions(linkedMentions), [linkedMentions]);
  const groupedUnlinked = useMemo(() => groupMentions(unlinkedMentions), [unlinkedMentions]);

  // ── Firestore Listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentProjectId) return;

    const firebase = FirebaseService.getInstance();
    const unsubscribe = firebase.listenToProjectNotes(currentProjectId, (docs) => {
      setProjectDocs(docs);
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  // ── Trigger Recompute ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      // Pass true for force if projectDocs just changed (implied by dependency)
      // but let the recompute function handle cache check for doc switches.
      recomputeBacklinks(projectDocs);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentDocId, projectDocs, recomputeBacklinks]);

  const handleManualRefresh = () => {
    setLoading(true);
    recomputeBacklinks(projectDocs, true); // Force recompute
  };

  const handleLinkMention = async (docId: string) => {
    if (!canLink) return;

    const docToUpdate = projectDocs.find(d => d.id === docId);
    if (!docToUpdate || !docToUpdate.searchText) return;

    const escapedTitle = currentDocTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!\\[\\[)${escapedTitle}(?!\\]\\])`, 'gi');
    
    const newText = docToUpdate.searchText.replace(regex, `[[${currentDocTitle}]]`);
    
    try {
      await FirebaseService.getInstance().saveNote(docId, { searchText: newText });
      // Clearing cache for this doc is not strictly needed as recompute will trigger anyway
    } catch (err) {
      console.error('[Backlinks] Failed to link mentions:', err);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (docType !== 'document') {
    return (
      <div className="backlinks-panel">
        <div className="backlinks-panel__header">
          <div className="backlinks-panel__header-top">
            <h2 className="backlinks-panel__title">Backlinks</h2>
            <button className="backlinks-panel__close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="backlinks-panel__empty-state">
          <Search size={48} className="backlinks-panel__empty-icon" />
          <p>Backlinks are only available for documents</p>
        </div>
      </div>
    );
  }

  const highlightMatch = (context: string, isUnlinked: boolean) => {
    const escapedTitle = currentDocTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTitle, 'gi');
    const parts = context.split(regex);
    const matches = context.match(regex);

    return (
      <>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {matches && matches[i] && (
              <span className={`backlinks-mention__highlight ${isUnlinked ? 'backlinks-mention__highlight--unlinked' : ''}`}>
                {matches[i]}
              </span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="backlinks-panel">
      <div className="backlinks-panel__header">
        <div className="backlinks-panel__header-top">
          <h2 className="backlinks-panel__title">Backlinks</h2>
          <div className="backlinks-panel__header-actions">
            <button 
              className="backlinks-panel__refresh" 
              onClick={handleManualRefresh} 
              disabled={loading}
              title="Refresh backlinks"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
            <button className="backlinks-panel__close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="backlinks-panel__subtitle">
          {linkedMentions.length} link{linkedMentions.length !== 1 ? 's' : ''} to {currentDocTitle}
        </div>
      </div>

      <div className="backlinks-panel__content">
        {loading && (
          <div className="backlinks-panel__loading">
            <Loader2 size={24} className="spin" />
            <span>Recomputing backlinks...</span>
          </div>
        )}

        {/* Linked Mentions Section */}
        <div className="backlinks-section">
          <div className="backlinks-section__header">
            LINKED MENTIONS ({linkedMentions.length})
          </div>
          {groupedLinked.length === 0 ? (
            <div className="backlinks-section__empty">
              No documents link to {currentDocTitle} yet. Type [[{currentDocTitle}]] in any document to create a link.
            </div>
          ) : (
            <div className="backlinks-list">
              {groupedLinked.map(group => (
                <div key={group.docId} className="backlinks-group">
                  <div className="backlinks-item__header" onClick={() => onNavigateToDoc(group.docId, group.docTitle)}>
                    <FileText size={14} />
                    <span className="backlinks-item__doc-title">{group.docTitle}</span>
                    <ArrowUpRight size={12} className="backlinks-item__nav-icon" />
                    <span className="backlinks-item__time">{new Date(group.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {group.mentions.map(mention => (
                    <div key={mention.id} className="backlinks-item">
                      <div className="backlinks-item__context">
                        {highlightMatch(mention.context, false)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlinked Mentions Section */}
        <div className="backlinks-section">
          <div className="backlinks-section__header">
            UNLINKED MENTIONS ({unlinkedMentions.length})
          </div>
          {groupedUnlinked.length === 0 ? (
            <div className="backlinks-section__empty">
              No unlinked mentions found.
            </div>
          ) : (
            <div className="backlinks-list">
              {groupedUnlinked.map(group => (
                <div key={group.docId} className="backlinks-group backlinks-item--unlinked">
                  <div className="backlinks-item__header" onClick={() => onNavigateToDoc(group.docId, group.docTitle)}>
                    <FileText size={14} />
                    <span className="backlinks-item__doc-title">{group.docTitle}</span>
                    <ArrowUpRight size={12} className="backlinks-item__nav-icon" />
                    <button 
                      className="backlinks-item__link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLinkMention(group.docId);
                      }}
                      disabled={!canLink}
                      title={!canLink ? "You need edit access to create links" : "Link all mentions in this document"}
                    >
                      Link
                    </button>
                    <span className="backlinks-item__time">{new Date(group.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {group.mentions.map(mention => (
                    <div key={mention.id} className="backlinks-item">
                      <div className="backlinks-item__context">
                        {highlightMatch(mention.context, true)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
