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
export function GraphView({ graphData, height = 520, onNodeClick, busFactorIds = [] }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const busFactorSet = React.useMemo(() => new Set(busFactorIds), [busFactorIds]);

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

  // Responsive width observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width || 800);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fit to view after data loads
  useEffect(() => {
    if (fgRef.current && safeData.nodes.length > 0) {
      setTimeout(() => {
        try { fgRef.current.zoomToFit(400, 40); } catch {}
      }, 600);
    }
  }, [safeData]);

  const drawNode = useCallback((node, ctx, globalScale) => {
    if (node.x == null || node.y == null) return;

    const r = NODE_RADIUS[node.type] || 6;
    const color = getColor(node, busFactorSet);
    const isHovered = node.id === hoveredId;
    const isBusFactor = busFactorSet.has(node.id);

    // Risk halo rings
    if (isBusFactor) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#ff44440a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ff444455';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Hover glow
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ffffff60';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Node circle with gradient-like shading
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(node.x, node.y - r * 0.2, r * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = `${color}55`;
    ctx.fill();

    // Label — always show when zoomed in, show for all nodes at normal zoom
    const label = (node.name || node.id || '').replace(/^@[^/]+\//, '');
    const short = label.length > 18 ? label.slice(0, 17) + '…' : label;
    const fontSize = Math.min(10, Math.max(6, 9 / globalScale));
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Label background
    const tw = ctx.measureText(short).width;
    const padding = 2;
    ctx.fillStyle = '#0a0a0fcc';
    ctx.fillRect(node.x - tw / 2 - padding, node.y + r + 2, tw + padding * 2, fontSize + 2);

    // Label text
    ctx.fillStyle = isHovered ? '#ffffff' : isBusFactor ? '#ff8888' : '#c8c8d8';
    ctx.fillText(short, node.x, node.y + r + 3);
  }, [busFactorSet, hoveredId]);

  const drawLink = useCallback((link, ctx) => {
    const src = link.source;
    const tgt = link.target;
    if (!src?.x || !tgt?.x) return;

    const color = EDGE_COLORS[link.type] || '#60a5fa';
    const isMaintains = link.type === 'MAINTAINS';
    const lw = isMaintains ? 2 : 1.5;
    const alpha = isMaintains ? 0.7 : 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    if (!isMaintains) ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, []);

  if (!safeData.nodes.length) return null;

  return (
    <div ref={containerRef} className="graph-container relative overflow-hidden" style={{ height }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={safeData}
        width={width}
        height={height}
        backgroundColor="#0a0a0f"
        nodeCanvasObject={drawNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObject={drawLink}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={(node) => onNodeClick && onNodeClick(node)}
        onNodeHover={(node) => {
          setHoveredId(node?.id ?? null);
          setTooltip(node
            ? { name: node.name, type: node.type, ecosystem: node.ecosystem, version: node.version }
            : null
          );
          document.body.style.cursor = node ? 'pointer' : 'default';
        }}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        cooldownTicks={150}
        nodeRelSize={4}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link) => EDGE_COLORS[link.type] || '#30304880'}
        d3VelocityDecay={0.25}
        d3AlphaDecay={0.015}
        warmupTicks={30}
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 panel p-2 space-y-1">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 text-2xs font-mono text-text-muted">
            <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: color }} />
            {type}
          </div>
        ))}
        <div className="flex items-center gap-2 text-2xs font-mono text-risk">
          <div className="rounded-full flex-shrink-0 ring-1 ring-risk" style={{ width: 8, height: 8, background: BUS_FACTOR_COLOR }} />
          Bus Factor
        </div>
      </div>

      {/* Node + edge count */}
      <div className="absolute top-3 right-3 panel px-2.5 py-1">
        <span className="text-2xs font-mono text-text-dim">
          {safeData.nodes.length}N · {safeData.links.length}E
        </span>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          className="panel w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary font-mono text-sm"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 200)}
          title="Zoom in"
        >+</button>
        <button
          className="panel w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary font-mono text-sm"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 0.75, 200)}
          title="Zoom out"
        >−</button>
        <button
          className="panel w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary font-mono text-xs"
          onClick={() => fgRef.current?.zoomToFit(400, 40)}
          title="Fit to view"
        >⊡</button>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div className="tooltip" style={{ bottom: 16, left: 16 }}>
          <div className="font-mono text-text-primary text-xs font-medium">{tooltip.name}</div>
          <div className="text-text-muted text-2xs mt-0.5 font-mono">
            {tooltip.type}
            {tooltip.ecosystem && ` · ${tooltip.ecosystem}`}
            {tooltip.version && ` · v${tooltip.version}`}
          </div>
        </div>
      )}
    </div>
  );
}
