import { redirect } from 'next/navigation';
import { accountPath } from '@/utils/accountSections';

// Old links to a project's notification settings lead here.
export default function Page() {
  redirect(accountPath('notifications'));
}
