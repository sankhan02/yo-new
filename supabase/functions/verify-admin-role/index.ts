import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

// This function securely verifies if a user has admin rights
// It uses the user's JWT token for authentication and checks their role in the database
serve(async (req) => {
  try {
    // Get request body
    const { wallet_address } = await req.json();
    
    // Validate the wallet address format
    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Get JWT token from request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    // Get Supabase client with admin privileges 
    // (Note: This is executed in a secure Edge Function environment)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get Supabase client with the user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Verify the user's JWT and get their Supabase UUID
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message || 'Invalid token' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    // Verify that the authenticated user owns the wallet address
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, wallet_address, roles')
      .eq('user_id', user.id)
      .eq('wallet_address', wallet_address)
      .single();
    
    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Wallet address verification failed' }),
        { headers: { 'Content-Type': 'application/json' }, status: 403 }
      );
    }
    
    // Check if user has admin role
    const isAdmin = profile.roles?.includes('admin') || false;
    
    // Return the result
    return new Response(
      JSON.stringify({ 
        isAdmin,
        userId: user.id, 
        walletAddress: wallet_address 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Admin verification error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}); 