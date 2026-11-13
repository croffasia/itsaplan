'use client';

import GodSettingsGate from './components/GodSettingsGate';
import GodJobsForm from './components/jobs/GodJobsForm';
import { useInstanceJobSettingsQuery } from './services/god.service';
import { toJobForm } from './utils/jobFields';

export default function GodJobsPage() {
  const query = useInstanceJobSettingsQuery();

  return (
    <GodSettingsGate slug="jobs" data={query.data}>
      {(settings) => <GodJobsForm settings={toJobForm(settings)} />}
    </GodSettingsGate>
  );
}
