import { ScrollText } from 'lucide-react';
import type { GodSection } from '@/utils/godSections';
import GodAuditLogPage from '@/features/god/GodAuditLogPage';

// A self-hosted instance lists the core's god mode sections and a preview of the audit
// log the hosted build and Pro add. The hosted build returns the core's with its own
// added, such as billing, or with one replaced or left out.
export default function godSections(core: GodSection[]): GodSection[] {
  return [
    ...core,
    { slug: 'audit-log', group: 'security', icon: ScrollText, Component: GodAuditLogPage },
  ];
}
