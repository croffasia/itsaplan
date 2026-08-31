import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { githubWebhookCommand } from './githubCommand';

describe('githubWebhookCommand', () => {
  it('subscribes to pull requests, checks, and branch lifecycle events', () => {
    const command = githubWebhookCommand('https://plan.example/webhooks/git/abc', 'secret');
    assert.ok(command.includes("'events[]=pull_request'"));
    assert.ok(command.includes("'events[]=check_run'"));
    assert.ok(command.includes("'events[]=create'"));
    assert.ok(command.includes("'events[]=delete'"));
    assert.ok(command.includes("'config[content_type]=json'"));
  });

  it('quotes values containing apostrophes', () => {
    const command = githubWebhookCommand("https://plan.example/o'clock", "it's-secret");
    assert.ok(command.includes(`o'"'"'clock`));
    assert.ok(command.includes(`it'"'"'s-secret`));
  });
});
