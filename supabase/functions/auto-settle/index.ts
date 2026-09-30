// ÉRIS — Auto-settlement (Supabase Edge Function, Deno).
// Lit les matchs PandaScore "finished" pour lesquels on a des pronos non réglés,
// puis appelle settle_match(match_id, score_a, score_b) — sans intervention.
//
// Secrets requis :  PANDASCORE_TOKEN   (supabase secrets set PANDASCORE_TOKEN=...)
// Auto-injectés    :  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Déploiement :  supabase functions deploy auto-settle --no-verify-jwt
// Test manuel :  curl -X POST https://<ref>.supabase.co/functions/v1/auto-settle

import { createClient } from 'npm:@supabase/supabase-js@2';

const PANDA = Deno.env.get('PANDASCORE_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PSResult { score: number; team_id: number }
interface PSOpp { opponent: { id: number; image_url: string | null } | null }
interface PSMatch {
  status: string;
  begin_at: string | null;
  serie: { id: number | null } | null;
  opponents: PSOpp[];
  results: PSResult[];
}

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = new Date().toISOString();
  // À régler : pronos non réglés, commencés OU sans kickoff connu.
  const { data: toSettle, error } = await sb
    .from('predictions')
    .select('match_id')
    .eq('settled', false)
    .or(`match_start.lte.${now},match_start.is.null`);
  if (error) {
    return json({ error: error.message }, 500);
  }
  // À backfiller : pronos sans logo (même réglés).
  const { data: toLogo } = await sb.from('predictions').select('match_id').is('team_a_logo', null);

  // Ids PandaScore uniquement (on ignore les matchs démo/test non numériques).
  const ids = [
    ...new Set([...(toSettle ?? []), ...(toLogo ?? [])].map((p) => p.match_id as string)),
  ].filter((id) => /^\d+$/.test(id));

  let settled = 0;
  let logos = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const res = await fetch(`https://api.pandascore.co/matches/${id}`, {
        headers: { Authorization: `Bearer ${PANDA}` },
      });
      if (!res.ok) continue;
      const m = (await res.json()) as PSMatch;

      // Backfill des logos (orientation A/B = opponents[0/1]).
      const aLogo = m.opponents?.[0]?.opponent?.image_url ?? null;
      const bLogo = m.opponents?.[1]?.opponent?.image_url ?? null;
      if (aLogo || bLogo) {
        const { error: logoErr } = await sb
          .from('predictions')
          .update({ team_a_logo: aLogo, team_b_logo: bLogo })
          .eq('match_id', id)
          .is('team_a_logo', null);
        if (!logoErr) logos++;
      }

      if (m.status !== 'finished') continue;

      // Même orientation A/B que l'app (teamA = opponents[0]).
      const aId = m.opponents?.[0]?.opponent?.id;
      const bId = m.opponents?.[1]?.opponent?.id;
      const scoreA = m.results?.find((r) => r.team_id === aId)?.score;
      const scoreB = m.results?.find((r) => r.team_id === bId)?.score;
      if (scoreA == null || scoreB == null) continue;

      const { error: rpcErr } = await sb.rpc('settle_match', {
        p_match_id: id,
        p_score_a: scoreA,
        p_score_b: scoreB,
      });
      if (rpcErr) {
        errors.push(`${id}: ${rpcErr.message}`);
        continue;
      }
      settled++;
      // Backfill kickoff + serie_id pour les vieux pronos (→ comptent en ligue + scope event).
      await sb
        .from('predictions')
        .update({
          match_start: m.begin_at,
          serie_id: m.serie?.id != null ? String(m.serie.id) : null,
        })
        .eq('match_id', id)
        .is('match_start', null);
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return json({ candidates: ids.length, settled, logos, errors });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
