'use client';

import * as React from 'react';
import type { useTranslations } from 'next-intl';
import type {
  DocxCommentCardRenderProps,
  DocxDocumentTheme,
  DocxTrackedChangeCardRenderProps,
} from '@extend-ai/react-docx';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// The cards are drawn by render callbacks the engine calls, where no hook can
// run, so the viewer hands its translator in.
type ViewerTranslator = ReturnType<typeof useTranslations<'common.documentViewer'>>;
type AnnotationBadgeVariant = 'outline' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
function trackedChangeBadgeVariant(
  kind: DocxTrackedChangeCardRenderProps['change']['kind'],
): AnnotationBadgeVariant {
  switch (kind) {
    case 'insertion':
    case 'move-to':
      return 'success';
    case 'deletion':
    case 'move-from':
      return 'error';
    default:
      return 'warning';
  }
}
function trackedChangeBadgeLabel(
  { change, kindLabel }: Pick<DocxTrackedChangeCardRenderProps, 'change' | 'kindLabel'>,
  t: ViewerTranslator,
) {
  switch (change.kind) {
    case 'insertion':
      return t('inserted');
    case 'deletion':
      return t('removed');
    case 'move-from':
      return t('movedFrom');
    case 'move-to':
      return t('movedTo');
    default:
      return kindLabel;
  }
}
function DocxAnnotationCard({
  anchorText,
  badge,
  badgeVariant = 'outline',
  date,
  meta,
  documentTheme,
  snippet,
  style,
}: {
  anchorText?: string;
  badge: string;
  badgeVariant?: AnnotationBadgeVariant;
  date?: string;
  documentTheme: DocxDocumentTheme;
  meta: string;
  snippet: string;
  style: React.CSSProperties;
}) {
  const isDarkDocument = documentTheme === 'dark';
  const cardStyle: React.CSSProperties = {
    ...style,
    backgroundColor: isDarkDocument ? 'rgb(24 24 27 / 0.95)' : 'rgb(255 255 255 / 0.95)',
    color: isDarkDocument ? '#f4f4f5' : '#18181b',
  };
  const mutedTextColor = isDarkDocument ? '#a1a1aa' : '#71717a';
  const anchorStyle: React.CSSProperties = {
    backgroundColor: isDarkDocument ? 'rgb(63 63 70 / 0.55)' : 'rgb(244 244 245 / 0.75)',
    color: mutedTextColor,
  };
  return (
    <Card
      style={cardStyle}
      className="pointer-events-auto box-border gap-2 rounded-lg p-2 shadow-sm before:rounded-[7px]"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div
          className="min-w-0 text-[11px] leading-tight font-medium"
          style={{ color: mutedTextColor }}
        >
          <div className="truncate">{meta}</div>
          {date ? <div className="mt-0.5 truncate">{date}</div> : null}
        </div>
        <Badge
          variant={badgeVariant === 'outline' ? 'outline' : 'secondary'}
          className={cn(
            'h-4 px-1 text-[10px]',
            cn(
              'max-w-[92px] truncate',
              badgeVariant === 'success' && 'bg-green-500/10 text-green-700 dark:text-green-300',
              badgeVariant === 'error' && 'bg-destructive/10 text-destructive',
              badgeVariant === 'warning' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
              badgeVariant === 'info' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
            ),
          )}
        >
          {badge}
        </Badge>
      </div>
      {anchorText ? (
        <div className="rounded-md px-2 py-1 text-[11px] leading-snug italic" style={anchorStyle}>
          {anchorText}
        </div>
      ) : null}
      <div className="text-xs leading-snug break-words">{snippet}</div>
    </Card>
  );
}
export function createDocxTrackedChangeCardRenderer(
  documentTheme: DocxDocumentTheme,
  t: ViewerTranslator,
) {
  return function renderDocxTrackedChangeCard({
    change,
    formattedDate,
    kindLabel,
    snippet,
    style,
  }: DocxTrackedChangeCardRenderProps) {
    return (
      <DocxAnnotationCard
        badge={trackedChangeBadgeLabel({ change, kindLabel }, t)}
        badgeVariant={trackedChangeBadgeVariant(change.kind)}
        date={formattedDate}
        documentTheme={documentTheme}
        meta={change.author?.trim() || t('unknownAuthor')}
        snippet={snippet}
        style={style}
      />
    );
  };
}
export function createDocxCommentCardRenderer(
  documentTheme: DocxDocumentTheme,
  t: ViewerTranslator,
) {
  return function renderDocxCommentCard({
    comment,
    formattedDate,
    snippet,
    style,
  }: DocxCommentCardRenderProps) {
    const badge = comment.resolved
      ? t('resolved')
      : comment.parentId !== undefined
        ? t('reply')
        : t('comment');
    return (
      <DocxAnnotationCard
        anchorText={comment.anchorText}
        badge={badge}
        badgeVariant={comment.resolved ? 'secondary' : 'info'}
        date={formattedDate}
        documentTheme={documentTheme}
        meta={comment.author?.trim() || t('unknownAuthor')}
        snippet={snippet}
        style={style}
      />
    );
  };
}
