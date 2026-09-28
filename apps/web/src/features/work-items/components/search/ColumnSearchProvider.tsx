import { useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { WorkItemsViewProps } from '@/utils/project';
import { ShellCtx } from '@/context/shellContext';
import { ColumnSearchContext } from '../../context/columnSearchContext';
import { useColumnSearch } from '../../hooks/useColumnSearch';
import { ColumnSearchSurface } from './ColumnSearchSurface';

export function ColumnSearchProvider({
  children,
  board,
  scope,
}: {
  children: ReactNode;
  board: WorkItemsViewProps;
  scope: string;
}) {
  const pathname = usePathname();
  const shell = useContext(ShellCtx);
  const search = useColumnSearch(board, `${shell?.viewerId ?? 'public'}:${scope}`, pathname);
  return (
    <ColumnSearchContext.Provider value={search}>
      {children}
      <ColumnSearchSurface />
    </ColumnSearchContext.Provider>
  );
}
