// A timeline cell's value as the button that opens its editor.
export function TimelineCellButton({ children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="-mx-1 flex h-6 min-w-0 items-center rounded px-1 text-start hover:bg-accent"
      {...props}
    >
      {children}
    </button>
  );
}
