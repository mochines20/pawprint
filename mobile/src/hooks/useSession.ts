import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, ready };
}
