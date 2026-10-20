import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { useSidebarSide } from '@/hooks/useSidebarSide';
import ResizeGrip from '@/components/common/ResizeGrip';
import { PopoverContent } from '@/components/ui/popover';
import { useSidebar } from '@/components/ui/sidebar';
import type { ProjectSwitcherScope } from './ProjectSwitcher';
import ProjectSwitcherList from './ProjectSwitcherList';
import ProjectSwitcherNav from './ProjectSwitcherNav';
import {
  PROJECT_PICKER_WIDTH,
  type useProjectSwitcherPreferences,
} from './hooks/useProjectSwitcherPreferences';

export default function ProjectSwitcherMenu({
  workspaces,
  workspace,
  teams,
  scope,
  onScopeChange,
  onPickWorkspace,
  currentProjectKey,
  recentIds,
  preferences,
  onSelectProject,
  onClose,
}: {
  workspaces: WorkspaceSummary[];
  workspace?: WorkspaceSummary;
  teams: Team[];
  scope: ProjectSwitcherScope;
  onScopeChange: (scope: ProjectSwitcherScope) => void;
  onPickWorkspace: (workspaceId: number) => void;
  currentProjectKey: string | null;
  recentIds: number[];
  preferences: ReturnType<typeof useProjectSwitcherPreferences>;
  onSelectProject: (key: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('nav');
  const { isMobile } = useSidebar();
  const sidebarSide = useSidebarSide();
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeStart = useRef(preferences.width);
  const inputRef = useRef<HTMLInputElement>(null);
  const side = sidebarSide === 'left' ? 'right' : 'left';

  return (
    <PopoverContent
      ref={contentRef}
      aria-label={t('projects')}
      className="group/picker flex h-[min(600px,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-lg p-0 md:flex-row"
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
        if (isMobile) contentRef.current?.focus();
        else inputRef.current?.focus();
      }}
    >
      <ProjectSwitcherNav
        workspaces={workspaces}
        workspace={workspace}
        teams={teams}
        scope={scope}
        onScopeChange={onScopeChange}
        onPickWorkspace={onPickWorkspace}
        onClose={onClose}
      />
      <ProjectSwitcherList
        workspace={workspace}
        teams={teams}
        scope={scope}
        currentProjectKey={currentProjectKey}
        recentIds={recentIds}
        sort={preferences.sort}
        onSortChange={preferences.setSort}
        onSelectProject={onSelectProject}
        inputRef={inputRef}
      />
      {!isMobile && (
        <ResizeGrip
          label={t('projectPicker.resize')}
          className="absolute inset-y-0 right-0 touch-none group-data-[side=left]/picker:right-auto group-data-[side=left]/picker:left-0"
          onDrag={(delta) => {
            const direction = contentRef.current?.dataset.side === 'left' ? -1 : 1;
            preferences.setWidth(resizeStart.current + delta * direction);
          }}
          onReset={() => preferences.setWidth(PROJECT_PICKER_WIDTH.initial)}
        />
      )}
    </PopoverContent>
  );
}
