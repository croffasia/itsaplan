import type { ReactNode } from 'react';
import { BrandPanel } from '@/cloud';
import { Card, CardContent } from '@/components/ui/card';

// The card of the screens a person meets outside the app: sign-in, an invite, an app
// asking for their account. `footer` goes under the card.
export default function BrandCardPage({
  subtitle,
  footer,
  children,
}: {
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-4 md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            {children}
            <BrandPanel subtitle={subtitle} />
          </CardContent>
        </Card>
        {footer}
      </div>
    </div>
  );
}
