import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';
import { gameService } from '@/services/gameService';

interface SessionData {
  isLoggedIn: boolean;
  lastActivity: number;
  userAgent: string;
  walletAddress: string;
}

export async function setUserSession(walletAddress: string): Promise<boolean> {
  try {
    const sessionData: SessionData = {
      isLoggedIn: true,
      lastActivity: Date.now(),
      userAgent: navigator.userAgent,
      walletAddress
    };

    await redis.set(
      `${REDIS_CONFIG.PREFIX.SESSION}${walletAddress}`,
      JSON.stringify(sessionData),
      { ex: REDIS_CONFIG.TTL.SESSION }
    );

    return true;
  } catch (error) {
    console.error('Error setting user session:', error);
    return false;
  }
}

export async function getUserSession(walletAddress: string): Promise<SessionData | null> {
  try {
    const sessionData = await redis.get(`${REDIS_CONFIG.PREFIX.SESSION}${walletAddress}`);
    if (!sessionData) return null;

    const session = JSON.parse(sessionData as string) as SessionData;

    // Update last activity
    await redis.set(
      `${REDIS_CONFIG.PREFIX.SESSION}${walletAddress}`,
      JSON.stringify({ ...session, lastActivity: Date.now() }),
      { ex: REDIS_CONFIG.TTL.SESSION }
    );

    return session;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
}

export async function removeUserSession(walletAddress: string): Promise<boolean> {
  try {
    await redis.del(`${REDIS_CONFIG.PREFIX.SESSION}${walletAddress}`);
    return true;
  } catch (error) {
    console.error('Error removing user session:', error);
    return false;
  }
}

export async function updateUserSession(
  walletAddress: string,
  updates: Partial<SessionData>
): Promise<boolean> {
  try {
    const currentSession = await getUserSession(walletAddress);
    if (!currentSession) return false;

    const updatedSession = {
      ...currentSession,
      ...updates,
      lastActivity: Date.now()
    };

    await redis.set(
      `${REDIS_CONFIG.PREFIX.SESSION}${walletAddress}`,
      JSON.stringify(updatedSession),
      { ex: REDIS_CONFIG.TTL.SESSION }
    );

    return true;
  } catch (error) {
    console.error('Error updating user session:', error);
    return false;
  }
}

export async function invalidateSession(walletAddress: string): Promise<boolean> {
  try {
    await redis.del(`user:session:${walletAddress}`);
    return true;
  } catch (error) {
    console.error('Error invalidating session:', error);
    return false;
  }
}

export async function isSessionValid(walletAddress: string): Promise<boolean> {
  try {
    const session = await getUserSession(walletAddress);
    if (!session) return false;

    // Check if session is expired (optional: add additional validation)
    const sessionAge = Date.now() - session.lastActivity;
    return sessionAge < 86400000; // 24 hours in milliseconds
  } catch (error) {
    console.error('Error checking session validity:', error);
    return false;
  }
}

export async function refreshSession(walletAddress: string): Promise<boolean> {
  try {
    const session = await getUserSession(walletAddress);
    if (!session) return false;

    // Update session with new timestamp
    return setUserSession(walletAddress);
  } catch (error) {
    console.error('Error refreshing session:', error);
    return false;
  }
} 