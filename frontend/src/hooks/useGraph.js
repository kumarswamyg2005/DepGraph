import { useState, useCallback } from 'react';

/**
 * useGraph — manages graph data { nodes, links } for visualization
 * Transforms any API response into force-graph compatible format.
 */
export function useGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadGraph = useCallback(async (fetchFn) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: apiError } = await fetchFn();
      if (apiError) {
        setError(apiError);
        setGraphData({ nodes: [], links: [] });
        return;
      }
      if (data && data.nodes) {
        // Already in graph format (dep-graph endpoint)
        setGraphData({
          nodes: (data.nodes || []).filter((n) => n && n.id),
          links: (data.links || []).filter((l) => l && l.source && l.target),
        });
      } else if (Array.isArray(data)) {
        // Convert flat array to graph (transitive deps)
        const nodes = data.map((pkg) => ({
          id: pkg.id || pkg.name,
          name: pkg.name,
          type: 'Package',
          ecosystem: pkg.ecosystem,
          version: pkg.version,
          depth: pkg.depth,
        }));
        setGraphData({ nodes, links: [] });
      } else {
        setGraphData({ nodes: [], links: [] });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const setGraph = useCallback((nodes, links) => {
    setGraphData({ nodes, links });
  }, []);

  const clear = useCallback(() => {
    setGraphData({ nodes: [], links: [] });
    setError(null);
  }, []);

  return { graphData, loading, error, loadGraph, setGraph, clear };
}
