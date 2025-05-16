import { supabase } from '@/storage/config/supabase';
import { logAdminAction } from '@/services/adminService';
import { getUserFromRequest } from '@/utils/authUtils'; // You may need to implement this

export async function GET(req) {
  const user = await getUserFromRequest(req);
  if (!user || !user.roles.includes('admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  const { data, error } = await supabase.from('game_config').select('*');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
}

export async function POST(req) {
  const user = await getUserFromRequest(req);
  if (!user || !user.roles.includes('admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  const { key, value } = await req.json();
  const { data, error } = await supabase
    .from('game_config')
    .update({ value })
    .eq('key', key)
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  await logAdminAction({
    adminId: user.id,
    actionType: 'admin_config_change',
    details: { key, newValue: value }
  });
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
} 