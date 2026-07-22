import ItsAPlanMark from '@/components/brand/ItsAPlanMark';

// The product mark at the bottom of both sidebars. Collapses to the mark alone
// when the sidebar is in icon mode.
export default function SidebarBrandFooter() {
  return (
    <div className="flex items-center gap-2.5 px-2 pt-2 pb-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <ItsAPlanMark className="size-9 shrink-0 text-sidebar-foreground" />
      <div className="grid leading-none group-data-[collapsible=icon]:hidden">
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          It&apos;s a Plan
        </span>
        <span className="mt-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Self-hosted
        </span>
      </div>
    </div>
  );
}
