import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type CustomField, type CustomFieldType, type MemberScope } from '@/lib/api';
import { cn } from '@/lib/utils';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  FIELD_TYPES,
  FIELD_TYPE_ICONS,
  MEMBER_SCOPES,
  useFieldTypeLabel,
} from '../../utils/fieldTypes';
import FieldChangeWarning from './FieldChangeWarning';
import FieldOptionsEditor, { parseOptionValues, type OptionDraft } from './FieldOptionsEditor';

export interface FieldFormValues {
  name: string;
  fieldType: CustomFieldType;
  memberScope?: MemberScope;
  showInBody: boolean;
  options: { id?: number; value: string }[];
}

const CHOICE_CLASS =
  'rounded-md text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const CHOICE_ON = 'bg-primary/10 font-medium text-foreground';
const CHOICE_OFF = 'text-muted-foreground hover:bg-accent hover:text-accent-foreground';

function holdsOptions(fieldType: CustomFieldType): boolean {
  return fieldType === 'select' || fieldType === 'multi_select';
}

// The dialog that adds or edits one custom field: its name, its type picked from a
// grid, the settings that type brings (the options of a select, who a member field
// holds), and where it renders on the issue. Everything stays editable afterwards;
// a change that the values already stored cannot survive says so before it is saved.
export default function SettingsCustomFieldDialog({
  group,
  initial,
  onSubmit,
  onClose,
}: {
  // The group the field belongs to, named in the dialog header: an issue type or
  // the project-wide scope.
  group: string;
  // The field being edited; absent while adding one.
  initial?: CustomField;
  onSubmit: (values: FieldFormValues) => void;
  onClose: () => void;
}) {
  const t = useTranslations('settings.customFields');
  const tCommon = useTranslations('common');
  const fieldTypeLabel = useFieldTypeLabel();
  const [name, setName] = useState(initial?.name ?? '');
  const [fieldType, setFieldType] = useState<CustomFieldType>(initial?.fieldType ?? 'text');
  const [memberScope, setMemberScope] = useState<MemberScope>(initial?.memberScope ?? 'all');
  const [showInBody, setShowInBody] = useState(initial?.showInBody ?? false);
  const [options, setOptions] = useState<OptionDraft[]>(
    () => initial?.options.map((o) => ({ key: `option-${o.id}`, id: o.id, value: o.value })) ?? [],
  );
  const [pendingOptions, setPendingOptions] = useState('');
  const isMember = fieldType === 'member';

  // What the values issues already hold will not survive. Only an existing field has
  // any, so a new one warns about nothing.
  const typeChanged = initial != null && fieldType !== initial.fieldType;
  const scopeNarrowed =
    initial != null &&
    !typeChanged &&
    isMember &&
    memberScope !== 'all' &&
    memberScope !== initial.memberScope;
  const optionsRemoved = (initial?.options ?? []).some((o) => !options.some((d) => d.id === o.id));

  // Picking a type presets the placement to its default (body for markdown,
  // properties otherwise); the user can still flip it before saving.
  function changeType(next: CustomFieldType) {
    setFieldType(next);
    setShowInBody(next === 'markdown');
  }

  function submit() {
    if (!name.trim()) return;
    const typed = parseOptionValues(pendingOptions).map((value) => ({ value }));
    onSubmit({
      name: name.trim(),
      fieldType,
      memberScope: isMember ? memberScope : undefined,
      showInBody,
      options: holdsOptions(fieldType)
        ? [
            ...options.map((o) => ({ id: o.id, value: o.value.trim() })).filter((o) => o.value),
            ...typed,
          ]
        : [],
    });
  }

  return (
    <Modal title={t(initial ? 'editField' : 'addField')} crumb={group} onClose={onClose} wide>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="custom-field-name">{tCommon('name')}</Label>
          <Input
            id="custom-field-name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="h-9"
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('type')}</Label>
            <div
              role="radiogroup"
              aria-label={t('type')}
              className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3"
            >
              {FIELD_TYPES.map((option) => {
                const Icon = FIELD_TYPE_ICONS[option];
                const active = option === fieldType;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeType(option)}
                    className={cn(
                      CHOICE_CLASS,
                      'flex h-9 items-center gap-2 px-2.5',
                      active ? CHOICE_ON : CHOICE_OFF,
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{fieldTypeLabel(option)}</span>
                  </button>
                );
              })}
            </div>
            {typeChanged && <FieldChangeWarning>{t('typeChangeWarning')}</FieldChangeWarning>}
          </div>

          {holdsOptions(fieldType) && (
            <div className="space-y-1.5">
              <FieldOptionsEditor
                options={options}
                onChange={setOptions}
                pending={pendingOptions}
                onPendingChange={setPendingOptions}
              />
              {optionsRemoved && (
                <FieldChangeWarning>{t('optionsRemovedWarning')}</FieldChangeWarning>
              )}
            </div>
          )}

          {isMember && (
            <div className="space-y-1.5">
              <Label>{t('memberScope')}</Label>
              <div role="radiogroup" aria-label={t('memberScope')} className="flex flex-wrap gap-1">
                {MEMBER_SCOPES.map((scope) => {
                  const active = scope === memberScope;
                  return (
                    <button
                      key={scope}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMemberScope(scope)}
                      className={cn(CHOICE_CLASS, 'h-8 px-2.5', active ? CHOICE_ON : CHOICE_OFF)}
                    >
                      {t(`memberScopes.${scope}`)}
                    </button>
                  );
                })}
              </div>
              {scopeNarrowed && <FieldChangeWarning>{t('memberScopeWarning')}</FieldChangeWarning>}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 pt-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="text-sm">{t('mainInfo')}</span>
              <span className="block text-xs text-muted-foreground">{t('mainInfoTooltip')}</span>
            </span>
            <Switch checked={showInBody} onCheckedChange={setShowInBody} />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {tCommon(initial ? 'save' : 'add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
