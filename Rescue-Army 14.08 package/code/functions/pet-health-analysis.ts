// supabase/functions/pet-health-analysis/index.ts
// Claude reasons across labs, weight, vaccinations, history and device data → pattern findings.
// ALWAYS framed as AI reasoning for the veterinarian, never a diagnosis.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You are a veterinary clinical-reasoning assistant helping a pet owner and their veterinarian.
Rules: You do NOT diagnose or prescribe. You surface patterns and relationships across data that a busy clinician
might miss, and phrase each as something to discuss with the vet. Flag data-quality problems (unit errors,
implausible jumps) explicitly. Be specific about which values you are connecting. Cite reference ranges when
values are borderline. Return ONLY JSON:
{ "findings": [ { "severity": "attention"|"watch"|"good", "title": string, "body": string } ],
  "data_quality": [string], "vet_summary": string }`;

Deno.serve(async (req) => {
  const { pet_id } = await req.json();
  const [pet, labs, weights, vax, history, devices] = await Promise.all([
    supabase.from('pets').select('name, species, breed, gender, age_text, weight_lb, target_weight_lb, spayed_neutered').eq('id', pet_id).single(),
    supabase.from('lab_results').select('panel, analyte, value, unit, ref_low, ref_high, flag, taken_on').eq('pet_id', pet_id).eq('confirmed', true).order('taken_on'),
    supabase.from('weight_entries').select('weight_lb, source, recorded_at').eq('pet_id', pet_id).order('recorded_at'),
    supabase.from('vaccinations').select('vaccine, brand, given_on, valid_until, reactions').eq('pet_id', pet_id).eq('confirmed', true),
    supabase.from('medical_records').select('record_type, title, record_date, notes').eq('pet_id', pet_id).order('record_date'),
    supabase.from('device_readings').select('metric, value, recorded_at').eq('pet_id', pet_id).gte('recorded_at', new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1800,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify({
      pet: pet.data, labs: labs.data, weights: weights.data, vaccinations: vax.data, history: history.data,
      device_last_30d: devices.data,
    }) }],
  });
  const text = msg.content.find((c) => c.type === 'text')?.text ?? '{}';
  const out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

  const { data: row } = await supabase.from('ai_health_analyses').insert({
    pet_id,
    findings: out.findings ?? [],
    inputs: { labs: labs.data?.length ?? 0, weights: weights.data?.length ?? 0, events: history.data?.length ?? 0,
              device_readings: devices.data?.length ?? 0, data_quality: out.data_quality ?? [], vet_summary: out.vet_summary ?? '' },
    model: 'claude-sonnet-4-5',
  }).select().single();

  return Response.json(row);
});
