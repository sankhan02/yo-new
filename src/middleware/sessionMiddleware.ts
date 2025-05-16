import type { NextFunction, Request, Response } from 'express';
import { REDIS_CONFIG } from '@/config/redis';
import { getUserSession, removeUserSession } from '@/utils/sessionUtils';

interface SessionOptions {
  required?: boolean;
  walletHeaderName?: string;
  errorMessage?: string;
}

const defaultOptions: Required<SessionOptions> = {
  required: true,
  walletHeaderName: 'x-wallet-address',
  errorMessage: 'Authentication required.',
};

/**
 * Create a session middleware
 */
export function createSessionMiddleware(options: SessionOptions = {}) {
  const {
    required,
    walletHeaderName,
    errorMessage,
  } = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const walletAddress = req.headers[walletHeaderName] as string;

      if (!walletAddress) {
        if (required) {
          return res.status(401).json({ error: errorMessage });
        }
        return next();
      }

      const session = await getUserSession(walletAddress);

      if (!session && required) {
        return res.status(401).json({ error: errorMessage });
      }

      // Attach session to request
      req.session = session;
      req.walletAddress = walletAddress;

      next();
    } catch (error) {
      console.error('Session middleware error:', error);
      if (required) {
        return res.status(500).json({ error: 'Internal server error.' });
      }
      next();
    }
  };
}

/**
 * Middleware for required session
 */
export const requireSession = createSessionMiddleware({
  required: true,
});

/**
 * Middleware for optional session
 */
export const optionalSession = createSessionMiddleware({
  required: false,
});

/**
 * Middleware to clear session
 */
export async function clearSession(req: Request, res: Response, next: NextFunction) {
  try {
    const walletAddress = req.headers[defaultOptions.walletHeaderName] as string;
    
    if (walletAddress) {
      await removeUserSession(walletAddress);
    }

    next();
  } catch (error) {
    console.error('Clear session error:', error);
    next();
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: {
        isLoggedIn: boolean;
        lastActivity: number;
        userAgent: string;
        walletAddress: string;
      } | null;
      walletAddress?: string;
    }
  }
} 