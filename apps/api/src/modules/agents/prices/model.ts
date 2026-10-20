import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

const rate = (meter: string) =>
  t.Number({ minimum: 0, maximum: 1_000_000, description: `USD per million ${meter} tokens.` });

const cacheRate = (meter: string) =>
  t.Nullable(
    t.Number({
      minimum: 0,
      maximum: 1_000_000,
      description: `USD per million ${meter} tokens; null bills them at the input rate.`,
    }),
  );

const priceFields = {
  input: rate('input'),
  output: rate('output'),
  cacheRead: cacheRate('cache-read'),
  cacheWrite: cacheRate('cache-write'),
};

export const ModelPriceResponse = t.Object(priceFields);

export const OwnPriceResponse = t.Object({
  id: t.Number(),
  provider: t.String(),
  model: t.String(),
  ...priceFields,
});

export const ModelPriceRowResponse = t.Object({
  provider: t.String(),
  model: t.String(),
  builtIn: t.Nullable(ModelPriceResponse),
  own: t.Nullable(OwnPriceResponse),
});

export const UsedModelPriceResponse = t.Composite([
  ModelPriceRowResponse,
  t.Object({ calls: t.Number({ description: 'Calls in the last 90 days.' }) }),
]);

export const ModelPriceCatalogPageResponse = pageResponse(ModelPriceRowResponse);

export const catalogQuery = t.Object({
  search: t.Optional(
    t.String({ maxLength: 200, description: 'Part of `provider/model`, in any case.' }),
  ),
  ...pageQueryFields,
});

export const setModelPriceBody = t.Object({
  provider: t.String({ minLength: 1, maxLength: 200 }),
  model: t.String({ minLength: 1, maxLength: 200 }),
  input: priceFields.input,
  output: priceFields.output,
  cacheRead: t.Optional(priceFields.cacheRead),
  cacheWrite: t.Optional(priceFields.cacheWrite),
});

export const priceParams = t.Object({ workspaceId: t.Numeric(), priceId: t.Numeric() });
