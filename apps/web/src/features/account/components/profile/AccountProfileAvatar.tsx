'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { uploadAvatar, removeAvatar } from '../../services/profile.service';

// The raster image types the API accepts. The API enforces the real limits; this
// only narrows the file picker.
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif';

// The API stores the image and sets the account's image column itself, so the only
// thing left here is to read the session again — that is what every avatar in the
// app renders from.
export default function AccountProfileAvatar() {
  const t = useTranslations('account.profile');
  const tCommon = useTranslations('common');
  const { data: session, refetch: refetchSession } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const user = session?.user;
  const image = user?.image ?? null;
  const maxAvatarMb = useStorageSettingsQuery().data?.maxAvatarMb;

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: async () => {
      await refetchSession();
      toast.success(t('avatarUpdated'));
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('avatarUploadFailed')),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: async () => {
      await refetchSession();
      toast.success(t('avatarRemoved'));
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('avatarRemoveFailed')),
  });

  const busy = uploadMutation.isPending || removeMutation.isPending;

  function uploadLabel() {
    if (uploadMutation.isPending) return t('uploading');
    return image ? t('change') : t('upload');
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    if (maxAvatarMb && file.size > maxAvatarMb * 1024 * 1024) {
      setError(t('avatarTooLarge', { mb: maxAvatarMb }));
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={user?.name || user?.email || '?'} image={image} className="size-16 text-lg" />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {uploadLabel()}
          </Button>
          {image && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => {
                setError(null);
                removeMutation.mutate();
              }}
            >
              <Trash2 className="size-3.5" />
              {tCommon('delete')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('avatarFormats')}
          {maxAvatarMb ? ` ${t('avatarMaxSize', { mb: maxAvatarMb })}` : ''}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
