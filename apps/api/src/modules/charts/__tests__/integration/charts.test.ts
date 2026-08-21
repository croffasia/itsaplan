import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const spec = {
  type: 'bar' as const,
  title: 'Issues per week',
  x: 'week',
  series: [{ key: 'created', label: 'Created' }],
  data: [
    { week: 'W10', created: 8 },
    { week: 'W11', created: 12 },
  ],
};

async function setupOwnerProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return asOwner;
}

describe('charts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('answers with the spec it was given', async () => {
    const asOwner = await setupOwnerProject();

    const res = await asOwner.projects({ projectKey: 'MKT' }).charts.post(spec);
    expect(res.status).toBe(200);
    expect(res.data).toEqual(spec);
  });

  it('accepts every chart type, several series, and stacking', async () => {
    const asOwner = await setupOwnerProject();

    const types = [
      'bar',
      'line',
      'area',
      'pie',
      'radar',
      'radial',
      'scatter',
      'funnel',
      'treemap',
    ] as const;

    for (const type of types) {
      const res = await asOwner.projects({ projectKey: 'MKT' }).charts.post({
        ...spec,
        type,
        stacked: true,
        series: [{ key: 'created' }, { key: 'closed', color: '#22c55e' }],
        data: [{ week: 'W10', created: 8, closed: 5 }],
      });
      expect(res.status).toBe(200);
    }
  });

  it('accepts how a chart is drawn: percent stacking, sides, curve, values, and a mixed series', async () => {
    const asOwner = await setupOwnerProject();

    const res = await asOwner.projects({ projectKey: 'MKT' }).charts.post({
      ...spec,
      stacked: 'percent',
      horizontal: true,
      curve: 'step',
      showValues: true,
      series: [{ key: 'created' }, { key: 'average', type: 'line' }],
      data: [{ week: 'W10', created: 8, average: 4 }],
    });
    expect(res.status).toBe(200);
  });

  it('rejects a spec the renderer could not draw', async () => {
    const asOwner = await setupOwnerProject();
    const charts = asOwner.projects({ projectKey: 'MKT' }).charts;

    // @ts-expect-error the type has to be one the renderer draws
    expect((await charts.post({ ...spec, type: 'sankey' })).status).toBe(400);
    // @ts-expect-error stacking is on, off, or by percent
    expect((await charts.post({ ...spec, stacked: 'always' })).status).toBe(400);
    // @ts-expect-error a series is drawn as a bar, a line, or an area
    expect((await charts.post({ ...spec, series: [{ key: 'created', type: 'pie' }] })).status).toBe(
      400,
    );
    expect((await charts.post({ ...spec, x: '' })).status).toBe(400);
    expect((await charts.post({ ...spec, series: [] })).status).toBe(400);
    expect((await charts.post({ ...spec, series: [{ key: '' }] })).status).toBe(400);
    expect((await charts.post({ ...spec, data: [] })).status).toBe(400);
    // @ts-expect-error a data cell holds a string, a number, or null
    expect((await charts.post({ ...spec, data: [{ week: { nested: 1 } }] })).status).toBe(400);
  });

  it('denies a non-member and answers 404 for an unknown project', async () => {
    await setupOwnerProject();
    const outsider = authedApi((await signUpTestUser()).cookie);

    const denied = await outsider.projects({ projectKey: 'MKT' }).charts.post(spec);
    expect(denied.status).toBe(403);

    const missing = await outsider.projects({ projectKey: 'NOPE' }).charts.post(spec);
    expect(missing.status).toBe(404);
  });
});
