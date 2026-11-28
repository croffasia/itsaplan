import type { LucideIcon } from 'lucide-react';

// By the action an extension of the api records in an issue's history (recordActivity).
// The line after the actor is `issue.activity.extensions.<action>`, given the entry's
// `subject`, `from` and `to` and a `<v>` tag for a value. A self-hosted instance adds none.
const activityActionIcons: Record<string, LucideIcon> = {};

export default activityActionIcons;
