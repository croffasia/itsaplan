import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { GitAccountProvider } from '@/lib/api/endpoints/gitAccounts';
import GitAccountConnectDialog from '@/components/common/git/GitAccountConnectDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';

// Said before a comment that will not reach the repository issue, because its author has
// no account on the host. Connecting one here sends the comment under it; posting here
// only keeps it on the board.
export default function CommentUnsentNotice({
  host,
  onSend,
  onHide,
  onClose,
}: {
  host: { provider: GitAccountProvider; baseUrl: string };
  onSend: () => void;
  onHide: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('issue.comments');
  const [hide, setHide] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const provider = GIT_PROVIDER_CONFIG[host.provider].label;

  function remember() {
    if (hide) onHide();
  }

  return (
    <>
      <Dialog open={!connecting} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('unsentTitle', { provider })}</DialogTitle>
            <DialogDescription>{t('unsentBody', { provider })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:items-center">
            <div className="flex items-center gap-2 sm:me-auto">
              <Checkbox
                id="unsent-comment-hide"
                checked={hide}
                onCheckedChange={(value) => setHide(value === true)}
              />
              <Label htmlFor="unsent-comment-hide" className="font-normal">
                {t('unsentHide')}
              </Label>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                remember();
                onSend();
                onClose();
              }}
            >
              {t('unsentPostHere')}
            </Button>
            <Button
              onClick={() => {
                remember();
                setConnecting(true);
              }}
            >
              {t('unsentConnect', { provider })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GitAccountConnectDialog
        open={connecting}
        onOpenChange={(open) => !open && onClose()}
        host={host}
        onConnected={onSend}
      />
    </>
  );
}
