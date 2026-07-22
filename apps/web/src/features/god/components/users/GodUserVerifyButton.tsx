'use client';

import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useVerifyInstanceUserEmail } from '../../services/god.service';

// Confirms an account's email address on the owner's behalf, for a user who cannot
// open the confirmation link (no mail provider, a lost message, a manual signup).
export default function GodUserVerifyButton({ userId }: { userId: string }) {
  const verify = useVerifyInstanceUserEmail();

  async function run() {
    try {
      await verify.mutateAsync(userId);
      toast.success('Email address confirmed');
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={verify.isPending}
      onClick={(e) => {
        e.stopPropagation();
        void run();
      }}
    >
      <MailCheck />
      {verify.isPending ? 'Confirming…' : 'Mark verified'}
    </Button>
  );
}
