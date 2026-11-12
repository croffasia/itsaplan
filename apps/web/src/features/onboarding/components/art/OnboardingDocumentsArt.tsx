import { Link } from 'lucide-react';
import { CARD, INK, LINE } from '../../utils/art';
import OnboardingSparkle from './OnboardingSparkle';

const GREEN = '#3C9A62';
const PAGE_LINES = [
  [72, 156],
  [86, 140],
  [100, 150],
  [202, 150],
  [216, 124],
  [230, 138],
];

// A page with a linked issue and a checklist, its revisions beside it and a comment on it.
export default function OnboardingDocumentsArt() {
  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect
        x="212"
        y="40"
        width="188"
        height="224"
        rx="12"
        opacity=".7"
        transform="rotate(-6 306 152)"
        className={CARD}
      />
      <rect
        x="212"
        y="40"
        width="188"
        height="224"
        rx="12"
        opacity=".88"
        transform="rotate(4 306 152)"
        className={CARD}
      />
      <rect x="206" y="26" width="196" height="236" rx="12" className={CARD} />
      <rect x="226" y="48" width="110" height="10" rx="5" opacity=".85" className={INK} />
      {PAGE_LINES.map(([y, width]) => (
        <rect key={y} x="226" y={y} width={width} height="6" rx="3" className={LINE} />
      ))}
      <rect x="226" y="114" width="64" height="20" rx="6" fill={GREEN} fillOpacity=".16" />
      <text
        x="258"
        y="128"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="600"
        className="fill-[#2B7A4B] dark:fill-[#6CC290]"
      >
        ITS-42
      </text>
      <rect x="298" y="121" width="84" height="6" rx="3" className={LINE} />
      <rect x="226" y="148" width="14" height="14" rx="4" fill={GREEN} />
      <path
        d="M229.5 155 l2.4 2.4 l4.4 -4.8"
        stroke="#fff"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="248" y="152" width="100" height="6" rx="3" className={LINE} />
      <rect
        x="226"
        y="172"
        width="14"
        height="14"
        rx="4"
        fill="none"
        strokeWidth="1.6"
        className="stroke-muted-foreground"
      />
      <rect x="248" y="176" width="84" height="6" rx="3" className={LINE} />

      <rect x="432" y="64" width="116" height="140" rx="12" className={CARD} />
      <path d="M452 88 V180" strokeWidth="2" className="stroke-border" />
      <circle cx="452" cy="88" r="9" fill={GREEN} fillOpacity=".2" />
      <circle cx="452" cy="88" r="5.5" fill={GREEN} />
      {[134, 180].map((y) => (
        <circle
          key={y}
          cx="452"
          cy={y}
          r="5"
          strokeWidth="2"
          className="fill-card stroke-muted-foreground"
        />
      ))}
      {[
        [82, 62, 40],
        [128, 56, 36],
        [174, 60, 32],
      ].map(([y, first, second]) => (
        <g key={y}>
          <rect x="466" y={y} width={first} height="6" rx="3" className={LINE} />
          <rect
            x="466"
            y={y + 11}
            width={second}
            height="5"
            rx="2.5"
            opacity=".7"
            className={LINE}
          />
        </g>
      ))}

      <path d="M150 198 L172 214 L166 196 Z" className="fill-card" />
      <rect x="56" y="138" width="124" height="64" rx="14" className={CARD} />
      <circle cx="78" cy="160" r="10" fill={GREEN} fillOpacity=".35" />
      <rect x="96" y="154" width="68" height="6" rx="3" className={LINE} />
      <rect x="96" y="166" width="50" height="6" rx="3" className={LINE} />
      <rect x="70" y="182" width="94" height="6" rx="3" className={LINE} />
      <rect x="96" y="56" width="44" height="44" rx="12" className={CARD} />
      <Link x={106} y={66} width={24} height={24} className="text-[#2B7A4B] dark:text-[#6CC290]" />
      <OnboardingSparkle x={560} y={236} size={8} color={GREEN} />
      <OnboardingSparkle x={182} y={40} size={6} color={GREEN} />
    </svg>
  );
}
