/**
 * The /api/onboard/[route] endpoint inside next dev: hands requests to the in-memory MockStore.
 * The file name ends in .dev.ts: next.config.ts adds dev.ts to pageExtensions only on the dev server,
 * so at build time it is just an ordinary file and the static output has no such endpoint.
 */
import {
  MOCK_ROUTES,
  MockStore,
  mockDelayMs,
  mockLang,
  type MockNotification,
  type MockReply,
} from "@/storefront/mock/api";

const store = new MockStore();
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function reply(result: MockReply): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: HEADERS,
  });
}

export async function POST(request: Request, context: { params: Promise<{ route: string }> }): Promise<Response> {
  const { route } = await context.params;
  const lang = mockLang(request.headers.get("accept-language"));
  const say = (zh: string, en: string) => (lang === "en" ? en : zh);
  if (!MOCK_ROUTES.has(route))
    return reply({
      status: 404,
      body: { error: say("接口不存在。", "Endpoint not found."), kind: "other" },
    });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ status: 400, body: { error: say("参数无效。", "Invalid parameters."), kind: "other" } });
  }
  await new Promise((resolve) => setTimeout(resolve, mockDelayMs(route)));
  if (route === "cdk") return reply(store.lookup(body, lang));
  if (route === "username") return reply(store.checkUsername(body, lang));
  const result = store.redeem(body, lang);
  logNotification(result);
  return reply(result);
}

/** The mock API cannot send real mail: log where it would have gone and what it said to the dev server terminal, for checking. */
function logNotification(result: MockReply): void {
  const notification = result.body.notification as MockNotification | null;
  if (!notification) return;
  if (!notification.sent) {
    console.info(`[mock] 账号信息没发到 ${notification.to}：${notification.error}`);
    return;
  }
  const issued = (result.body.mailboxes as { ok: boolean; email?: string }[])
    .filter((item) => item.ok)
    .map((item) => item.email)
    .join("、");
  console.info(`[mock] 已把 ${issued} 的账号信息「发到」${notification.to}`);
}

const notAllowed = (): Response =>
  new Response(JSON.stringify({ error: "只接受 POST。", kind: "other" }), {
    status: 405,
    headers: { ...HEADERS, Allow: "POST" },
  });

export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
