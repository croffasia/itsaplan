import { Globe, Lock, Users, type LucideIcon } from 'lucide-react';

// Who sees a note board or a Docs page: every project member, its owner alone, or
// its owner and the members it is shared with.
export type AccessVisibility = 'public' | 'private' | 'restricted';

export const ACCESS_ICON: Record<AccessVisibility, LucideIcon> = {
  public: Globe,
  private: Lock,
  restricted: Users,
};

// Someone access can be granted to. `canAccess` false means their role cannot read
// the feature at all, so the API rejects granting them access.
export interface AccessCandidate {
  userId: string;
  name: string;
  image: string | null;
  kind: 'member' | 'agent';
  canAccess: boolean;
}

// The words of the access control, translated by the feature that shows it.
export interface AccessLabels {
  access: string;
  placeholder: string;
  nothingFound: string;
  members: string;
  agents: string;
  agent: string;
  noAccess: string;
  listHint: string;
  visibility: Record<AccessVisibility, string>;
}
