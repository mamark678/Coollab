// ─── Graph View Types ──────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  linkCount: number;
  isResolved: boolean;
  isActive: boolean;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphConfig {
  showOrphans: boolean;
  showTags: boolean;
  showAttachments: boolean;
  linkDistance: number;
  repelForce: number;
  centerForce: number;
  nodeSize: number;
  labelThreshold: number;
  localViewDepth: number;
  linkStrength: number;
  gravity: number;
  clusterStrength: number;
}

export interface GraphViewState {
  panX: number;
  panY: number;
  zoom: number;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  isDragging: boolean;
  dragNodeId: string | null;
  isLocalView: boolean;
  searchQuery: string;
  activeFilters: string[];
  /** Show the minimap overlay in the bottom-right corner */
  showMinimap: boolean;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  showOrphans: true,
  showTags: false,
  showAttachments: false,
  linkDistance: 80,
  repelForce: 120,
  centerForce: 0.05,
  nodeSize: 6,
  labelThreshold: 0.6,
  localViewDepth: 1,
  linkStrength: 0.3,
  gravity: 0.05,
  clusterStrength: 0.1,
};

export const DEFAULT_GRAPH_STATE: GraphViewState = {
  panX: 0,
  panY: 0,
  zoom: 1,
  hoveredNodeId: null,
  selectedNodeId: null,
  isDragging: false,
  dragNodeId: null,
  isLocalView: false,
  searchQuery: '',
  activeFilters: [],
  showMinimap: false,
};