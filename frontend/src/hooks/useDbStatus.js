import { useState, useEffect, useCallback } from 'react';
import { getHealth } from '../lib/api';

/**
 * useDbStatus — polls /api/health every 15s
 * Returns { connected, status, loading, refetch }
 */
export function useDbStatus() {
  const [state, setState] = useState({ connected: null, status: 'checking', loading: true });

  const check = useCallback(async () => {
    const { data, error } = await getHealth();
    if (error || !data) {
      setState({ connected: false, status: 'error', loading: false });
    } else {
      setState({ connected: data.connected, status: data.status, loading: false });
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 15_000);
    return () => clearInterval(interval);
  }, [check]);

  return { ...state, refetch: check };
}
