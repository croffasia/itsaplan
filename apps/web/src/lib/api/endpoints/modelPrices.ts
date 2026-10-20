import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// A price in USD per million tokens. A cache rate is null where those tokens are
// billed at the input rate.
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number | null;
  cacheWrite: number | null;
}

export interface OwnModelPrice extends ModelPrice {
  id: number;
  provider: string;
  model: string;
}

// A model with its built-in price and the one the workspace set, which wins.
export interface ModelPriceRow {
  provider: string;
  model: string;
  builtIn: ModelPrice | null;
  own: OwnModelPrice | null;
}

export type ModelPriceInput = { provider: string; model: string } & ModelPrice;

export const listUsedModelPrices = (workspaceId: number) =>
  request<(ModelPriceRow & { calls: number })[]>(`/workspaces/${workspaceId}/model-prices/used`);

export const listModelPriceCatalog = (workspaceId: number, params: PageParams, search?: string) =>
  request<Page<ModelPriceRow>>(
    `/workspaces/${workspaceId}/model-prices/catalog${pageQuery(params, { search })}`,
  );

export const setModelPrice = (workspaceId: number, input: ModelPriceInput) =>
  request<OwnModelPrice>(`/workspaces/${workspaceId}/model-prices`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const deleteModelPrice = (workspaceId: number, priceId: number) =>
  request<void>(`/workspaces/${workspaceId}/model-prices/${priceId}`, { method: 'DELETE' });
