import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

// This function retrieves game configurations for the admin dashboard
// It validates the user has admin rights before returning any data
serve(async (req) => {
  try {
    // Get JWT token from request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    // Get Supabase client with admin privileges
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
    
    // Verify that the user has admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('roles')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    // Check if user has admin role
    const isAdmin = profile.roles?.includes('admin') || false;
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 403 }
      );
    }
    
    // Fetch game configurations from the database
    const { data: configs, error: configsError } = await supabaseAdmin
      .from('game_configs')
      .select('*')
      .order('key');
    
    if (configsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch configurations' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Return the configurations
    return new Response(
      JSON.stringify({ 
        configs: configs || [],
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error fetching game configs:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}); 