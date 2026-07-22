import { SquareKanban } from 'lucide-react';
import { APP_NAME } from '@/utils/app';

// Branded panel shown beside the form on wide screens, in place of an external
// image — self-contained, no asset. Shared by the auth screens and the invite
// accept screen; the subtitle differs per context.
export default function BrandPanel({
  subtitle = 'Plan issues on a board. Sign in to open your projects.',
}: {
  subtitle?: string;
}) {
  return (
    <div className="relative hidden flex-col items-center justify-center gap-3 bg-primary text-primary-foreground md:flex">
      <SquareKanban className="size-12" />
      <span className="text-lg font-semibold">{APP_NAME}</span>
      <p className="max-w-[16rem] text-center text-sm text-primary-foreground/70">{subtitle}</p>
    </div>
  );
}
