import VexolMark from '@/components/brand/VexolMark';

export default function SidebarBrandFooter() {
  return (
    <div className="flex w-full items-center gap-2.5 px-2 pt-2 pb-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <VexolMark className="size-9 shrink-0 text-sidebar-foreground" />
      <span className="truncate text-base font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
        Vexol
      </span>
    </div>
  );
}
