import type { ReactNode } from 'react';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import AuthFormHeader from './AuthFormHeader';

export default function AuthMessagePanel({
  title,
  description,
  actions,
  footer,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader title={title} description={description} />
        {actions}
        <FieldDescription className="text-center">{footer}</FieldDescription>
      </FieldGroup>
    </div>
  );
}
