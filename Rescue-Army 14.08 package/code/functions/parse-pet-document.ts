// supabase/functions/parse-pet-document/index.ts
// Claude reads an uploaded vaccine record / lab report and returns structured rows.
// Rows land with source='ai_extracted', confirmed=false → owner reviews in the app before they count.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SCHEMA = `Return ONLY JSON: {
  "kind": "vaccine_record" | "lab_report" | "invoice" | "other",
  "vaccinations": [{ "vaccine": string, "brand": string|null, "dose": string|null, "lot_number": string|null,
     "route_site": string|null, "given_on": "YYYY-MM-DD", "valid_until": "YYYY-MM-DD"|null, "clinic": string|null,
     "vet_name": string|null, "reactions": string|null }],
  "labs": [{ "panel": string, "analyte": string, "value": number|null, "unit": string|null,
     "ref_low": number|null, "ref_high": number|null, "flag": "low"|"normal"|"high"|null, "taken_on": "YYYY-MM-DD", "clinic": string|null }],
  "notes": string
}. Extract only what is printed. Never guess dates. Weights in lb (convert kg×2.20462).`;

Deno.serve(async (req) => {
  const { document_id } = await req.json();
  const { data: doc } = await supabase.from('pet_documents').select('*').eq('id', document_id).single();
  if (!doc) return new Response('not found', { status: 404 });

  const { data: signed } = await supabase.storage.from('pet-documents').createSignedUrl(doc.storage_path, 300);
  const bytes = await (await fetch(signed!.signedUrl)).arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const isPdf = doc.storage_path.toLowerCase().endsWith('.pdf');

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: [
      isPdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
            : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
      { type: 'text', text: `You are a veterinary records clerk. ${SCHEMA}` },
    ]}],
  });
  const text = msg.content.find((c) => c.type === 'text')?.text ?? '{}';
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

  const vax = (parsed.vaccinations ?? []).map((v: any) => ({ ...v, pet_id: doc.pet_id, document_id: doc.id, source: 'ai_extracted', confirmed: false }));
  const labs = (parsed.labs ?? []).map((l: any) => ({ ...l, pet_id: doc.pet_id, document_id: doc.id, source: 'ai_extracted', confirmed: false }));
  if (vax.length) await supabase.from('vaccinations').insert(vax);
  if (labs.length) await supabase.from('lab_results').insert(labs);
  await supabase.from('pet_documents').update({ ai_status: 'parsed', ai_summary: parsed, kind: parsed.kind ?? doc.kind }).eq('id', doc.id);

  return Response.json({ vaccinations: vax.length, labs: labs.length });
});
