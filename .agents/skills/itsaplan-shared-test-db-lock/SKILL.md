---
name: itsaplan-shared-test-db-lock
description: Use when parallel agents share the api test database.
category: testing
---

# Shared test database lock

apps/api, apps/bot and apps/worker share one test database, and the api suite truncates every table before each test. When more than one agent runs these suites, serialize them with an atomic `mkdir` lock in a path shared by all panes:

```bash
until mkdir /tmp/<task>-briefs/test.lock 2>/dev/null; do sleep 10; done
cd apps/api && bun test --env-file=../../.env.test <path>; status=$?
rmdir /tmp/<task>-briefs/test.lock
exit $status
```

Release the lock even when tests fail: capture the exit status and run `rmdir` before exiting, never chain `rmdir` with `&&`.
