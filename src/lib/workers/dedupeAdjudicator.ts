import { supabase } from '@/lib/backend';
import { getOpenAIClient } from '@/lib/openai/client';
import { logger } from '@/lib/logger';

interface DupeCandidate {
  row1_id: number;
  row2_id: number;
  payee_name_1: string;
  payee_name_2: string;
  normalized_name_1: string;
  normalized_name_2: string;
}

/**
 * Fetch duplicate name candidates, ask the LLM to adjudicate, and persist links.
 */
export async function adjudicateDuplicates(limit = 50): Promise<void> {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('mv_dupe_candidates')
    .select('*')
    .limit(limit);
  if (error) throw error;
  if (!data) return;

  const client = await getOpenAIClient();

  for (const cand of data as DupeCandidate[]) {
    const prompt = `Two payee names may refer to the same entity.\n\nPayee A: "${cand.payee_name_1}"\nPayee B: "${cand.payee_name_2}"\n\nDecide if they should be merged (same entity), linked (related but distinct), or treated as distinct.\nRespond with exactly one word: merge, link, or distinct.`;

    let decision = 'distinct';
    try {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1
      });
      decision = (resp.choices[0].message.content || '').trim().toLowerCase();
    } catch (err) {
      logger.error('[DEDUPE] LLM adjudication failed', err);
      continue;
    }

    if (decision === 'merge' || decision === 'link') {
      const { error: upsertError } = await supabase
        .from('dedupe_links')
        .upsert(
          {
            canonical_normalized: cand.normalized_name_1,
            duplicate_normalized: cand.normalized_name_2
          },
          { onConflict: 'duplicate_normalized' }
        );
      if (upsertError) {
        logger.error('[DEDUPE] Failed to record dedupe link', upsertError);
      } else {
        logger.info(`[DEDUPE] Recorded ${decision} for ${cand.normalized_name_1} and ${cand.normalized_name_2}`);
      }
    } else {
      logger.info(`[DEDUPE] Marked distinct: ${cand.normalized_name_1} vs ${cand.normalized_name_2}`);
    }
  }
}
