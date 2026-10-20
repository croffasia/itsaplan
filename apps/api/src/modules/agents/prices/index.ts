import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import { workspaceParams } from '#modules/workspaces/model';
import {
  ModelPriceCatalogPageResponse,
  OwnPriceResponse,
  UsedModelPriceResponse,
  catalogQuery,
  priceParams,
  setModelPriceBody,
} from './model';
import { deleteModelPrice, listCatalogPrices, listUsedModelPrices, setModelPrice } from './service';

// The model prices of a workspace, which the agent dashboards of its teams cost calls
// with. Its owner and its admins read and set them, as they read the workspace's
// dashboard.
export const modelPriceRoutes = new Elysia({
  name: 'model-prices',
  detail: { tags: ['Model Prices'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/workspaces/:workspaceId/model-prices/used',
    ({ standing }) => listUsedModelPrices(standing.workspaceId),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 200: t.Array(UsedModelPriceResponse), ...errors(400, 401, 404) },
      detail: {
        summary: 'List the models a workspace uses, with their prices',
        description:
          'The models the agents of the workspace called in the last 90 days, and those it ' +
          'set a price for, each with the built-in price and its own. Models no price ' +
          'covers come first.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/model-prices/catalog',
    ({ standing, query }) =>
      paginate(query, (window) => listCatalogPrices(standing.workspaceId, query.search, window)),
    {
      workspaceManager: true,
      params: workspaceParams,
      query: catalogQuery,
      response: { 200: ModelPriceCatalogPageResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Page through the built-in model prices',
        description:
          'One page of the built-in price table, in provider and model order, each row ' +
          'with the price the workspace set for that model, if any.',
      },
    },
  )

  .put(
    '/workspaces/:workspaceId/model-prices',
    ({ standing, body }) => setModelPrice(standing.workspaceId, body),
    {
      workspaceManager: true,
      params: workspaceParams,
      body: setModelPriceBody,
      response: { 200: OwnPriceResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Set the price of a model',
        description:
          "Sets the workspace's own price for a model, replacing the one it had. The " +
          'agent dashboards cost every call of that model with it, past calls included.',
      },
    },
  )

  .delete(
    '/workspaces/:workspaceId/model-prices/:priceId',
    async ({ standing, params }) => {
      if (!(await deleteModelPrice(standing.workspaceId, params.priceId)))
        throw new HttpError(404, 'Price not found');
      return noContent();
    },
    {
      workspaceManager: true,
      params: priceParams,
      response: { 204: t.Void(), ...errors(400, 401, 404) },
      detail: {
        summary: 'Remove the price a workspace set for a model',
        description: 'The model is costed at the built-in price again, or not at all.',
      },
    },
  );
