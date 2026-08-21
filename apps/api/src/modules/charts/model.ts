import { t } from 'elysia';

// The chart spec: the one shape a chart is described in. An agent fills it, the
// endpoint checks it, and the chat draws it from the ```chart fence the agent writes
// into its answer — so this schema is what the model reads as the create_chart
// arguments and every field carries its description.
export const chartSpec = t.Object({
  type: t.Union(
    [
      t.Literal('bar'),
      t.Literal('line'),
      t.Literal('area'),
      t.Literal('pie'),
      t.Literal('radar'),
      t.Literal('radial'),
      t.Literal('scatter'),
      t.Literal('funnel'),
      t.Literal('treemap'),
    ],
    {
      description:
        'How to draw it. `bar` compares categories, `line` and `area` follow a value ' +
        'over time, `pie` and `radial` show parts of a whole, `treemap` shows the same ' +
        'parts when there are too many for a pie, `funnel` shows what is left at each ' +
        'stage, `radar` compares several measures over the same categories, `scatter` ' +
        'puts one number against another. Pie, radial, funnel, and treemap show the ' +
        'first series only.',
    },
  ),
  title: t.Optional(t.String({ maxLength: 200, description: 'Heading shown above the chart.' })),
  x: t.String({
    minLength: 1,
    maxLength: 100,
    description:
      'The key holding the category of each row: the x axis for bar, line, area, and ' +
      'scatter, the slice name for pie, radial, funnel, and treemap, the corner name ' +
      'for radar. On a scatter chart it holds a number, everywhere else a name.',
  }),
  series: t.Array(
    t.Object({
      key: t.String({
        minLength: 1,
        maxLength: 100,
        description: 'The key holding this series’ number in every data row.',
      }),
      label: t.Optional(t.String({ maxLength: 200, description: 'Name shown for the series.' })),
      color: t.Optional(
        t.String({
          maxLength: 30,
          description: 'Hex color such as #6366f1. Left out, the chart palette is used.',
        }),
      ),
      type: t.Optional(
        t.Union([t.Literal('bar'), t.Literal('line'), t.Literal('area')], {
          description:
            'Draws this series as a bar, a line, or an area instead of what `type` says, ' +
            'so one chart can show a count as bars and an average as a line. Read on ' +
            'bar, line, and area charts.',
        }),
      ),
    }),
    { minItems: 1, maxItems: 12, description: 'One entry per measure drawn.' },
  ),
  data: t.Array(t.Record(t.String(), t.Union([t.String(), t.Number(), t.Null()])), {
    minItems: 1,
    maxItems: 500,
    description:
      'The rows, each holding the `x` key and every series key, e.g. { "week": "W12", "created": 8 }.',
  }),
  stacked: t.Optional(
    t.Union([t.Boolean(), t.Literal('percent')], {
      description:
        'Stack the series instead of drawing them side by side. "percent" stacks them ' +
        'as shares of 100%, which shows how a composition shifts rather than how it grew.',
    }),
  ),
  horizontal: t.Optional(
    t.Boolean({
      description:
        'Turn a bar chart on its side, so the categories run down the left. Use it for ' +
        'long category names or a ranking of more than about eight of them.',
    }),
  ),
  curve: t.Optional(
    t.Union([t.Literal('monotone'), t.Literal('linear'), t.Literal('step')], {
      description:
        'The shape a line or an area takes between two points: smoothed, straight, or ' +
        'held until the next value. Default monotone.',
    }),
  ),
  showValues: t.Optional(
    t.Boolean({
      description: 'Print each number on the chart. Leave it off past about a dozen rows.',
    }),
  ),
});
