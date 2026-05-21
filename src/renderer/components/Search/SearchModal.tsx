import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileText, LayoutDashboard, Database, MessageSquare, Hash, X } from 'lucide-react';
import { FirebaseService } from '../../services/firebase';
import type { DocumentSchema } from '../../services/firebase';
import type { CommentItem } from '../../types/comment.types';
import './SearchModal.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDoc: (docId: string, title?: string, type?: 'document' | 'canvas' | 'base' | 'folder' | null) => void;
  projectId: string | null;
}

type FilterType = 'All' | 'Documents' | 'Canvas' | 'Base' | 'Properties' | 'Comments';

interface SearchResult {
  id: string; // docId or commentId
  docId: string;
  title: string;
  type: string;
  docType?: 'document' | 'canvas' | 'base' | 'folder' | null;
  snippet: string;
  folderName: string;
  updatedAt: number;
  icon: React.ReactNode;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigateToDoc, projectId }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Data cache
  const [documents, setDocuments] = useState<DocumentSchema[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [docContentCache, setDocContentCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setFilter('All');
      setSelectedIndex(0);
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    if (!projectId) return;
    setIsLoading(true);
    
    try {
      const firebase = FirebaseService.getInstance();
      const docs = await firebase.listProjectNotes(projectId);
      setDocuments(docs);
      
      // Load content for search cache
      const contentCache: Record<string, string> = {};
      const fetchCommentsPromises = docs.map(async (d) => {
        if (d.searchText) {
          contentCache[d.id] = d.searchText;
        } else if (d.content) {
          contentCache[d.id] = d.content;
        }
        
        // Fetch comments for this doc
        return new Promise<CommentItem[]>((resolve) => {
          const unsub = firebase.listenToComments(d.id, (c) => {
            resolve(c.map(comment => ({ ...comment, docId: d.id } as CommentItem & { docId: string })));
          });
          setTimeout(() => unsub(), 2000); // Hack to just read once via onSnapshot
        });
      });
      
      setDocContentCache(contentCache);
      
      const allCommentsNested = await Promise.all(fetchCommentsPromises);
      setComments(allCommentsNested.flat() as any);
      
    } catch (err) {
      console.error('[Search] Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filter, documents, comments]);

  const getFolderName = (parentId?: string | null) => {
    if (!parentId) return 'Root';
    const parent = documents.find(d => d.id === parentId);
    return parent ? parent.title : 'Root';
  };

  const highlightSnippet = (text: string, term: string) => {
    if (!text) return '';
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text.substring(0, 100);
    
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + term.length + 40);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';
    return snippet;
  };

  const performSearch = (searchTerm: string) => {
    const term = searchTerm.toLowerCase();
    const newResults: SearchResult[] = [];

    // Search Documents
    if (filter === 'All' || filter === 'Documents') {
      documents.forEach(doc => {
        if (doc.type === 'document' || !doc.type) {
          const matchTitle = doc.title.toLowerCase().includes(term);
          const content = docContentCache[doc.id] || '';
          const matchContent = content.toLowerCase().includes(term);
          
          if (matchTitle || matchContent) {
            newResults.push({
              id: doc.id,
              docId: doc.id,
              title: doc.title,
              type: 'Document',
              snippet: matchTitle ? 'Matches title' : highlightSnippet(content, term),
              folderName: getFolderName(doc.parentId),
              updatedAt: doc.updatedAt || 0,
              icon: <FileText size={14} />,
              docType: 'document'
            });
          }
        }
      });
    }

    // Search Canvas
    if (filter === 'All' || filter === 'Canvas') {
      documents.forEach(doc => {
        if (doc.type === 'canvas') {
          const matchTitle = doc.title.toLowerCase().includes(term);
          // In real implementation, parse canvas json to search card content
          if (matchTitle) {
            newResults.push({
              id: doc.id,
              docId: doc.id,
              title: doc.title,
              type: 'Canvas',
              snippet: 'Matches title',
              folderName: getFolderName(doc.parentId),
              updatedAt: doc.updatedAt || 0,
              icon: <LayoutDashboard size={14} />,
              docType: 'canvas'
            });
          }
        }
      });
    }

    // Search Base
    if (filter === 'All' || filter === 'Base') {
      documents.forEach(doc => {
        if (doc.type === 'base') {
          const matchTitle = doc.title.toLowerCase().includes(term);
          if (matchTitle) {
            newResults.push({
              id: doc.id,
              docId: doc.id,
              title: doc.title,
              type: 'Base',
              snippet: 'Matches title',
              folderName: getFolderName(doc.parentId),
              updatedAt: doc.updatedAt || 0,
              icon: <Database size={14} />,
              docType: 'base'
            });
          }
        }
      });
    }

    // Search Properties
    if (filter === 'All' || filter === 'Properties') {
      documents.forEach(doc => {
        if (doc.properties) {
          let propertyMatch = false;
          let propSnippet = '';
          for (const [key, prop] of Object.entries(doc.properties)) {
            if (key.toLowerCase().includes(term)) {
              propertyMatch = true;
              propSnippet = `Property key: ${key}`;
              break;
            }
            if (prop.value && String(prop.value).toLowerCase().includes(term)) {
              propertyMatch = true;
              propSnippet = `Property ${key}: ${prop.value}`;
              break;
            }
          }
          if (propertyMatch) {
            newResults.push({
              id: `prop-${doc.id}`,
              docId: doc.id,
              title: doc.title,
              type: 'Property',
              snippet: propSnippet,
              folderName: getFolderName(doc.parentId),
              updatedAt: doc.updatedAt || 0,
              icon: <Hash size={14} />
            });
          }
        }
      });
    }

    // Search Comments
    if (filter === 'All' || filter === 'Comments') {
      comments.forEach(c => {
        const matchContent = c.content.toLowerCase().includes(term);
        const matchAuthor = c.authorName.toLowerCase().includes(term);
        if (matchContent || matchAuthor) {
          const docId = (c as any).docId;
          const doc = documents.find(d => d.id === docId);
          if (doc) {
            newResults.push({
              id: c.id || Math.random().toString(),
              docId: doc.id,
              title: doc.title,
              type: 'Comment',
              snippet: highlightSnippet(c.content, term),
              folderName: getFolderName(doc.parentId),
              updatedAt: c.createdAt || 0,
              icon: <MessageSquare size={14} />,
              docType: (doc.type as any) || 'document'
            });
          }
        }
      });
    }

    setResults(newResults.sort((a, b) => b.updatedAt - a.updatedAt));
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      const item = results[selectedIndex];
      onNavigateToDoc(item.docId, item.title, item.docType);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal__input-wrapper">
          <Search className="search-modal__icon" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="search-modal__input"
            placeholder="Search everything..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isLoading && <span className="search-modal__loading" />}
          <button className="search-modal__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="search-modal__filters">
          {(['All', 'Documents', 'Canvas', 'Base', 'Properties', 'Comments'] as FilterType[]).map(f => (
            <button
              key={f}
              className={`search-modal__filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="search-modal__results">
          {query.trim() && results.length === 0 && !isLoading && (
            <div className="search-modal__no-results">
              <p>No results for "{query}"</p>
              <span>Check your spelling or try different keywords.</span>
            </div>
          )}

          {results.map((result, index) => (
            <div
              key={result.id + index}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                onNavigateToDoc(result.docId, result.title, result.docType);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-item__icon">
                {result.icon}
              </div>
              <div className="search-result-item__content">
                <div className="search-result-item__header">
                  <span className="search-result-item__title">{result.title}</span>
                  <span className="search-result-item__folder">{result.folderName}</span>
                </div>
                <div className="search-result-item__snippet">
                  {result.snippet.split(new RegExp(`(${query})`, 'gi')).map((part, i) => 
                    part.toLowerCase() === query.toLowerCase() 
                      ? <mark key={i}>{part}</mark> 
                      : <span key={i}>{part}</span>
                  )}
                </div>
                <div className="search-result-item__meta">
                  {new Date(result.updatedAt).toLocaleDateString()} · {result.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
