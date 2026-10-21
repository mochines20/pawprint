import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); } finally { setLoading(false); }
  }, [fn]);
  useEffect(() => { void run(); }, [run]);
  return { data, setData, loading, reload: run };
}
