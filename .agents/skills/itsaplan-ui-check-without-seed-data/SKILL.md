---
name: itsaplan-ui-check-without-seed-data
description: Use when verifying itsaplan UI that needs absent DB rows.
category: testing
---

# Check UI that needs data the local DB does not hold

When a page needs a row the local database does not have, do not seed the shared dev DB and do not report the page as unverifiable. Render the real component in a temporary route with sample props, check it in both themes, then delete the route.

1. Confirm the row is missing. List tables first with `\dt` before querying, because a guessed table name (`view`) fails. Run the query through `docker exec <postgres container> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "..."'`.
2. Create `apps/web/src/app/share/<tmp>/page.tsx` that imports the real header or component and passes literal sample values.
3. From `apps/web`, start the dev server on a free port with `API_URL=http://localhost:<published api port> bunx next dev -p <port>`. Take the API port from `docker ps`.
4. Open the route in the browser. For dark mode, toggle the class on `document.documentElement` with the JavaScript tool, then take a screenshot. Repeat for light mode.
5. Clean up: delete the temporary directory, stop the dev server, close the browser tab. `git status --short apps/web/src/app/share` must show only the intended changes.
6. In the report, name the page states that were not checked, such as a real share page with issue data.
