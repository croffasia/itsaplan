// The magic-word grammar for linking pull requests to issues, copying Linear's:
// a magic word followed by one or more issue identifiers ("Fixes MKT-42",
// "Closes MKT-1, MKT-2 and MKT-3"). Closing words move the issue to the closed
// state when the PR merges; non-closing words only link. "skip"/"ignore" before
// an identifier suppresses both for that identifier anywhere in the text.

const CLOSING_WORDS = [
  'close',
  'closes',
  'closed',
  'closing',
  'fix',
  'fixes',
  'fixed',
  'fixing',
  'resolve',
  'resolves',
  'resolved',
  'resolving',
  'complete',
  'completes',
  'completed',
  'completing',
  'implement',
  'implements',
  'implemented',
  'implementing',
];

const NON_CLOSING_WORDS = [
  'ref',
  'refs',
  'references',
  'part of',
  'related to',
  'relates to',
  'contributes to',
  'toward',
  'towards',
];

const SKIP_WORDS = ['skip', 'ignore'];

export interface IssueRef {
  key: string;
  sequenceNumber: number;
}

export interface ParsedMagicWords {
  // Identifiers named by a closing word — closed when the PR merges.
  closes: IssueRef[];
  // Identifiers named by a non-closing word — linked but never closed.
  references: IssueRef[];
  // Identifiers explicitly excluded with skip/ignore. The webhook handler uses
  // these to remove a link that an earlier delivery already created.
  skipped: IssueRef[];
}

const IDENTIFIER = String.raw`[A-Za-z][A-Za-z0-9]*-\d+`;
// One or more identifiers after a magic word, separated by commas and/or "and".
const IDENTIFIER_LIST = String.raw`${IDENTIFIER}(?:\s*(?:,|and|,\s*and)\s+${IDENTIFIER})*`;

// Longest phrase first, so "relates to" wins over a hypothetical "relates".
const ALL_WORDS = [...SKIP_WORDS, ...CLOSING_WORDS, ...NON_CLOSING_WORDS].sort(
  (a, b) => b.length - a.length,
);
const MAGIC_RE = new RegExp(
  String.raw`(?<=^|[^A-Za-z0-9])(${ALL_WORDS.join('|').replace(/ /g, String.raw`\s+`)})\s*:?\s+(${IDENTIFIER_LIST})(?![A-Za-z0-9-])`,
  'gi',
);
const IDENTIFIER_RE = new RegExp(IDENTIFIER, 'g');

function toRef(identifier: string): IssueRef {
  const dash = identifier.lastIndexOf('-');
  return {
    key: identifier.slice(0, dash).toUpperCase(),
    sequenceNumber: Number(identifier.slice(dash + 1)),
  };
}

const refId = (ref: IssueRef) => `${ref.key}-${ref.sequenceNumber}`;

// Branch names do not need a magic word: `feature/MKT-42-summary` is enough to
// establish a development link. Requiring the key at the start or immediately
// after a slash avoids treating arbitrary dashed words later in the title as keys.
const BARE_IDENTIFIER_RE = new RegExp(String.raw`(?<=^|/)(${IDENTIFIER})(?=$|[-_/])`, 'gi');

export function parseIssueIdentifiers(text: string): IssueRef[] {
  const refs = new Map<string, IssueRef>();
  for (const match of text.matchAll(BARE_IDENTIFIER_RE)) {
    const ref = toRef(match[1]);
    refs.set(refId(ref), ref);
  }
  return [...refs.values()];
}

// Parses PR title + description text. An identifier under a skip word never
// appears in the result; one named by both a closing and a non-closing word
// counts as closing.
export function parseMagicWords(text: string): ParsedMagicWords {
  const closes = new Map<string, IssueRef>();
  const references = new Map<string, IssueRef>();
  const skipped = new Set<string>();

  for (const match of text.matchAll(MAGIC_RE)) {
    const word = match[1].toLowerCase().replace(/\s+/g, ' ');
    const refs = (match[2].match(IDENTIFIER_RE) ?? []).map(toRef);
    for (const ref of refs) {
      if (SKIP_WORDS.includes(word)) skipped.add(refId(ref));
      else if (CLOSING_WORDS.includes(word)) closes.set(refId(ref), ref);
      else references.set(refId(ref), ref);
    }
  }

  for (const id of skipped) {
    closes.delete(id);
    references.delete(id);
  }
  for (const id of closes.keys()) references.delete(id);
  return {
    closes: [...closes.values()],
    references: [...references.values()],
    skipped: [...skipped].map(toRef),
  };
}
