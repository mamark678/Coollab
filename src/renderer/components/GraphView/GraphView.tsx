// ─── Graph View Component ──────────────────────────────────────────────────
// Hosts the canvas, controls, and tooltip for the Obsidian-style graph.

import { GitBranch, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GraphControls } from './GraphControls';
import { hitTestNode, renderGraph, screenToGraph } from './graphRenderer';
import './GraphView.css';
import type { GraphConfig, GraphNode, GraphViewState } from './GraphView.types';
import { DEFAULT_GRAPH_CONFIG, DEFAULT_GRAPH_STATE } from './GraphView.types';
import { useForceSimulation } from './useForceSimulation';
import { useGraphData } from './useGraphData';

interface GraphViewProps {
  activeDocId: string | null;
  onNavigateToDoc?: (docId: string) => void;
  isVisible: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const GraphView: React.FC<GraphViewProps> = React.memo(({
  activeDocId,
  onNavigateToDoc,
  isVisible,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);
  const [viewState, setViewState] = useState<GraphViewState>(DEFAULT_GRAPH_STATE);
  const [tooltipNode, setTooltipNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Pan/drag tracking refs ─────────────────────────────────────────────
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  // Inertia
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const inertiaFrameRef = useRef<number>(0);
  const lastPanTimeRef = useRef(0);

  // Smooth camera animation
  const cameraAnimRef = useRef<number>(0);
  const lastFocusedIdRef = useRef<string | null>(null);

  // Render loop frame ref
  const animFrameRef = useRef<number>(0);

  // Auto-fit tracking
  const hasInitialFitRef = useRef(false);
  const prevFullscreenRef = useRef(isFullscreen);

  // Load graph data from Firebase
  const { nodes, edges, loading, error, retry } = useGraphData(activeDocId, config.nodeSize);

  // ── Local View Filtering ──────────────────────────────────────────────
  const getLocalGraphData = useCallback(() => {
    if (!viewState.isLocalView || !activeDocId) return { filteredNodes: nodes, filteredEdges: edges };

    const localNodes = new Set<string>();
    const localEdges: typeof edges = [];

    const visit = (nodeId: string, depth: number) => {
      if (depth > config.localViewDepth || localNodes.has(nodeId)) return;
      localNodes.add(nodeId);
      edges.forEach((edge) => {
        if (edge.source === nodeId) {
          localEdges.push(edge);
          visit(edge.target, depth + 1);
        } else if (edge.target === nodeId) {
          localEdges.push(edge);
          visit(edge.source, depth + 1);
        }
      });
    };

    visit(activeDocId, 0);

    return {
      filteredNodes: nodes.filter((n) => localNodes.has(n.id)),
      filteredEdges: edges.filter((e) => localNodes.has(e.source) && localNodes.has(e.target)),
    };
  }, [nodes, edges, activeDocId, viewState.isLocalView, config.localViewDepth]);

  const { filteredNodes: baseNodes, filteredEdges: baseEdges } = getLocalGraphData();

  const filteredNodes = config.showOrphans
    ? baseNodes
    : baseNodes.filter((n) => n.linkCount > 0);

  const { simulatedNodes, reheat, dragStart, drag, dragEnd } = useForceSimulation(
    filteredNodes,
    baseEdges,
    config,
    isVisible
  );

  // ── Helper: animate camera to fit all nodes in the given container size ──
  const animateFitToNodes = useCallback((
    targetNodes: GraphNode[],
    cw: number,
    ch: number,
    duration = 400
  ) => {
    if (targetNodes.length === 0 || cw <= 0 || ch <= 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of targetNodes) {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }

    const graphW = maxX - minX + 80;
    const graphH = maxY - minY + 80;
    const zoom = Math.min(cw / graphW, ch / graphH, 2);
    const targetPanX = cw / 2 - ((minX + maxX) / 2) * zoom;
    const targetPanY = ch / 2 - ((minY + maxY) / 2) * zoom;

    const startPanX = viewStateRef.current.panX;
    const startPanY = viewStateRef.current.panY;
    const startZoom = viewStateRef.current.zoom;
    const start = performance.now();

    cancelAnimationFrame(cameraAnimRef.current);

    const animate = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setViewState((prev) => ({
        ...prev,
        panX: startPanX + (targetPanX - startPanX) * ease,
        panY: startPanY + (targetPanY - startPanY) * ease,
        zoom: startZoom + (zoom - startZoom) * ease,
      }));
      if (t < 1) cameraAnimRef.current = requestAnimationFrame(animate);
    };

    cameraAnimRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Auto-fit on first load & fullscreen toggle ────────────────────────
  const hasNodes = simulatedNodes.length > 0;
  useEffect(() => {
    if (!hasNodes || !isVisible) return;

    const fullscreenChanged = prevFullscreenRef.current !== isFullscreen;
    prevFullscreenRef.current = isFullscreen;

    const needsFit = !hasInitialFitRef.current || fullscreenChanged;
    if (!needsFit) return;

    hasInitialFitRef.current = true;

    if (activeDocId) {
      setViewState((prev) => ({ ...prev, selectedNodeId: activeDocId }));
    }

    // Wait a few frames for layout to settle (especially after fullscreen)
    let frame = 0;
    const waitAndFit = () => {
      if (frame++ < 3) {
        requestAnimationFrame(waitAndFit);
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      animateFitToNodes(simulatedNodes, rect.width, rect.height, fullscreenChanged ? 350 : 500);
    };
    requestAnimationFrame(waitAndFit);

    return () => cancelAnimationFrame(cameraAnimRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNodes, isVisible, isFullscreen, simulatedNodes, animateFitToNodes]);

  // ── Smooth focus-to-node when activeDocId changes ─────────────────────
  useEffect(() => {
    if (!activeDocId || !hasNodes) return;

    const target = simulatedNodes.find((n) => n.id === activeDocId);
    if (!target) return;

    if (lastFocusedIdRef.current === activeDocId) return;
    lastFocusedIdRef.current = activeDocId;

    setViewState((prev) => ({ ...prev, selectedNodeId: activeDocId }));

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const targetZoom = Math.min(2, Math.max(viewStateRef.current.zoom, 1.2));
    const targetPanX = cw / 2 - target.x * targetZoom;
    const targetPanY = ch / 2 - target.y * targetZoom;

    const startPanX = viewStateRef.current.panX;
    const startPanY = viewStateRef.current.panY;
    const startZoom = viewStateRef.current.zoom;

    const duration = 500;
    const start = performance.now();

    cancelAnimationFrame(cameraAnimRef.current);

    const animate = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setViewState((prev) => ({
        ...prev,
        panX: startPanX + (targetPanX - startPanX) * ease,
        panY: startPanY + (targetPanY - startPanY) * ease,
        zoom: startZoom + (targetZoom - startZoom) * ease,
      }));
      if (t < 1) cameraAnimRef.current = requestAnimationFrame(animate);
    };

    cameraAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(cameraAnimRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, simulatedNodes]);

  // ── Canvas resize & High-DPI management ──────────────────────────────
  const [logicalSize, setLogicalSize] = useState({ width: 0, height: 0 });

  // Use a ref to track logical size inside callbacks without causing dep loops.
  const logicalSizeRef = useRef({ width: 0, height: 0 });

  // syncDimensions reads the container's current layout size and updates the
  // canvas buffer to match, applying devicePixelRatio for HiDPI sharpness.
  // IMPORTANT: no state in deps — uses refs to avoid infinite loops.
  const syncDimensions = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    if (logicalSizeRef.current.width !== w || logicalSizeRef.current.height !== h) {
      logicalSizeRef.current = { width: w, height: h };
      setLogicalSize({ width: w, height: h });
    }
  }, []);

  // When visibility or fullscreen changes, wait for the browser to finish
  // painting the new layout before reading dimensions. setTimeout(0) fires
  // after layout+paint, matching the timing of a ResizeObserver callback.
  useEffect(() => {
    if (!isVisible) return;

    const resizeHandle = () => {
      syncDimensions();
    };

    window.addEventListener('resize', resizeHandle);

    // Use requestAnimationFrame to ensure we sync AFTER the browser's layout pass
    // for the fullscreen transition, and do it multiple times to catch any layout shifts.
    let frames = 0;
    const syncLoop = () => {
      syncDimensions();
      if (frames++ < 5) {
        requestAnimationFrame(syncLoop);
      }
    };
    requestAnimationFrame(syncLoop);

    return () => {
      window.removeEventListener('resize', resizeHandle);
    };
  }, [isVisible, isFullscreen, syncDimensions]);

  // ResizeObserver handles all ongoing resize events (window drag, panel resize)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(syncDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [syncDimensions]);

  // ── Render loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const draw = (): void => {
      // Read real container dimensions every frame so the canvas buffer
      // is always in sync with the display size.  This makes the render
      // loop self-healing — even if a resize event is missed or fires
      // before layout settles, the very next frame corrects the buffer
      // and the graph is never blurry.
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w <= 0 || h <= 0) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        logicalSizeRef.current = { width: w, height: h };
      }

      renderGraph(
        ctx,
        simulatedNodes,
        edges,
        viewStateRef.current,
        config,
        w,
        h
      );
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [simulatedNodes, edges, config, isVisible]);

  // ── Wheel zoom — must be a native non-passive listener ────────────────
  // React's synthetic onWheel is passive and cannot call preventDefault(),
  // which causes page scroll to compete with canvas zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(inertiaFrameRef.current);
      
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setViewState((prev) => {
        const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor));
        const panX = cx - (cx - prev.panX) * (newZoom / prev.zoom);
        const panY = cy - (cy - prev.panY) * (newZoom / prev.zoom);
        return { ...prev, zoom: newZoom, panX, panY };
      });
    };

    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [simulatedNodes.length]); // Re-attach when nodes appear and canvas is rendered

  // ── Inertia pan loop ───────────────────────────────────────────────────
  const startInertia = useCallback(() => {
    cancelAnimationFrame(inertiaFrameRef.current);
    const decay = 0.88;
    const step = (): void => {
      const vx = panVelocityRef.current.x;
      const vy = panVelocityRef.current.y;
      if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) {
        panVelocityRef.current = { x: 0, y: 0 };
        return;
      }
      panVelocityRef.current = { x: vx * decay, y: vy * decay };
      setViewState((prev) => ({
        ...prev,
        panX: prev.panX + panVelocityRef.current.x,
        panY: prev.panY + panVelocityRef.current.y,
      }));
      inertiaFrameRef.current = requestAnimationFrame(step);
    };
    inertiaFrameRef.current = requestAnimationFrame(step);
  }, []);

  // ── Canvas coordinate helper ───────────────────────────────────────────
  const getCanvasCoords = useCallback((e: React.MouseEvent): { cx: number; cy: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { cx: 0, cy: 0 };
    const rect = canvas.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  }, []);

  // ── Mouse handlers ─────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    cancelAnimationFrame(inertiaFrameRef.current);
    panVelocityRef.current = { x: 0, y: 0 };

    const { cx, cy } = getCanvasCoords(e);
    const graphPos = screenToGraph(cx, cy, viewStateRef.current);
    const hit = hitTestNode(graphPos.x, graphPos.y, simulatedNodes);

    if (hit) {
      setViewState((prev) => ({ ...prev, isDragging: true, dragNodeId: hit.id }));
      dragStart(hit.id, graphPos.x, graphPos.y);
    } else {
      isPanningRef.current = true;
      lastMouseRef.current = { x: cx, y: cy };
      lastPanTimeRef.current = performance.now();
    }
  }, [getCanvasCoords, simulatedNodes, dragStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { cx, cy } = getCanvasCoords(e);

    if (viewStateRef.current.isDragging && viewStateRef.current.dragNodeId) {
      const graphPos = screenToGraph(cx, cy, viewStateRef.current);
      drag(viewStateRef.current.dragNodeId, graphPos.x, graphPos.y);
      return;
    }

    if (isPanningRef.current) {
      const now = performance.now();
      const dt = Math.max(1, now - lastPanTimeRef.current);
      const dx = cx - lastMouseRef.current.x;
      const dy = cy - lastMouseRef.current.y;

      panVelocityRef.current = {
        x: panVelocityRef.current.x * 0.4 + (dx / dt) * 16,
        y: panVelocityRef.current.y * 0.4 + (dy / dt) * 16,
      };

      lastMouseRef.current = { x: cx, y: cy };
      lastPanTimeRef.current = now;
      setViewState((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
      return;
    }

    const graphPos = screenToGraph(cx, cy, viewStateRef.current);
    const hit = hitTestNode(graphPos.x, graphPos.y, simulatedNodes);

    if (hit) {
      setViewState((prev) => prev.hoveredNodeId === hit.id ? prev : { ...prev, hoveredNodeId: hit.id });
      setTooltipNode(hit);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    } else {
      setViewState((prev) => prev.hoveredNodeId === null ? prev : { ...prev, hoveredNodeId: null });
      setTooltipNode(null);
    }
  }, [getCanvasCoords, simulatedNodes, drag]);

  const handleMouseUp = useCallback(() => {
    if (viewStateRef.current.isDragging && viewStateRef.current.dragNodeId) {
      dragEnd(viewStateRef.current.dragNodeId);
      setViewState((prev) => ({ ...prev, isDragging: false, dragNodeId: null }));
    }
    if (isPanningRef.current) {
      isPanningRef.current = false;
      const { x, y } = panVelocityRef.current;
      if (Math.abs(x) > 1 || Math.abs(y) > 1) startInertia();
    }
  }, [dragEnd, startInertia]);

  const handleMouseLeave = useCallback(() => {
    setTooltipNode(null);
    setViewState((prev) => ({ ...prev, hoveredNodeId: null }));
    if (isPanningRef.current) {
      isPanningRef.current = false;
      startInertia();
    }
  }, [startInertia]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const { cx, cy } = getCanvasCoords(e);
    const graphPos = screenToGraph(cx, cy, viewStateRef.current);
    const hit = hitTestNode(graphPos.x, graphPos.y, simulatedNodes);
    setViewState((prev) => ({ ...prev, selectedNodeId: hit ? hit.id : null }));
  }, [getCanvasCoords, simulatedNodes]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { cx, cy } = getCanvasCoords(e);
    const graphPos = screenToGraph(cx, cy, viewStateRef.current);
    const hit = hitTestNode(graphPos.x, graphPos.y, simulatedNodes);
    if (hit?.isResolved && onNavigateToDoc) {
      onNavigateToDoc(hit.id);
    }
  }, [getCanvasCoords, simulatedNodes, onNavigateToDoc]);

  // ── Control callbacks ──────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    setViewState((prev) => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.3) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom * 0.7) }));
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (simulatedNodes.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    animateFitToNodes(simulatedNodes, rect.width, rect.height, 350);
  }, [simulatedNodes, animateFitToNodes]);

  // ── Error / Empty states ───────────────────────────────────────────────
  if (error || (!loading && simulatedNodes.length === 0)) {
    return (
      <div className={`graph-view ${isFullscreen ? 'graph-view--fullscreen' : ''}`}>
        <div className="graph-view__empty">
          {error ? (
            <>
              <GitBranch size={48} className="graph-view__empty-icon" />
              <div className="graph-view__empty-title">Graph failed to load</div>
              <div className="graph-view__empty-desc">{error}</div>
              <button className="graph-view__retry-btn" onClick={retry} type="button">
                <RefreshCw size={14} style={{ marginRight: 6, display: 'inline' }} />
                Retry
              </button>
            </>
          ) : (
            <>
              <GitBranch size={48} className="graph-view__empty-icon" />
              <div className="graph-view__empty-title">No connections yet</div>
              <div className="graph-view__empty-desc">
                Create documents and link them with [[WikiLinks]] to see your knowledge graph.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`graph-view ${isFullscreen ? 'graph-view--fullscreen' : ''}`}
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        className={`graph-view__canvas ${viewState.isDragging ? 'graph-view__canvas--dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      <GraphControls
        config={config}
        viewState={viewState}
        onConfigChange={setConfig}
        onViewStateChange={setViewState}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        onReheat={reheat}
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {tooltipNode && (
        <div
          className="graph-tooltip"
          style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 8, position: 'fixed' }}
        >
          <div className="graph-tooltip__title">{tooltipNode.label}</div>
          <div className="graph-tooltip__meta">
            <span>{tooltipNode.linkCount} link{tooltipNode.linkCount !== 1 ? 's' : ''}</span>
            {!tooltipNode.isResolved && <span>• Unresolved</span>}
            {tooltipNode.isActive && <span>• Active</span>}
          </div>
          {tooltipNode.tags.length > 0 && (
            <div className="graph-tooltip__tags">
              {tooltipNode.tags.map((tag) => (
                <span key={tag} className="graph-tooltip__tag">#{tag}</span>
              ))}
            </div>
          )}
          <div className="graph-tooltip__hint">Double-click to open</div>
        </div>
      )}
    </div>

  );
});