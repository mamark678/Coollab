import {
  Hand,
  Image as ImageIcon,
  Layers,
  Link2,
  Maximize,
  MousePointer2,
  StickyNote,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { DocumentSchema, FirebaseService } from '../../services/firebase';
import { YjsService } from '../../services/yjs';
import { SyncService } from '../../services/sync';
import { useAppStore } from '../../store/useAppStore';
import * as Y from 'yjs';
import './Canvas.css';
import { CanvasCardType, CanvasData, CanvasEdge, CanvasNode } from './Canvas.types';

interface CanvasProps {
  roomName: string;
  username: string;
  userId?: string;
  readOnly?: boolean;
}

const NoteCardContent: React.FC<{ noteId: string }> = ({ noteId }) => {
  const [note, setNote] = useState<DocumentSchema | null>(null);

  useEffect(() => {
    if (!noteId) return;
    const firebase = FirebaseService.getInstance();
    const unsub = firebase.listenToNote(noteId, (doc) => {
      setNote(doc);
    });
    return () => unsub();
  }, [noteId]);

  if (!noteId) return <div className="placeholder">Select a document</div>;
  if (!note) return <div className="placeholder">Loading...</div>;

  return (
    <div className="note-card-content">
      <div className="note-title">{note.title}</div>
      <div className="note-preview">
        {note.searchText?.substring(0, 200) || 'No content'}
      </div>
    </div>
  );
};

const ImageCardContent: React.FC<{ node: CanvasNode, updateNode: (id: string, updates: Partial<CanvasNode>) => void }> = ({ node, updateNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await (window as any).electronAPI.invoke('canvas:open-image-dialog');
      if (result) {
        if (result.size > 1024 * 1024) {
          const confirm = window.confirm('This image is larger than 1MB. Are you sure you want to proceed?');
          if (!confirm) {
            setIsLoading(false);
            return;
          }
        }
        updateNode(node.id, { imageBase64: result.base64, imageType: result.mimeType, content: '' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open file dialog or read image');
    } finally {
      setIsLoading(false);
    }
  };

  if (node.imageBase64) {
    return <img src={`data:${node.imageType || 'image/png'};base64,${node.imageBase64}`} alt="Canvas content" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />;
  }

  if (node.content !== 'new_image') {
    return (
      <div className="placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--theme-error)' }}>
        <ImageIcon size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
        <span>Broken Image</span>
      </div>
    );
  }

  return (
    <div className="image-card-content" style={{ display: 'flex', flexDirection: 'column', padding: '10px', gap: '8px', height: '100%', boxSizing: 'border-box' }}>
      {isLoading ? (
        <div className="placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span className="loading-spinner" style={{ marginRight: '8px' }}></span> Loading...
        </div>
      ) : (
        <div className="placeholder" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <button 
            onClick={handleFileUpload} 
            style={{ width: '100%', padding: '8px', cursor: 'pointer', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600 }}
            onMouseDown={e => e.stopPropagation()}
          >
            Upload Local Image
          </button>
          {error && <div style={{ color: 'var(--theme-error)', fontSize: '11px', textAlign: 'center', marginTop: '4px' }}>{error}</div>}
        </div>
      )}
    </div>
  );
};

export const Canvas: React.FC<CanvasProps> = ({ roomName, username, userId, readOnly = false }) => {
  const [data, setData] = useState<CanvasData>({ nodes: [], edges: [] });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'select' | 'pan' | 'connect'>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectingNote, setIsSelectingNote] = useState<string | null>(null); // nodeId to update
  const [allNotes, setAllNotes] = useState<DocumentSchema[]>([]);
  const [cursors, setCursors] = useState<Record<string, any>>({});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null); // source nodeId for connect mode
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number, y: number }>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const isDragging = useRef(false);

  const yjsService = YjsService.getInstance();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<any>(null);

  // ── Yjs Collaboration ────────────────────────────────────────────────
  useEffect(() => {
    if (!roomName) return;
    setLoading(true);
    
    const yjs = YjsService.getInstance();
    const sync = SyncService.getInstance();

    yjs.init({ roomName }).then(async () => {
      console.log(`[Canvas] [DEBUG] Yjs initialized for room: "${roomName}"`);
      const store = useAppStore.getState();
      const pId = store.currentProjectId;
      const uId = store.activityType === 'individual' ? (store.viewingStudentId || userId) : undefined;
      await sync.bootSync(roomName, pId || undefined, uId || undefined, 'canvas');
      
      const doc = yjs.getDoc();
      const provider = yjs.getProvider();
      providerRef.current = provider;
      
      const nodesMap = doc.getMap<CanvasNode>('canvas-nodes');
      const edgesMap = doc.getMap<CanvasEdge>('canvas-edges');

      // Hydrate from Firestore if Yjs state is empty (Step 2)
      if (nodesMap.size === 0) {
        const firebase = FirebaseService.getInstance();
        firebase.getNote(roomName, pId || undefined, uId || undefined, 'canvas').then((note: any) => {
          if (note && note.nodes && note.nodes.length > 0 && nodesMap.size === 0) {
            doc.transact(() => {
              note.nodes.forEach((n: any) => nodesMap.set(n.id, n));
              (note.edges || []).forEach((e: any) => edgesMap.set(e.id, e));
            }, 'initial-hydration');
          }
        });
      }

      const syncFromYjs = () => {
        const received = Date.now();
        const sent = (window as any).__canvasLastChange || 0;
        console.log(`[Canvas] REMOTE update received at ${received}${sent ? ` | Approximate Local Delay: ${received - sent}ms` : ''}`);
        
        setData({
          nodes: Array.from(nodesMap.values()),
          edges: Array.from(edgesMap.values())
        });
      };

      nodesMap.observe(syncFromYjs);
      edgesMap.observe(syncFromYjs);
      syncFromYjs();

      // Set local awareness state
      provider.awareness.setLocalStateField('user', {
        uid: userId,
        name: username,
        color: 'var(--theme-primary)', // Default canvas user color
      });

      // Awareness (Cursors)
      const updateCursors = () => {
        const states = provider.awareness.getStates();
        const nextCursors: Record<string, any> = {};
        states.forEach((state: any, clientID: number) => {
          if (state.cursor && clientID !== doc.clientID) {
            nextCursors[clientID] = state;
          }
        });
        setCursors(nextCursors);
      };

      provider.awareness.on('change', updateCursors);

      // Monitor connection status for debugging latency
      console.log('[Canvas Yjs] Provider created:', provider);
      provider.on('status', (event: { connected: boolean }) => {
        console.log(`[Canvas Yjs] Status Update at ${Date.now()}:`, event);
      });
      provider.on('peers', (event: { webrtcPeers: string[], bcPeers: string[] }) => {
        console.log(`[Canvas Yjs] Peers at ${Date.now()}:`, event);
        console.log(`[Canvas Yjs] WebRTC peers count: ${event.webrtcPeers?.length}`);
        console.log(`[Canvas Yjs] BC peers count: ${event.bcPeers?.length}`);
      });
      provider.on('synced', (event: any) => {
        console.log(`[Canvas Yjs] Synced at ${Date.now()}:`, event);
      });

      // Step 4 Debug Info
      console.log('[Canvas Debug] Has ydoc:', !!doc);
      console.log('[Canvas Debug] Has provider:', !!provider);
      console.log('[Canvas Debug] nodesMap size:', nodesMap.size);

      setLoading(false);
    });

    return () => {
      if (providerRef.current) {
        providerRef.current.awareness.setLocalState(null);
      }
      sync.destroy();
      yjs.destroy();
    };
  }, [roomName, username, userId]);

  // ── Periodic Backup Save (Step 4) ──────────────────────────────────
  useEffect(() => {
    if (!roomName || readOnly || data.nodes.length === 0) return;
    const interval = setInterval(() => {
      const firebase = FirebaseService.getInstance();
      firebase.saveNote(roomName, {
        nodes: data.nodes,
        edges: data.edges,
        updatedAt: Date.now()
      } as any);
    }, 30000); // 30s backup interval
    return () => clearInterval(interval);
  }, [roomName, data.nodes, data.edges, readOnly]);

  useEffect(() => {
    const handleDocDeleted = (e: any) => {
      const deletedId = e.detail?.docId;
      if (!deletedId) return;

      const doc = yjsService.getDoc();
      const nodesMap = doc.getMap<CanvasNode>('canvas-nodes');
      const edgesMap = doc.getMap<CanvasEdge>('canvas-edges');

      const idsToRemove: string[] = [];

      Array.from(nodesMap.values()).forEach((node) => {
        if (node.type === 'note' && node.content === deletedId) {
          idsToRemove.push(node.id);
        }
      });

      if (idsToRemove.length > 0) {
        idsToRemove.forEach(id => nodesMap.delete(id));
        Array.from(edgesMap.values()).forEach(edge => {
          if (idsToRemove.includes(edge.fromId) || idsToRemove.includes(edge.toId)) {
            edgesMap.delete(edge.id);
          }
        });
      }
    };

    window.addEventListener('coollab-doc-deleted', handleDocDeleted);
    return () => window.removeEventListener('coollab-doc-deleted', handleDocDeleted);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't pan if typing in a textarea
        if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Manual wheel listener to support non-passive preventDefault and zoom-to-cursor
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleWheelRaw = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Mouse position in canvas space before zoom
      const canvasX = (mouseX - offset.x) / scale;
      const canvasY = (mouseY - offset.y) / scale;

      const zoomSpeed = 0.1;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(3, Math.max(0.1, scale * delta));

      // New offset to keep the canvas point under the mouse
      const newOffsetX = mouseX - canvasX * newScale;
      const newOffsetY = mouseY - canvasY * newScale;

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    };

    el.addEventListener('wheel', handleWheelRaw, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelRaw);
  }, [offset, scale]);

  const addNode = (type: CanvasCardType) => {
    const doc = yjsService.getDoc();
    const nodesMap = doc.getMap<CanvasNode>('canvas-nodes');
    const newNodeId = `node-${Math.random().toString(36).substr(2, 9)}`;

    const newNode: CanvasNode = {
      id: newNodeId,
      type,
      x: (-offset.x + 100) / scale,
      y: (-offset.y + 100) / scale,
      width: type === 'group' ? 400 : 250,
      height: type === 'group' ? 300 : 150,
      content: type === 'text' ? 'New text card' : type === 'group' ? 'New Group' : type === 'image' ? 'new_image' : '',
      color: type === 'group' ? '#7c3aed' : undefined
    };

    nodesMap.set(newNodeId, newNode);
    // Real-time sync handled by Yjs; periodic backup handles Firestore

    window.dispatchEvent(new CustomEvent('workspace-action', {
      detail: { type: 'canvas_node_created', label: newNode.content }
    }));

    if (type === 'note') {
      setIsSelectingNote(newNodeId);
      fetchNotes();
    }
  };

  const fetchNotes = async () => {
    const firebase = FirebaseService.getInstance();
    const docs = await firebase.listUserNotes(firebase.auth.currentUser?.uid || '');
    setAllNotes(docs.filter(d => d.type === 'document' || !d.type));
  };

  const updateNode = (id: string, updates: Partial<CanvasNode>) => {
    if (readOnly) return;
    const now = Date.now();
    console.log(`[Canvas] LOCAL change at ${now} — updating ${id}`);
    (window as any).__canvasLastChange = now;

    const doc = yjsService.getDoc();
    const nodesMap = doc.getMap<CanvasNode>('canvas-nodes');
    const existing = nodesMap.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      yjsService.getDoc().transact(() => {
        nodesMap.set(id, updated);
      }, 'local-update');
    }
  };

  const addEdge = (fromId: string, toId: string) => {
    if (readOnly || fromId === toId) return;
    const doc = yjsService.getDoc();
    const edgesMap = doc.getMap<CanvasEdge>('canvas-edges');
    // Check for duplicate edge
    const exists = Array.from(edgesMap.values()).some(
      e => (e.fromId === fromId && e.toId === toId) || (e.fromId === toId && e.toId === fromId)
    );
    if (exists) return;
    const edgeId = `edge-${Math.random().toString(36).substr(2, 9)}`;
    const newEdge = { id: edgeId, fromId, toId };
    edgesMap.set(edgeId, newEdge);
  };

  const deleteEdge = (edgeId: string) => {
    if (readOnly) return;
    const doc = yjsService.getDoc();
    const edgesMap = doc.getMap<CanvasEdge>('canvas-edges');
    edgesMap.delete(edgeId);
    setSelectedEdgeId(null);
  };

  const deleteSelected = async () => {
    if (readOnly || selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} item(s)?`)) return;
    
    const doc = yjsService.getDoc();
    const nodesMap = doc.getMap<CanvasNode>('canvas-nodes');
    const edgesMap = doc.getMap<CanvasEdge>('canvas-edges');
    const firebase = FirebaseService.getInstance();

    setDeleteError(null);

    try {
      // 1. Only delete Firestore documents for 'note' type nodes that embed a real document
      const store = useAppStore.getState();
      const pId = store.activityType === 'individual' ? store.currentProjectId : undefined;
      const uId = store.activityType === 'individual' ? (store.viewingStudentId || userId) : undefined;

      for (const id of selectedIds) {
        const node = nodesMap.get(id);
        if (node && node.type === 'note' && node.content) {
          // Only note-type nodes reference a real Firestore document
          await firebase.deleteNote(node.content, pId || undefined, uId || undefined, 'document').catch((err) => {
            console.warn('[Canvas] Could not delete linked doc:', node.content, err.message);
          });
          window.dispatchEvent(new CustomEvent('coollab-doc-deleted', { detail: { docId: node.content } }));
        }
        // text, image, group nodes are Yjs-only — no Firestore doc to delete
      }

      // 2. Collect edges to remove
      const edgesToDelete = Array.from(edgesMap.values()).filter(edge => 
        selectedIds.includes(edge.fromId) || selectedIds.includes(edge.toId) || selectedIds.includes(edge.id)
      );

      // 3. Remove from Yjs (which syncs to Firestore via SyncService)
      selectedIds.forEach(id => nodesMap.delete(id));
      edgesToDelete.forEach(edge => edgesMap.delete(edge.id));
      
      setSelectedIds([]);
      // Global fix for focus bug on Windows: force reload after delete
      window.location.reload();
    } catch (err) {
      console.error('[Canvas] Failed to delete from Firestore:', err);
      setDeleteError('Failed to permanently delete some items from Firestore. Please try again.');
      setTimeout(() => setDeleteError(null), 3000);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'pan' || e.button === 1 || spacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (providerRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;
        providerRef.current.awareness.setLocalStateField('cursor', { x, y });
      }
    }

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  if (loading) return <div className="canvas-loading">Loading Canvas...</div>;

  return (
    <div
      className="canvas-container"
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        if (providerRef.current) {
          providerRef.current.awareness.setLocalStateField('cursor', null);
        }
      }}
      style={{ cursor: (tool === 'pan' || spacePressed) ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
      onClick={() => { setSelectedIds([]); setSelectedEdgeId(null); }}
    >
        {/* Background Grid */}
        <div
          className="canvas-grid"
          style={{
            backgroundPosition: `${offset.x}px ${offset.y}px`,
            backgroundSize: `${40 * scale}px ${40 * scale}px`
          }}
        />

        {/* Viewport */}
        <div
          className="canvas-viewport"
          ref={viewportRef}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Render Edges (Arrows) */}
          <svg className="canvas-edges" style={{ position: 'absolute', top: 0, left: 0, width: '10000px', height: '10000px', zIndex: 10, pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 14 5, 0 10" fill="#7c3aed" />
              </marker>
              <marker id="arrowhead-selected" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 14 5, 0 10" fill="#ef4444" />
              </marker>
              <filter id="edge-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {data.edges?.map(edge => {
              const from = data.nodes.find(n => n.id === edge.fromId);
              const to = data.nodes.find(n => n.id === edge.toId);
              if (!from || !to) return null;

              const fromX = dragPositions[from.id]?.x ?? from.x;
              const fromY = dragPositions[from.id]?.y ?? from.y;
              const toX = dragPositions[to.id]?.x ?? to.x;
              const toY = dragPositions[to.id]?.y ?? to.y;

              const cx1 = fromX + from.width / 2;
              const cy1 = fromY + from.height / 2;
              const cx2 = toX + to.width / 2;
              const cy2 = toY + to.height / 2;

              const angle = Math.atan2(cy2 - cy1, cx2 - cx1);
              const reverseAngle = Math.atan2(cy1 - cy2, cx1 - cx2);

              const x1 = cx1 + Math.cos(angle) * (from.width / 2);
              const y1 = cy1 + Math.sin(angle) * (from.height / 2);
              const x2 = cx2 + Math.cos(reverseAngle) * (to.width / 2);
              const y2 = cy2 + Math.sin(reverseAngle) * (to.height / 2);

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
              const curvature = dist * 0.15;
              const perpX = -(y2 - y1) / dist * curvature;
              const perpY = (x2 - x1) / dist * curvature;

              const pathD = `M ${x1} ${y1} Q ${midX + perpX} ${midY + perpY}, ${x2} ${y2}`;
              const isSelected = selectedEdgeId === edge.id;

              return (
                <g key={edge.id}>
                  {/* Invisible wide hit-area for clicking */}
                  <path
                    d={pathD}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(isSelected ? null : edge.id); setSelectedIds([]); }}
                  />
                  {/* Visible edge */}
                  <path
                    d={pathD}
                    stroke={isSelected ? '#ef4444' : '#7c3aed'}
                    strokeWidth={isSelected ? 4 : 3}
                    fill="none"
                    markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                    filter="url(#edge-glow)"
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Delete button at midpoint when selected */}
                  {isSelected && !readOnly && (
                    <g
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); }}
                    >
                      <circle cx={midX + perpX} cy={midY + perpY} r="12" fill="#ef4444" />
                      <text x={midX + perpX} y={midY + perpY} textAnchor="middle" dominantBaseline="central"
                        fill="#fff" fontSize="14" fontWeight="bold" style={{ pointerEvents: 'none' }}>×</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Render Cursors */}
          {Object.entries(cursors).map(([id, state]) => (
            <div
              key={id}
              className="canvas-cursor"
              style={{
                left: state.cursor.x,
                top: state.cursor.y,
                backgroundColor: state.user?.color || '#7c3aed'
              }}
            >
              <div className="cursor-label">{state.user?.name || 'User'}</div>
            </div>
          ))}

          {/* Render Nodes (Cards) */}
          {data.nodes?.map(node => (
            <Rnd
              key={node.id}
              size={{ width: node.width, height: node.height }}
              position={{ x: node.x, y: node.y }}
              onDragStart={() => {
                isDragging.current = true;
              }}
              onDrag={(e, d) => {
                setDragPositions(prev => ({ ...prev, [node.id]: { x: d.x, y: d.y } }));
                // For real-time peer sync during drag (Yjs is instant)
                if (!readOnly) updateNode(node.id, { x: d.x, y: d.y });
              }}
              onDragStop={(e, d) => {
                isDragging.current = false;
                setDragPositions(prev => {
                  const next = { ...prev };
                  delete next[node.id];
                  return next;
                });
                // Final sync
                if (!readOnly) {
                  updateNode(node.id, { x: d.x, y: d.y });
                }
              }}
              onResizeStart={() => {
                isDragging.current = true;
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                isDragging.current = false;
                if (readOnly) return;
                const width = parseInt(ref.style.width);
                const height = parseInt(ref.style.height);
                updateNode(node.id, { width, height, ...position });
              }}
              scale={scale}
              dragEnabled={tool === 'select'}
              className={`canvas-node canvas-node--${node.type} ${selectedIds.includes(node.id) ? 'canvas-node--selected' : ''} ${connectFrom === node.id ? 'canvas-node--connect-source' : ''}`}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (tool === 'connect') {
                  if (!connectFrom) {
                    setConnectFrom(node.id);
                  } else {
                    addEdge(connectFrom, node.id);
                    setConnectFrom(null);
                  }
                  return;
                }
                if (e.shiftKey) {
                  setSelectedIds(prev => prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]);
                } else {
                  setSelectedIds([node.id]);
                }
              }}
            >
              <div className="canvas-node__inner" style={node.type === 'group' ? { borderColor: node.color, backgroundColor: `${node.color}11` } : {}}>
                <div className="canvas-node__header">
                  <span className="node-type-icon">
                    {node.type === 'note' && <StickyNote size={12} />}
                    {node.type === 'text' && <Type size={12} />}
                    {node.type === 'image' && <ImageIcon size={12} />}
                    {node.type === 'group' && <Layers size={12} />}
                  </span>
                  <span className="node-label">
                    {node.type === 'group' ? node.content : node.type === 'note' ? 'Document Embed' : ''}
                  </span>
                </div>

                <div className="canvas-node__content">
                  {node.type === 'text' && (
                    <textarea
                      value={node.content}
                      onChange={(e) => updateNode(node.id, { content: e.target.value })}
                      onMouseDown={e => e.stopPropagation()}
                      placeholder="Type something..."
                      readOnly={readOnly}
                    />
                  )}
                  {node.type === 'image' && (
                    <ImageCardContent node={node} updateNode={updateNode} />
                  )}
                  {node.type === 'note' && (
                    <NoteCardContent noteId={node.content} />
                  )}
                </div>
              </div>
            </Rnd>
          ))}
        </div>

        {/* Toolbar */}
        {!readOnly && (
          <div className="canvas-toolbar" onClick={e => e.stopPropagation()}>
            <div className="toolbar-group">
              <button className={`toolbar-btn ${tool === 'select' ? 'active' : ''}`} onClick={() => { setTool('select'); setConnectFrom(null); }} title="Select (V)">
                <MousePointer2 size={18} />
              </button>
              <button className={`toolbar-btn ${tool === 'pan' ? 'active' : ''}`} onClick={() => { setTool('pan'); setConnectFrom(null); }} title="Pan (H)">
                <Hand size={18} />
              </button>
              <button className={`toolbar-btn ${tool === 'connect' ? 'active' : ''}`} onClick={() => { setTool('connect'); setConnectFrom(null); setSelectedIds([]); }} title="Connect Nodes (C)">
                <Link2 size={18} />
              </button>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <button className="toolbar-btn" onClick={() => addNode('note')} title="Add Document Card">
                <StickyNote size={18} />
              </button>
              <button className="toolbar-btn" onClick={() => addNode('text')} title="Add Text Card">
                <Type size={18} />
              </button>
              <button className="toolbar-btn" onClick={() => addNode('image')} title="Add Image Card">
                <ImageIcon size={18} />
              </button>
              <button className="toolbar-btn" onClick={() => addNode('group')} title="Add Group">
                <Layers size={18} />
              </button>
            </div>
            {selectedIds.length === 2 && (
              <>
                <div className="toolbar-divider" />
                <div className="toolbar-group">
                  <button className="toolbar-btn" onClick={() => { addEdge(selectedIds[0], selectedIds[1]); setSelectedIds([]); }} title="Connect Selected Nodes">
                    <Link2 size={18} />
                    <span style={{ fontSize: 11, marginLeft: 4 }}>Connect</span>
                  </button>
                </div>
              </>
            )}
            {selectedIds.length > 0 && (
              <>
                <div className="toolbar-divider" />
                <div className="toolbar-group">
                  <button className="toolbar-btn danger" onClick={deleteSelected} title="Delete Selected">
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Actions (Zoom controls) */}
        <div className="canvas-zoom-controls" onClick={e => e.stopPropagation()}>
          <button onClick={() => setScale(prev => Math.max(0.1, prev * 0.9))} title="Zoom Out"><ZoomOut size={16} /></button>
          <span className="zoom-percentage">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(prev => Math.min(3, prev * 1.1))} title="Zoom In"><ZoomIn size={16} /></button>
          <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} title="Reset View"><Maximize size={16} /></button>
        </div>

        {/* Note Selector Modal */}
        {isSelectingNote && (
          <div className="canvas-modal-overlay" onClick={() => setIsSelectingNote(null)}>
            <div className="canvas-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">Select a document to embed</div>
              <div className="note-list">
                {allNotes.map(note => (
                  <div
                    key={note.id}
                    className="note-list-item"
                    onClick={() => {
                      updateNode(isSelectingNote, { content: note.id });
                      setIsSelectingNote(null);
                    }}
                  >
                    <StickyNote size={14} />
                    <span>{note.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {deleteError && (
          <div style={{
            position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--theme-error)', color: 'white', padding: '8px 16px', borderRadius: '4px',
            zIndex: 1000, fontSize: '13px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}>
            {deleteError}
          </div>
        )}
      </div>
    );
  };
