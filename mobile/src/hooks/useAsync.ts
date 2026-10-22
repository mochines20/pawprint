import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (value) {
      setError(value instanceof Error ? value : new Error('REQUEST_FAILED'));
    } finally {
      setLoading(false);
    }
  }, [fn]);
  useEffect(() => { void run(); }, [run]);
  return { data, setData, loading, error, reload: run };
}
