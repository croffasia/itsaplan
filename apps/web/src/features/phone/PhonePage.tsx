'use client';

import { useMemo, useState } from 'react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PhoneCall, PhoneCallFilters } from '@/lib/api';
import PhoneCallTable from './components/PhoneCallTable';
import PhoneFilterBar from './components/PhoneFilterBar';
import PhoneNoteDialog from './components/PhoneNoteDialog';
import PhoneNumbersBar from './components/PhoneNumbersBar';
import PhoneRecordingToggle from './components/PhoneRecordingToggle';
import PhoneSummaryCards from './components/PhoneSummaryCards';
import { useIncomingCallToasts } from './hooks/useIncomingCallToasts';
import {
  useAddPhoneCallNote,
  useBlockPhoneNumber,
  usePhoneCallsQuery,
  usePhoneDevicesQuery,
  usePhoneOverviewQuery,
  useStartPhoneCall,
} from './services/phone.service';

export default function PhonePage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const canEdit = can('phone', 'edit');

  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [status, setStatus] = useState('all');
  const [numberId, setNumberId] = useState('all');
  const [page, setPage] = useState(1);
  const [noteTarget, setNoteTarget] = useState<PhoneCall | null>(null);

  const overviewQuery = usePhoneOverviewQuery(projectKey);
  const configured = overviewQuery.data?.configured ?? false;
  const devicesQuery = usePhoneDevicesQuery(configured ? projectKey : '');

  const filters = useMemo<PhoneCallFilters>(
    () => ({
      page,
      search: search.trim() || undefined,
      direction: direction === 'all' ? undefined : (direction as 'inbound' | 'outbound'),
      status: status === 'all' ? undefined : status,
      numberId: numberId === 'all' ? undefined : numberId,
    }),
    [page, search, direction, status, numberId],
  );
  const callsQuery = usePhoneCallsQuery(configured ? projectKey : '', filters);
  const addNote = useAddPhoneCallNote(projectKey);
  const blockNumber = useBlockPhoneNumber(projectKey);
  const startCall = useStartPhoneCall(projectKey);

  useIncomingCallToasts(projectKey, configured);

  const setFilter = (key: 'search' | 'direction' | 'status' | 'numberId', value: string) => {
    setPage(1);
    if (key === 'search') setSearch(value);
    if (key === 'direction') setDirection(value);
    if (key === 'status') setStatus(value);
    if (key === 'numberId') setNumberId(value);
  };

  if (!project || overviewQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('phone', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to the business number.
      </div>
    );
  }

  const overview = overviewQuery.data;
  const numbers = overview?.numbers ?? [];
  const calls = callsQuery.data;
  const pagination = calls?.pagination;
  const device = devicesQuery.data?.[0] ?? null;
  // The switch writes to one number's dial plan, so it only appears when the
  // filter says which number that is — or when there is only one to begin with.
  const recordingNumber =
    numberId === 'all'
      ? numbers.length === 1
        ? numbers[0]
        : null
      : (numbers.find((entry) => entry.id === numberId) ?? null);

  const dial = (call: PhoneCall) => {
    if (!device || !call.externalNumber) return;
    const target = numbers.find((entry) => entry.number === call.internalNumber) ?? numbers[0];
    if (!target) return;
    startCall.mutate({ deviceId: device.deviceId, to: call.externalNumber, numberId: target.id });
  };

  return (
    <SectionPageView
      title="Business number"
      description="The calls, voicemails and recordings of the Rinkel numbers, read live from Rinkel."
      wide
    >
      {!configured ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          This instance has no Rinkel API key. Set <code>RINKEL_KEY</code> in the root{' '}
          <code>.env</code> and restart the api, and the call history appears here.
        </p>
      ) : (
        <div className="space-y-4 pb-8">
          <div className="flex flex-wrap items-start gap-2">
            <PhoneNumbersBar numbers={numbers} />
            {recordingNumber && (
              <PhoneRecordingToggle
                projectKey={projectKey}
                numberId={recordingNumber.id}
                canEdit={canEdit}
              />
            )}
          </div>

          {devicesQuery.data?.length === 0 && (
            <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
              Calling back is off because no device is registered on the Rinkel account. Sign in to
              the Rinkel app once and it appears here.
            </p>
          )}

          {calls && (
            <PhoneSummaryCards stats={calls.stats} newVoicemails={overview?.newVoicemails ?? 0} />
          )}

          <PhoneFilterBar
            search={search}
            direction={direction}
            status={status}
            numberId={numberId}
            numbers={numbers}
            onChange={setFilter}
          />

          {callsQuery.isLoading ? (
            <Skeleton className="h-96" />
          ) : (calls?.calls.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No calls match these filters.
            </p>
          ) : (
            <>
              <PhoneCallTable
                projectKey={projectKey}
                calls={calls!.calls}
                canEdit={canEdit}
                canDial={Boolean(device)}
                onNote={setNoteTarget}
                onBlock={(call) =>
                  call.externalNumber &&
                  blockNumber.mutate({ number: call.externalNumber, blocked: call.blocked })
                }
                onDial={dial}
              />
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.currentPage} of {pagination.totalPages} ·{' '}
                    {pagination.totalItems} calls
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <PhoneNoteDialog
        open={noteTarget !== null}
        onOpenChange={(open) => !open && setNoteTarget(null)}
        caller={noteTarget?.externalNumber ?? 'this caller'}
        saving={addNote.isPending}
        onSubmit={(content) => {
          if (!noteTarget) return;
          addNote.mutate(
            { callId: noteTarget.id, content },
            { onSuccess: () => setNoteTarget(null) },
          );
        }}
      />
    </SectionPageView>
  );
}
