'use client';

import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import DocumentDetailsOwnerPicker from './DocumentDetailsOwnerPicker';
import DocumentDetailsValue from './DocumentDetailsValue';

// The page owner. Whoever may manage the page hands it to another member from here.
export default function DocumentDetailsOwner({
  projectKey,
  ownerId,
  name,
  image,
  onTransfer,
}: {
  projectKey: string;
  ownerId: string | null;
  name: string;
  image: string | null;
  onTransfer?: (userId: string) => void;
}) {
  const t = useTranslations('documents');
  const value = (
    <DocumentDetailsValue
      interactive={Boolean(onTransfer)}
      title={t('inspector.transferOwnership')}
    >
      <Avatar name={name} image={image} />
      <span className="truncate" dir="auto">
        {name}
      </span>
    </DocumentDetailsValue>
  );
  if (!onTransfer) return value;
  return (
    <DocumentDetailsOwnerPicker
      projectKey={projectKey}
      ownerId={ownerId}
      trigger={value}
      onPick={onTransfer}
    />
  );
}
