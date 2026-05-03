const MAX_GRAPH_REFS = 6;

function getNodePositions(refs, xPercent) {
  const count = refs.length;
  if (count === 0) return [];

  const top = count === 1 ? 130 : 52;
  const bottom = count === 1 ? 130 : 208;
  const step = count === 1 ? 0 : (bottom - top) / (count - 1);

  return refs.map((ref, index) => ({
    ref,
    x: xPercent,
    y: top + step * index
  }));
}

function GraphNode({ node, className, children, onNavigate }) {
  const isNavigable = Boolean(node.ref);

  return (
    <button
      className={`citation-graph-node ${className}`}
      style={{ left: `${node.x}%`, top: `${node.y}px` }}
      onClick={() => isNavigable && onNavigate(node.ref.part, node.ref.question, node.ref.article)}
      disabled={!isNavigable}
    >
      {children}
    </button>
  );
}

export default function CitationGraph({ article, onNavigate }) {
  const inboundRefs = article.inboundRefs || [];
  const outboundRefs = article.outboundRefs || [];
  const inboundNodes = getNodePositions(inboundRefs.slice(0, MAX_GRAPH_REFS), 15);
  const outboundNodes = getNodePositions(outboundRefs.slice(0, MAX_GRAPH_REFS), 85);
  const centerNode = { x: 50, y: 130 };
  const hiddenInbound = Math.max(0, inboundRefs.length - MAX_GRAPH_REFS);
  const hiddenOutbound = Math.max(0, outboundRefs.length - MAX_GRAPH_REFS);

  if (inboundRefs.length === 0 && outboundRefs.length === 0) return null;

  return (
    <section className="citation-graph-panel">
      <div className="citation-graph-header">
        <span className="section-label">Citation Graph</span>
        <span className="citation-graph-counts">
          {inboundRefs.length} inbound · {outboundRefs.length} outbound
        </span>
      </div>

      <div className="citation-graph-canvas" aria-label="Article citation graph">
        <svg className="citation-graph-lines" viewBox="0 0 100 260" preserveAspectRatio="none" role="presentation">
          {inboundNodes.map(node => (
            <line
              key={`in-${node.ref.part}-${node.ref.question}-${node.ref.article}`}
              className="citation-graph-line inbound"
              x1={node.x + 9}
              y1={node.y}
              x2={centerNode.x - 11}
              y2={centerNode.y}
            />
          ))}
          {outboundNodes.map(node => (
            <line
              key={`out-${node.ref.part}-${node.ref.question}-${node.ref.article}`}
              className="citation-graph-line outbound"
              x1={centerNode.x + 11}
              y1={centerNode.y}
              x2={node.x - 9}
              y2={node.y}
            />
          ))}
        </svg>

        <div className="citation-graph-column-label inbound">Cited by</div>
        <div className="citation-graph-column-label outbound">Cites</div>

        {inboundNodes.map(node => (
          <GraphNode
            key={`node-in-${node.ref.part}-${node.ref.question}-${node.ref.article}`}
            node={node}
            className="inbound"
            onNavigate={onNavigate}
          >
            <span>{node.ref.part}</span>
            <strong>Q.{node.ref.question} A.{node.ref.article}</strong>
          </GraphNode>
        ))}

        <GraphNode node={centerNode} className="current" onNavigate={onNavigate}>
          <span>Current</span>
          <strong>{article.part} Q.{article.question} A.{article.article}</strong>
        </GraphNode>

        {outboundNodes.map(node => (
          <GraphNode
            key={`node-out-${node.ref.part}-${node.ref.question}-${node.ref.article}`}
            node={node}
            className="outbound"
            onNavigate={onNavigate}
          >
            <span>{node.ref.part}</span>
            <strong>Q.{node.ref.question} A.{node.ref.article}</strong>
          </GraphNode>
        ))}

        {(hiddenInbound > 0 || hiddenOutbound > 0) && (
          <div className="citation-graph-overflow">
            {hiddenInbound > 0 && <span>+{hiddenInbound} more inbound</span>}
            {hiddenOutbound > 0 && <span>+{hiddenOutbound} more outbound</span>}
          </div>
        )}
      </div>
    </section>
  );
}
