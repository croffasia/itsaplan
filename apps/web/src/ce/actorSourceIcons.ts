import type { LucideIcon } from 'lucide-react';

// By the source key the api adds with setActorSources; the tooltips are in
// `common.actorSource.<key>`. A self-hosted instance adds no sources.
const actorSourceIcons: Record<string, LucideIcon> = {};

export default actorSourceIcons;
