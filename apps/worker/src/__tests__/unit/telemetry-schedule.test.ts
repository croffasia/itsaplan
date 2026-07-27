import { describe, expect, it } from 'bun:test';
import {
  MINUTES_PER_DAY,
  minuteOfDay,
  randomSendMinute,
  shouldSend,
  utcDay,
} from '../../telemetry-schedule';

describe('utcDay', () => {
  it('formats the UTC date', () => {
    expect(utcDay(new Date('2026-07-27T23:59:59Z'))).toBe('2026-07-27');
    expect(utcDay(new Date('2026-07-28T00:00:00Z'))).toBe('2026-07-28');
  });
});

describe('minuteOfDay', () => {
  it('counts minutes since midnight UTC', () => {
    expect(minuteOfDay(new Date('2026-07-27T00:00:00Z'))).toBe(0);
    expect(minuteOfDay(new Date('2026-07-27T13:37:00Z'))).toBe(817);
    expect(minuteOfDay(new Date('2026-07-27T23:59:59Z'))).toBe(MINUTES_PER_DAY - 1);
  });
});

describe('randomSendMinute', () => {
  it('stays inside the day', () => {
    for (let i = 0; i < 200; i++) {
      const minute = randomSendMinute();
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThan(MINUTES_PER_DAY);
      expect(Number.isInteger(minute)).toBe(true);
    }
  });
});

describe('shouldSend', () => {
  it('sends the very first pulse immediately, whatever the slot', () => {
    expect(
      shouldSend({ day: '2026-07-27', lastSentDay: null, minuteOfDay: 0, sendMinute: 1400 }),
    ).toBe(true);
  });

  it('does not send twice on the same day', () => {
    expect(
      shouldSend({
        day: '2026-07-27',
        lastSentDay: '2026-07-27',
        minuteOfDay: 1439,
        sendMinute: 10,
      }),
    ).toBe(false);
  });

  it('waits for the instance slot on later days', () => {
    const before = {
      day: '2026-07-28',
      lastSentDay: '2026-07-27',
      minuteOfDay: 599,
      sendMinute: 600,
    };
    expect(shouldSend(before)).toBe(false);
    expect(shouldSend({ ...before, minuteOfDay: 600 })).toBe(true);
    expect(shouldSend({ ...before, minuteOfDay: 1439 })).toBe(true);
  });

  it('still sends after a gap of several days once the slot passes', () => {
    expect(
      shouldSend({
        day: '2026-07-30',
        lastSentDay: '2026-07-20',
        minuteOfDay: 700,
        sendMinute: 600,
      }),
    ).toBe(true);
  });
});
