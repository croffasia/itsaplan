import type { CustomField } from '@/lib/api/endpoints/customFields';
import { colorDot } from '@/components/common/fields/colorDot';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';
import { useTranslations } from 'next-intl';

// A select or multi-select custom field as a pill with the chosen values, opening the
// field's options. A multi-select keeps the list open while options are toggled.
export default function IssueCustomFieldOptionsPick({
  def,
  optionIds,
  onChange,
  defaultOpen,
}: {
  def: CustomField;
  optionIds: number[];
  onChange: (optionIds: number[]) => void;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('issue.customFields');
  const tFields = useTranslations('issue.fields');
  const multi = def.fieldType === 'multi_select';
  const chosen = def.options.filter((o) => optionIds.includes(o.id));

  return (
    <PopoverPick
      defaultOpen={defaultOpen}
      closeOnSelect={!multi}
      trigger={
        <Pill active={chosen.length > 0}>
          <span className="truncate" dir="auto">
            {chosen.length > 0 ? chosen.map((o) => o.value).join(', ') : tFields('empty')}
          </span>
        </Pill>
      }
      inputPlaceholder={t('pickOption')}
      emptyText={t('noOptions')}
      items={[
        ...(multi
          ? []
          : [
              {
                key: 'none',
                search: t('noOption'),
                icon: null,
                label: t('noOption'),
                selected: chosen.length === 0,
                onSelect: () => onChange([]),
              },
            ]),
        ...def.options.map((o) => {
          const selected = optionIds.includes(o.id);
          return {
            key: String(o.id),
            search: o.value,
            icon: colorDot(o.color),
            label: o.value,
            selected,
            onSelect: () => {
              if (!multi) onChange([o.id]);
              else
                onChange(selected ? optionIds.filter((id) => id !== o.id) : [...optionIds, o.id]);
            },
          };
        }),
      ]}
    />
  );
}
