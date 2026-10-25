import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { issuePagePath, issuePanelPath, issueReturnPath } from './paths';

describe('issuePagePath', () => {
  it('carries the page the issue was opened from', () => {
    assert.equal(
      issuePagePath('acme.ENG', 42, '/acme/ENG/view/7?foo=bar'),
      '/acme/issue/ENG-42?from=%2Facme%2FENG%2Fview%2F7%3Ffoo%3Dbar',
    );
  });

  it('leaves the path plain without a from page', () => {
    assert.equal(issuePagePath('acme.ENG', 42), '/acme/issue/ENG-42');
  });
});

describe('issueReturnPath', () => {
  it('returns to the same project and drops the panel parameter', () => {
    assert.equal(
      issueReturnPath('acme.ENG', '/acme/ENG/view/7?foo=bar&issue=42'),
      '/acme/ENG/view/7?foo=bar',
    );
    assert.equal(issueReturnPath('acme.ENG', '/acme/ENG'), '/acme/ENG');
  });

  it('refuses another project', () => {
    assert.equal(issueReturnPath('acme.ENG', '/acme/OTHER/view/7'), null);
    assert.equal(issueReturnPath('acme.ENG', '/acme/ENG/../OTHER'), null);
  });

  it('refuses another origin or a missing path', () => {
    assert.equal(issueReturnPath('acme.ENG', 'https://evil.example/acme/ENG'), null);
    assert.equal(issueReturnPath('acme.ENG', '//evil.example/acme/ENG'), null);
    assert.equal(issueReturnPath('acme.ENG', null), null);
  });
});

describe('issuePanelPath', () => {
  it('adds the issue the panel shows to the return path', () => {
    assert.equal(
      issuePanelPath('acme.ENG', '/acme/ENG/view/7?foo=bar', 42),
      '/acme/ENG/view/7?foo=bar&issue=42',
    );
  });

  it('returns null when the from page is not usable', () => {
    assert.equal(issuePanelPath('acme.ENG', null, 42), null);
    assert.equal(issuePanelPath('acme.ENG', '/acme/OTHER', 42), null);
  });
});
