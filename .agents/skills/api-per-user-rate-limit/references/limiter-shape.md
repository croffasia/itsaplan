# Limiter shape

```ts
import { HttpError } from '#shared/lib';

export const CALLS_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;

// Per process: with several api replicas each one counts on its own.
const calls = new Map<string, number[]>();

export function takeCall(userId: string, now = Date.now()): void {
  const recent = (calls.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= CALLS_PER_HOUR) {
    calls.set(userId, recent);
    throw new HttpError(429, `Allows ${CALLS_PER_HOUR} per hour. Try again later.`);
  }
  recent.push(now);
  calls.set(userId, recent);
}
```

Handler use: `takeCall(requireUser(user).id);` as the first statement, then the model call.

Test use: loop `CALLS_PER_HOUR` times over the route, then expect `res.status` to be 429 and the error text to contain `per hour`.
