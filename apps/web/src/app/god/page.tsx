import { redirect } from 'next/navigation';
import { godPath } from '@/utils/paths';
import { GOD_SECTIONS } from '@/utils/godSections';

// /god has no page of its own — it opens the first section.
export default function Page() {
  redirect(godPath(GOD_SECTIONS[0]!.slug));
}
