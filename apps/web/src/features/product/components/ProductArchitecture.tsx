import { getTranslations } from 'next-intl/server';
import { AgentRunInfographic, ArchitectureInfographic } from '@/components/brand/infographics';
import ProductSection from './ProductSection';

const NODE_KEYS = ['browser', 'web', 'api', 'worker', 'bot', 'postgres', 'runner', 'mcp'] as const;
const NOTE_KEYS = ['webNote', 'apiNote', 'workerNote', 'botNote', 'runnerNote', 'mcpNote'] as const;

export default async function ProductArchitecture() {
  const t = await getTranslations('product.architecture');
  const nodes = Object.fromEntries(
    [...NODE_KEYS, ...NOTE_KEYS].map((k) => [k, t(`nodes.${k}`)]),
  ) as Record<(typeof NODE_KEYS)[number] | (typeof NOTE_KEYS)[number], string>;
  return (
    <ProductSection id="architecture" title={t('title')} intro={t('body')} className="bg-muted/40">
      <div
        dir="ltr"
        tabIndex={0}
        role="region"
        aria-label={t('figureTitle')}
        className="overflow-x-auto rounded-2xl border bg-card p-4 sm:p-8"
      >
        <div className="min-w-[560px]">
          <ArchitectureInfographic
            labels={{ title: t('figureTitle'), desc: t('figureDesc'), ...nodes }}
          />
        </div>
      </div>
      <h3 className="mt-12 text-xl font-semibold">{t('flowTitle')}</h3>
      <div className="mt-6 rounded-2xl border bg-card p-4 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <AgentRunInfographic
            labels={{
              title: t('flowTitle'),
              desc: t('flowDesc'),
              assign: t('flow.assign'),
              budget: t('flow.budget'),
              run: t('flow.run'),
              result: t('flow.result'),
            }}
          />
        </div>
      </div>
    </ProductSection>
  );
}
