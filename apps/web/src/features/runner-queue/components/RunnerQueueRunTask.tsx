import Markdown from '@/components/common/Markdown';
import RunnerQueueCopyButton from './RunnerQueueCopyButton';

export default function RunnerQueueRunTask({ prompt }: { prompt: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 text-sm">
        <Markdown>{prompt}</Markdown>
      </div>
      <RunnerQueueCopyButton text={prompt} />
    </div>
  );
}
