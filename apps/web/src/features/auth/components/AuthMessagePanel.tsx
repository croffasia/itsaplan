import type { ReactNode } from 'react';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import AuthFormHeader from './AuthFormHeader';

// A screen that replaces the form: the visitor has nothing left to fill in here and
// the footer is the only way on (open the inbox, go back to sign in).
export default function AuthMessagePanel({
  title,
  description,
  footer,
}: {
  title: string;
  description: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader title={title} description={description} />
        <FieldDescription className="text-center">{footer}</FieldDescription>
      </FieldGroup>
    </div>
  );
}
