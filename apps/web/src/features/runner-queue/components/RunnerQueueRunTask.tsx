import CopyButton from '@/components/common/CopyButton';
import Markdown from '@/components/common/Markdown';

export default function RunnerQueueRunTask({ prompt }: { prompt: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 text-sm">
        <Markdown>{prompt}</Markdown>
      </div>
      <CopyButton text={prompt} />
    </div>
  );
}
