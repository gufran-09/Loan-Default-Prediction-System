/**
 * Sliding Window In-Memory Rate Limiter
 * Guards credit decisioning and AI endpoints against denial-of-service and burst spikes.
 */

interface RateLimitRecord {
  timestamps: number[]
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Periodic sweep every 5 minutes to prevent memory leak
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => {
        const cutoff = Date.now() - this.windowMs
        for (const [key, record] of this.records.entries()) {
          record.timestamps = record.timestamps.filter((t) => t > cutoff)
          if (record.timestamps.length === 0) {
            this.records.delete(key)
          }
        }
      }, 300000)

      if (typeof timer.unref === 'function') {
        timer.unref()
      }
    }
  }

  public check(identifier: string): {
    allowed: boolean
    remaining: number
    resetTimeMs: number
  } {
    const now = Date.now()
    const cutoff = now - this.windowMs

    let record = this.records.get(identifier)
    if (!record) {
      record = { timestamps: [] }
      this.records.set(identifier, record)
    }

    // Retain only requests within current sliding window
    record.timestamps = record.timestamps.filter((t) => t > cutoff)

    if (record.timestamps.length >= this.maxRequests) {
      const oldestInWindow = record.timestamps[0]
      const resetTimeMs = oldestInWindow + this.windowMs - now
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs: Math.max(0, resetTimeMs),
      }
    }

    record.timestamps.push(now)
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      resetTimeMs: this.windowMs,
    }
  }
}

// 60 requests per minute for standard credit scoring APIs
export const scoringRateLimiter = new SlidingWindowRateLimiter(60, 60000)

// 20 requests per minute for generative AI (Claude 3.5 on Bedrock)
export const aiRateLimiter = new SlidingWindowRateLimiter(20, 60000)
