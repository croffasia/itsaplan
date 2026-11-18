import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quadMatrix } from './flyToMark';

// Applies a CSS matrix3d (column-major) to a point of the box, with the perspective divide.
function apply(matrix: string, x: number, y: number): [number, number] {
  const m = matrix.slice('matrix3d('.length, -1).split(',').map(Number);
  const w = m[3] * x + m[7] * y + m[15];
  return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
}

function assertNear([x, y]: [number, number], [ex, ey]: [number, number]) {
  assert.ok(Math.abs(x - ex) < 1e-6 && Math.abs(y - ey) < 1e-6, `${x},${y} is not ${ex},${ey}`);
}

describe('quadMatrix', () => {
  it('maps the corners of the box onto the corners of the quad', () => {
    const quad: [number, number][] = [
      [-40, 120],
      [300, 120],
      [260, 129],
      [-46, 129],
    ];
    const matrix = quadMatrix(640, 9, quad);
    const corners: [number, number][] = [
      [0, 0],
      [640, 0],
      [640, 9],
      [0, 9],
    ];
    corners.forEach(([x, y], i) => assertNear(apply(matrix, x, y), quad[i]));
  });

  it('leaves a box mapped onto itself unchanged', () => {
    const box: [number, number][] = [
      [0, 0],
      [640, 0],
      [640, 9],
      [0, 9],
    ];
    assertNear(apply(quadMatrix(640, 9, box), 320, 4.5), [320, 4.5]);
  });
});
