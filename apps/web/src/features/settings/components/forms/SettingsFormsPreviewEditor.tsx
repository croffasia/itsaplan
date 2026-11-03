'use client';

import {
  CalendarDays,
  CircleChevronDown,
  GripVertical,
  Plus,
  TextAlignStart,
  Type,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SettingsFormsPreviewForm from './SettingsFormsPreviewForm';

const TABS = ['form', 'questions', 'issue', 'design'] as const;

const QUESTIONS = [
  { Icon: Type, width: '45%' },
  { Icon: TextAlignStart, width: '60%' },
  { Icon: CircleChevronDown, width: '35%' },
  { Icon: CalendarDays, width: '50%' },
];

// The editor of a new form, open on its questions, beside the form as it is filled in.
export default function SettingsFormsPreviewEditor() {
  const t = useTranslations('sections.previews.forms');
  const tCommon = useTranslations('common');

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-5">
      <h2 className="text-base font-semibold">{t('new')}</h2>
      <div className="grid gap-6 md:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <Tabs value="questions" className="gap-0">
          <TabsList variant="line">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(`tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="space-y-2.5 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t('questionsHint')}</p>
              <span className="flex h-7 items-center gap-1.5 px-2 text-sm text-muted-foreground">
                <Plus className="size-4" />
                {tCommon('add')}
              </span>
            </div>
            <div className="rounded-md border">
              {QUESTIONS.map(({ Icon, width }) => (
                <div
                  key={width}
                  className="flex h-10 items-center gap-2.5 border-b px-2 last:border-b-0"
                >
                  <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <Skeleton className="h-3.5" style={{ width }} />
                  <Skeleton className="ms-auto h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </Tabs>
        <SettingsFormsPreviewForm />
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <Skeleton className="h-5 w-9 rounded-full" />
        <span className="text-sm">{t('enabled')}</span>
        <Skeleton className="ms-auto h-9 w-28" />
      </div>
    </section>
  );
}
