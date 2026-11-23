import { SOFT } from '../../utils/art';

const MARK = 'fill-muted-foreground/35';

// A made-up company logo in a tile: a shape and a word, the shape and the word length
// picked by `i`, so neighbouring tiles differ.
export default function OnboardingLogoTile({ x, y, i }: { x: number; y: number; i: number }) {
  const cx = x + 26;
  const cy = y + 26;
  const shapes = [
    <circle key="circle" cx={cx} cy={cy} r="8" className={MARK} />,
    <rect key="square" x={cx - 8} y={cy - 8} width="16" height="16" rx="4" className={MARK} />,
    <path
      key="triangle"
      d={`M${cx} ${cy - 9} L${cx + 9} ${cy + 7} L${cx - 9} ${cy + 7} Z`}
      className={MARK}
    />,
    <rect
      key="diamond"
      x={cx - 6}
      y={cy - 6}
      width="12"
      height="12"
      rx="2"
      transform={`rotate(45 ${cx} ${cy})`}
      className={MARK}
    />,
  ];

  return (
    <g>
      <rect x={x} y={y} width="96" height="52" rx="10" className={SOFT} />
      {shapes[i % shapes.length]}
      <rect x={x + 40} y={cy - 4} width={28 + ((i * 7) % 18)} height="8" rx="4" className={MARK} />
    </g>
  );
}
