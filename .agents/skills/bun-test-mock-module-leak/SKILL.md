---
name: bun-test-mock-module-leak
description: Use when bun tests pass alone but fail in the full suite.
category: testing
---

# Bun test: mock.module leaks across files

`mock.module(...)` in Bun replaces a module for the whole test process. A mock registered in one test file stays active for later files. A test that passes alone and fails in `bun test` or `bun run test` is usually reading another file's mock.

Before changing component code for such a failure:
1. Run the failing file alone. If it passes, the cause is cross-file state.
2. Find every file that mocks the same module: `grep -rln "mock.module('<module path>'" apps/web/src`.
3. Compare the mock shape with what the component reads, for example `useSession` returning `{ data: { user } }`.

Fix by giving the leaking file a complete mock of the module, or by moving the mock into the file that needs it. Do not add optional chaining to hide the missing data.

Report a failure as pre-existing only after running the full suite on a clean copy of the base commit. A cheaper proof for a shared checkout: `git stash push --include-untracked -- <touched path>`, run the suite, then `git stash pop`, and confirm the same failures appear without the changes.

Timeouts near 1100 ms that pass when the file runs alone are load from a concurrent build, not a code failure. Re-run the file alone before changing code.
