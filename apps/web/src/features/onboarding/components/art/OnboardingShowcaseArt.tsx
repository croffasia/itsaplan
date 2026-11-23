import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { CARD, LINE, SOFT, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingCursor from './OnboardingCursor';
import OnboardingLogoTile from './OnboardingLogoTile';
import OnboardingSparkle from './OnboardingSparkle';

const ACCENT = '#5B6EE1';
const COLUMNS = [84, 192, 300, 408];
const ROWS = [108, 172];
const FREE = { x: 300, y: 172 };

// The list of companies on itsaplan.dev with one place left for the reader's logo.
export default function OnboardingShowcaseArt() {
  const t = useTranslations('onboarding.showcase.art');
  const tiles = ROWS.flatMap((y) => COLUMNS.map((x) => ({ x, y }))).filter(
    (tile) => tile.x !== FREE.x || tile.y !== FREE.y,
  );

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="60" y="28" width="480" height="232" rx="14" className={CARD} />
      <path d="M60 58 V42 A14 14 0 0 1 74 28 H526 A14 14 0 0 1 540 42 V58 Z" className={SOFT} />
      <circle cx="78" cy="43" r="3.5" fill="#F87171" />
      <circle cx="90" cy="43" r="3.5" fill="#FBBF24" />
      <circle cx="102" cy="43" r="3.5" fill="#34D399" />
      <rect x="226" y="35" width="148" height="16" rx="8" className="fill-card" />
      <text x="300" y="46.5" fontSize="9.5" textAnchor="middle" className={SUB}>
        itsaplan.dev
      </text>
      <OnboardingArtText x={84} y={86} width={300} size={13} weight={600}>
        {t('heading')}
      </OnboardingArtText>
      <rect x="84" y="94" width="150" height="5" rx="2.5" className={LINE} />

      {tiles.map((tile, i) => (
        <OnboardingLogoTile key={`${tile.x}-${tile.y}`} x={tile.x} y={tile.y} i={i} />
      ))}

      <rect
        x={FREE.x}
        y={FREE.y}
        width="96"
        height="52"
        rx="10"
        fill={ACCENT}
        fillOpacity=".12"
        stroke={ACCENT}
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
      <Plus x={FREE.x + 12} y={FREE.y + 19} width={14} height={14} color={ACCENT} />
      <OnboardingArtText
        x={FREE.x + 30}
        y={FREE.y + 30}
        width={60}
        size={10}
        weight={600}
        className="fill-[#5B6EE1]"
      >
        {t('yourLogo')}
      </OnboardingArtText>
      <OnboardingCursor x={FREE.x + 88} y={FREE.y + 42} />
      <OnboardingSparkle x={FREE.x + 104} y={FREE.y - 6} size={7} color={ACCENT} />
      <OnboardingSparkle x={FREE.x - 10} y={FREE.y + 62} size={5} color={ACCENT} />
      <OnboardingSparkle x={556} y={40} size={8} color={ACCENT} />
    </svg>
  );
}
