import { describe, it, expect } from 'bun:test';
import { INVITE_EMAIL_SUBJECT, inviteEmailPayload } from '../../email';

const invite = {
  id: 7,
  token: '4a4ef4f0-0b3e-4c1a-9c2a-6d3f1c9b2e11',
  role: 'member' as const,
  roleName: null,
  invitedByName: 'Ann',
  invitedByEmail: 'ann@example.com',
};

describe('inviteEmailPayload', () => {
  it('uses a fixed subject that carries no project name', () => {
    const payload = inviteEmailPayload({ id: 1, name: 'URGENT: reset your password' }, invite);
    expect(payload.subject).toBe(INVITE_EMAIL_SUBJECT);
    expect(payload.subject).not.toContain('URGENT');
  });

  it('names the project in the body, quoted and attributed to the sender', () => {
    const payload = inviteEmailPayload({ id: 1, name: 'Marketing' }, invite);
    expect(payload.text).toContain('Ann invited you to join the project "Marketing" as member.');
  });

  it('collapses line breaks in the project name', () => {
    const payload = inviteEmailPayload({ id: 1, name: 'Line\r\nbreak' }, invite);
    expect(payload.text).toContain('"Line break"');
  });
});
