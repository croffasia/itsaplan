# Seed data for documentation captures

```bash
bun docs/modules/_shared/seed/seed.ts
```

The script talks to the running API over HTTP (`API_URL`, default `http://localhost:3000`; `APP_URL`
is sent as the `Origin` header, default `http://localhost:3001`). It can be run again: every entity
that already exists is left as it is.

It creates:

| Entity | Value |
| --- | --- |
| Owner account | `seed-owner@example.test`, owner of the team and the project |
| Member account | `seed-member@example.test`, project member on the default member role |
| Team | `Seed Team` (slug `seed-team`) in the owner's workspace |
| Project | key `SEED`, 12 issues spread across the project's columns |
| Notifications | 4 `assigned` notifications for the member, from every third issue assigned to them |
| Dashboard | `Seed overview`, with no charts |

Both accounts use the password constant in `seed.ts`. The first account registered on an instance
is the instance admin; the seed accounts are not, so `god` pages are not covered by this data.

The dashboard has no charts. Chart specs are defined by the dashboards module and the seed is
extended in step 2 of the documentation work.

A refused sign-up (sign-up disabled, or email verification required) stops the script with a
message that names the account.
