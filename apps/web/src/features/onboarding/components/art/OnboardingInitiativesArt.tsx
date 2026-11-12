import { useTranslations } from 'next-intl';
import { Flag } from 'lucide-react';
import { CARD, LINE, SOFT } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';
import OnboardingStateIcon from './OnboardingStateIcon';

const VIOLET = '#7C5CE6';
const ISSUES = [
  { y: 62, state: 'done', width: 96 },
  { y: 119, state: 'inProgress', width: 88 },
  { y: 176, state: 'todo', width: 92 },
] as const;

// Three issues feeding one initiative, with its progress ring, health and progress bar.
export default function OnboardingInitiativesArt() {
  const t = useTranslations('onboarding.art');
  const tHealth = useTranslations('initiatives.health');

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      {ISSUES.map((issue) => (
        <path
          key={issue.y}
          d={`M232 ${issue.y + 21} C 290 ${issue.y + 21}, 286 140, 344 140`}
          stroke={VIOLET}
          strokeOpacity=".5"
          strokeWidth="2"
          fill="none"
        />
      ))}
      {ISSUES.map((issue) => (
        <g key={issue.y}>
          <rect x="64" y={issue.y} width="168" height="42" rx="10" className={CARD} />
          <OnboardingStateIcon state={issue.state} cx={84} cy={issue.y + 21} />
          <rect x="100" y={issue.y + 13} width={issue.width} height="6" rx="3" className={LINE} />
          <rect
            x="100"
            y={issue.y + 25}
            width={issue.width - 34}
            height="6"
            rx="3"
            className={LINE}
          />
          <circle cx="232" cy={issue.y + 21} r="3.5" fill={VIOLET} />
        </g>
      ))}
      <rect x="344" y="58" width="196" height="164" rx="16" className={CARD} />
      <rect x="360" y="74" width="36" height="36" rx="10" fill={VIOLET} fillOpacity=".16" />
      <Flag x={368} y={82} width={20} height={20} className="text-[#5B3FC4] dark:text-[#A58CF5]" />
      <circle cx="510" cy="92" r="16" strokeWidth="5" fill="none" className="stroke-border" />
      <circle
        cx="510"
        cy="92"
        r="16"
        stroke={VIOLET}
        strokeWidth="5"
        fill="none"
        strokeDasharray="64.3 100.5"
        strokeLinecap="round"
        transform="rotate(-90 510 92)"
      />
      <OnboardingArtText x={360} y={137} width={164} size={15} weight={600}>
        {t('initiative')}
      </OnboardingArtText>
      <rect x="360" y="148" width="140" height="6" rx="3" className={LINE} />
      <rect x="360" y="164" width="84" height="20" rx="10" fill={VIOLET} fillOpacity=".16" />
      <OnboardingArtText
        x={370}
        y={177.5}
        width={70}
        size={10.5}
        weight={600}
        className="fill-[#5B3FC4] dark:fill-[#A58CF5]"
      >
        {tHealth('on_track')}
      </OnboardingArtText>
      <rect x="360" y="198" width="164" height="8" rx="4" className={SOFT} />
      <rect x="360" y="198" width="105" height="8" rx="4" fill={VIOLET} />
      <OnboardingSparkle x={560} y={48} size={9} color={VIOLET} />
      <OnboardingSparkle x={46} y={40} size={7} color={VIOLET} />
    </svg>
  );
}
