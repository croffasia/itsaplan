import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gitlabWebhookCommand } from './gitlabCommand';

describe('gitlabWebhookCommand', () => {
  it('creates a webhook for the current GitLab project', () => {
    const command = gitlabWebhookCommand('https://plan.example/webhooks/git/abc', 'secret');
    assert.ok(command.includes('glab api projects/:id/hooks'));
    assert.ok(command.includes("--raw-field url='https://plan.example/webhooks/git/abc'"));
    assert.ok(command.includes("--raw-field token='secret'"));
    assert.ok(command.includes('--field merge_requests_events=true'));
    assert.ok(command.includes('--field pipeline_events=true'));
    assert.ok(command.includes('--field push_events=true'));
    assert.ok(command.includes('--field enable_ssl_verification=true'));
  });

  it('quotes values that contain an apostrophe', () => {
    assert.ok(
      gitlabWebhookCommand('https://example.test/a', "it's-secret").includes(
        `--raw-field token='it'"'"'s-secret'`,
      ),
    );
  });
});
