import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chartFileName } from './chartExport';
import type { ChartSpec } from './chartSpec';

const spec: ChartSpec = {
  type: 'bar',
  x: 'week',
  series: [{ key: 'created' }],
  data: [{ week: 'W1', created: 3 }],
};

describe('chartFileName', () => {
  it('names the file after the chart title', () => {
    assert.equal(
      chartFileName({ ...spec, title: 'Issues per week' }, 'png'),
      'issues-per-week.png',
    );
  });

  it('falls back to a plain name for a chart with no title', () => {
    assert.equal(chartFileName(spec, 'svg'), 'chart.svg');
  });

  it('keeps letters of any script and drops the rest', () => {
    assert.equal(chartFileName({ ...spec, title: 'Задачи / неделя!' }, 'png'), 'задачи-неделя.png');
    assert.equal(chartFileName({ ...spec, title: '///' }, 'png'), 'chart.png');
  });

  it('cuts a very long title', () => {
    const name = chartFileName({ ...spec, title: 'a'.repeat(200) }, 'svg');
    assert.equal(name, `${'a'.repeat(60)}.svg`);
  });
});
