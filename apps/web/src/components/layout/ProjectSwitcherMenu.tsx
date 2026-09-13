import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import type { Team } from '@/lib/api/endpoints/teams';
import { useSidebarSide } from '@/hooks/useSidebarSide';
import ResizeGrip from '@/components/common/ResizeGrip';
import { PopoverContent } from '@/components/ui/popover';
import { useSidebar } from '@/components/ui/sidebar';
import ProjectSwitcherList from './ProjectSwitcherList';
import ProjectSwitcherToolbar from './ProjectSwitcherToolbar';
import ProjectSwitcherFooter from './ProjectSwitcherFooter';
import type { useProjectSwitcherPreferences } from './hooks/useProjectSwitcherPreferences';

export default function ProjectSwitcherMenu({
  projects,
  teams,
  current,
  preferences,
  openTeams,
  onOpenTeam,
  onSelectProject,
  onClose,
}: {
  projects: Project[];
  teams: Team[];
  current?: Project;
  preferences: ReturnType<typeof useProjectSwitcherPreferences>;
  openTeams: Record<number, boolean>;
  onOpenTeam: (teamId: number, open: boolean) => void;
  onSelectProject: (key: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('nav');
  const { isMobile } = useSidebar();
  const sidebarSide = useSidebarSide();
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeStart = useRef(preferences.width);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHidden, setShowHidden] = useState(false);
  const side = sidebarSide === 'left' ? 'right' : 'left';

  return (
    <PopoverContent
      ref={contentRef}
      aria-label={t('projects')}
      className="group/picker flex max-h-[min(720px,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-lg p-0"
      style={{
        width: preferences.width,
        maxWidth: 'min(calc(100vw - 16px), var(--radix-popover-content-available-width))',
      }}
      align="start"
      side={isMobile ? 'bottom' : side}
      collisionPadding={8}
      onPointerDownCapture={() => {
        resizeStart.current =
          contentRef.current?.getBoundingClientRect().width ?? preferences.width;
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <ProjectSwitcherToolbar preferences={preferences} isMobile={isMobile} />
      <ProjectSwitcherList
        projects={projects}
        teams={teams}
        current={current}
        sort={preferences.sort}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        openTeams={openTeams}
        onOpenTeam={onOpenTeam}
        onSelectProject={onSelectProject}
        inputRef={inputRef}
      />
      <ProjectSwitcherFooter onClose={onClose} />
      {!isMobile && (
        <ResizeGrip
          label={t('projectPicker.resize')}
          className="absolute inset-y-0 right-0 touch-none group-data-[side=left]/picker:right-auto group-data-[side=left]/picker:left-0"
          onDrag={(delta) => {
            const direction = contentRef.current?.dataset.side === 'left' ? -1 : 1;
            preferences.setWidth(resizeStart.current + delta * direction);
          }}
        />
      )}
    </PopoverContent>
  );
}
