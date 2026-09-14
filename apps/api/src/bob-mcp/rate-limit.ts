interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class ServiceRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: { capacity: number; refillPerMinute: number }) {}

  take(identity: string, now = Date.now()): boolean {
    const current = this.buckets.get(identity) ?? {
      tokens: this.options.capacity,
      updatedAt: now,
    };
    const elapsed = Math.max(0, now - current.updatedAt);
    const tokens = Math.min(
      this.options.capacity,
      current.tokens + (elapsed / 60_000) * this.options.refillPerMinute,
    );
    if (tokens < 1) {
      this.buckets.set(identity, { tokens, updatedAt: now });
      return false;
    }
    this.buckets.set(identity, { tokens: tokens - 1, updatedAt: now });
    return true;
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const bobMcpRateLimiter = new ServiceRateLimiter({ capacity: 20, refillPerMinute: 60 });

export function resetBobMcpRateLimiter(): void {
  bobMcpRateLimiter.clear();
}
