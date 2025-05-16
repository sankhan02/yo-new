import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

// This function updates a game configuration for the admin dashboard
// It validates the user has admin rights before allowing any changes
serve(async (req) => {
  try {
    // Get request body
    const { key, value } = await req.json();
    
    // Validate the parameters
    if (!key || typeof key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid configuration key' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (value === undefined) {
      return new Response(
        JSON.stringify({ error: 'Configuration value is required' }),
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
    
    // Check if the config exists first
    const { data: existingConfig, error: configCheckError } = await supabaseAdmin
      .from('game_configs')
      .select('key')
      .eq('key', key)
      .single();
    
    if (configCheckError && configCheckError.code !== 'PGRST116') { // Not "no rows returned" error
      return new Response(
        JSON.stringify({ error: 'Failed to check configuration' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    let result;
    
    // Update or insert the configuration
    if (existingConfig) {
      // Update existing config
      const { data, error: updateError } = await supabaseAdmin
        .from('game_configs')
        .update({ value, updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('key', key)
        .select()
        .single();
      
      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update configuration' }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      result = data;
    } else {
      // Insert new config
      const { data, error: insertError } = await supabaseAdmin
        .from('game_configs')
        .insert({ 
          key, 
          value, 
          created_at: new Date().toISOString(),
          created_by: user.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .select()
        .single();
      
      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create configuration' }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      result = data;
    }
    
    // Return success response with the updated configuration
    return new Response(
      JSON.stringify({ 
        success: true,
        config: result,
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error updating game config:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}); 