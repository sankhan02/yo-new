/**
 * Request Queue utility for handling concurrent user actions
 * 
 * This utility ensures that actions from the same user are processed
 * in the correct order without race conditions
 */

interface QueuedRequest {
  id: string;
  action: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class RequestQueue {
  private queues: Map<string, QueuedRequest[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private timeoutMs: number = 30000; // Default 30 second timeout
  
  /**
   * Enqueue a new request for a specific user
   * 
   * @param userId Unique identifier for the user (e.g., wallet address)
   * @param action The async function to execute
   * @returns Promise that resolves with the result of the action
   */
  async enqueue<T>(userId: string, action: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Create a unique request ID
      const requestId = `${userId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      
      // Create queue for this user if it doesn't exist
      if (!this.queues.has(userId)) {
        this.queues.set(userId, []);
      }
      
      // Add request to queue
      const queue = this.queues.get(userId)!;
      const request: QueuedRequest = {
        id: requestId,
        action,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      queue.push(request);
      
      // Start processing if not already processing
      if (!this.processing.get(userId)) {
        this.processQueue(userId);
      }
    });
  }
  
  /**
   * Process the request queue for a specific user
   * 
   * @param userId Unique identifier for the user
   */
  private async processQueue(userId: string): Promise<void> {
    // Mark as processing
    this.processing.set(userId, true);
    
    // Get the queue
    const queue = this.queues.get(userId);
    if (!queue || queue.length === 0) {
      // No requests to process
      this.processing.set(userId, false);
      return;
    }
    
    // Get the next request
    const request = queue.shift()!;
    
    // Check if request has timed out
    if (Date.now() - request.timestamp > this.timeoutMs) {
      request.reject(new Error('Request timed out in queue'));
      // Continue with next request
      return this.processQueue(userId);
    }
    
    try {
      // Execute the action
      const result = await request.action();
      // Resolve the promise
      request.resolve(result);
    } catch (error) {
      // Reject the promise
      request.reject(error);
    } finally {
      // Process next item in queue (if any)
      if (queue.length > 0) {
        // Continue processing with slight delay to avoid blocking
        setTimeout(() => this.processQueue(userId), 10);
      } else {
        // Mark as not processing
        this.processing.set(userId, false);
      }
    }
  }
  
  /**
   * Clear all pending requests for a specific user
   * 
   * @param userId Unique identifier for the user
   * @param reason Optional reason for clearing the queue
   */
  clearQueue(userId: string, reason: string = 'Queue cleared'): void {
    const queue = this.queues.get(userId);
    if (!queue) return;
    
    // Reject all pending requests
    queue.forEach(request => {
      request.reject(new Error(reason));
    });
    
    // Clear the queue
    this.queues.set(userId, []);
  }
  
  /**
   * Set the timeout for requests in the queue
   * 
   * @param timeoutMs Timeout in milliseconds
   */
  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
  }
  
  /**
   * Get number of pending requests for a user
   * 
   * @param userId Unique identifier for the user
   * @returns Number of pending requests
   */
  getPendingCount(userId: string): number {
    const queue = this.queues.get(userId);
    return queue ? queue.length : 0;
  }
  
  /**
   * Check if there are pending requests for a user
   * 
   * @param userId Unique identifier for the user
   * @returns True if there are pending requests
   */
  hasPendingRequests(userId: string): boolean {
    return this.getPendingCount(userId) > 0;
  }
}

// Export singleton instance
export const requestQueue = new RequestQueue(); 