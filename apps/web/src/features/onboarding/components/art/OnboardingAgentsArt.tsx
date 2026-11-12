import { useTranslations } from 'next-intl';
import { CARD, INK, LINE, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';

const BLUE = '#2B8FCB';
const STEPS = ['read', 'search', 'pullRequest', 'report'] as const;

// A robot working through an issue: two steps done, one running, one waiting.
export default function OnboardingAgentsArt() {
  const t = useTranslations('onboarding.art');

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="152" y="178" width="88" height="70" rx="22" className={CARD} />
      <circle cx="196" cy="208" r="9" fill={BLUE} fillOpacity=".25" />
      <circle cx="196" cy="208" r="4.5" fill={BLUE} />
      <path d="M196 72 V54" stroke={BLUE} strokeWidth="3" strokeLinecap="round" />
      <circle cx="196" cy="48" r="7" fill={BLUE} />
      <rect x="124" y="106" width="12" height="34" rx="6" fill={BLUE} />
      <rect x="256" y="106" width="12" height="34" rx="6" fill={BLUE} />
      <rect x="136" y="72" width="120" height="100" rx="30" className={CARD} />
      <rect x="152" y="92" width="88" height="58" rx="20" fill="#1E2A38" />
      <rect x="172" y="108" width="12" height="20" rx="6" fill="#7FD3FF" />
      <rect x="208" y="108" width="12" height="20" rx="6" fill="#7FD3FF" />
      <path
        d="M186 138 Q196 144 206 138"
        stroke="#7FD3FF"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="278" cy="120" r="3" fill={BLUE} fillOpacity=".4" />
      <circle cx="292" cy="112" r="4" fill={BLUE} fillOpacity=".6" />
      <circle cx="307" cy="103" r="5" fill={BLUE} fillOpacity=".85" />

      <rect x="320" y="40" width="224" height="200" rx="16" className={CARD} />
      <rect x="336" y="56" width="60" height="20" rx="6" fill={BLUE} fillOpacity=".16" />
      <text
        x="366"
        y="70"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="600"
        className="fill-[#1E6FA3] dark:fill-[#5DB2E6]"
      >
        ITS-42
      </text>
      <text x="528" y="70" textAnchor="end" fontSize="10.5" fontWeight="500" className={SUB}>
        {t('working')}
      </text>
      <rect x="336" y="88" width="164" height="9" rx="4.5" opacity=".8" className={INK} />
      <rect x="336" y="104" width="120" height="6" rx="3" className={LINE} />
      {STEPS.map((step, i) => {
        const cy = 132 + i * 28;
        return (
          <g key={step}>
            {i < 2 && (
              <g>
                <circle cx="346" cy={cy} r="8" fill={BLUE} />
                <path
                  d={`M342.5 ${cy} l2.6 2.6 l4.6 -5`}
                  stroke="#fff"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
            {i === 2 && (
              <g>
                <circle
                  cx="346"
                  cy={cy}
                  r="8"
                  strokeWidth="2.4"
                  fill="none"
                  className="stroke-border"
                />
                <path
                  d={`M346 ${cy - 8} A8 8 0 0 1 354 ${cy}`}
                  stroke={BLUE}
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            )}
            {i === 3 && (
              <circle
                cx="346"
                cy={cy}
                r="8"
                strokeWidth="2"
                strokeDasharray="3 3"
                fill="none"
                className="stroke-muted-foreground"
              />
            )}
            <OnboardingArtText
              x={364}
              y={cy + 4}
              width={168}
              size={12}
              className={i === 3 ? SUB : undefined}
            >
              {t(`steps.${step}`)}
            </OnboardingArtText>
          </g>
        );
      })}
      <OnboardingSparkle x={92} y={52} size={9} color={BLUE} />
      <OnboardingSparkle x={82} y={226} size={6} color={BLUE} />
      <OnboardingSparkle x={566} y={252} size={7} color={BLUE} />
    </svg>
  );
}
