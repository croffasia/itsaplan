import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Column } from '@/lib/api/endpoints/columns';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import { IssueLinksProvider, useIsBlocked, useIssueLinks } from './useIssueLinks';

const started = { id: 1, stateType: 'started' } as Column;
const blocker = { id: 2, columnId: started.id, links: [] } as unknown as BoardIssue;
const card = {
  id: 1,
  columnId: started.id,
  links: [{ id: 9, relation: 'blocked_by', issueId: blocker.id }],
} as unknown as BoardIssue;

function Probe() {
  const links = useIssueLinks(card.links);
  return `${useIsBlocked(card) ? 'blocked' : 'free'} ${links.length}`;
}

describe('IssueLinksProvider', () => {
  it('keeps the blocked tint with the Links display property off, and hides the relations', () => {
    const html = renderToStaticMarkup(
      <IssueLinksProvider issues={[card, blocker]} columns={[started]} enabled={false}>
        <Probe />
      </IssueLinksProvider>,
    );
    assert.equal(html, 'blocked 0');
  });
});
