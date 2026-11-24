# Commits and releases

Subject: Conventional Commit, `type(scope): summary`. PRs are squash-merged, so the PR title
becomes the commit subject on `main` (`pr-title.yml` checks it). release-please reads the
subjects to pick the next version and write `CHANGELOG.md`.

Pick the type by what the change gives the user, not by how much code it touches:

- **`feat:` — minor.** A capability that did not exist: a new entity, page, integration, or a
  setting that unlocks behaviour. Use it only for a change that earns a "Highlights" entry.
- **`improvement:` — patch.** A visible change to something that exists: a redesign, a
  reworked layout, a theme, a better interaction. Not a bug fix, not a new capability.
- **`fix:` — patch.** Behaviour that was wrong is now right.
- **Every other type (`perf`, `refactor`, `docs`, `build`, `ci`, `test`, `chore`, `revert`) —
  patch.**

Scope: the name of one app or package (`api`, `web`, `worker`, `bot`, `db`, `auth`, …). No
scope when the change spans several.

Release config traps:

- Add a new commit type to both `pr-title.yml` and `changelog-sections` in
  `release-please-config.json`. release-please drops a type that is not in
  `changelog-sections` from the release notes.
- Keep `"package-name": ""` in `release-please-config.json`. Without it, release-please skips
  every release and stops at `There are untagged, merged release PRs outstanding - aborting`.

