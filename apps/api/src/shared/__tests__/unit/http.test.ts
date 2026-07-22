import { describe, it, expect } from 'bun:test';
import { noContent } from '../../http';

describe('noContent', () => {
  it('is a 204 response with an empty body', () => {
    const res = noContent();
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });
});
