import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Globe, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD, GOLD_SOFT, GOLD_STROKE, GOLD_TEXT, SOFT, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';
import OnboardingWorkflowNode from './OnboardingWorkflowNode';

const ARROWS = 'M160 98 H192 M326 98 H358 M427 126 V168 M492 200 H512';
const HEADS =
  'M187 94 L192 98 L187 102 M353 94 L358 98 L353 102 M423 163 L427 168 L431 163 M507 196 L512 200 L507 204';

// A workflow on its canvas: a trigger hands the issue to one agent, a second one checks the
// work and can send it back, then a request goes out; the current run below.
export default function OnboardingWorkflowsArt() {
  const t = useTranslations('onboarding.art.workflows');
  const tStates = useTranslations('onboarding.art.states');
  const dots = `${useId().replace(/[^a-zA-Z0-9]/g, '')}dots`;
  const steps = [
    {
      x: 54,
      width: 54,
      label: t('writer'),
      className: 'fill-[#22A06B]/16',
      text: 'fill-[#1A7F50] dark:fill-[#4ADE80]',
    },
    { x: 112, width: 70, label: t('reviewer'), className: GOLD_SOFT, text: GOLD_TEXT },
    { x: 188, width: 66, label: t('request'), className: SOFT, text: SUB },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern id={dots} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" className="fill-border" />
        </pattern>
      </defs>
      <rect x="24" y="16" width="552" height="248" rx="16" className={CARD} />
      <rect x="24" y="16" width="552" height="248" rx="16" fill={`url(#${dots})`} />
      <OnboardingArtText x={44} y={42} width={84} size={12} weight={600}>
        {t('name')}
      </OnboardingArtText>
      <rect x="134" y="30" width="34" height="17" rx="8.5" className={GOLD_SOFT} />
      <text
        x="151"
        y="42"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        className={GOLD_TEXT}
      >
        {t('on')}
      </text>
      <path d={ARROWS} strokeWidth="1.5" fill="none" className="stroke-muted-foreground" />
      <path
        d={HEADS}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-muted-foreground"
      />
      <path
        d="M392 126 C 392 158, 262 158, 262 131"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        fill="none"
        className={GOLD_STROKE}
      />
      <path
        d="M258 136 L262 130 L266 136"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={GOLD_STROKE}
      />
      <rect
        x="281"
        y="142"
        width="92"
        height="18"
        rx="9"
        strokeWidth="1"
        className={cn('fill-card', GOLD_STROKE)}
      />
      <OnboardingArtText x={290} y={154.5} width={78} size={9.5} weight={600} className={GOLD_TEXT}>
        {t('sendBack')}
      </OnboardingArtText>

      <OnboardingWorkflowNode
        x={40}
        y={70}
        width={120}
        Icon={Zap}
        title={t('trigger')}
        sub={t('issueEvent')}
      />
      <OnboardingWorkflowNode
        x={196}
        y={70}
        width={130}
        Icon={Bot}
        title={t('writer')}
        sub={t('draftNotes')}
        state="done"
      />
      <OnboardingWorkflowNode
        x={362}
        y={70}
        width={130}
        Icon={Bot}
        title={t('reviewer')}
        sub={t('checkDraft')}
        state="running"
      />
      <OnboardingWorkflowNode
        x={362}
        y={172}
        width={130}
        Icon={Globe}
        title={t('request')}
        sub="POST /notes"
        state="waiting"
      />
      <rect x="516" y="185" width="52" height="30" rx="15" className={SOFT} />
      <text x="542" y="203.5" textAnchor="middle" fontSize="10" fontWeight="600" className={SUB}>
        {tStates('done')}
      </text>

      <rect x="40" y="176" width="280" height="72" rx="12" className={cn(CARD, 'stroke-border')} />
      <OnboardingArtText x={54} y={198} width={250} size={10.5} weight={600}>
        {t('run', { number: 48 })}
      </OnboardingArtText>
      <OnboardingArtText x={54} y={213} width={250} size={9.5} weight={400} className={SUB}>
        {t('running', { step: t('reviewer'), round: 2 })}
      </OnboardingArtText>
      {steps.map((step) => (
        <g key={step.x}>
          <rect
            x={step.x}
            y="224"
            width={step.width}
            height="16"
            rx="8"
            className={step.className}
          />
          <OnboardingArtText
            x={step.x + 7}
            y={235.5}
            width={step.width - 12}
            size={9}
            weight={600}
            className={step.text}
          >
            {step.label}
          </OnboardingArtText>
        </g>
      ))}
      <OnboardingSparkle x={560} y={36} size={8} color="#E9A52A" />
    </svg>
  );
}
