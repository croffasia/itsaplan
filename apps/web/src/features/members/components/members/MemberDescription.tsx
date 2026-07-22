import type { MemberRow } from '@/lib/api';

// A member's project description (what they do), shown under their name. Renders
// nothing when unset. Editing is a separate action (MemberDescriptionDialog).
export default function MemberDescription({ member }: { member: MemberRow }) {
  if (!member.description) return null;
  return <span className="text-xs text-muted-foreground">{member.description}</span>;
}
