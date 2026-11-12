import { useTranslations } from 'next-intl';
import { Mail, MessageCircle } from 'lucide-react';
import {
  CARD,
  GOLD,
  GOLD_ICON,
  GOLD_SOFT,
  GOLD_STROKE,
  GOLD_TEXT,
  INK,
  LINE,
  SOFT,
  SUB,
} from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';

const FIELD = 'fill-card stroke-border';

// A support form on a client's site, the issue it files and the email that answers it.
export default function OnboardingPortalArt() {
  const t = useTranslations('onboarding.art.portal');

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="36" y="24" width="300" height="232" rx="14" className={CARD} />
      <path d="M36 54 V38 A14 14 0 0 1 50 24 H322 A14 14 0 0 1 336 38 V54 Z" className={SOFT} />
      <circle cx="54" cy="39" r="3.5" fill="#F87171" />
      <circle cx="66" cy="39" r="3.5" fill="#FBBF24" />
      <circle cx="78" cy="39" r="3.5" fill="#34D399" />
      <rect x="96" y="31" width="200" height="16" rx="8" className="fill-card" />
      <text x="108" y="42.5" fontSize="9.5" className={SUB}>
        acme.io/support
      </text>
      <rect x="56" y="70" width="120" height="9" rx="4.5" opacity=".85" className={INK} />
      <rect x="56" y="86" width="180" height="6" rx="3" className={LINE} />
      <rect x="56" y="102" width="260" height="142" rx="12" className={SOFT} />
      <OnboardingArtText x={70} y={124} width={232} size={12} weight={600}>
        {t('contactSupport')}
      </OnboardingArtText>
      <OnboardingArtText x={70} y={142} width={108} size={8.5} className={SUB}>
        {t('name')}
      </OnboardingArtText>
      <rect x="70" y="146" width="108" height="18" rx="5" className={FIELD} />
      <OnboardingArtText x={190} y={142} width={112} size={8.5} className={SUB}>
        {t('email')}
      </OnboardingArtText>
      <rect x="190" y="146" width="112" height="18" rx="5" className={FIELD} />
      <OnboardingArtText x={70} y={178} width={232} size={8.5} className={SUB}>
        {t('message')}
      </OnboardingArtText>
      <rect x="70" y="182" width="232" height="32" rx="5" className={FIELD} />
      <rect x="78" y="191" width="140" height="4" rx="2" className={LINE} />
      <rect x="78" y="201" width="100" height="4" rx="2" className={LINE} />
      <rect x="70" y="220" width="74" height="18" rx="6" className={GOLD} />
      <OnboardingArtText
        x={78}
        y={232.5}
        width={62}
        size={10}
        weight={600}
        className="fill-[#3D2C06]"
      >
        {t('send')}
      </OnboardingArtText>
      <circle cx="318" cy="238" r="14" className={GOLD} />
      <MessageCircle x={310} y={230} width={16} height={16} className="text-[#3D2C06]" />

      <path
        d="M340 150 C 362 150, 360 112, 374 112"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        className={GOLD_STROKE}
      />
      <path
        d="M369 107 L375 112 L369 117"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={GOLD_STROKE}
      />

      <rect x="380" y="62" width="184" height="96" rx="12" className={CARD} />
      <text x="394" y="82" fontSize="9.5" className={`font-mono ${SUB}`}>
        ITS-240
      </text>
      <rect x="490" y="71" width="62" height="16" rx="8" className={GOLD_SOFT} />
      <OnboardingArtText x={497} y={82.5} width={52} size={9} weight={600} className={GOLD_TEXT}>
        {t('request')}
      </OnboardingArtText>
      <OnboardingArtText x={394} y={104} width={160} size={12}>
        {t('issue')}
      </OnboardingArtText>
      <circle cx="401" cy="134" r="8" fill="#C3B5F2" />
      <text x="414" y="137.5" fontSize="9.5" className={SUB}>
        Maria · maria@client.com
      </text>

      <rect x="380" y="172" width="184" height="60" rx="12" className={CARD} />
      <rect x="392" y="188" width="28" height="28" rx="8" className={GOLD_SOFT} />
      <Mail x={398} y={194} width={16} height={16} className={GOLD_ICON} />
      <OnboardingArtText x={430} y={199} width={126} size={10.5} weight={600}>
        {t('replySent')}
      </OnboardingArtText>
      <OnboardingArtText x={430} y={214} width={126} size={9} weight={400} className={SUB}>
        {t('followed')}
      </OnboardingArtText>
      <OnboardingSparkle x={566} y={36} size={8} color="#E9A52A" />
      <OnboardingSparkle x={356} y={252} size={6} color="#E9A52A" />
    </svg>
  );
}
