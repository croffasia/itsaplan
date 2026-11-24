import { Clock, Eye, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

// What the app gets: an MCP token acts for the person in every team, and it lasts
// until they disconnect the app.
export default function McpConsentPermissions() {
  const t = useTranslations('mcp.oauth.consent');
  const items = [
    { icon: Eye, text: t('canSee') },
    { icon: Pencil, text: t('canChange') },
    { icon: Clock, text: t('keepsAccess') },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 text-sm">
      <p className="font-medium">{t('actsAs')}</p>
      <ul className="flex flex-col gap-2.5">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
