import { connection } from 'next/server';
import { serverRuntimeEnv } from '@/utils/runtimeEnv';

// Publishes the per-instance origins to the browser. It renders before any bundle
// script, so a client module reading runtimeEnv() at import time already sees them.
// `connection()` keeps the values out of a prerender: a page rendered at build time
// would carry the building machine's environment into the HTML.
// `<` is escaped because the JSON is written into an inline script, where a
// `</script>` inside a value would end the element.
export default async function RuntimeEnvScript() {
  await connection();
  const json = JSON.stringify(serverRuntimeEnv()).replace(/</g, '\\u003c');
  return <script dangerouslySetInnerHTML={{ __html: `window.__ITSAPLAN_ENV__=${json}` }} />;
}
