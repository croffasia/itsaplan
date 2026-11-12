import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PRO_URL } from '@/utils/app';

export default function OnboardingFooter({
  count,
  index,
  proLink,
  onGo,
  onDone,
}: {
  count: number;
  index: number;
  proLink: boolean;
  onGo: (index: number) => void;
  onDone: () => void;
}) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const last = index === count - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-5 py-3.5">
      <div className="flex items-center">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={t('goTo', { number: i + 1 })}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => onGo(i)}
            className="flex rounded-full px-[3px] py-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <span
              className={cn(
                'h-2 rounded-full transition-[width,background-color] duration-300',
                i === index ? 'w-5 bg-foreground' : 'w-2 bg-muted-foreground/35',
              )}
            />
          </button>
        ))}
      </div>
      <div className="ms-auto flex items-center gap-2">
        {index > 0 && (
          <Button variant="ghost" onClick={() => onGo(index - 1)}>
            {tCommon('back')}
          </Button>
        )}
        {proLink && (
          <Button asChild className="bg-pro text-pro-foreground hover:bg-pro/90">
            <a href={PRO_URL} target="_blank" rel="noreferrer">
              {t('getInPro')}
              <ArrowUpRight className="opacity-70" />
            </a>
          </Button>
        )}
        {last ? (
          <Button onClick={onDone}>{t('start')}</Button>
        ) : (
          <Button onClick={() => onGo(index + 1)}>
            {t('next')}
            <ArrowRight className="rtl:rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}
