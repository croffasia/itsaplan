import { afterEach, describe, expect, test } from 'bun:test';
import { getObject, putObject, storageDriverName } from '../index';

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('driver selection', () => {
  test('defaults to s3 when STORAGE_DRIVER is unset', async () => {
    delete process.env.STORAGE_DRIVER;
    for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      delete process.env[k];
    }
    expect(storageDriverName()).toBe('s3');
    await expect(putObject('k', Buffer.from('x'), 'text/plain')).rejects.toThrow(
      'S3 storage is not configured',
    );
    await expect(getObject('k')).rejects.toThrow('S3 storage is not configured');
  });

  test('sharepoint without its variables fails clearly', async () => {
    process.env.STORAGE_DRIVER = 'SharePoint';
    delete process.env.SHAREPOINT_TENANT_ID;
    expect(storageDriverName()).toBe('sharepoint');
    await expect(putObject('k', Buffer.from('x'), 'text/plain')).rejects.toThrow(
      /SharePoint storage is not configured: set SHAREPOINT_TENANT_ID/,
    );
  });

  test('rejects an unknown driver', () => {
    process.env.STORAGE_DRIVER = 'gcs';
    expect(() => storageDriverName()).toThrow(/Unknown STORAGE_DRIVER/);
  });
});
