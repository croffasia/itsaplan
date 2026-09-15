export function ColumnSearchHighlight({
  text,
  ranges,
}: {
  text: string;
  ranges: { start: number; end: number }[];
}) {
  let offset = 0;
  const parts = ranges.flatMap((range) => {
    const before = text.slice(offset, range.start);
    offset = range.end;
    return [
      before,
      <mark
        key={`${range.start}:${range.end}`}
        className="rounded-xs bg-secondary font-semibold text-foreground"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    ];
  });
  return (
    <>
      {parts}
      {text.slice(offset)}
    </>
  );
}
