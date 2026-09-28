/**
 * Request Queue with Throttling
 * 
 * Prevents overwhelming the backend with concurrent requests by:
 * - Limiting max concurrent requests
 * - Adding delay between requests
 * - Queueing excess requests
 */

class RequestQueue {
  constructor(maxConcurrent = 4, delayMs = 150) {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
    this.lastRequestTime = 0;
  }

  async add(requestFn) {
    // Wait if we're at max concurrent requests
    if (this.active >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }

    // Enforce minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.delayMs) {
      await new Promise(resolve => 
        setTimeout(resolve, this.delayMs - timeSinceLastRequest)
      );
    }

    this.active++;
    this.lastRequestTime = Date.now();

    try {
      const result = await requestFn();
      return result;
    } finally {
      this.active--;
      
      // Process next request in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  /**
   * Get current queue stats
   */
  getStats() {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Create global request queue instance
export const requestQueue = new RequestQueue(4, 150);

// Export stats for debugging
if (typeof window !== 'undefined') {
  window.__requestQueueStats = () => requestQueue.getStats();
}

export default requestQueue;
