import Avatar from '@/components/common/Avatar';

export default function RunnerQueueRunPerson({
  name,
  image,
  label,
}: {
  name: string;
  image?: string | null;
  label: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar name={name} image={image} />
      <span className="min-w-0 break-all">{label}</span>
    </span>
  );
}
