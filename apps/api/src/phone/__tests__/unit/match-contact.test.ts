import { describe, expect, it } from 'bun:test';
import { matchContact, type PhoneContactMatch } from '../../store';

// The index holds only digits, which is what crmPhoneIndex stores.
const INDEX: PhoneContactMatch[] = [
  { customerId: 'cust-1', name: 'Acme', phone: '31639429209' },
  { customerId: 'cust-2', name: 'Globex', phone: '0201234567' },
];

describe('matchContact', () => {
  it('matches the same number written in national and international form', () => {
    expect(matchContact('06 39429209', INDEX)?.customerId).toBe('cust-1');
    expect(matchContact('+31639429209', INDEX)?.customerId).toBe('cust-1');
  });

  it('matches a number stored in national form', () => {
    expect(matchContact('+31201234567', INDEX)?.customerId).toBe('cust-2');
  });

  it('does not match a different number', () => {
    expect(matchContact('+31612345678', INDEX)).toBeNull();
  });

  it('has nothing to match when the number is missing or too short', () => {
    expect(matchContact(null, INDEX)).toBeNull();
    expect(matchContact('112', INDEX)).toBeNull();
  });

  it('matches nothing against an empty index', () => {
    expect(matchContact('+31639429209', [])).toBeNull();
  });

  // Two numbers sharing only their last digits are not the same subscriber.
  it('does not match a customer stored with a partial number', () => {
    const partial = [{ customerId: 'cust-3', name: 'Short', phone: '429209' }];
    expect(matchContact('+31639429209', partial)).toBeNull();
  });
});
