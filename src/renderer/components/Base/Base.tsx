import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Table as TableIcon, 
  LayoutDashboard, 
  Grid, 
  List as ListIcon, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Info,
  Check,
  Eye,
  EyeOff,
  Calculator,
  StickyNote,
  ChevronDown,
  X
} from 'lucide-react';
import { FirebaseService, DocumentSchema, DocumentProperties, PropertyType } from '../../services/firebase';
import { collection as firestoreCollection, doc as firestoreDoc, onSnapshot, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { getBuiltInProperties, BuiltInProperties } from '../../utils/documentUtils';
import { BaseData, BaseView, BaseViewType } from './Base.types';
import { useAppStore } from '../../store/useAppStore';
import './Base.css';

interface BaseProps {
  roomName: string;
  readOnly?: boolean;
}

const DEFAULT_BASE_DATA: BaseData = {
  views: [{
    id: 'default',
    name: 'Table View',
    type: 'table',
    config: { visibleColumns: ['modifiedTime', 'fileTags'] }
  }],
  activeViewId: 'default'
};

type CustomColumnType = 'text' | 'number' | 'date' | 'checkbox' | 'select';
interface CustomColumn {
  id: string;
  name: string;
  type: CustomColumnType;
  order: number;
  createdAt: number;
}

export const Base: React.FC<BaseProps> = ({ roomName, readOnly = false }) => {
  const [data, setData] = useState<BaseData | null>(null);
  const [notes, setNotes] = useState<DocumentSchema[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<{ field: string; condition: string; value: any }[]>([]);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<CustomColumnType>('text');
  const [editingCellId, setEditingCellId] = useState<string | null>(null); // "rowId:colId"
  const [editingColHeaderId, setEditingColHeaderId] = useState<string | null>(null);
  const [editingColHeaderName, setEditingColHeaderName] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  const firebase = FirebaseService.getInstance();

  // ── Read workspace context from store (stable hook-based values) ───
  const currentProjectId = useAppStore(s => s.currentProjectId);
  const activityType = useAppStore(s => s.activityType);
  const viewingStudentId = useAppStore(s => s.viewingStudentId);
  const currentUserId = firebase.auth.currentUser?.uid;

  // Derive stable params for individual workspace Firestore paths
  const isIndividual = activityType === 'individual';
  const workspaceProjectId = isIndividual ? currentProjectId : undefined;
  const workspaceUserId = isIndividual ? (viewingStudentId || currentUserId) : undefined;

  // ── Data Sync (Base document itself) ──────────────────────────────
  useEffect(() => {
    if (!roomName) return;

    let isActive = true;

    // Timeout fallback: if data hasn't loaded in 5s, show empty Base
    const timeout = setTimeout(() => {
      if (isActive && loading) {
        console.warn('[Base] Load timeout — creating default Base data');
        setData(DEFAULT_BASE_DATA);
        setLoading(false);
      }
    }, 5000);

    console.log('[Base] listenToNote', { roomName, workspaceProjectId, workspaceUserId });

    const unsub = firebase.listenToNote(
      roomName,
      (doc) => {
        if (!isActive) return;
        clearTimeout(timeout);
        if (doc.content) {
          try {
            const parsed = JSON.parse(doc.content);
            if (!parsed.views || parsed.views.length === 0) {
              parsed.views = DEFAULT_BASE_DATA.views;
              parsed.activeViewId = 'default';
            }
            setData(parsed);
          } catch (e) {
            console.error('[Base] Failed to parse content:', e);
            setData(DEFAULT_BASE_DATA);
          }
        } else {
          // Document exists but has no content — use defaults
          setData(DEFAULT_BASE_DATA);
        }
        setLoading(false);
      },
      workspaceProjectId || undefined,
      workspaceUserId || undefined,
      'base'
    );

    return () => {
      isActive = false;
      clearTimeout(timeout);
      unsub();
    };
  }, [roomName, workspaceProjectId, workspaceUserId]);

  // ── Custom Columns listener (Individual only) ─────────────────────
  useEffect(() => {
    if (!isIndividual || !workspaceProjectId || !workspaceUserId || !roomName) return;
    let isActive = true;
    const colsCol = firestoreCollection(
      firebase.db,
      `notes/${workspaceProjectId}/studentWorkspaces/${workspaceUserId}/base/${roomName}/columns`
    );
    const unsub = onSnapshot(colsCol, (snap) => {
      if (!isActive) return;
      const cols: CustomColumn[] = [];
      snap.forEach((d) => cols.push({ ...(d.data() as CustomColumn), id: d.id }));
      cols.sort((a, b) => a.order - b.order);
      setCustomColumns(cols);
    });
    return () => { isActive = false; unsub(); };
  }, [roomName, isIndividual, workspaceProjectId, workspaceUserId]);

  // ── Notes/Rows listener ───────────────────────────────────────────────
  // Individual Activity Projects: listen to base/{baseId}/rows/
  // Regular Projects: listen to all project documents (existing behavior)
  const scopedFolderId = data?.scopedFolderId;

  useEffect(() => {
    if (!currentProjectId) return;
    let unsub: (() => void) | undefined;
    let isActive = true;

    if (isIndividual && workspaceProjectId && workspaceUserId) {
      // ── Individual Activity Project: listen to Base-specific rows ──
      // Path: /notes/{projectId}/studentWorkspaces/{userId}/base/{baseId}/rows/
      console.log('[Base] Listening to rows at:', `notes/${workspaceProjectId}/studentWorkspaces/${workspaceUserId}/base/${roomName}/rows`);
      const rowsCol = firestoreCollection(
        firebase.db,
        `notes/${workspaceProjectId}/studentWorkspaces/${workspaceUserId}/base/${roomName}/rows`
      );
      unsub = onSnapshot(rowsCol, (snap) => {
        if (!isActive) return;
        const rows: DocumentSchema[] = [];
        snap.forEach((docSnap) => {
          rows.push({ ...(docSnap.data() as DocumentSchema), id: docSnap.id });
        });
        setNotes(rows);
        setAllDocs(rows);
        setLoading(false);
        useAppStore.getState().setSyncStatus('synced');
      });
    } else {
      // ── Regular Project: listen to all project documents (existing behavior) ──
      const filterNotes = (d: DocumentSchema) => {
        const isExcludedType = d.type === 'folder' || d.type === 'base' || d.type === 'canvas';
        return !d.isFolder && !isExcludedType && (d.id.startsWith('room-') || d.type === 'document' || !d.type);
      };

      // Fetch all user docs for context (links, backlinks etc.)
      firebase.listUserNotes(currentUserId || '').then(userDocs => {
        if (isActive) setAllDocs(userDocs);
      });

      unsub = firebase.listenToProjectNotes(currentProjectId, (projectDocs) => {
        if (!isActive) return;
        useAppStore.getState().setSyncStatus('synced');
        const uniqueDocs = Array.from(
          new Map(projectDocs.map(d => [d.id, d])).values()
        );
        if (scopedFolderId) {
          setNotes(uniqueDocs.filter(d => d.parentId === scopedFolderId && filterNotes(d)));
        } else {
          setNotes(uniqueDocs.filter(filterNotes));
        }
        setLoading(false);
      });
    }

    return () => {
      isActive = false;
      unsub?.();
    };
  }, [scopedFolderId, roomName, currentProjectId, isIndividual, workspaceProjectId, workspaceUserId]);

  const activeView = useMemo(() => {
    return data?.views.find(v => v.id === data.activeViewId) || data?.views[0];
  }, [data]);

  const saveData = (newData: BaseData) => {
    if (readOnly) return;
    setData(newData);
    const store = useAppStore.getState();
    const uId = store.activityType === 'individual' ? (store.viewingStudentId || firebase.auth.currentUser?.uid) : undefined;
    firebase.saveNote(roomName, { content: JSON.stringify(newData) }, store.currentProjectId || undefined, uId || undefined);
  };

  const toggleColumn = (col: string) => {
    if (!data || !activeView) return;
    const currentCols = activeView.config.visibleColumns || [];
    const newCols = currentCols.includes(col) 
      ? currentCols.filter(c => c !== col) 
      : [...currentCols, col];
    
    const newViews = data.views.map(v => 
      v.id === activeView.id ? { ...v, config: { ...v.config, visibleColumns: newCols } } : v
    );
    saveData({ ...data, views: newViews });
  };

  const BUILT_IN_FIELDS = [
    'fileName', 'fileBaseName', 'fileExtension', 'filePath', 'fileFullName', 
    'folder', 'fileSize', 'createdTime', 'modifiedTime', 'fileLinks', 
    'fileBacklinks', 'fileEmbeds', 'fileTags'
  ];

  const customFields = useMemo(() => {
    const fields = new Set<string>();
    notes.forEach(n => {
      if (n.properties) {
        Object.keys(n.properties).forEach(k => fields.add(k));
      }
    });
    return Array.from(fields);
  }, [notes]);

  // ── Rendering Helpers ────────────────────────────────────────────────
  // ── Sorting & Filtering Logic ────────────────────────────────────────
  const processedNotes = useMemo(() => {
    let result = [...notes];

    // 1. Search
    if (searchQuery) {
      result = result.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // 2. Filter
    filters.forEach(f => {
      result = result.filter(n => {
        const builtIn = getBuiltInProperties(n, allDocs);
        const isBuiltIn = BUILT_IN_FIELDS.includes(f.field);
        const val = isBuiltIn ? (builtIn as any)[f.field] : n.properties?.[f.field]?.value;

        switch (f.condition) {
          case 'contains': return String(val || '').toLowerCase().includes(String(f.value).toLowerCase());
          case 'doesNotContain': return !String(val || '').toLowerCase().includes(String(f.value).toLowerCase());
          case 'isEmpty': return !val || val === '';
          case 'isNotEmpty': return !!val && val !== '';
          case 'isChecked': return !!val;
          case 'isUnchecked': return !val;
          case 'isBefore': return new Date(val).getTime() < new Date(f.value).getTime();
          case 'isAfter': return new Date(val).getTime() > new Date(f.value).getTime();
          case 'isOn': return new Date(val).toDateString() === new Date(f.value).toDateString();
          default: return true;
        }
      });
    });

    // 3. Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const builtInA = getBuiltInProperties(a, allDocs);
        const builtInB = getBuiltInProperties(b, allDocs);
        const isBuiltIn = BUILT_IN_FIELDS.includes(sortConfig.field);
        
        let valA = isBuiltIn ? (builtInA as any)[sortConfig.field] : a.properties?.[sortConfig.field]?.value;
        let valB = isBuiltIn ? (builtInB as any)[sortConfig.field] : b.properties?.[sortConfig.field]?.value;

        // Normalize for comparison
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [notes, searchQuery, filters, sortConfig, allDocs]);

  const handleCreateDocument = async () => {
    if (readOnly || !firebase.auth.currentUser) return;

    const newDocId = `row-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const newRow: DocumentSchema = {
      id: newDocId,
      projectId: currentProjectId || null,
      title: 'Untitled Document',
      parentId: data?.scopedFolderId || null,
      type: 'document',
      ownerId: firebase.auth.currentUser.uid,
      collaborators: [firebase.auth.currentUser.uid],
      createdAt: now,
      updatedAt: now,
      content: null,
      isFolder: false,
      isProject: false
    };

    if (isIndividual && workspaceProjectId && workspaceUserId) {
      // Individual Activity Project: write to base/{baseId}/rows/{rowId}
      const rowRef = firestoreDoc(
        firebase.db,
        `notes/${workspaceProjectId}/studentWorkspaces/${workspaceUserId}/base/${roomName}/rows`,
        newDocId
      );
      await setDoc(rowRef, newRow);
    } else {
      // Regular project: create a normal project document
      const baseDoc = await firebase.getNote(roomName);
      if (!baseDoc?.projectId) return;
      const uId = activityType === 'individual' ? (viewingStudentId || firebase.auth.currentUser?.uid) : undefined;
      await firebase.createNote(newDocId, { ...newRow, projectId: baseDoc.projectId }, baseDoc.projectId, uId || undefined);
    }

    window.dispatchEvent(new CustomEvent('workspace-action', {
      detail: { type: 'base_row_added', rowData: { title: newRow.title, customFields: {} } }
    }));

    setEditingTitleId(newDocId);
  };

  const handleUpdateTitle = async (noteId: string, newTitle: string) => {
    if (readOnly) return;

    if (isIndividual && workspaceProjectId && workspaceUserId) {
      // Individual Activity Project: update in base/{baseId}/rows/{rowId}
      const rowRef = firestoreDoc(
        firebase.db,
        `notes/${workspaceProjectId}/studentWorkspaces/${workspaceUserId}/base/${roomName}/rows`,
        noteId
      );
      await setDoc(rowRef, { title: newTitle, updatedAt: Date.now() }, { merge: true });
    } else {
      // Regular project: use standard saveNote
      await firebase.saveNote(noteId, { title: newTitle }, currentProjectId || undefined,
        activityType === 'individual' ? (viewingStudentId || firebase.auth.currentUser?.uid) : undefined
      );
    }

    window.dispatchEvent(new CustomEvent('workspace-action', {
      detail: { type: 'base_row_added', rowData: { title: newTitle, customFields: {} } }
    }));

    setEditingTitleId(null);
  };

  // ── Custom Column Handlers ────────────────────────────────────────
  const basePath = (isIndividual && workspaceProjectId && workspaceUserId)
    ? `notes/${workspaceProjectId}/studentWorkspaces/${workspaceUserId}/base/${roomName}` : null;

  const handleAddColumn = async () => {
    if (readOnly || !basePath || !newColName.trim()) return;
    const colId = `col-${Math.random().toString(36).substr(2, 9)}`;
    const colData: CustomColumn = {
      id: colId, name: newColName.trim(), type: newColType,
      order: customColumns.length, createdAt: Date.now()
    };
    await setDoc(firestoreDoc(firebase.db, `${basePath}/columns`, colId), colData);
    setNewColName(''); setNewColType('text'); setShowAddColumn(false);
  };

  const handleRenameColumn = async (colId: string, name: string) => {
    if (readOnly || !basePath) return;
    await setDoc(firestoreDoc(firebase.db, `${basePath}/columns`, colId), { name }, { merge: true });
    setEditingColHeaderId(null);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (readOnly || !basePath) return;
    await deleteDoc(firestoreDoc(firebase.db, `${basePath}/columns`, colId));
  };

  const handleCellEdit = async (rowId: string, colId: string, value: any) => {
    if (readOnly || !basePath) return;
    const rowRef = firestoreDoc(firebase.db, `${basePath}/rows`, rowId);
    await setDoc(rowRef, { customFields: { [colId]: value }, updatedAt: Date.now() }, { merge: true });
    setEditingCellId(null);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (readOnly) return;
    if (isIndividual && basePath) {
      await deleteDoc(firestoreDoc(firebase.db, `${basePath}/rows`, rowId));
    } else {
      await firebase.deleteNote(rowId, currentProjectId || undefined,
        activityType === 'individual' ? (viewingStudentId || currentUserId) : undefined, 'document');
    }
    // Global fix for focus bug on Windows: force reload after delete
    window.location.reload();
  };

  const handleDeleteSelected = async () => {
    if (readOnly || selectedRows.size === 0) return;
    if (!window.confirm(`Delete ${selectedRows.size} row(s)?`)) return;
    const promises = Array.from(selectedRows).map(id => handleDeleteRow(id));
    await Promise.all(promises);
    setSelectedRows(new Set());
    // Global fix for focus bug on Windows: force reload after delete
    window.location.reload();
  };

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === processedNotes.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(processedNotes.map(n => n.id)));
    }
  };

  if (loading || !data || !activeView) return <div className="base-loading">Loading Base...</div>;

  return (
    <div className="base-container">
      {/* Header / Toolbar */}
      <div className="base-header">
        <div className="view-switcher">
          {data.views?.map(view => (
            <button 
              key={view.id}
              className={`view-btn ${data.activeViewId === view.id ? 'active' : ''}`}
              onClick={() => saveData({ ...data, activeViewId: view.id })}
            >
              {view.type === 'table' && <TableIcon size={14} />}
              {view.type === 'board' && <LayoutDashboard size={14} />}
              {view.type === 'gallery' && <Grid size={14} />}
              {view.type === 'list' && <ListIcon size={14} />}
              <span>{view.name}</span>
            </button>
          ))}
          <button className="add-view-btn" title="Add View"><Plus size={14} /></button>
        </div>

        <div className="base-actions">
          <div className="search-box">
            <Search size={14} />
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Filter Menu */}
          <div className="dropdown-container">
            <button 
              className={`action-btn ${filters.length > 0 ? 'active' : ''}`}
              onClick={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Filter size={14} /> Filter {filters.length > 0 && `(${filters.length})`}
            </button>
            {showFilterMenu && (
              <div className="base-dropdown base-dropdown--filter">
                <div className="dropdown-header">Filters</div>
                <div className="filter-list">
                  {filters.map((f, i) => (
                    <div key={i} className="filter-item">
                      <span className="filter-text">{f.field} {f.condition} {f.value}</span>
                      <button onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}><X size={12} /></button>
                    </div>
                  ))}
                  {filters.length === 0 && <div className="empty-text">No active filters</div>}
                </div>
                <div className="dropdown-footer">
                  <button className="add-filter-btn" onClick={() => {
                    const field = BUILT_IN_FIELDS[0];
                    setFilters([...filters, { field, condition: 'contains', value: '' }]);
                  }}>+ Add filter</button>
                  {filters.length > 0 && <button className="clear-btn" onClick={() => setFilters([])}>Clear all</button>}
                </div>
              </div>
            )}
          </div>

          {/* Sort Menu */}
          <div className="dropdown-container">
            <button 
              className={`action-btn ${sortConfig ? 'active' : ''}`}
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              <ArrowUpDown size={14} /> Sort {sortConfig && `(${sortConfig.field})`}
            </button>
            {showSortMenu && (
              <div className="base-dropdown base-dropdown--sort">
                <div className="dropdown-header">Sort By</div>
                <div className="sort-options">
                  {[...BUILT_IN_FIELDS, ...customFields].map(field => (
                    <button 
                      key={field} 
                      className={`sort-option-btn ${sortConfig?.field === field ? 'selected' : ''}`}
                      onClick={() => setSortConfig({ field, direction: sortConfig?.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                    >
                      {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      {sortConfig?.field === field && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ))}
                </div>
                {sortConfig && (
                  <div className="dropdown-footer">
                    <button className="clear-btn" onClick={() => setSortConfig(null)}>Clear sort</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!readOnly && isIndividual && (
            <div className="dropdown-container">
              <button className="action-btn" onClick={() => setShowAddColumn(!showAddColumn)}>
                <Plus size={14} /> Add Column
              </button>
              {showAddColumn && (
                <div className="base-dropdown" style={{ minWidth: 240, left: 0, right: 'auto' }}>
                  <div className="dropdown-header">Add Column</div>
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input placeholder="Column name (e.g. Role, Status)" value={newColName} onChange={e => setNewColName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setShowAddColumn(false); }}
                      autoFocus className="title-edit-input" style={{ fontSize: 13 }} />
                    <select value={newColType} onChange={e => setNewColType(e.target.value as CustomColumnType)}
                      style={{ background: '#2e2e4a', border: '1px solid #3e3e5a', borderRadius: 4, color: 'var(--theme-text-primary)', padding: '6px 8px', fontSize: 13, outline: 'none' }}>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="select">Select</option>
                    </select>
                    <button onClick={handleAddColumn} disabled={!newColName.trim()}
                      style={{ padding: '6px 12px', background: newColName.trim() ? '#7c3aed' : '#2e2e4a', border: 'none', borderRadius: 6, color: 'var(--theme-text-primary)', cursor: newColName.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 600 }}>
                      Add Column
                    </button>
                  </div>
                  {customColumns.length > 0 && (
                    <div style={{ borderTop: '1px  solid var(--theme-border)', padding: '4px 0' }}>
                      <div className="section-label">Existing Columns</div>
                      {customColumns.map(c => (
                        <div key={c.id} className="column-item">
                          <span>{c.name} <span style={{ color: '#64748b', fontSize: 10 }}>({c.type})</span></span>
                          <button onClick={() => handleDeleteColumn(c.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {!readOnly && selectedRows.size > 0 && (
            <button className="action-btn" onClick={handleDeleteSelected}
              style={{ borderColor: 'var(--theme-error)', color: 'var(--theme-error)' }}>
              <X size={14} /> Delete Selected ({selectedRows.size})
            </button>
          )}
          {!readOnly && (
            <button className="action-btn action-btn--primary" onClick={handleCreateDocument}>
              <Plus size={14} /> New Row
            </button>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="base-content">
        {activeView.type === 'table' && (
          <div className="table-view">
            <table>
              <thead>
                <tr>
                  {!readOnly && (
                    <th style={{ width: 36, textAlign: 'center', padding: '8px 4px' }}>
                      <input type="checkbox"
                        checked={processedNotes.length > 0 && selectedRows.size === processedNotes.length}
                        onChange={toggleSelectAll}
                        style={{ accentColor: 'var(--theme-primary)', width: 15, height: 15, cursor: 'pointer' }} />
                    </th>
                  )}
                  <th>File Name</th>
                  {activeView.config.visibleColumns?.map(col => (
                    <th key={col}>{col.replace(/([A-Z])/g, ' $1').toLowerCase()}</th>
                  ))}
                  {isIndividual && customColumns.map(col => (
                    <th key={col.id} className="custom-col-header" onDoubleClick={() => {
                      if (!readOnly) { setEditingColHeaderId(col.id); setEditingColHeaderName(col.name); }
                    }}>
                      {editingColHeaderId === col.id ? (
                        <input autoFocus className="title-edit-input" value={editingColHeaderName}
                          onChange={e => setEditingColHeaderName(e.target.value)}
                          onBlur={() => handleRenameColumn(col.id, editingColHeaderName)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameColumn(col.id, editingColHeaderName); if (e.key === 'Escape') setEditingColHeaderId(null); }}
                          style={{ width: '100%', fontSize: '11px', padding: '2px 4px' }}
                        />
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          {col.name}
                          {!readOnly && <button onClick={(e) => { e.stopPropagation(); handleDeleteColumn(col.id); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={10} /></button>}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="add-col" style={{ position: 'relative' }}>
                    {isIndividual && !readOnly && (
                      <button className="add-col-btn" onClick={() => setShowAddColumn(!showAddColumn)} title="Add column">
                        <Plus size={14} />
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedNotes.map(note => {
                  const builtIn = getBuiltInProperties(note, allDocs);
                  const cf = (note as any).customFields || {};
                  return (
                    <tr key={note.id} style={{ background: selectedRows.has(note.id) ? 'rgba(124,58,237,0.08)' : undefined }}>
                      {!readOnly && (
                        <td style={{ width: 36, textAlign: 'center', padding: '8px 4px' }}>
                          <input type="checkbox"
                            checked={selectedRows.has(note.id)}
                            onChange={() => toggleRowSelection(note.id)}
                            style={{ accentColor: 'var(--theme-primary)', width: 15, height: 15, cursor: 'pointer' }} />
                        </td>
                      )}
                      <td className="cell-title">
                        <div className="title-cell-container">
                          {editingTitleId === note.id && !readOnly ? (
                            <input 
                              autoFocus
                              className="title-edit-input"
                              defaultValue={note.title}
                              onBlur={(e) => handleUpdateTitle(note.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateTitle(note.id, e.currentTarget.value);
                                if (e.key === 'Escape') setEditingTitleId(null);
                              }}
                            />
                          ) : (
                            <div 
                              className="clickable-title"
                              onClick={() => !readOnly ? setEditingTitleId(note.id) : undefined}
                              onDoubleClick={() => window.dispatchEvent(new CustomEvent('coollab-navigate', { detail: { docId: note.id } }))}
                            >
                              {note.title}
                            </div>
                          )}
                        </div>
                      </td>
                      {activeView.config.visibleColumns?.map(col => {
                        const isBuiltIn = BUILT_IN_FIELDS.includes(col);
                        const val = isBuiltIn ? (builtIn as any)[col] : note.properties?.[col]?.value;
                        return (
                          <td key={col} className={isBuiltIn ? 'cell-readonly' : 'cell-editable'}>
                            {Array.isArray(val) ? (val.length > 0 ? val.join(', ') : '—') : 
                             typeof val === 'number' && col.toLowerCase().includes('time') ? new Date(val).toLocaleDateString() :
                             (val || '—')}
                          </td>
                        );
                      })}
                      {isIndividual && customColumns.map(col => {
                        const cellKey = `${note.id}:${col.id}`;
                        const cellVal = cf[col.id] ?? '';
                        const isEditing = editingCellId === cellKey;
                        if (col.type === 'checkbox') {
                          return (
                            <td key={col.id} className="cell-editable" style={{ textAlign: 'center' }}>
                              <input type="checkbox" checked={!!cellVal} disabled={readOnly}
                                onChange={e => handleCellEdit(note.id, col.id, e.target.checked)}
                                style={{ accentColor: 'var(--theme-primary)', width: 16, height: 16, cursor: readOnly ? 'default' : 'pointer' }} />
                            </td>
                          );
                        }
                        return (
                          <td key={col.id} className="cell-editable" onClick={() => !readOnly && setEditingCellId(cellKey)}>
                            {isEditing ? (
                              <input autoFocus className="title-edit-input"
                                type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                defaultValue={cellVal}
                                onBlur={e => handleCellEdit(note.id, col.id, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCellEdit(note.id, col.id, col.type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value); if (e.key === 'Escape') setEditingCellId(null); }}
                                style={{ fontSize: 13 }} />
                            ) : (
                              <span style={{ color: cellVal ? '#e2e8f0' : '#4b5563', cursor: readOnly ? 'default' : 'pointer' }}>
                                {col.type === 'date' && cellVal ? new Date(cellVal).toLocaleDateString() : (cellVal || '—')}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', padding: '4px' }}>
                        {!readOnly && (
                          <button onClick={() => { if (window.confirm(`Delete "${note.title}"?`)) handleDeleteRow(note.id); }}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                            title="Delete row">
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeView.type === 'board' && (
          <div className="board-view">
            {(() => {
              const groupBy = activeView.config.groupByProperty || 'status';
              const groups: Record<string, DocumentSchema[]> = { 'No Value': [] };
              
              processedNotes.forEach(n => {
                const val = n.properties?.[groupBy]?.value || 'No Value';
                if (!groups[val]) groups[val] = [];
                groups[val].push(n);
              });

              return Object.entries(groups).map(([groupName, groupNotes]) => (
                <div key={groupName} className="board-column">
                  <div className="column-header">
                    <span>{groupName}</span>
                    <span className="count">{groupNotes.length}</span>
                  </div>
                  <div className="column-cards">
                    {groupNotes.map(note => (
                      <div key={note.id} className="board-card" onClick={() => window.dispatchEvent(new CustomEvent('coollab-navigate', { detail: { docId: note.id } }))}>
                        <div className="card-title">{note.title}</div>
                        <div className="card-props">
                          {activeView.config.visibleColumns?.map(col => (
                            <div key={col} className="card-prop">
                              <span className="prop-name">{col}:</span>
                              <span className="prop-val">{String(note.properties?.[col]?.value || '—')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!readOnly && (
                      <button className="add-card-btn" onClick={handleCreateDocument}><Plus size={14} /> Add card</button>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {activeView.type === 'gallery' && (
          <div className="gallery-view">
            {processedNotes.map(note => (
              <div key={note.id} className="gallery-card" onClick={() => window.dispatchEvent(new CustomEvent('coollab-navigate', { detail: { docId: note.id } }))}>
                <div className="gallery-card__preview">
                  {/* Placeholder for real preview */}
                  <StickyNote size={32} />
                </div>
                <div className="gallery-card__info">
                  <div className="card-title">{note.title}</div>
                  <div className="card-meta">{new Date(note.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView.type === 'list' && (
          <div className="list-view">
            {processedNotes.map(note => (
              <div key={note.id} className="list-item" onClick={() => window.dispatchEvent(new CustomEvent('coollab-navigate', { detail: { docId: note.id } }))}>
                <StickyNote size={16} />
                <span className="item-title">{note.title}</span>
                <span className="item-meta">{new Date(note.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
