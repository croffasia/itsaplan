import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ModelPrice, ModelPriceRow } from '@/lib/api/endpoints/modelPrices';
import { useDeleteModelPrice, useSetModelPrice } from '@/services/modelPrices.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRate } from '../../utils/format';

type Field = keyof ModelPrice;

const FIELDS: Field[] = ['input', 'output', 'cacheRead', 'cacheWrite'];

// A cache rate may be left empty: those tokens are then billed at the input rate.
const OPTIONAL: ReadonlySet<Field> = new Set(['cacheRead', 'cacheWrite']);

const asText = (value: number | null | undefined) => (value == null ? '' : String(value));

// A field's rate: null when it is left empty, undefined when it holds no price.
function rateOf(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

// Sets the workspace's price for one model, starting from the price its calls are
// costed at now. A price the workspace set can be dropped, back to the built-in one.
export default function ModelPriceDialog({
  workspaceId,
  row,
  onClose,
}: {
  workspaceId: number;
  row: ModelPriceRow;
  onClose: () => void;
}) {
  const t = useTranslations('teams.workspace.modelPrices');
  const tCommon = useTranslations('common');
  const start = row.own ?? row.builtIn;
  const [text, setText] = useState<Record<Field, string>>({
    input: asText(start?.input),
    output: asText(start?.output),
    cacheRead: asText(start?.cacheRead),
    cacheWrite: asText(start?.cacheWrite),
  });
  const save = useSetModelPrice(workspaceId);
  const remove = useDeleteModelPrice(workspaceId);
  const busy = save.isPending || remove.isPending;

  const rates: Record<Field, number | null | undefined> = {
    input: rateOf(text.input),
    output: rateOf(text.output),
    cacheRead: rateOf(text.cacheRead),
    cacheWrite: rateOf(text.cacheWrite),
  };
  const valid = FIELDS.every(
    (field) => rates[field] !== undefined && (OPTIONAL.has(field) || rates[field] !== null),
  );

  async function submit() {
    if (!valid) return;
    // An own price may cover the model under another spelling, such as its undated name.
    const { provider, model } = row.own ?? row;
    await save.mutateAsync({
      provider,
      model,
      input: rates.input!,
      output: rates.output!,
      cacheRead: rates.cacheRead ?? null,
      cacheWrite: rates.cacheWrite ?? null,
    });
    onClose();
  }

  async function dropOwn() {
    if (!row.own) return;
    await remove.mutateAsync(row.own.id);
    onClose();
  }

  return (
    <Modal title={row.own ? t('editTitle') : t('setTitle')} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <p className="w-fit max-w-full rounded-md bg-muted px-2 py-1 font-mono text-xs break-all">
            {row.provider} / {row.model}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('perMillion')}{' '}
            {row.builtIn
              ? t('builtInPrice', {
                  input: formatRate(row.builtIn.input),
                  output: formatRate(row.builtIn.output),
                })
              : t('noBuiltInPrice')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`model-price-${field}`}>{t(`columns.${field}`)}</Label>
              <Input
                id={`model-price-${field}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required={!OPTIONAL.has(field)}
                autoFocus={field === 'input'}
                value={text[field]}
                onChange={(event) => setText((prev) => ({ ...prev, [field]: event.target.value }))}
                placeholder={OPTIONAL.has(field) ? t('sameAsInput') : '0.00'}
                aria-invalid={rates[field] === undefined || undefined}
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{t('appliesToPast')}</p>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
          {row.own && (
            <Button type="button" variant="ghost" onClick={dropOwn} disabled={busy}>
              {row.builtIn ? t('useBuiltIn') : t('removePrice')}
            </Button>
          )}
          <div className="ms-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {save.isPending ? tCommon('saving') : t('save')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
