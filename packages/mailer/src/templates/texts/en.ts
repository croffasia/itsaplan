import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Open the invitation to sign in or create an account. If you did not expect this invitation, you can ignore this email.';

export const en: EmailLocaleTexts = {
  linkHint: 'Or open this link:',
  words: {
    someone: 'Someone',
    untitled: 'Untitled',
    owner: 'owner',
    manager: 'manager',
    member: 'member',
  },
  templates: {
    reset: {
      subject: 'Reset your password',
      body: 'Use the link below to set a new password. Ignore this email if you did not ask for it.',
      button: 'Set a new password',
    },
    verify: {
      subject: 'Confirm your email address',
      body: 'Use the link below to confirm this address and finish signing up.',
      button: 'Confirm the address',
    },
    magic: {
      subject: 'Your sign-in link',
      body: 'Use the link below to sign in. It works once and expires shortly.',
      button: 'Sign in',
    },
    inviteProject: {
      subject: "You were invited to {project} on It's a Plan",
      body: `{inviter} invited you to join {project} as {role}.\n\n${INVITE_NEXT}`,
      button: 'Open the invitation',
    },
    inviteTeam: {
      subject: "You were invited to {team} on It's a Plan",
      body: `{inviter} invited you to join the team {team} as {role}.\n\n${INVITE_NEXT}`,
      button: 'Open the invitation',
    },
    assigned: {
      subject: '{ref}: assigned to you',
      body: '{actor} assigned this issue to you.\n\n{ref}: {title}',
      button: 'Open the issue',
    },
    mentioned: {
      subject: '{ref}: you were mentioned',
      body: '{actor} mentioned you on this issue.\n\n{ref}: {title}',
      button: 'Open the issue',
    },
    commented: {
      subject: '{ref}: new comment',
      body: '{actor} commented on this issue.\n\n{ref}: {title}',
      button: 'Open the comment',
    },
    stateChanged: {
      subject: '{ref}: status changed to {to}',
      body: '{actor} changed the status of this issue from {from} to {to}.\n\n{ref}: {title}',
      button: 'Open the issue',
    },
    documentMentioned: {
      subject: '{document}: you were mentioned',
      body: '{actor} mentioned you in this document.\n\n{document}',
      button: 'Open the document',
    },
    documentCommentMentioned: {
      subject: '{document}: you were mentioned',
      body: '{actor} mentioned you in a comment on this document.\n\n{document}',
      button: 'Open the document',
    },
    test: {
      subject: "It's a Plan email test",
      body: "This test confirms that It's a Plan can send email through the configured provider.",
      button: '',
    },
  },
};
