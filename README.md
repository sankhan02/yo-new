# Solana Wallet Authentication with Reown AppKit and Supabase

This project implements an efficient one-click wallet-based authentication system using [Reown AppKit](https://appkit.reown.com/) and [Supabase](https://supabase.io/).

## Single-Click Authentication Flow

This implementation follows a streamlined approach based on the official Reown AppKit documentation:

1. **Single Connect Button**: User clicks one button to connect their Solana wallet
2. **Automatic Message Signing**: Message signing is triggered automatically by AppKit
3. **Automatic Edge Function Call**: Our SIWX addSession hook calls the Supabase Edge Function
4. **Automatic JWT Setup**: The JWT from the Edge Function is used to establish a Supabase session

## Key Components

### 1. Frontend Components
- `appkit.ts`: Initializes Reown AppKit with our custom SIWX configuration
- `siwx.ts`: Custom SIWX configuration that automatically triggers the Edge Function
- `WalletConnection.vue`: Simple UI component with just a connect button
- `auth.ts`: Compatibility layer for legacy code

### 2. Backend Components
- `supabase/functions/wallet-auth/index.ts`: Supabase Edge Function that verifies wallet signatures and issues JWTs

## Implementation Details

### Custom SIWX Configuration
The implementation uses Reown AppKit's SIWX with a custom configuration that hooks into our Supabase authentication:

```typescript
// Custom SIWX configuration with Edge Function hook
export const siwxConfig: SIWXConfig = {
  async createMessage({ accountAddress, chainId }) {
    // Create message with domain, uri, statement, and nonce
    return {
      accountAddress,
      chainId,
      domain: window.location.hostname,
      // ... other properties
      
      toString() {
        return `Sign in to ${domain}\nNonce: ${nonce}\nIssued At: ${timestamp}`;
      }
    };
  },
  
  async addSession(session: SIWXSession) {
    // This is called automatically after message signing
    // 1. Extract data from the session (address, signature, message)
    // 2. Call Supabase Edge Function to authenticate
    // 3. Set up Supabase session with the returned JWT
    // 4. Store state in localStorage
  },
  
  // Other methods for session management
};
```

### Supabase Edge Function
The Edge Function verifies Solana signatures and creates/gets users in Supabase Auth:

```typescript
// Verify signature
const pubkey = bs58.decode(address);
const msg = new TextEncoder().encode(message);
const sig = bs58.decode(signature);
const isValid = nacl.sign.detached.verify(msg, sig, pubkey);

// Create/get user in Supabase Auth
const userId = await createOrGetUser(address);

// Issue JWT
const payload = {
  sub: userId,
  email: `${address}@wallet.yomama`,
  aud: "authenticated",
  role: "authenticated",
  exp: getNumericDate(60 * 60),  // 1 hour expiry
  user_metadata: { wallet_address: address }
};

// Return JWT token
return { token };
```

## Setup Instructions

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file with Supabase and Reown credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_SUPABASE_FUNCTION_URL=your-edge-function-url
   VITE_REOWN_PROJECT_ID=your-reown-project-id
   ```

3. **Deploy Edge Function**:
   ```
   npx supabase functions deploy wallet-auth
   ```

4. **Set required secrets**:
   ```
   npx supabase secrets set SUPABASE_JWT_SECRET=your-jwt-secret
   npx supabase secrets set SUPABASE_URL=your-supabase-url
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

5. **Run the application**:
   ```
   npm run dev
   ```

## Security Considerations

- All signature verification happens server-side in the Edge Function
- Message nonces prevent replay attacks
- Timestamp validation ensures messages expire after a short time
- Row-Level Security (RLS) in Supabase protects user data

## Resources

- [Reown AppKit Documentation](https://docs.reown.com/appkit)
- [Supabase Authentication Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) 