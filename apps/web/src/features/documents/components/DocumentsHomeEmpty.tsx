import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export default function DocumentsHomeEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty className="border p-6 md:p-6">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
