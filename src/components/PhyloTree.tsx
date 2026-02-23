'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { SpeciationEvent } from '../lib/simulation/world';

export interface PhyloNode {
  id: string;
  parentId: string | null;
  bornAt: number;
  extinctAt: number | null;
  label: string;
  color: string;
  children: PhyloNode[];
}

interface PhyloTreeProps {
  speciationEvents: SpeciationEvent[];
  extinctionHistory: Array<{ tick: number; speciesId: string }>;
  currentTick: number;
  selectedSpeciesId: string | null;
  onSelectSpecies: (speciesId: string | null) => void;
  speciesLabels: Map<string, string>;
  speciesColors: Map<string, string>;
}

interface LayoutNode {
  node: PhyloNode;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized (0 = top = old, 1 = bottom = present)
  depth: number;
}

function buildTree(
  speciationEvents: SpeciationEvent[],
  extinctionHistory: Array<{ tick: number; speciesId: string }>,
  speciesLabels: Map<string, string>,
  speciesColors: Map<string, string>,
  currentTick: number
): PhyloNode {
  const extinctMap = new Map(extinctionHistory.map((e) => [e.speciesId, e.tick]));

  const nodeMap = new Map<string, PhyloNode>();

  // Root
  const root: PhyloNode = {
    id: 'primordial',
    parentId: null,
    bornAt: 0,
    extinctAt: extinctMap.get('primordial') ?? null,
    label: speciesLabels.get('primordial') ?? 'Primordial',
    color: speciesColors.get('primordial') ?? '#4ade80',
    children: [],
  };
  nodeMap.set('primordial', root);

  for (const event of speciationEvents) {
    const child: PhyloNode = {
      id: event.childSpeciesId,
      parentId: event.parentSpeciesId,
      bornAt: event.tick,
      extinctAt: extinctMap.get(event.childSpeciesId) ?? null,
      label:
        speciesLabels.get(event.childSpeciesId) ??
        event.childSpeciesId,
      color: event.color,
      children: [],
    };
    nodeMap.set(event.childSpeciesId, child);
  }

  // Link children
  for (const [id, node] of nodeMap.entries()) {
    if (id === 'primordial') continue;
    const parent = nodeMap.get(node.parentId ?? 'primordial');
    if (parent) {
      parent.children.push(node);
    }
  }

  // Update colors from map (may have been updated after event)
  for (const [id, node] of nodeMap.entries()) {
    const c = speciesColors.get(id);
    if (c) node.color = c;
    const l = speciesLabels.get(id);
    if (l) node.label = l;
    const ext = extinctMap.get(id);
    if (ext !== undefined) node.extinctAt = ext;
  }

  void currentTick;
  return root;
}

function countLeaves(node: PhyloNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + countLeaves(c), 0);
}

function layoutTree(
  root: PhyloNode,
  maxTick: number
): LayoutNode[] {
  const result: LayoutNode[] = [];
  const totalLeaves = Math.max(1, countLeaves(root));

  function assignX(
    node: PhyloNode,
    leafOffset: number
  ): number {
    if (node.children.length === 0) {
      const x = (leafOffset + 0.5) / totalLeaves;
      result.push({
        node,
        x,
        y: Math.min(1, (node.extinctAt ?? maxTick) / maxTick),
        depth: leafOffset,
      });
      return x;
    }

    let currentLeaf = leafOffset;
    const childXs: number[] = [];
    for (const child of node.children) {
      const childLeaves = countLeaves(child);
      childXs.push(assignX(child, currentLeaf));
      currentLeaf += childLeaves;
    }

    const x = childXs.reduce((s, v) => s + v, 0) / childXs.length;
    result.push({
      node,
      x,
      y: node.bornAt / maxTick,
      depth: leafOffset,
    });
    return x;
  }

  assignX(root, 0);
  return result;
}

// Animation tracking for new branches
const NEW_BRANCH_DURATION = 600; // ms

export function PhyloTree({
  speciationEvents,
  extinctionHistory,
  currentTick,
  selectedSpeciesId,
  onSelectSpecies,
  speciesLabels,
  speciesColors,
}: PhyloTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ w: 300, h: 600 });
  const [newBranchTimestamps, setNewBranchTimestamps] = useState<Map<string, number>>(new Map());
  const [now, setNow] = useState(() => Date.now());

  // Track new branches for animation
  useEffect(() => {
    if (speciationEvents.length === 0) return;
    const last = speciationEvents[speciationEvents.length - 1];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewBranchTimestamps((prev) => {
      const next = new Map(prev);
      next.set(last.childSpeciesId, Date.now());
      return next;
    });
  }, [speciationEvents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize observer
  useEffect(() => {
    const svg = svgRef.current?.parentElement;
    if (!svg) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Pulse animation frame
  useEffect(() => {
    let id: number;
    function tick() {
      setNow(Date.now());
      id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const tree = useMemo(
    () =>
      buildTree(
        speciationEvents,
        extinctionHistory,
        speciesLabels,
        speciesColors,
        currentTick
      ),
    [speciationEvents, extinctionHistory, speciesLabels, speciesColors, currentTick]
  );

  const maxTick = Math.max(currentTick, 1);
  const layoutNodes = useMemo(
    () => layoutTree(tree, maxTick),
    [tree, maxTick]
  );

  const PAD = { top: 40, bottom: 40, left: 20, right: 20 };
  const innerW = dimensions.w - PAD.left - PAD.right;
  const innerH = dimensions.h - PAD.top - PAD.bottom;

  function toSvgX(nx: number) {
    return PAD.left + nx * innerW;
  }
  function toSvgY(ny: number) {
    return PAD.top + ny * innerH;
  }

  // Build edge list
  const edges: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    childId: string;
    parentBornAt: number;
    childBornAt: number;
    isNew: boolean;
    color: string;
    isExtinct: boolean;
  }> = [];

  const nodeById = new Map(layoutNodes.map((ln) => [ln.node.id, ln]));

  for (const ln of layoutNodes) {
    if (!ln.node.parentId) continue;
    const parent = nodeById.get(ln.node.parentId);
    if (!parent) continue;

    const birthTimestamp = newBranchTimestamps.get(ln.node.id);
    const isNew = birthTimestamp !== undefined && now - birthTimestamp < NEW_BRANCH_DURATION;
    const isExtinct = ln.node.extinctAt !== null;

    edges.push({
      x1: toSvgX(parent.x),
      y1: toSvgY(parent.node.bornAt / maxTick),
      x2: toSvgX(ln.x),
      y2: toSvgY(ln.y),
      childId: ln.node.id,
      parentBornAt: parent.node.bornAt,
      childBornAt: ln.node.bornAt,
      isNew,
      color: ln.node.color,
      isExtinct,
    });
  }

  return (
    <svg
      ref={svgRef}
      width={dimensions.w}
      height={dimensions.h}
      className="select-none"
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        {/* Pulse animation for living nodes */}
        <style>{`
          @keyframes phylo-pulse {
            0%, 100% { opacity: 1; r: 6px; }
            50% { opacity: 0.7; r: 9px; }
          }
          .living-pulse {
            animation: phylo-pulse 2s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* Y-axis label */}
      <text
        x={PAD.left}
        y={PAD.top - 12}
        fontSize={9}
        fill="#4b5563"
        textAnchor="start"
      >
        OLDER
      </text>
      <text
        x={PAD.left}
        y={dimensions.h - PAD.bottom + 18}
        fontSize={9}
        fill="#4b5563"
        textAnchor="start"
      >
        PRESENT
      </text>

      {/* Edges */}
      {edges.map((e) => {
        const totalLen = Math.sqrt((e.x2 - e.x1) ** 2 + (e.y2 - e.y1) ** 2);
        const progress = e.isNew
          ? Math.min(1, (now - (newBranchTimestamps.get(e.childId) ?? 0)) / NEW_BRANCH_DURATION)
          : 1;

        // Cubic bezier: go down from parent, then arc to child x
        const cx1 = e.x1;
        const cy1 = e.y1 + (e.y2 - e.y1) * 0.5;
        const cx2 = e.x2;
        const cy2 = e.y1 + (e.y2 - e.y1) * 0.5;

        const pathD = `M ${e.x1} ${e.y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${e.x2} ${e.y2}`;

        return (
          <path
            key={e.childId}
            d={pathD}
            fill="none"
            stroke={e.isExtinct ? '#374151' : e.color}
            strokeWidth={1.5}
            strokeOpacity={e.isExtinct ? 0.4 : 0.85}
            strokeDasharray={e.isNew ? `${totalLen * progress} ${totalLen}` : undefined}
            strokeDashoffset={e.isNew ? 0 : undefined}
            style={
              e.isNew
                ? { transition: `stroke-dasharray ${NEW_BRANCH_DURATION}ms linear` }
                : {}
            }
          />
        );
      })}

      {/* Nodes */}
      {layoutNodes.map((ln) => {
        const cx = toSvgX(ln.x);
        const cy = toSvgY(ln.node.bornAt / maxTick);
        const isLiving = ln.node.extinctAt === null;
        const isSelected = selectedSpeciesId === ln.node.id;
        const isExtinct = !isLiving;

        // Pulse offset for living nodes
        const pulsePhase = (now / 2000) * Math.PI * 2;
        const pulseR = isLiving && !isExtinct ? 6 + Math.sin(pulsePhase) * 2 : 5;

        return (
          <g
            key={ln.node.id}
            onClick={() =>
              onSelectSpecies(
                selectedSpeciesId === ln.node.id ? null : ln.node.id
              )
            }
            style={{ cursor: 'pointer' }}
          >
            {/* Selection ring */}
            {isSelected && (
              <circle
                cx={cx}
                cy={cy}
                r={pulseR + 5}
                fill="none"
                stroke="white"
                strokeWidth={1.5}
                strokeOpacity={0.8}
              />
            )}

            {/* Node circle */}
            <circle
              cx={cx}
              cy={cy}
              r={pulseR}
              fill={isExtinct ? '#374151' : ln.node.color}
              fillOpacity={isExtinct ? 0.4 : 1}
              stroke={isExtinct ? '#1f2937' : '#ffffff22'}
              strokeWidth={1}
            />

            {/* Label */}
            <text
              x={cx}
              y={cy - pulseR - 4}
              fontSize={9}
              fill={isExtinct ? '#4b5563' : '#d1d5db'}
              textAnchor="middle"
              fontStyle="italic"
            >
              {ln.node.label.length > 16
                ? ln.node.label.slice(0, 15) + '…'
                : ln.node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
