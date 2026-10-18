import { describe, it, expect } from 'bun:test';
import { parseDueDate, withTitleDueDate } from '../../due-date';

// Wednesday 14 October 2026.
const now = new Date('2026-10-14T15:30:00Z');

describe('parseDueDate', () => {
  it.each([
    ['Ship the release 2026-11-02', '2026-11-02'],
    ['Call the vendor today', '2026-10-14'],
    ['Send the invoice tomorrow', '2026-10-15'],
    ['Plan the offsite next week', '2026-10-19'],
    ['Review the draft by Friday', '2026-10-16'],
    ['Review the draft by fri', '2026-10-16'],
    ['Book the room on this Monday', '2026-10-19'],
    ['Weekly sync due Wednesday', '2026-10-21'],
    ['Renew the domain on 3 March', '2027-03-03'],
    ['Renew the domain by 20th October', '2026-10-20'],
    ['Renew the domain on 14 Oct', '2026-10-14'],
    ['Renew the domain by March 3rd', '2027-03-03'],
    ['Renew the domain on 3 March 2028', '2028-03-03'],
    ['Renew the domain by March 3, 2028', '2028-03-03'],
  ])('%s', (title, expected) => {
    expect(parseDueDate(title, now)).toBe(expected);
  });

  it.each([
    'Fix the login page',
    'Friday standup notes',
    'Meeting on 31 February',
    'Release 2026-02-30',
    'Update the may release notes',
  ])('finds no date in "%s"', (title) => {
    expect(parseDueDate(title, now)).toBeNull();
  });
});

type Input = { title: string; dueDate?: string | null; startDate?: string | null };

describe('withTitleDueDate', () => {
  it('sets the date the title names', () => {
    expect(withTitleDueDate<Input>({ title: 'Pay rent tomorrow' }, now).dueDate).toBe('2026-10-15');
  });

  it('keeps a due date the input sets, a null one included', () => {
    expect(withTitleDueDate({ title: 'Pay rent tomorrow', dueDate: null }, now).dueDate).toBeNull();
    expect(
      withTitleDueDate({ title: 'Pay rent tomorrow', dueDate: '2026-12-01' }, now).dueDate,
    ).toBe('2026-12-01');
  });

  it('leaves out a date before the start date', () => {
    const input: Input = { title: 'Pay rent tomorrow', startDate: '2026-11-01' };
    expect(withTitleDueDate(input, now).dueDate).toBeUndefined();
  });
});
