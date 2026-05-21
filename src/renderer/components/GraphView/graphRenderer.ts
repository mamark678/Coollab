// ─── Graph Canvas Renderer ─────────────────────────────────────────────────
// Pure rendering functions — no React, no hooks.

import type { GraphConfig, GraphEdge, GraphNode, GraphViewState } from './GraphView.types';

/**
 * Main render function — clears and redraws the entire graph.
 */
export function renderGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  state: GraphViewState,
  config: GraphConfig,
  logicalWidth: number,
  logicalHeight: number
): void {
  if (logicalWidth <= 0 || logicalHeight <= 0) return;

  // Retrieve CSS variables dynamically from the canvas element to support global theming
  const rootStyle = getComputedStyle(ctx.canvas);
  const backgroundColor = rootStyle.getPropertyValue('--theme-background').trim() || '#0d0d1a';
  const surfaceColor = rootStyle.getPropertyValue('--theme-surface').trim() || '#131326';
  const primaryColor = rootStyle.getPropertyValue('--theme-primary').trim() || '#7c3aed';
  const secondaryColor = rootStyle.getPropertyValue('--theme-secondary').trim() || '#a78bfa';
  const borderColor = rootStyle.getPropertyValue('--theme-border').trim() || 'rgba(255,255,255,0.08)';
  const textPrimaryColor = rootStyle.getPropertyValue('--theme-text-primary').trim() || '#ffffff';
  const textSecondaryColor = rootStyle.getPropertyValue('--theme-text-secondary').trim() || '#94a3b8';

  const themeColors = {
    backgroundColor,
    surfaceColor,
    primaryColor,
    secondaryColor,
    borderColor,
    textPrimaryColor,
    textSecondaryColor,
  };

  // Clear any existing transformation — ensure we start from a clean slate
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Calculate actual scale factors between physical buffer and logical units
  const scaleX = ctx.canvas.width / logicalWidth;
  const scaleY = ctx.canvas.height / logicalHeight;

  // 1. Scale context to match logical coordinate space (High-DPI support)
  ctx.scale(scaleX, scaleY);

  // 2. Clear and fill background
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // 3. Apply pan/zoom on top of DPR scale
  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  // Build lookup sets for highlighting
  const connectedToSelected = new Set<string>();
  const connectedToHovered = new Set<string>();
  const edgesOfSelected = new Set<string>();
  const edgesOfHovered = new Set<string>();

  if (state.selectedNodeId) {
    for (const e of edges) {
      if (e.source === state.selectedNodeId || e.target === state.selectedNodeId) {
        connectedToSelected.add(e.source);
        connectedToSelected.add(e.target);
        edgesOfSelected.add(`${e.source}→${e.target}`);
      }
    }
  }
  if (state.hoveredNodeId) {
    for (const e of edges) {
      if (e.source === state.hoveredNodeId || e.target === state.hoveredNodeId) {
        connectedToHovered.add(e.source);
        connectedToHovered.add(e.target);
        edgesOfHovered.add(`${e.source}→${e.target}`);
      }
    }
  }

  // Filtering: find nodes that match search query
  const hasSearch = Boolean(state.searchQuery);
  const matchesSearch = (node: GraphNode): boolean => {
    if (!hasSearch) return true;
    return node.label.toLowerCase().includes(state.searchQuery.toLowerCase());
  };

  // Build a fast node lookup map
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // ── 4. Draw edges ──────────────────────────────────────────────────────
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const edgeKey = `${edge.source}→${edge.target}`;
    const isHighlightedBySelected = edgesOfSelected.has(edgeKey);
    const isHighlightedByHovered = edgesOfHovered.has(edgeKey);
    const isHighlighted = isHighlightedBySelected || isHighlightedByHovered;
    const isUnresolved = !sourceNode.isResolved || !targetNode.isResolved;

    // Dim edges whose endpoints don't match search
    const searchVisible = !hasSearch || (matchesSearch(sourceNode) && matchesSearch(targetNode));

    // Opacity logic
    let edgeAlpha = 1;
    if (!searchVisible) {
      edgeAlpha = 0.03;
    } else if (state.selectedNodeId && !isHighlightedBySelected) {
      edgeAlpha = 0.04;
    } else if (hasSearch) {
      edgeAlpha = isHighlighted ? 1 : 0.08;
    }

    ctx.globalAlpha = edgeAlpha;

    // Edge thickness scales with weight and highlight state
    const baseWidth = 0.5 + (edge.weight ?? 1) * 0.5;
    const lineWidth = isHighlighted ? baseWidth * 2.5 : baseWidth;

    ctx.beginPath();
    ctx.moveTo(sourceNode.x, sourceNode.y);
    ctx.lineTo(targetNode.x, targetNode.y);

    if (isUnresolved) {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = hexToRGBA(textPrimaryColor, 0.08);
      ctx.lineWidth = 1;
    } else if (isHighlightedBySelected) {
      ctx.setLineDash([]);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = lineWidth;
    } else if (isHighlightedByHovered) {
      ctx.setLineDash([]);
      ctx.strokeStyle = hexToRGBA(secondaryColor, 0.7);
      ctx.lineWidth = lineWidth;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = hexToRGBA(textPrimaryColor, 0.13);
      ctx.lineWidth = lineWidth;
    }

    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1;
  }

  // ── 5. Draw nodes ──────────────────────────────────────────────────────
  for (const node of nodes) {
    const isHovered = state.hoveredNodeId === node.id;
    const isSelected = state.selectedNodeId === node.id;
    const isConnectedToSelected = connectedToSelected.has(node.id);
    const isConnectedToHovered = connectedToHovered.has(node.id);
    const nodeMatchesSearch = matchesSearch(node);

    // Determine alpha
    let alpha = 1;
    if (hasSearch) {
      alpha = nodeMatchesSearch ? 1 : 0.08;
    } else if (state.selectedNodeId && !isSelected && !isConnectedToSelected) {
      alpha = 0.15;
    } else if (state.hoveredNodeId && !isHovered && !isConnectedToHovered && !state.selectedNodeId) {
      alpha = 0.4;
    }

    ctx.globalAlpha = alpha;

    // Dynamic radius — slightly enlarged on hover/select
    const baseRadius = Math.max(
      config.nodeSize,
      Math.min(20, config.nodeSize + Math.log2(node.linkCount + 1) * 2)
    );
    const dynamicRadius = isHovered
      ? baseRadius * 1.35
      : isSelected
        ? baseRadius * 1.2
        : baseRadius;

    // Glow effects
    if (node.isActive) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = hexToRGBA(primaryColor, 0.7);
    } else if (isSelected) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = hexToRGBA(primaryColor, 0.5);
    } else if (isHovered) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = hexToRGBA(secondaryColor, 0.4);
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, dynamicRadius, 0, Math.PI * 2);

    const resolvedColor = resolveNodeColor(node.color, themeColors);

    // Fill color
    if (isSelected || node.isActive) {
      ctx.fillStyle = primaryColor;
    } else if (isHovered) {
      ctx.fillStyle = brighten(resolvedColor, 0.35);
    } else if (isConnectedToSelected) {
      ctx.fillStyle = brighten(resolvedColor, 0.15);
    } else {
      ctx.fillStyle = resolvedColor;
    }
    ctx.fill();

    // Stroke ring
    if (isSelected) {
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2.5 / state.zoom;
    } else if (isHovered) {
      ctx.strokeStyle = hexToRGBA(secondaryColor, 0.8);
      ctx.lineWidth = 2 / state.zoom;
    } else if (node.isActive) {
      ctx.strokeStyle = hexToRGBA(secondaryColor, 0.5);
      ctx.lineWidth = 1.5 / state.zoom;
    } else {
      ctx.strokeStyle = hexToRGBA(textPrimaryColor, 0.12);
      ctx.lineWidth = 1 / state.zoom;
    }
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1;
  }

  // ── 6. Draw labels — adaptive to zoom ────────────────────────────────
  // Always show label for hovered/selected; others appear at threshold
  const labelZoom = state.zoom;
  const showAllLabels = labelZoom >= config.labelThreshold;
  const showImportantLabels = labelZoom >= config.labelThreshold * 0.5;

  if (showImportantLabels) {
    for (const node of nodes) {
      const isHovered = state.hoveredNodeId === node.id;
      const isSelected = state.selectedNodeId === node.id;
      const isConnectedToSelected = connectedToSelected.has(node.id);
      const nodeMatchesSearch = matchesSearch(node);
      const isImportant = isHovered || isSelected || node.isActive || node.linkCount >= 3;

      // Skip unimportant nodes if we're not at full label threshold
      if (!showAllLabels && !isImportant) continue;

      // Skip if not visible due to search
      if (hasSearch && !nodeMatchesSearch) continue;

      // Alpha
      let labelAlpha = 1;
      if (hasSearch) {
        labelAlpha = nodeMatchesSearch ? 1 : 0;
      } else if (state.selectedNodeId && !isSelected && !isConnectedToSelected) {
        labelAlpha = 0.12;
      } else if (!showAllLabels) {
        // Fade in as zoom increases toward threshold
        const progress = (labelZoom - config.labelThreshold * 0.5) / (config.labelThreshold * 0.5);
        labelAlpha = isImportant ? 1 : Math.max(0, Math.min(1, progress));
      }

      if (labelAlpha <= 0) continue;

      ctx.globalAlpha = labelAlpha;

      // Font — scale slightly with zoom but clamp
      const baseFontSize = 12;
      const fontSize = Math.max(9, Math.min(14, baseFontSize / Math.sqrt(state.zoom)));

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (isHovered || isSelected) {
        ctx.font = `600 ${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = textPrimaryColor;
        // Text shadow for legibility
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
      } else if (node.isActive) {
        ctx.font = `600 ${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = hexToRGBA(secondaryColor, 0.95);
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
      } else {
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = hexToRGBA(textPrimaryColor, 0.65);
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
      }

      // Truncate long labels
      const maxLen = isHovered || isSelected ? 40 : 24;
      const label = node.label.length > maxLen
        ? node.label.slice(0, maxLen - 1) + '…'
        : node.label;

      const dynamicRadius = Math.max(
        config.nodeSize,
        Math.min(20, config.nodeSize + Math.log2(node.linkCount + 1) * 2)
      );

      ctx.fillText(label, node.x, node.y + dynamicRadius + 4);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // Restore pan/zoom transform (back to DPR-only scale)
  ctx.restore();

  // ── 7. Minimap — drawn in logical pixel space (DPR scale still active)
  if (state.showMinimap && nodes.length > 0) {
    renderMinimap(ctx, nodes, edges, state, logicalWidth, logicalHeight, themeColors);
  }
}


// ─── Minimap rendering ──────────────────────────────────────────────────────

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  state: GraphViewState,
  canvasW: number,
  canvasH: number,
  theme: {
    backgroundColor: string;
    surfaceColor: string;
    primaryColor: string;
    secondaryColor: string;
    borderColor: string;
    textPrimaryColor: string;
    textSecondaryColor: string;
  }
): void {
  const mmW = 140;
  const mmH = 100;
  const mmX = canvasW - mmW - 16;
  const mmY = canvasH - mmH - 16;
  const padding = 10;

  // Find graph bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  const graphW = maxX - minX || 1;
  const graphH = maxY - minY || 1;
  const scaleX = (mmW - padding * 2) / graphW;
  const scaleY = (mmH - padding * 2) / graphH;
  const scale = Math.min(scaleX, scaleY);

  const toMM = (x: number, y: number) => ({
    mx: mmX + padding + (x - minX) * scale,
    my: mmY + padding + (y - minY) * scale,
  });

  // Background
  ctx.save();
  ctx.fillStyle = hexToRGBA(theme.surfaceColor, 0.88);
  ctx.strokeStyle = hexToRGBA(theme.textPrimaryColor, 0.08);
  ctx.lineWidth = 1;
  roundRect(ctx, mmX, mmY, mmW, mmH, 8);
  ctx.fill();
  ctx.stroke();

  // Edges
  ctx.globalAlpha = 0.3;
  for (const edge of edges) {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) continue;
    const { mx: sx, my: sy } = toMM(src.x, src.y);
    const { mx: tx, my: ty } = toMM(tgt.x, tgt.y);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = hexToRGBA(theme.textPrimaryColor, 0.2);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Nodes
  ctx.globalAlpha = 1;
  for (const node of nodes) {
    const { mx, my } = toMM(node.x, node.y);
    const r = node.isActive ? 3 : node.id === state.selectedNodeId ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fillStyle = node.isActive ? theme.primaryColor : node.id === state.selectedNodeId ? theme.secondaryColor : node.color;
    ctx.fill();
  }

  // Viewport rectangle
  const vpX = (-state.panX / state.zoom - minX) * scale + mmX + padding;
  const vpY = (-state.panY / state.zoom - minY) * scale + mmY + padding;
  // Estimate canvas display size from the context
  const vpW = (canvasW / state.zoom) * scale;
  const vpH = (canvasH / state.zoom) * scale;

  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = theme.primaryColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(vpX, vpY, vpW, vpH);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ─── Utility ────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Hit test — return the node under the given graph-space coordinates.
 * Uses a slightly enlarged hit area for easier clicking.
 */
export function hitTestNode(
  graphX: number,
  graphY: number,
  nodes: GraphNode[]
): GraphNode | null {
  let bestMatch: GraphNode | null = null;
  let bestDist = Infinity;

  for (const node of nodes) {
    const dx = graphX - node.x;
    const dy = graphY - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = node.radius + Math.max(4, node.radius * 0.3);
    if (dist <= hitRadius && dist < bestDist) {
      bestMatch = node;
      bestDist = dist;
    }
  }

  return bestMatch;
}

/**
 * Convert screen coordinates to graph-space coordinates.
 */
export function screenToGraph(
  screenX: number,
  screenY: number,
  state: GraphViewState
): { x: number; y: number } {
  return {
    x: (screenX - state.panX) / state.zoom,
    y: (screenY - state.panY) / state.zoom,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function brighten(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * amount));
  const ng = Math.min(255, Math.round(g + (255 - g) * amount));
  const nb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function hexToRGBA(hex: string, alpha: number): string {
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 6) {
    if (hex.startsWith('rgb') || hex.startsWith('hsl') || hex.startsWith('var')) {
      return hex;
    }
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveNodeColor(
  colorKey: string,
  theme: {
    primaryColor: string;
    secondaryColor: string;
    textSecondaryColor: string;
    textPrimaryColor: string;
  }
): string {
  if (colorKey === 'orphan') {
    return hexToRGBA(theme.textSecondaryColor, 0.4);
  }
  if (colorKey === 'tagged') {
    return theme.secondaryColor;
  }
  if (colorKey === 'active') {
    return theme.primaryColor;
  }
  if (colorKey === 'default') {
    return theme.textSecondaryColor;
  }
  return colorKey;
}