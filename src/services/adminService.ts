import { supabase } from '@/storage/config/supabase';

/**
 * Log an admin action to user_action_logs
 * @param adminId - The admin user's ID
 * @param actionType - The type of admin action (e.g., 'admin_config_change', 'admin_user_ban', 'admin_balance_adjust')
 * @param details - An object describing what was changed or moderated
 */
export async function logAdminAction({
  adminId,
  actionType,
  details
}: {
  adminId: string;
  actionType: string;
  details: any;
}) {
  await supabase.from('user_action_logs').insert({
    user_id: adminId,
    action_type: actionType,
    details: JSON.stringify(details),
    created_at: new Date().toISOString()
  });
} 