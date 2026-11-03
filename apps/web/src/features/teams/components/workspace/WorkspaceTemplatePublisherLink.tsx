'use client';

import { useState } from 'react';
import WorkspaceTemplatePublisherCode from './WorkspaceTemplatePublisherCode';
import WorkspaceTemplatePublisherEmail from './WorkspaceTemplatePublisherEmail';

// Links the workspace to the gallery: the gallery emails a code to the address, and the
// code confirms it.
export default function WorkspaceTemplatePublisherLink({
  workspaceId,
  defaultEmail,
  onLinked,
  onCancel,
}: {
  workspaceId: number;
  defaultEmail: string;
  onLinked: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [codeSent, setCodeSent] = useState(false);

  return codeSent ? (
    <WorkspaceTemplatePublisherCode
      workspaceId={workspaceId}
      email={email}
      onChangeEmail={() => setCodeSent(false)}
      onLinked={onLinked}
      onCancel={onCancel}
    />
  ) : (
    <WorkspaceTemplatePublisherEmail
      workspaceId={workspaceId}
      email={email}
      onEmailChange={setEmail}
      onSent={() => setCodeSent(true)}
      onCancel={onCancel}
    />
  );
}
