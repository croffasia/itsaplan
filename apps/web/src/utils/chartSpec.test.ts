import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHART_PALETTE,
  chartHasLegend,
  chartLegend,
  isSliceChart,
  parseChartSpec,
  seriesColor,
} from './chartSpec';
import type { ChartSpec } from './chartSpec';

const spec = {
  type: 'bar',
  x: 'week',
  series: [{ key: 'created' }],
  data: [{ week: 'W1', created: 3 }],
};

function parse(patch: Record<string, unknown> = {}) {
  return parseChartSpec(JSON.stringify({ ...spec, ...patch }));
}

describe('parseChartSpec', () => {
  it('parses a complete spec', () => {
    assert.deepEqual(parse(), spec);
  });

  it('parses a spec a model wrote a stray token next to', () => {
    assert.deepEqual(parseChartSpec(`${JSON.stringify(spec)}</br>`), spec);
  });

  it('rejects anything that is not a spec object', () => {
    assert.equal(parseChartSpec('not json'), null);
    assert.equal(parseChartSpec('[]'), null);
    assert.equal(parseChartSpec('"text"'), null);
  });

  it('parses every type the renderer draws', () => {
    for (const type of [
      'bar',
      'line',
      'area',
      'pie',
      'radar',
      'radial',
      'scatter',
      'funnel',
      'treemap',
    ]) {
      assert.equal(parse({ type })?.type, type);
    }
  });

  it('rejects a spec the renderer could not draw', () => {
    assert.equal(parse({ type: 'sankey' }), null);
    assert.equal(parse({ x: '' }), null);
    assert.equal(parse({ series: [] }), null);
    assert.equal(parse({ series: [{ label: 'no key' }] }), null);
    assert.equal(parse({ data: 'rows' }), null);
    assert.equal(parse({ data: [] }), null);
  });
});

describe('seriesColor', () => {
  it('prefers the color the spec names', () => {
    assert.equal(seriesColor({ key: 'a', color: '#123456' }, 0), '#123456');
  });

  it('falls back to the palette, wrapping past its end', () => {
    assert.equal(seriesColor({ key: 'a' }, 1), CHART_PALETTE[1]);
    assert.equal(seriesColor({ key: 'a' }, CHART_PALETTE.length), CHART_PALETTE[0]);
  });
});

describe('chartLegend', () => {
  it('lists the series of a bar, line, or area chart', () => {
    assert.deepEqual(
      chartLegend({
        ...(spec as ChartSpec),
        series: [{ key: 'created', label: 'Created' }, { key: 'closed' }],
      }),
      [
        { key: 'created', label: 'Created', color: CHART_PALETTE[0] },
        { key: 'closed', label: 'closed', color: CHART_PALETTE[1] },
      ],
    );
  });

  it('lists the categories of a pie and a radial, since they are coloured by slice', () => {
    for (const type of ['pie', 'radial'] as const) {
      assert.deepEqual(
        chartLegend({
          ...(spec as ChartSpec),
          type,
          data: [
            { week: 'Backlog', created: 2 },
            { week: 'Done', created: 12 },
          ],
        }),
        [
          { key: 'Backlog', label: 'Backlog', color: CHART_PALETTE[0] },
          { key: 'Done', label: 'Done', color: CHART_PALETTE[1] },
        ],
      );
    }
  });
});

describe('isSliceChart', () => {
  it('holds for the types drawn one shape per row', () => {
    assert.equal(isSliceChart({ ...(spec as ChartSpec), type: 'radial' }), true);
    assert.equal(isSliceChart({ ...(spec as ChartSpec), type: 'treemap' }), true);
    assert.equal(isSliceChart({ ...(spec as ChartSpec), type: 'radar' }), false);
  });
});

describe('chartHasLegend', () => {
  const rows = [
    { week: 'Backlog', created: 2 },
    { week: 'Done', created: 12 },
  ];

  it('holds once there is more than one entry to tell apart', () => {
    assert.equal(chartHasLegend(spec as ChartSpec), false);
    assert.equal(chartHasLegend({ ...(spec as ChartSpec), type: 'pie', data: rows }), true);
  });

  it('does not hold for a chart that names its shapes inside the drawing', () => {
    assert.equal(chartHasLegend({ ...(spec as ChartSpec), type: 'funnel', data: rows }), false);
    assert.equal(chartHasLegend({ ...(spec as ChartSpec), type: 'treemap', data: rows }), false);
  });
});
