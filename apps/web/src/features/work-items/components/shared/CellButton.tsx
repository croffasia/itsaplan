// A cell's value as the button that opens its editor.
export function CellButton({ children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="-mx-1 -my-0.5 grid min-h-6 min-w-0 items-center rounded px-1 text-start hover:bg-accent"
      {...props}
    >
      {children}
    </button>
  );
}
