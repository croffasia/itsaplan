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
        '`bar` compares categories. `line` and `area` show a value over time. `pie` and `radial` ' +
        'show parts of a whole, `treemap` when there are too many parts for a pie. `funnel` ' +
        'shows what is left at each stage. `radar` compares several measures on the same ' +
        'categories. `scatter` plots one number against another. ' +
        'Pie, radial, funnel and treemap show only the first series.',
    },
  ),
  title: t.Optional(t.String({ maxLength: 200, description: 'Heading above the chart.' })),
  x: t.String({
    minLength: 1,
    maxLength: 100,
    description:
      'Row key for the category: the x axis (bar, line, area, scatter), the slice name (pie, ' +
      'radial, funnel, treemap) or the corner name ' +
      '(radar). A number on scatter, a name elsewhere.',
  }),
  series: t.Array(
    t.Object({
      key: t.String({
        minLength: 1,
        maxLength: 100,
        description: "Row key that holds this series' number.",
      }),
      label: t.Optional(t.String({ maxLength: 200, description: 'Name shown for the series.' })),
      color: t.Optional(
        t.String({
          maxLength: 30,
          description: 'Hex color, such as #6366f1. Omit to use the chart palette.',
        }),
      ),
      type: t.Optional(
        t.Union([t.Literal('bar'), t.Literal('line'), t.Literal('area')], {
          description:
            'Draws this series as a bar, line or area, overriding `type`. Example: a count as ' +
            'bars and an average as a line. Only for bar, line and area charts.',
        }),
      ),
    }),
    { minItems: 1, maxItems: 12, description: 'One entry per measure.' },
  ),
  data: t.Array(t.Record(t.String(), t.Union([t.String(), t.Number(), t.Null()])), {
    minItems: 1,
    maxItems: 500,
    description:
      'Rows with the `x` key and every series key, such as { "week": "W12", "created": 8 }.',
  }),
  stacked: t.Optional(
    t.Union([t.Boolean(), t.Literal('percent')], {
      description:
        'Stack the series instead of side by side. "percent" stacks them as shares of 100%, to ' +
        'show how a composition changes, not how it grew.',
    }),
  ),
  horizontal: t.Optional(
    t.Boolean({
      description:
        'Draw bars horizontally, categories on the left. Use for long category names or a ' +
        'ranking of more than about eight.',
    }),
  ),
  curve: t.Optional(
    t.Union([t.Literal('monotone'), t.Literal('linear'), t.Literal('step')], {
      description:
        'Line shape between points: smoothed (monotone, ' +
        'default), straight (linear) or held until the next value (step).',
    }),
  ),
  showValues: t.Optional(
    t.Boolean({
      description: 'Show each number on the chart. Leave off above about a dozen rows.',
    }),
  ),
});
