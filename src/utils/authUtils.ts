// Utility to extract user from request (mock for now)
// TODO: Replace with real authentication logic (e.g., JWT/session)
export async function getUserFromRequest(req: any) {
  // Example: extract from req.headers.authorization or session
  // For now, return a mock admin user
  return {
    id: 'admin-uuid',
    roles: ['admin']
  };
} 