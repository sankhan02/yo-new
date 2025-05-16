/**
 * Custom Error Classes
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * Error Handler Service
 * 
 * Centralized error handling and logging service
 */
class ErrorHandler {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  /**
   * Log an error with context
   * 
   * @param error Error to log
   * @param context Additional context for the error
   */
  logError(error: Error, context?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.error('[Game Error]:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      if (context) {
        console.error('Context:', context);
      }
    } else {
      // In production, we could send to a centralized error logging service
      // such as Sentry, LogRocket, etc.
      // e.g., Sentry.captureException(error, { extra: context });
      
      // For now, just log to console but with less detail for security
      console.error('[Game Error]:', error.message);
    }
  }
  
  /**
   * Handle an error with proper logging and user notification
   * 
   * @param error Error to handle
   * @param context Description of where the error occurred
   * @returns User-friendly error message
   */
  handleError(error: Error, context: string): string {
    this.logError(error, { context });
    return this.getUserMessage(error);
  }
  
  /**
   * Retry an operation with exponential backoff
   * 
   * @param operation Function to retry
   * @param context Description of the operation
   * @param validator Optional function to validate success
   * @param maxRetries Maximum number of retry attempts
   * @param initialDelayMs Initial delay between retries in milliseconds
   * @returns Result of the operation
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    context: string,
    validator?: (result: T) => boolean,
    maxRetries = 3,
    initialDelayMs = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const result = await operation();
        
        // If a validator is provided, check if the result is valid
        if (validator && !validator(result)) {
          throw new Error(`Operation result validation failed for ${context}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error 
          ? error 
          : new Error(String(error));
        
        retryCount++;
        
        if (retryCount <= maxRetries) {
          // Calculate exponential backoff delay
          const delayMs = initialDelayMs * Math.pow(2, retryCount - 1);
          console.warn(`Retrying ${context} (${retryCount}/${maxRetries}) after ${delayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError || new Error(`Max retries exceeded for ${context}`);
  }
  
  /**
   * Handle an API error with consistent response formatting
   * 
   * @param error Error to handle
   * @param defaultMessage Default user-friendly message
   * @returns Formatted error response
   */
  formatApiError(error: Error, defaultMessage: string = 'An unexpected error occurred'): Record<string, any> {
    this.logError(error);
    
    return {
      success: false,
      error: this.isDevelopment ? error.message : defaultMessage,
      code: this.getErrorCode(error)
    };
  }
  
  /**
   * Get a numeric error code based on error type
   * 
   * @param error Error to process
   * @returns Numeric error code
   */
  private getErrorCode(error: Error): number {
    // Custom error codes based on error types
    if (error.message.includes('rate limit')) {
      return 429; // Too Many Requests
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('not authorized')) {
      return 401; // Unauthorized
    }
    
    if (error.message.includes('not found')) {
      return 404; // Not Found
    }
    
    if (error.message.includes('validation')) {
      return 400; // Bad Request
    }
    
    if (error.message.includes('timeout')) {
      return 408; // Request Timeout
    }
    
    // Default error code
    return 500; // Internal Server Error
  }
  
  /**
   * Create a user-friendly error message
   * 
   * @param error Original error
   * @param defaultMessage Default message to show users
   * @returns User-friendly error message
   */
  getUserMessage(error: Error, defaultMessage: string = 'Something went wrong. Please try again.'): string {
    if (this.isDevelopment) {
      return error.message;
    }
    
    // Only show specific error messages for certain error types
    if (error.message.includes('rate limit')) {
      return 'You\'re doing that too often. Please slow down and try again in a moment.';
    }
    
    if (error.message.includes('cooldown')) {
      return 'This action is on cooldown. Please wait before trying again.';
    }
    
    // Default to generic message for other errors
    return defaultMessage;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler(); 