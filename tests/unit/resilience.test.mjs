import test from 'node:test'
import assert from 'node:assert/strict'
import { CircuitBreaker } from '../../lib/resilience/circuitBreaker.ts'
import { SlidingWindowRateLimiter } from '../../lib/resilience/rateLimit.ts'

test('CircuitBreaker - transitions from CLOSED to OPEN after failure threshold', async () => {
  const cb = new CircuitBreaker({
    serviceName: 'test-service',
    failureThreshold: 3,
    cooldownPeriodMs: 100,
    successThreshold: 2,
  })

  assert.equal(cb.getState(), 'CLOSED')

  const failingCall = () => Promise.reject(new Error('Downstream network timeout'))

  // 1st failure
  await assert.rejects(cb.execute(failingCall))
  assert.equal(cb.getState(), 'CLOSED')

  // 2nd failure
  await assert.rejects(cb.execute(failingCall))
  assert.equal(cb.getState(), 'CLOSED')

  // 3rd failure -> trips breaker OPEN
  await assert.rejects(cb.execute(failingCall))
  assert.equal(cb.getState(), 'OPEN')

  // Immediate subsequent call should be blocked by circuit breaker
  let fallbackExecuted = false
  const result = await cb.execute(
    () => Promise.resolve('primary'),
    () => {
      fallbackExecuted = true
      return 'fallback-cached'
    }
  )

  assert.equal(fallbackExecuted, true)
  assert.equal(result, 'fallback-cached')
})

test('SlidingWindowRateLimiter - enforces max requests within window', () => {
  const limiter = new SlidingWindowRateLimiter(3, 1000)
  const clientKey = 'client-192.168.1.1'

  const res1 = limiter.check(clientKey)
  assert.equal(res1.allowed, true)
  assert.equal(res1.remaining, 2)

  const res2 = limiter.check(clientKey)
  assert.equal(res2.allowed, true)
  assert.equal(res2.remaining, 1)

  const res3 = limiter.check(clientKey)
  assert.equal(res3.allowed, true)
  assert.equal(res3.remaining, 0)

  // 4th request should be rejected
  const res4 = limiter.check(clientKey)
  assert.equal(res4.allowed, false)
  assert.equal(res4.remaining, 0)
  assert.ok(res4.resetTimeMs > 0)
})
