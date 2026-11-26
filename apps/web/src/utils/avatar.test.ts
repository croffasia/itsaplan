import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initials } from './avatar';

describe('initials', () => {
  it('takes two words, one word or an email', () => {
    assert.equal(initials('Jane Doe'), 'JD');
    assert.equal(initials('octocat'), 'OC');
    assert.equal(initials('jane@x.io'), 'JA');
  });

  it('leaves out a note in parentheses', () => {
    assert.equal(initials('Ana (ana@x.io)'), 'AN');
    assert.equal(initials('Jane Doe (GitHub)'), 'JD');
  });
});
