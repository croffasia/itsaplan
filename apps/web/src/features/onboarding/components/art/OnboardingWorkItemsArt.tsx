import { useState } from 'react';
import OnboardingCalendarArt, { type CalendarMode } from './OnboardingCalendarArt';
import OnboardingKanbanArt from './OnboardingKanbanArt';
import OnboardingTableArt from './OnboardingTableArt';
import OnboardingTimelineArt from './OnboardingTimelineArt';
import OnboardingViewSwitcher, { type WorkView } from './OnboardingViewSwitcher';

// The same issues in each layout of the work items page; the switcher on the picture
// changes it, as the one on the page does.
export default function OnboardingWorkItemsArt() {
  const [view, setView] = useState<WorkView>('kanban');
  const [mode, setMode] = useState<CalendarMode>('month');

  return (
    <>
      {view === 'kanban' && <OnboardingKanbanArt />}
      {view === 'table' && <OnboardingTableArt />}
      {view === 'timeline' && <OnboardingTimelineArt />}
      {view === 'calendar' && <OnboardingCalendarArt mode={mode} onMode={setMode} />}
      <OnboardingViewSwitcher view={view} onView={setView} />
    </>
  );
}
