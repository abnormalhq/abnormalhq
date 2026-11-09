/** next dev only: excluded by the production pageExtensions/static export. */
import { MockShopStore } from "@/storefront/mock/shop";

const store = new MockShopStore();

// Account endpoints have two path segments (account/login etc.), so this is a catch-all route; one in-memory shop handles every endpoint.
async function handle(request: Request, context: { params: Promise<{ route: string[] }> }): Promise<Response> {
  const { route } = await context.params;
  return store.fetch(route.join("/"), request);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
