// AppKit configuration for Reown
import { createAppKit } from '@reown/appkit/vue';
import { siwxConfig } from './siwx';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana, solanaDevnet } from '@reown/appkit/networks';

// Environment-specific configuration
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'yomama-game';

// Initialize AppKit with Solana wallet support and SIWX
// This is the single source of truth for AppKit configuration
const appKit = createAppKit({
  // Project ID from Reown dashboard
  projectId,
  
  // Adapters for wallet connections
  adapters: [
    new SolanaAdapter({ wallets: [] }) // Add wallet adapters as needed
  ],
  
  // Supported networks
  networks: [solana, solanaDevnet],
  
  // Use our custom SIWX configuration
  siwx: siwxConfig,
  
  // UI Theme configuration
  themeMode: 'dark',
  features: {
    analytics: false 
  },
  
  // App metadata
  metadata: {
    name: 'YO MAMA',
    description: 'The ultimate clicker game on Solana',
    url: window.location.origin,
    icons: ['/favicon.ico']
  },
  
  // Theme variables for UI customization
  themeVariables: {
    '--w3m-accent': '#000000',
  }
});

// Export initialized AppKit instance
export { appKit }; // Removed default export, use only named export 