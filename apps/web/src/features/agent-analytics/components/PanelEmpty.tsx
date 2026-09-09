// What a panel shows in place of its content when the window holds nothing for it.
export default function PanelEmpty({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}
