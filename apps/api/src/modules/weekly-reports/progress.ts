import type { WarningKind, WeeklyReportSettings } from './model';

export interface ReportIssue {
  id: number;
  parentId: number | null;
  typeId: number | null;
  title: string;
  state: string;
  dueDate: string | null;
  fields: Map<number, { number: string | null; text: string | null }>;
}

type Warning = { id: number; title: string; kind: typeof WarningKind.static };

export function reportDates(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return { today, weekStart: monday.toISOString().slice(0, 10) };
}

function parsePercent(raw: string | null | undefined) {
  if (!raw || !/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [integer, fraction = ''] = raw.split('.');
  const whole = Number(integer);
  if (whole > 100 || (whole === 100 && /[1-9]/.test(fraction))) return null;
  return { value: Number(raw), integer, fraction };
}

function weightsTotal100(weights: NonNullable<ReturnType<typeof parsePercent>>[]) {
  const places = weights.reduce((max, weight) => Math.max(max, weight.fraction.length), 0);
  const total = weights.reduce(
    (sum, { integer, fraction }) => sum + BigInt(integer + fraction.padEnd(places, '0')),
    0n,
  );
  return total === 100n * 10n ** BigInt(places);
}

function displayProgress(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

export function calculateProgress(
  issues: ReportIssue[],
  settings: WeeklyReportSettings,
  today: string,
) {
  const warnings: Warning[] = [];
  const warn = ({ id, title }: ReportIssue, kind: Warning['kind']) =>
    warnings.push({ id, title, kind });
  const byParent = new Map<number | null, ReportIssue[]>();
  for (const issue of issues) {
    if (issue.state === 'canceled') continue;
    const siblings = byParent.get(issue.parentId);
    if (siblings) siblings.push(issue);
    else byParent.set(issue.parentId, [issue]);
  }

  function weighted(
    parent: ReportIssue,
    children: { issue: ReportIssue; rate: number | null }[],
    weightField: number,
  ) {
    if (!children.length) {
      warn(parent, 'noChildren');
      return null;
    }
    const weights: NonNullable<ReturnType<typeof parsePercent>>[] = [];
    let total = 0;
    for (const { issue, rate } of children) {
      const weight = parsePercent(issue.fields.get(weightField)?.number);
      if (!weight) warn(issue, 'invalidWeight');
      else {
        weights.push(weight);
        if (rate !== null) total += (weight.value * rate) / 100;
      }
    }
    if (weights.length !== children.length) return null;
    if (!weightsTotal100(weights)) {
      warn(parent, 'weightTotal');
      return null;
    }
    return children.some(({ rate }) => rate === null) ? null : total;
  }

  function delay(issue: ReportIssue, field: number) {
    if (issue.state === 'completed' || !issue.dueDate || issue.dueDate >= today) return [];
    const reason = issue.fields.get(field)?.text?.trim();
    if (!reason) {
      warn(issue, 'missingReason');
      return [];
    }
    return [reason];
  }

  const groups = (byParent.get(null) ?? [])
    .filter((issue) => issue.typeId === settings.levelOneTypeId)
    .map((root) => {
      const nodes = (byParent.get(root.id) ?? [])
        .filter((issue) => issue.typeId === settings.levelTwoTypeId)
        .map((node) => {
          const leaves = (byParent.get(node.id) ?? []).filter(
            (issue) => issue.typeId === settings.levelThreeTypeId,
          );
          const rated = leaves.map((issue) => {
            const rate = parsePercent(issue.fields.get(settings.completionRateId)?.number);
            if (!rate) warn(issue, 'invalidRate');
            return { issue, rate: rate?.value ?? null };
          });
          return {
            issue: node,
            rate: weighted(node, rated, settings.levelThreeWeightId),
            reasons: [
              ...delay(node, settings.levelTwoReasonId),
              ...leaves.flatMap((issue) => delay(issue, settings.levelThreeReasonId)),
            ],
          };
        });
      if (nodes.some(({ rate }) => rate === null)) warn(root, 'unavailableChild');
      return {
        id: root.id,
        title: root.title,
        progress: displayProgress(weighted(root, nodes, settings.levelTwoWeightId)),
        nodes: nodes.map(({ issue, rate, reasons }) => ({
          id: issue.id,
          title: issue.title,
          progress: displayProgress(rate),
          reasons,
        })),
      };
    });
  return { groups, warnings };
}

function markdownText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function reportMarkdown(groups: ReturnType<typeof calculateProgress>['groups']) {
  return groups
    .flatMap(({ nodes }) =>
      nodes.map(({ title, progress, reasons }) =>
        [
          `## ${markdownText(title)}`,
          progress === null ? 'Progress unavailable' : `Progress: ${progress}%`,
          reasons.map((reason) => `- ${markdownText(reason)}`).join('\n'),
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
    )
    .join('\n\n');
}
