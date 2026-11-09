export interface EmailText {
  subject: string;
  body: string;
  button: string;
}

export type CoreEmailKey =
  | 'reset'
  | 'verify'
  | 'magic'
  | 'inviteProject'
  | 'inviteTeam'
  | 'assigned'
  | 'mentioned'
  | 'commented'
  | 'stateChanged'
  | 'documentMentioned'
  | 'documentCommentMentioned'
  | 'test';

// Words a message fills in by itself: a role name, or a value that has no name of its own.
export interface EmailWords {
  someone: string;
  untitled: string;
  owner: string;
  manager: string;
  member: string;
}

export interface EmailLocaleTexts {
  // Stands before the address under the button.
  linkHint: string;
  words: EmailWords;
  templates: Record<CoreEmailKey, EmailText>;
}
