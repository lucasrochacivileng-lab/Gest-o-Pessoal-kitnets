import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseNubankNotification, suggestByRules } from './nubank-parser.ts';

const TOKEN_SHA256 = '720254f86db4a3d53b8ed32da1035430b550440b24e76bf7828a2ed9e5e5b44b';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const safeDate = (value: unknown) => {
  const parsed = value ? new Date(String(value)) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token || await sha256(token) !== TOKEN_SHA256) {
    return json({ success: false, error: 'unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'invalid_json' }, 400);
  }

  const packageName = String(body.package || body.package_name || '').trim();
  const title = String(body.title || '').trim();
  const text = String(body.text || '').trim();
  const receivedAt = safeDate(body.received_at || body.receivedAt || body['received at']);

  if (!packageName || (!title && !text)) {
    return json({ success: false, error: 'package_and_content_are_required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: 'server_not_configured' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (ownerError || !owner) return json({ success: false, error: 'admin_owner_not_found' }, 500);

  const dedupeKey = await sha256(`${packageName}|${title}|${text}|${receivedAt}`);
  const isNubank = /nubank|nu\.production/i.test(packageName);
  const parsed = isNubank
    ? parseNubankNotification(title, text)
    : { recognized: false, parserVersion: 'unsupported-package' };

  const { data: existing } = await supabase
    .from('notifications')
    .select('id, target_id, parse_status')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();

  if (existing) {
    return json({
      success: true,
      duplicate: true,
      notification_id: existing.id,
      transaction_id: existing.target_id || null,
      parsed: existing.parse_status === 'parsed',
    });
  }

  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      owner_id: owner.id,
      target_entity: 'financial_inbox',
      title: title || 'Notificacao bancaria',
      message: text,
      status: 'pendente',
      source: 'macrodroid',
      package_name: packageName,
      raw_title: title,
      raw_text: text,
      received_at: receivedAt,
      payload: body,
      parser_name: parsed.parserVersion,
      parse_status: parsed.recognized ? 'parsed' : 'unrecognized',
      dedupe_key: dedupeKey,
    })
    .select('id')
    .single();

  if (notificationError || !notification) {
    return json({ success: false, error: 'notification_insert_failed' }, 500);
  }

  if (!parsed.recognized || !parsed.transactionType || !parsed.direction || !parsed.amount || !parsed.description) {
    return json({
      success: true,
      parsed: false,
      notification_id: notification.id,
      transaction_id: null,
    });
  }

  const { data: ruleRows } = await supabase
    .from('records')
    .select('data')
    .eq('entity', 'ClassificationRule')
    .eq('active', true);
  const suggestion = suggestByRules(parsed.description, (ruleRows || []).map((row) => row.data));

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .insert({
      owner_id: owner.id,
      notification_id: notification.id,
      provider: 'nubank',
      transaction_type: parsed.transactionType,
      direction: parsed.direction,
      amount: parsed.amount,
      merchant: parsed.merchant || null,
      description: parsed.description,
      occurred_at: receivedAt,
      category_suggested: suggestion.category,
      cost_center_suggested: suggestion.costCenter,
      raw_parse: { ...parsed, classification_source: suggestion.source },
    })
    .select('*')
    .single();

  if (transactionError || !transaction) {
    await supabase.from('notifications').update({ status: 'erro', parse_status: 'transaction_error' }).eq('id', notification.id);
    return json({ success: false, error: 'transaction_insert_failed', notification_id: notification.id }, 500);
  }

  await supabase.from('notifications').update({ target_id: transaction.id }).eq('id', notification.id);

  return json({
    success: true,
    parsed: true,
    duplicate: false,
    notification_id: notification.id,
    transaction_id: transaction.id,
    transaction: {
      type: transaction.transaction_type,
      direction: transaction.direction,
      amount: transaction.amount,
      merchant: transaction.merchant,
      category_suggested: transaction.category_suggested,
      cost_center_suggested: transaction.cost_center_suggested,
    },
  });
});
