import { describe, expect, it } from 'bun:test';
import { firstPartyWebsite, publicEvidence } from '../../presenters';

describe('Leads presenters', () => {
  it('only exposes a first-party website as the company website', () => {
    expect(firstPartyWebsite('https://example.com', 'first_party')).toBe('https://example.com');
    expect(firstPartyWebsite('https://instagram.com/example', 'social_profile')).toBeNull();
    expect(
      firstPartyWebsite('https://booking.example/profile', 'directory_or_booking_profile'),
    ).toBeNull();
  });

  it('removes local screenshot paths and keeps safe public evidence links', () => {
    expect(
      publicEvidence([
        {
          evidence_type: 'source',
          source_url: 'https://www.google.com/maps/place/example',
          screenshot_path: 'C:\\private\\desktop.png',
          screenshot_sha256: 'secret-internal-hash',
        },
        { evidence_type: 'file', source_url: 'file:///private/mobile.png' },
      ]),
    ).toEqual([{ type: 'source', url: 'https://www.google.com/maps/place/example' }]);
  });
});
