'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import AuthFormHeader from '../AuthFormHeader';
import AuthMessagePanel from '../AuthMessagePanel';
import { sendPasswordResetEmail } from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';

// Asks for the address and mails a reset link. The answer is the same whether or not
// an account exists, so this screen never tells the visitor which it was.
export default function AuthForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { error, pending, run } = useAuthAction();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    run(
      async () => {
        await sendPasswordResetEmail(email);
        setSent(true);
      },
      { redirect: false },
    );
  }

  if (sent) {
    return (
      <AuthMessagePanel
        title="Check your email"
        description={`If an account exists for ${email}, a reset link is on its way.`}
        footer={
          <Link href="/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader
          title="Reset your password"
          description="We will email you a link to set a new one"
        />

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Remembered it?{' '}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
