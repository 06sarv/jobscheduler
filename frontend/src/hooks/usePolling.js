import { useState, useEffect, useCallback, useRef } from 'react';

export const usePolling = (fetchFn, intervalMs = 10000, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err);
      console.error('Polling error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    const tick = () => {
      timeoutRef.current = setTimeout(async () => {
        await fetchData();
        tick();
      }, intervalMs);
    };

    tick();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, intervalMs]);

  return { data, loading, error, refresh: fetchData };
};
