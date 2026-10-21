// Supabase Edge Function (Deno). Sends transactional email through Brevo.
// Secrets:  supabase secrets set BREVO_API_KEY=xxxx BREVO_SENDER_EMAIL=hello@yourdomain.ph BREVO_SENDER_NAME=Pawprint
// Deploy:   supabase functions deploy send-email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TEMPLATES: Record<string, { subject: string; html: (p: Record<string, string>) => string }> = {
  welcome: {
    subject: 'Welcome to Pawprint',
    html: () => '<h2>Welcome to Pawprint 🐾</h2><p>Spot cats. Leave a trace. Your pins are always approximate and disappear after 24 hours.</p>',
  },
  care_flag_update: {
    subject: 'Update on your Care Flag',
    html: (p) => `<p>Your Care Flag (${p.need ?? 'cat in need'}) has an update: ${p.status ?? 'someone is on the way'}.</p>`,
  },
  streak_reminder: {
    subject: 'Your streak is about to end',
    html: (p) => `<p>You are on a ${p.streak ?? ''}-day streak. Spot a cat today to keep it.</p>`,
  },
};

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Only signed-in users may trigger email, and only to their own address.
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supa.auth.getUser();
  if (!user?.email) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: cors });

  const { kind, params = {} } = await req.json();
  const tpl = TEMPLATES[kind];
  if (!tpl) return new Response(JSON.stringify({ ok: false, error: 'unknown template' }), { status: 400, headers: cors });

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: Deno.env.get('BREVO_SENDER_EMAIL'), name: Deno.env.get('BREVO_SENDER_NAME') ?? 'Pawprint' },
      to: [{ email: user.email }],
      subject: tpl.subject,
      htmlContent: tpl.html(params),
    }),
  });
  return new Response(JSON.stringify({ ok: res.ok }), { status: res.ok ? 200 : 502, headers: { ...cors, 'content-type': 'application/json' } });
});
