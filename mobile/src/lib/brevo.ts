import { supabase } from './supabase';

/**
 * Emails go through a Supabase Edge Function (supabase/functions/send-email).
 * The Brevo API key is a server secret and must never be bundled in the app.
 */
export type EmailKind = 'welcome' | 'care_flag_update' | 'streak_reminder';

export async function sendEmail(kind: EmailKind, params: Record<string, string | number> = {}) {
  const { data, error } = await supabase.functions.invoke('send-email', { body: { kind, params } });
  if (error) throw error;
  return data as { ok: boolean };
}
