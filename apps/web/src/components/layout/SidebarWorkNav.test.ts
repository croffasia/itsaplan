import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./SidebarWorkNav.tsx', import.meta.url), 'utf8');

describe('SidebarWorkNav', () => {
  it('places Leads directly after Accounting in the work navigation', () => {
    const accounting = source.indexOf('label="Accounting"');
    const leads = source.indexOf('label="Leads"');

    expect(accounting).toBeGreaterThan(-1);
    expect(leads).toBeGreaterThan(accounting);
    expect(source.slice(accounting + 'label="Accounting"'.length, leads)).not.toContain('label="');
  });

  it('uses the shared sidebar item for Leads', () => {
    expect(source).toContain('<SidebarNavItem');
    expect(source).toContain('label="Leads"');
  });
});
