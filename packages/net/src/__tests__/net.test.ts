import { describe, it, expect } from 'bun:test';
import { isPrivateIp } from '../index';

describe('isPrivateIp', () => {
  it('flags loopback, private, link-local, and CGNAT IPv4', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.0.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('passes public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it('flags loopback, link-local, and unique-local IPv6', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fd00::1', 'FD00::1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('flags IPv4-mapped and IPv4-compatible IPv6 carrying a private IPv4', () => {
    for (const ip of [
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '::FFFF:A9FE:A9FE',
      '::127.0.0.1',
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('passes IPv4-mapped IPv6 carrying a public IPv4', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    expect(isPrivateIp('::ffff:808:808')).toBe(false);
  });
});
