import React, { useEffect, useRef, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Node type → color
const NODE_COLORS = {
  Package:      '#22c55e',
  Developer:    '#3b82f6',
  Repository:   '#a855f7',
  Organization: '#f97316',
};

const BUS_FACTOR_COLOR = '#ff4444';

const EDGE_COLORS = {
  DEPENDS_ON:    '#60a5fa',   // blue, solid
  MAINTAINS:     '#4ade80',   // green, solid
  PUBLISHES:     '#c084fc',   // purple
  CONTRIBUTES_TO:'#fb923c',   // orange
  MEMBER_OF:     '#fbbf24',   // yellow
  OWNS:          '#94a3b8',   // slate
};

const NODE_RADIUS = {
  Package:      7,
  Developer:    8,
  Repository:   6,
  Organization: 6,
};

function getColor(node, busFactorSet) {
  if (busFactorSet.has(node.id)) return BUS_FACTOR_COLOR;
  return NODE_COLORS[node.type] || '#8888a0';
}

/**
 * GraphView — robust interactive force-graph visualization
 * Props:
 *   graphData: { nodes: [...], links: [...] }
 *   height: number
 *   onNodeClick: (node) => void
 *   busFactorIds: string[]  — IDs that get risk halo
 */
export function GraphView({ graphData, height = 520, onNodeClick, busFactorIds = [], focusNodeId = null }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [animTime, setAnimTime] = useState(0);

  const busFactorSet = React.useMemo(() => new Set(busFactorIds), [busFactorIds]);

  // Continuously drive pulse animation time
  useEffect(() => {
    let animId;
    const loop = () => {
      setAnimTime(Date.now());
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Sanitize graph data — remove nulls, ensure all link endpoints exist
  const safeData = React.useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    const nodes = (graphData.nodes || []).filter(
      (n) => n && n.id != null && n.id !== ''
    );
    const nodeIds = new Set(nodes.map((n) => String(n.id)));

    const links = (graphData.links || []).filter((l) => {
      if (!l) return false;
      const src = l.source?.id ?? l.source;
      const tgt = l.target?.id ?? l.target;
      return src != null && tgt != null && nodeIds.has(String(src)) && nodeIds.has(String(tgt));
    });

    return { nodes, links };
  }, [graphData]);

  // Focus node center effect
  useEffect(() => {
    if (!focusNodeId || !fgRef.current || !safeData.nodes.length) return;
    const targetNode = safeData.nodes.find(
      (n) =>
        String(n.id) === String(focusNodeId) ||
        String(n.name) === String(focusNodeId) ||
        String(n.id) === `pkg-${focusNodeId}` ||
        String(n.id) === `dev-${focusNodeId}`
    );

    if (targetNode && targetNode.x != null && targetNode.y != null) {
      setHoveredNode(targetNode);
      fgRef.current.centerAt(targetNode.x, targetNode.y, 450);
      fgRef.current.zoom(1.2, 450);
    }
  }, [focusNodeId, safeData]);

  // Fit to view & configure D3 forces on data load
  useEffect(() => {
    if (fgRef.current && safeData.nodes.length > 0) {
      setTimeout(() => {
        try {
          if (safeData.nodes.length === 1) {
            fgRef.current.centerAt(0, 0, 400);
            fgRef.current.zoom(1.1, 400);
          } else {
            fgRef.current.zoomToFit(400, 120);
          }
          fgRef.current.d3Force('charge')?.strength(-160);
          fgRef.current.d3Force('link')?.distance(65);
        } catch {}
      }, 400);
    }
  }, [safeData]);

  // Node renderer with radial glow, pulse animations, and focus dimming
  const drawNode = useCallback(
    (node, ctx, globalScale) => {
      if (node.x == null || node.y == null) return;

      const nodeIdStr = String(node.id);
      const isHovered = hoveredNode?.id === node.id;
      const isHighlighted = !hoveredNode || highlightNodes.has(nodeIdStr);
      const isBusFactor = busFactorSet.has(node.id);
      const isRoot = node.isRoot;

      const scaleFactor = Math.max(1, Math.sqrt(globalScale * 0.8));
      const r = ((NODE_RADIUS[node.type] || 6) * (isHovered ? 1.25 : 1)) / scaleFactor;
      const color = getColor(node, busFactorSet);

      ctx.save();
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.15;

      // 1. Outer Radial Glow
      const glowR = Math.min(r * (isHovered ? 2.2 : isBusFactor || isRoot ? 2.0 : 1.5), 18);
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
      glow.addColorStop(0, `${color}99`);
      glow.addColorStop(0.5, `${color}33`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowR, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      // 2. Animated Radar Pulse Ring for Bus Factor & Root nodes
      if (isBusFactor || isRoot) {
        const pulse = (Math.sin(animTime / 250) + 1) / 2; // 0..1
        const pulseR = r + 3 + pulse * 4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseR, 0, 2 * Math.PI);
        ctx.strokeStyle = isBusFactor ? `rgba(255, 68, 68, ${0.8 - pulse * 0.5})` : `rgba(34, 197, 94, ${0.8 - pulse * 0.5})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 3. Node Core Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner shiny highlight
      ctx.beginPath();
      ctx.arc(node.x - r * 0.25, node.y - r * 0.25, r * 0.45, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();

      // 4. Node Label
      const label = (node.name || node.id || '').replace(/^@[^/]+\//, '');
      const short = label.length > 20 ? label.slice(0, 19) + '…' : label;
      const fontSize = Math.min(11, Math.max(7, 10 / globalScale));
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const tw = ctx.measureText(short).width;
      const padding = 3;

      // Label background card
      ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
      ctx.fillRect(node.x - tw / 2 - padding, node.y + r + 3, tw + padding * 2, fontSize + 3);
      ctx.strokeStyle = isHovered ? color : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(node.x - tw / 2 - padding, node.y + r + 3, tw + padding * 2, fontSize + 3);

      // Label text
      ctx.fillStyle = isHovered ? '#ffffff' : isBusFactor ? '#ff9999' : '#d1d5db';
      ctx.fillText(short, node.x, node.y + r + 4);

      ctx.restore();
    },
    [busFactorSet, hoveredNode, highlightNodes, animTime]
  );


  // Link renderer with dynamic flow animation and hover focus
  const drawLink = useCallback(
    (link, ctx) => {
      const src = link.source;
      const tgt = link.target;
      if (!src?.x || !tgt?.x) return;

      const isHighlighted = !hoveredNode || highlightLinks.has(link);
      const color = EDGE_COLORS[link.type] || '#60a5fa';
      const isMaintains = link.type === 'MAINTAINS';

      ctx.save();
      ctx.globalAlpha = isHighlighted ? (hoveredNode ? 0.95 : 0.65) : 0.08;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isHighlighted && hoveredNode ? '#ffffff' : color;
      ctx.lineWidth = isHighlighted && hoveredNode ? 2.5 : isMaintains ? 2 : 1.5;
      if (!isMaintains && !isHighlighted) ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    },
    [hoveredNode, highlightLinks]
  );

  if (!safeData.nodes.length) return null;

  return (
    <div ref={containerRef} className="graph-container relative overflow-hidden rounded-xl border border-border-subtle bg-bg-panel shadow-2xl" style={{ height }}>
      {/* Background Radar Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]" />

      <ForceGraph2D
        ref={fgRef}
        graphData={safeData}
        width={width}
        height={height}
        backgroundColor="#090d16"
        minZoom={0.4}
        maxZoom={3.0}
        nodeCanvasObject={drawNode}

        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObject={drawLink}
        linkCanvasObjectMode={() => 'replace'}
        linkDirectionalParticles={(link) => (highlightLinks.has(link) || !hoveredNode ? 2 : 0)}
        linkDirectionalParticleSpeed={0.007}
        linkDirectionalParticleWidth={(link) => (highlightLinks.has(link) ? 3.5 : 2)}
        linkDirectionalParticleColor={(link) => EDGE_COLORS[link.type] || '#60a5fa'}
        linkDirectionalArrowLength={4.5}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={(link) => EDGE_COLORS[link.type] || '#60a5fa'}
        onNodeClick={(node) => {
          if (fgRef.current && node.x != null && node.y != null) {
            fgRef.current.centerAt(node.x, node.y, 450);
            fgRef.current.zoom(2.2, 450);
          }
          if (onNodeClick) onNodeClick(node);
        }}
        onNodeHover={(node) => {
          setHoveredNode(node || null);
          setTooltip(
            node
              ? { name: node.name, type: node.type, ecosystem: node.ecosystem, version: node.version }
              : null
          );
          document.body.style.cursor = node ? 'pointer' : 'default';
        }}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        cooldownTicks={180}
        nodeRelSize={4}
        d3VelocityDecay={0.2}
        d3AlphaDecay={0.015}
        warmupTicks={40}
      />

      {/* Glassmorphic Legend Overlay */}
      <div className="absolute top-3 left-3 panel p-2.5 backdrop-blur-md bg-bg-panel/80 border border-border-subtle shadow-lg space-y-1.5 rounded-lg">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 text-2xs font-mono text-text-muted">
            <div className="rounded-full flex-shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.3)]" style={{ width: 8, height: 8, background: color }} />
            {type}
          </div>
        ))}
        <div className="flex items-center gap-2 text-2xs font-mono text-risk">
          <div className="rounded-full flex-shrink-0 ring-1 ring-risk shadow-[0_0_8px_#ff4444]" style={{ width: 8, height: 8, background: BUS_FACTOR_COLOR }} />
          Bus Factor Risk
        </div>
      </div>

      {/* Node + edge count pill */}
      <div className="absolute top-3 right-3 panel px-3 py-1 backdrop-blur-md bg-bg-panel/80 border border-border-subtle shadow-md">
        <span className="text-2xs font-mono text-text-dim flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
          {safeData.nodes.length} Nodes · {safeData.links.length} Edges
        </span>
      </div>

      {/* Modern Zoom Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          className="panel w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary backdrop-blur-md bg-bg-panel/80 border border-border-subtle shadow-md rounded-md font-mono text-base transition-colors"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 200)}
          title="Zoom In"
        >
          +
        </button>
        <button
          className="panel w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary backdrop-blur-md bg-bg-panel/80 border border-border-subtle shadow-md rounded-md font-mono text-base transition-colors"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 0.75, 200)}
          title="Zoom Out"
        >
          −
        </button>
        <button
          className="panel w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary backdrop-blur-md bg-bg-panel/80 border border-border-subtle shadow-md rounded-md font-mono text-xs transition-colors"
          onClick={() => fgRef.current?.zoomToFit(400, 40)}
          title="Reset View"
        >
          ⊡
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="tooltip pointer-events-none font-mono text-xs shadow-xl" style={{ bottom: 16, left: 16 }}>
          <div className="font-semibold text-text-primary">{tooltip.name}</div>
          <div className="text-text-muted text-2xs mt-0.5">
            {tooltip.type}
            {tooltip.ecosystem && ` · ${tooltip.ecosystem}`}
            {tooltip.version && ` · v${tooltip.version}`}
          </div>
        </div>
      )}
    </div>
  );
}
