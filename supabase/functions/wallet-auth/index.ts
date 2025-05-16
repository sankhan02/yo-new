// Supabase Edge Function: SIWS + Supabase Auth for Solana
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import nacl from "npm:tweetnacl";
import bs58 from "npm:bs58";
import { create, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v2.8/mod.ts";

// CORS config
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://your-production-domain.com"
];

// JWT Configuration
const JWT_SECRET = Deno.env.get("SB_JWT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Validate environment variables
if (!JWT_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error("Missing env vars:", {
    hasJwtSecret: !!JWT_SECRET,
    hasSupabaseUrl: !!SUPABASE_URL,
    hasServiceRoleKey: !!SERVICE_ROLE_KEY,
    hasAnonKey: !!ANON_KEY
  });
  throw new Error("Required Supabase env vars are not set.");
}

const JWT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

function validateSIWSMessage(message: string): { domain: string; nonce: string } {
  const domainMatch = message.match(/Sign in to ([^\n]+)/i);
  const nonceMatch = message.match(/Nonce: ([^\n]+)/i);
  const issuedAtMatch = message.match(/Issued At: ([^\n]+)/i);

  if (!domainMatch || !nonceMatch || !issuedAtMatch) {
    throw new Error("Invalid SIWS message format");
  }

  const domain = domainMatch[1].trim();
  const nonce = nonceMatch[1].trim();
  const issuedAt = issuedAtMatch[1].trim();

  const messageTime = Date.parse(issuedAt);
  if (isNaN(messageTime)) throw new Error("Invalid issuedAt timestamp");

  const now = Date.now();
  if (Math.abs(now - messageTime) > 5 * 60 * 1000) {
    throw new Error("Message too old");
  }

  return { domain, nonce };
}

async function createOrGetUser(walletAddress: string): Promise<string> {
  const email = `${walletAddress}@wallet.yomama`;

  const headers = {
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "apikey": SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
  };

  try {
    // First try to get existing user by email
    const getUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers,
    });

    if (!getUserResponse.ok) {
      throw new Error(`Get user failed: ${await getUserResponse.text()}`);
    }

    const usersData = await getUserResponse.json();

    if (usersData?.users?.length > 0) {
      return usersData.users[0].id;
    }

    // Create new user if not found
    const createUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
          wallet_address: walletAddress,
          auth_method: "wallet",
        },
      }),
    });

    if (!createUserResponse.ok) {
      const errorText = await createUserResponse.text();
      console.error("Create user failed response:", errorText);
      throw new Error(`User creation failed: ${errorText}`);
    }

    const newUser = await createUserResponse.json();
    return newUser.id;
  } catch (error) {
    console.error("createOrGetUser error details:", error);
    throw error;
  }
}

async function createProfile(userId: string, walletAddress: string): Promise<void> {
  const email = `${walletAddress}@wallet.yomama`;
  
  const headers = {
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "apikey": SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  try {
    // First check if profile exists by wallet_address
    const checkProfileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?wallet_address=eq.${walletAddress}&select=id`,
      { headers }
    );

    if (!checkProfileResponse.ok) {
      throw new Error(`Check profile failed: ${await checkProfileResponse.text()}`);
    }

    const existingProfiles = await checkProfileResponse.json();
    if (existingProfiles.length > 0) {
      console.log("Profile already exists for wallet:", walletAddress);
      return;
    }

    // Create new profile
    const createProfileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: userId,
          wallet_address: walletAddress,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!createProfileResponse.ok) {
      const errorText = await createProfileResponse.text();
      console.error("Create profile failed response:", errorText);
      throw new Error(`Profile creation failed: ${errorText}`);
    }

    console.log("Profile created successfully for wallet:", walletAddress);
  } catch (error) {
    console.error("createProfile error details:", error);
    // If it's a unique constraint violation on wallet_address, we can ignore it
    if (error instanceof Error && error.message.includes('profiles_wallet_address_key')) {
      console.log("Wallet address already has a profile, continuing...");
      return;
    }
    throw error;
  }
}

// Serve HTTP requests
serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    // Get API key from request
    const apiKey = req.headers.get("apikey") || req.headers.get("authorization")?.split("Bearer ")[1];
    
    if (!apiKey) {
      throw new Error("No API key found in request");
    }

    // Verify it's the anon key
    if (apiKey !== ANON_KEY) {
      console.error("Invalid API key provided:", { 
        providedKey: apiKey?.slice(0, 8) + "..." 
      });
      throw new Error("Invalid API key");
    }

    // Parse request body
    const { address, signature, message } = await req.json();

    // Validate required fields
    if (!address || !signature || !message) {
      throw new Error("Missing required fields: address, signature, message");
    }

    // Create or get user
    const userId = await createOrGetUser(address);
    if (!userId) {
      throw new Error("Failed to create or get user");
    }

    // Verify signature
    const signatureUint8 = bs58.decode(signature);
    const messageUint8 = new TextEncoder().encode(message);
    const publicKeyUint8 = bs58.decode(address);

    const isValid = nacl.sign.detached.verify(
      messageUint8,
      signatureUint8,
      publicKeyUint8
    );

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Create profile record
    await createProfile(userId, address);

    // Generate JWT token
    const payload: Payload = {
      role: "authenticated",
      iss: "supabase",
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60), // 1 hour
      sub: userId,
      email: `${address}@wallet.yomama`,
      aud: "authenticated",
    };

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const token = await create({ alg: "HS256", typ: "JWT" }, payload, key);

    return new Response(
      JSON.stringify({ token }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in wallet-auth function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
