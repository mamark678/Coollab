// ─── Force Simulation Hook ─────────────────────────────────────────────────
// Wraps d3-force to run physics on graph nodes.

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphConfig, GraphEdge, GraphNode } from './GraphView.types';

interface SimNode extends SimulationNodeDatum {
  id: string;
  radius: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

interface ForceSimulationResult {
  simulatedNodes: GraphNode[];
  reheat: () => void;
  dragStart: (nodeId: string, x: number, y: number) => void;
  drag: (nodeId: string, x: number, y: number) => void;
  dragEnd: (nodeId: string) => void;
}

/**
 * Runs a d3-force simulation on the provided nodes/edges.
 * Pauses when `active` is false to save CPU.
 * Features:
 *  - Preserved positions across re-renders
 *  - Spring-resistance drag (node follows cursor with slight lag)
 *  - Smooth cool-down so the graph settles naturally
 */
export function useForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: GraphConfig,
  active: boolean
): ForceSimulationResult {
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const [simulatedNodes, setSimulatedNodes] = useState<GraphNode[]>(nodes);
  const nodesRef = useRef<SimNode[]>([]);

  // Preserve positions across config/data changes
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // For spring-resistance drag: store the "target" position separately
  const dragTargetRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const draggedNodeIdsRef = useRef<Set<string>>(new Set());

  // Spring interpolation frame loop
  const springFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      simRef.current?.stop();
      return;
    }

    // Build sim nodes, preserving existing positions
    const simNodes: SimNode[] = nodes.map((n) => {
      const existing = positionsRef.current.get(n.id);
      return {
        id: n.id,
        radius: n.radius,
        x: existing?.x ?? n.x,
        y: existing?.y ?? n.y,
        vx: 0,
        vy: 0,
      };
    });

    // Build sim links (only between existing nodes)
    const nodeIds = new Set(simNodes.map((n) => n.id));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight ?? 1,
      }));

    nodesRef.current = simNodes;

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(config.linkDistance)
          .strength((link) => (link.weight ?? 1) * config.linkStrength)
      )
      .force(
        'charge',
        forceManyBody<SimNode>()
          .strength(-config.repelForce * 2) // Boost repulsion so they spread nicely
          .distanceMax(2000) // Allow global repulsion
      )
      .force(
        'center',
        forceCenter<SimNode>(0, 0).strength(config.centerForce)
      )
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius((d) => d.radius + 6)
          .strength(0.7)
          .iterations(2)
      )
      .force(
        'gravity',
        (alpha) => {
          for (const node of simNodes) {
            // Gentle centripetal gravity — keeps disconnected nodes from flying off
            node.vx! -= node.x! * config.gravity * alpha;
            node.vy! -= node.y! * config.gravity * alpha;
          }
        }
      )
      // Slower decay = longer, more organic settling
      .alphaDecay(0.015)
      .velocityDecay(0.35)
      .on('tick', () => {
        // Cache positions
        for (const sn of simNodes) {
          if (sn.x !== undefined && sn.y !== undefined) {
            positionsRef.current.set(sn.id, { x: sn.x, y: sn.y });
          }
        }

        // Map back to GraphNode for rendering
        setSimulatedNodes(
          nodes.map((n) => {
            const sn = simNodes.find((s) => s.id === n.id);
            return { ...n, x: sn?.x ?? n.x, y: sn?.y ?? n.y };
          })
        );
      });

    simRef.current = sim;

    return () => {
      sim.stop();
      cancelAnimationFrame(springFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length, config.linkDistance, config.repelForce, config.centerForce, config.gravity, active]);

  const reheat = useCallback(() => {
    simRef.current?.alpha(0.8).restart();
  }, []);

  /**
   * dragStart — fix the node and begin spring loop.
   * The node's fx/fy will be pulled toward dragTargetRef with a spring,
   * rather than teleporting, giving a more physical "sticky" feel.
   */
  const dragStart = useCallback((nodeId: string, x: number, y: number) => {
    const sim = simRef.current;
    if (!sim) return;

    // Warm up the sim just enough to feel alive during drag
    sim.alphaTarget(0.3).restart();

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }

    dragTargetRef.current.set(nodeId, { x, y });
    draggedNodeIdsRef.current.add(nodeId);

    // Start spring interpolation loop
    const springStep = (): void => {
      const target = dragTargetRef.current.get(nodeId);
      const n = nodesRef.current.find((nd) => nd.id === nodeId);
      if (!target || !n || !draggedNodeIdsRef.current.has(nodeId)) return;

      // Spring: lerp fx toward target
      const spring = 0.18;
      n.fx = (n.fx ?? n.x ?? 0) + (target.x - (n.fx ?? n.x ?? 0)) * spring;
      n.fy = (n.fy ?? n.y ?? 0) + (target.y - (n.fy ?? n.y ?? 0)) * spring;

      springFrameRef.current = requestAnimationFrame(springStep);
    };

    cancelAnimationFrame(springFrameRef.current);
    springFrameRef.current = requestAnimationFrame(springStep);
  }, []);

  /**
   * drag — update the target position; the spring loop moves fx/fy toward it.
   */
  const drag = useCallback((nodeId: string, x: number, y: number) => {
    dragTargetRef.current.set(nodeId, { x, y });
  }, []);

  /**
   * dragEnd — release fixed position so the node re-enters the simulation.
   * Impart a small velocity in the direction of last movement for momentum.
   */
  const dragEnd = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;

    cancelAnimationFrame(springFrameRef.current);
    draggedNodeIdsRef.current.delete(nodeId);
    dragTargetRef.current.delete(nodeId);

    sim.alphaTarget(0);

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      // Give a tiny velocity kick in the direction the node was moving
      // (feels like throwing rather than dropping)
      const vx = node.vx ?? 0;
      const vy = node.vy ?? 0;
      node.fx = null;
      node.fy = null;
      node.vx = vx * 1.5;
      node.vy = vy * 1.5;
    }
  }, []);

  return {
    simulatedNodes,
    reheat,
    dragStart,
    drag,
    dragEnd,
  };
}