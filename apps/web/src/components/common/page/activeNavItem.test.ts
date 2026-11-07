import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Info } from 'lucide-react';
import { activeNavItem } from './SectionNav';

const item = (id: string, href: string) => ({ id, label: id, icon: Info, href });
const items = [item('info', '/acme/settings'), item('queue', '/acme/settings/queue')];

it('takes the entry a path is under, the longest of them', () => {
  assert.equal(activeNavItem(items, '/acme/settings')?.id, 'info');
  assert.equal(activeNavItem(items, '/acme/settings/queue')?.id, 'queue');
  assert.equal(activeNavItem(items, '/acme/settings/queue/12')?.id, 'queue');
  assert.equal(activeNavItem(items, '/acme/settings/queued')?.id, 'info');
  assert.equal(activeNavItem(items, '/other'), undefined);
});
