import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = 'all';

// The project a dashboard is narrowed to, or null for every project it reads.
export default function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: { projectId: number; name: string }[];
  value: number | null;
  onChange: (projectId: number | null) => void;
}) {
  const t = useTranslations('agentAnalytics');
  return (
    <Select
      value={value == null ? ALL : String(value)}
      onValueChange={(next) => onChange(next === ALL ? null : Number(next))}
    >
      <SelectTrigger className="w-48" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('allProjects')}</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.projectId} value={String(project.projectId)}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
