import { describe, expect, it } from 'bun:test';
import { callDto, callStats, numberDto } from '../../presenters';
import type { RinkelCall, RinkelNumber } from '../../client';

// The fixtures below are the shapes Rinkel actually returns, including the nulls
// it sends for a number nobody has labelled and for a call with no contact match.

const NUMBER: RinkelNumber = {
  id: '6a909aded757a49a55b9d326',
  label: null,
  number: '+31852501911',
  localizedNumber: '085 250 1911',
  status: 'ACTIVE',
  activationDate: '2026-08-27T20:15:26.184Z',
};

const CALL: RinkelCall = {
  id: '6aadda5053823d4f979e6ec3',
  callId: '19f56df8f1a09ccc3f120992',
  date: '2026-09-19T00:41:52.808Z',
  direction: 'outbound',
  externalNumber: {
    anonymous: false,
    localized: '06 39429209',
    e164: '+31639429209',
    isOnClientBlacklist: false,
    isOnGlobalBlacklist: false,
  },
  internalNumber: {
    id: '6a909aded757a49a55b9d326',
    label: null,
    localizedNumber: '+31 85 250 1911',
    number: '+31852501911',
  },
  duration: 1,
  status: 'MISSED',
  missedReason: 'NO_ANSWER',
  user: { fullName: 'Danil Karasev' },
  contact: null,
  voicemail: null,
  callRecording: null,
};

describe('phone presenters', () => {
  it('keeps a number that nobody labelled', () => {
    expect(numberDto(NUMBER)).toEqual({
      id: '6a909aded757a49a55b9d326',
      label: null,
      number: '085 250 1911',
      status: 'ACTIVE',
    });
  });

  it('falls back to the raw number when there is no localized one', () => {
    expect(numberDto({ ...NUMBER, localizedNumber: '' }).number).toBe('+31852501911');
  });

  it('flattens a call without a contact or a recording', () => {
    expect(callDto(CALL)).toMatchObject({
      id: '6aadda5053823d4f979e6ec3',
      direction: 'outbound',
      status: 'MISSED',
      missedReason: 'NO_ANSWER',
      externalNumber: '06 39429209',
      anonymous: false,
      blocked: false,
      internalNumber: '+31 85 250 1911',
      internalLabel: null,
      contactName: null,
      userName: 'Danil Karasev',
      recordingId: null,
      voicemailId: null,
      voicemailNew: false,
      sentiment: null,
    });
  });

  it('withholds the number of an anonymous caller but marks it', () => {
    const anonymous = callDto({
      ...CALL,
      externalNumber: { anonymous: true, isOnClientBlacklist: true },
    });
    expect(anonymous).toMatchObject({ externalNumber: null, anonymous: true, blocked: true });
  });

  it('prefers the contact name over the company name', () => {
    const named = callDto({ ...CALL, contact: { fullName: 'Jane Doe', companyName: 'Acme' } });
    expect(named.contactName).toBe('Jane Doe');

    const company = callDto({ ...CALL, contact: { companyName: 'Acme' } });
    expect(company.contactName).toBe('Acme');
  });

  it('carries the ids the audio buttons need', () => {
    const withAudio = callDto({
      ...CALL,
      status: 'VOICEMAIL',
      voicemail: { id: 'vm-1', new: true, duration: 12 },
      callRecording: { id: 'rec-1' },
    });
    expect(withAudio).toMatchObject({
      voicemailId: 'vm-1',
      voicemailNew: true,
      recordingId: 'rec-1',
    });
  });

  it('averages only the calls that were answered', () => {
    const calls = [
      callDto({ ...CALL, status: 'ANSWERED', direction: 'inbound', duration: 60 }),
      callDto({ ...CALL, status: 'ANSWERED', duration: 30 }),
      callDto({ ...CALL, status: 'MISSED', duration: 0 }),
      callDto({ ...CALL, status: 'VOICEMAIL', duration: 900 }),
    ];
    expect(callStats(calls)).toEqual({
      total: 4,
      inbound: 1,
      answered: 2,
      missed: 1,
      voicemail: 1,
      averageDuration: 45,
    });
  });

  it('reports no average when nothing was answered', () => {
    expect(callStats([callDto({ ...CALL, status: 'MISSED' })]).averageDuration).toBe(0);
  });
});
