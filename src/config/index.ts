// This file serves as an export point for project configuration settings
// It should not export AppKit functionality, which is now in appkit.ts

// Export environment variables 
export const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694" // this is a public projectId only to use on localhost
if (!projectId) {
  throw new Error('VITE_PROJECT_ID is not set')
}

// Export the SIWX configuration
export { siwxConfig } from './siwx';

// Note: For all AppKit-related functionality, import directly from './appkit'
// Example: import { appKit } from './appkit';