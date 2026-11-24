import { AppWindow, ArrowLeftRight } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import McpConsentTile from './McpConsentTile';

// The app that asks, then this instance. A client sends no logo, so its mark is the
// first letter of the name it registered with.
export default function McpConsentLogos({ clientName }: { clientName: string | null }) {
  const letter = clientName ? Array.from(clientName)[0]!.toUpperCase() : null;
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <McpConsentTile>
        {letter ?? <AppWindow className="size-5 text-muted-foreground" />}
      </McpConsentTile>
      <ArrowLeftRight className="size-4 text-muted-foreground" />
      <McpConsentTile>
        <AppLogo className="size-6" />
      </McpConsentTile>
    </div>
  );
}
