import { supabase } from '@/storage/config/supabase';

/**
 * Fetch a PvP match and its players by match ID
 */
export async function fetchMatch(matchId: string) {
  const { data: match, error } = await supabase
    .from('pvp_matches')
    .select('*')
    .eq('id', matchId)
    .single();
  if (error) throw error;
  const { data: players, error: playerError } = await supabase
    .from('pvp_match_players')
    .select('user_id, score, is_opponent')
    .eq('match_id', matchId);
  if (playerError) throw playerError;
  return { ...match, players };
}

/**
 * Create a new PvP match and its players
 */
export async function createMatch(type: string, bet: number, playerIds: string[]) {
  const { data: match, error } = await supabase
    .from('pvp_matches')
    .insert({
      type,
      status: 'pending',
      bet,
      start_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  const players = playerIds.map((userId, idx) => ({
    match_id: match.id,
    user_id: userId,
    score: 0,
    is_opponent: idx !== 0,
  }));
  const { error: playerError } = await supabase
    .from('pvp_match_players')
    .insert(players);
  if (playerError) throw playerError;
  return match;
}

/**
 * Update the status (and optionally winner) of a PvP match
 */
export async function updateMatchStatus(matchId: string, status: string, winnerId?: string) {
  const updateObj: any = { status };
  if (winnerId) updateObj.winner_id = winnerId;
  if (status === 'completed') updateObj.end_time = new Date().toISOString();
  const { error } = await supabase
    .from('pvp_matches')
    .update(updateObj)
    .eq('id', matchId);
  if (error) throw error;
}

/**
 * Update a player's score in a PvP match
 */
export async function updatePlayerScore(matchId: string, userId: string, score: number) {
  const { error } = await supabase
    .from('pvp_match_players')
    .update({ score })
    .eq('match_id', matchId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Fetch recent matches for a player
 */
export async function getPlayerMatches(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('pvp_match_players')
    .select('match_id, score, is_opponent, pvp_matches(*)')
    .eq('user_id', userId)
    .order('created_at', { foreignTable: 'pvp_matches', ascending: false })
    .limit(limit);
  if (error) throw error;
  return data?.map((row: any) => ({ ...row.pvp_matches, score: row.score, is_opponent: row.is_opponent })) || [];
}

/**
 * Add a player to the matchmaking queue
 */
export async function joinQueue(userId: string) {
  // Insert the user into the queue
  const { error } = await supabase
    .from('pvp_matchmaking_queue')
    .insert({ user_id: userId });
  if (error) throw error;
  // Try to find a match
  return await findMatchForUser(userId);
}

/**
 * Remove a player from the matchmaking queue
 */
export async function leaveQueue(userId: string) {
  const { error } = await supabase
    .from('pvp_matchmaking_queue')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Try to find a match for the given user
 * Returns the match if found, otherwise null
 */
export async function findMatchForUser(userId: string) {
  // Get all users in the queue except the current user
  const { data: queue, error } = await supabase
    .from('pvp_matchmaking_queue')
    .select('user_id, joined_at')
    .neq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  if (queue && queue.length > 0) {
    // Found an opponent, create a match
    const opponentId = queue[0].user_id;
    // Remove both users from the queue
    await leaveQueue(userId);
    await leaveQueue(opponentId);
    // Create the match (default bet and type for now)
    return await createMatch('1v1', 10, [userId, opponentId]);
  }
  // No match found yet
  return null;
}

/**
 * Fetch the top coin earners leaderboard
 */
export async function getLeaderboardTopCoins(limit = 20) {
  const { data, error } = await supabase
    .from('public_leaderboard_top_coins')
    .select('*')
    .order('coins', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Fetch the active (pending or in-progress) match for a user
 */
export async function getActiveMatch(userId: string) {
  const { data, error } = await supabase
    .from('pvp_match_players')
    .select('match_id, score, is_opponent, pvp_matches(*)')
    .eq('user_id', userId)
    .order('created_at', { foreignTable: 'pvp_matches', ascending: false })
    .limit(5); // Check recent matches
  if (error) throw error;
  if (!data) return null;
  const active = data.find((row: any) => {
    const match = Array.isArray(row.pvp_matches) ? row.pvp_matches[0] : row.pvp_matches;
    return match && (match.status === 'pending' || match.status === 'in_progress');
  });
  if (!active) return null;
  const match = Array.isArray(active.pvp_matches) ? active.pvp_matches[0] : active.pvp_matches;
  return match ? { ...match, score: active.score, is_opponent: active.is_opponent } : null;
}

/**
 * Log a PvP match result to user_action_logs
 */
export async function logMatchResult({
  matchId,
  winnerId,
  loserId,
  bet
}: {
  matchId: string;
  winnerId: string;
  loserId: string;
  bet: number;
}) {
  await supabase.from('user_action_logs').insert({
    user_id: winnerId,
    action_type: 'match_result',
    details: JSON.stringify({ matchId, winnerId, loserId, bet, result: 'win' }),
    created_at: new Date().toISOString()
  });
  await supabase.from('user_action_logs').insert({
    user_id: loserId,
    action_type: 'match_result',
    details: JSON.stringify({ matchId, winnerId, loserId, bet, result: 'loss' }),
    created_at: new Date().toISOString()
  });
} 