// A 204 No Content response. Elysia serializes returned values, so deletes return
// this explicit empty response instead of a body.
export const noContent = () => new Response(null, { status: 204 });
