import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { CARD, LINE, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';
import OnboardingStateIcon from './OnboardingStateIcon';

const ORANGE = '#E8783D';
const ACCENT_TEXT = 'fill-[#B9531F] dark:fill-[#F29A67]';

// A finished cycle, the active one with today marked and the next one, and an unfinished
// issue carried over into it.
export default function OnboardingCyclesArt() {
  const t = useTranslations('onboarding.art');
  const cycles = [
    { x: 70, width: 140, number: 12, className: SUB },
    { x: 220, width: 160, number: 13, className: ACCENT_TEXT },
    { x: 390, width: 140, number: 14, className: SUB },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      {cycles.map((cycle) => (
        <OnboardingArtText
          key={cycle.number}
          x={cycle.x + 4}
          y={44}
          width={cycle.width - 8}
          size={11.5}
          weight={600}
          className={cycle.className}
        >
          {t('cycle', { number: cycle.number })}
        </OnboardingArtText>
      ))}
      <rect x="70" y="54" width="140" height="36" rx="10" fill={ORANGE} fillOpacity=".28" />
      <path
        d="M133 72 l5 5 l9 -10"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-[#B9531F] dark:stroke-[#F29A67]"
      />
      <rect x="220" y="54" width="160" height="36" rx="10" className={CARD} />
      <rect x="220" y="54" width="96" height="36" rx="10" fill={ORANGE} fillOpacity=".5" />
      <rect
        x="390"
        y="54"
        width="140"
        height="36"
        rx="10"
        fill="none"
        strokeWidth="1.6"
        strokeDasharray="5 5"
        className="stroke-muted-foreground/60"
      />
      <path d="M316 50 V98" stroke={ORANGE} strokeWidth="2" />
      <circle cx="316" cy="50" r="4" fill={ORANGE} />
      <circle cx="124" cy="180" r="46" fill={ORANGE} fillOpacity=".14" />
      <circle cx="124" cy="180" r="30" className={CARD} />
      <RefreshCw
        x={110}
        y={166}
        width={28}
        height={28}
        className="text-[#B9531F] dark:text-[#F29A67]"
      />
      <rect x="236" y="118" width="128" height="54" rx="10" className={CARD} />
      <OnboardingStateIcon state="inProgress" cx={254} cy={145} />
      <rect x="268" y="134" width="80" height="6" rx="3" className={LINE} />
      <rect x="268" y="147" width="52" height="6" rx="3" className={LINE} />
      <path
        d="M366 145 C 396 145, 412 152, 420 164"
        stroke={ORANGE}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M419.4 155 L420 164 L411.9 160"
        stroke={ORANGE}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="398"
        y="170"
        width="128"
        height="54"
        rx="10"
        fill={ORANGE}
        fillOpacity=".06"
        stroke={ORANGE}
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
      <circle
        cx="416"
        cy="197"
        r="7"
        stroke={ORANGE}
        strokeOpacity=".6"
        strokeWidth="2"
        fill="none"
      />
      <rect x="430" y="186" width="80" height="6" rx="3" fill={ORANGE} fillOpacity=".25" />
      <rect x="430" y="199" width="52" height="6" rx="3" fill={ORANGE} fillOpacity=".25" />
      <OnboardingSparkle x={552} y={232} size={9} color={ORANGE} />
      <OnboardingSparkle x={250} y={236} size={6} color={ORANGE} />
    </svg>
  );
}
