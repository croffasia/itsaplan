import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX_KEY_BYTES = 8192;

type KeyProblem = 'tooLarge' | 'unreadable' | null;

export default function TeamGitHubAppKeyField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const t = useTranslations('settings.git');
  const fileInput = useRef<HTMLInputElement>(null);
  // Counts file picks and mode switches, so a read that ends after either is dropped.
  const readSeq = useRef(0);
  const [pasting, setPasting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [problem, setProblem] = useState<KeyProblem>(null);

  function switchMode() {
    readSeq.current += 1;
    setPasting(!pasting);
    setFileName('');
    setProblem(null);
    onChange('');
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const seq = ++readSeq.current;
    let key = '';
    let failure: KeyProblem = null;
    if (file.size > MAX_KEY_BYTES) failure = 'tooLarge';
    else {
      try {
        key = await file.text();
      } catch {
        failure = 'unreadable';
      }
    }
    if (seq !== readSeq.current) return;
    setProblem(failure);
    setFileName(failure ? '' : file.name);
    onChange(key);
  }

  return (
    <div className="space-y-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {t('nativePrivateKey')}
      </Label>
      {pasting ? (
        <Textarea
          id={id}
          rows={6}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          className="field-sizing-fixed font-mono text-xs break-all"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInput} type="file" accept=".pem" className="hidden" onChange={pick} />
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            aria-labelledby={`${id}-label ${id}`}
            onClick={() => fileInput.current?.click()}
          >
            {t('nativePrivateKeyChooseFile')}
          </Button>
          <p role="status" className="text-xs break-all text-muted-foreground">
            {fileName && t('nativePrivateKeyLoaded', { name: fileName })}
          </p>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {t(problem === 'tooLarge' ? 'nativePrivateKeyTooLarge' : 'nativePrivateKeyUnreadable')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t(pasting ? 'nativePrivateKeyPasteHint' : 'nativePrivateKeyFileHint')}
      </p>
      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={switchMode}>
        {t(pasting ? 'nativePrivateKeyFileInstead' : 'nativePrivateKeyPasteInstead')}
      </Button>
    </div>
  );
}
