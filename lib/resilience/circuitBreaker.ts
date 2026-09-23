/**
 * Institutional Circuit Breaker (Netflix Hystrix / Resilience4j pattern)
 * Protects downstream AWS services (Bedrock AI, SNS, WhatsApp Gateway) from cascading failures.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  failureThreshold?: number // Number of failures before tripping OPEN
  cooldownPeriodMs?: number // Cooldown duration before transitioning to HALF_OPEN
  successThreshold?: number // Consecutive successes in HALF_OPEN to transition to CLOSED
  serviceName?: string
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private readonly failureThreshold: number
  private readonly cooldownPeriodMs: number
  private readonly successThreshold: number
  public readonly serviceName: string

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.cooldownPeriodMs = options.cooldownPeriodMs ?? 30000 // 30s
    this.successThreshold = options.successThreshold ?? 2
    this.serviceName = options.serviceName ?? 'default-service'
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now()
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN'
        this.successCount = 0
      }
    }
    return this.state
  }

  public async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState()

    if (currentState === 'OPEN') {
      if (fallback) {
        return fallback()
      }
      throw new Error(
        `[CircuitBreaker:${this.serviceName}] Circuit is OPEN. Calls to downstream service are currently blocked to prevent cascading failure.`
      )
    }

    try {
      const result = await action()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      if (fallback) {
        return fallback()
      }
      throw error
    }
  }

  private recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED'
        this.failureCount = 0
        this.successCount = 0
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0
    }
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
    }
  }

  public reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
  }
}

// Pre-configured circuit breaker singletons for critical cloud integrations
export const bedrockCircuitBreaker = new CircuitBreaker({
  serviceName: 'AWS-Bedrock-Runtime',
  failureThreshold: 4,
  cooldownPeriodMs: 45000,
})

export const whatsappCircuitBreaker = new CircuitBreaker({
  serviceName: 'Meta-WhatsApp-Cloud-API',
  failureThreshold: 5,
  cooldownPeriodMs: 30000,
})
