import { Ban, CircleSlash, Copy, Link2, type LucideIcon } from 'lucide-react';
import type { BoardIssue, IssueLink, IssueLinkInputKind, IssueLinkKind } from '@/lib/api';

// A relation reads differently from each of its two ends, and both the panel and
// the activity feed name it from the end being looked at. That reading is the
// IssueLinkInputKind — the same vocabulary the API takes when a relation is
// created, so the picker's options are these too. The name of a relation is a
// message under `issueLinks.relations` (see useLinkRelationLabel).

// Icon per relation. The two duplicate readings share one icon; the label next
// to it separates them.
export const LINK_RELATION_ICONS: Record<IssueLinkInputKind, LucideIcon> = {
  blocked_by: CircleSlash,
  blocks: Ban,
  duplicates: Copy,
  duplicated_by: Copy,
  relates: Link2,
};

// Group order in the panel, and the order the picker offers them in.
export const LINK_RELATIONS: IssueLinkInputKind[] = [
  'blocked_by',
  'blocks',
  'duplicates',
  'duplicated_by',
  'relates',
];

// The relations offered when the other issue is created on the spot. A brand new
// issue cannot duplicate anything, so the two duplicate readings are left out.
export const CREATE_LINK_RELATIONS: IssueLinkInputKind[] = ['blocked_by', 'blocks', 'relates'];

// Whether an activity entry's subject names a relation. The feed stores the
// relation there, and reads it as a sentence fragment ("marked this issue as
// blocked by IAP-3") rather than the noun the panel heads a group with: the
// phrases are messages under `issueLinks.phrases`, the nouns under
// `issueLinks.relations` (see useLinkRelationLabel).
export function isLinkRelation(subject: string | null): subject is IssueLinkInputKind {
  return subject != null && LINK_RELATIONS.includes(subject as IssueLinkInputKind);
}

// How the relation reads from the issue the link was loaded for. The source side
// reads it as stored; the target side reads the inverse. The board payload states
// this per issue itself, so only the issue page's links go through here.
export function linkRelation(link: IssueLink): IssueLinkInputKind {
  if (link.direction === 'outward') return link.kind;
  if (link.kind === 'blocks') return 'blocked_by';
  if (link.kind === 'duplicates') return 'duplicated_by';
  return 'relates';
}

// Whether another issue holds this one up, which the board views tint the card
// or row for. Read off the issue's own relations, so it holds whether or not the
// Links display property is showing them.
export function isBlocked(issue: BoardIssue): boolean {
  return issue.links.some((link) => link.relation === 'blocked_by');
}

// The same relation read from the other end, for naming it on the issue on that
// side. 'relates' reads the same from both.
export function inverseRelation(relation: IssueLinkInputKind): IssueLinkInputKind {
  if (relation === 'blocked_by') return 'blocks';
  if (relation === 'blocks') return 'blocked_by';
  if (relation === 'duplicates') return 'duplicated_by';
  if (relation === 'duplicated_by') return 'duplicates';
  return 'relates';
}

// The kind a relation is stored under, which is what a pair carries at most once:
// the two readings of a directional relation are the same row, so asking for the
// inverse of an existing one is the 409 the API answers with.
export function storedKind(relation: IssueLinkInputKind): IssueLinkKind {
  if (relation === 'blocked_by') return 'blocks';
  if (relation === 'duplicated_by') return 'duplicates';
  return relation;
}
