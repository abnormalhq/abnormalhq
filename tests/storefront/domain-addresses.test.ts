import { afterEach, expect, test, vi } from "vitest";
import {
  addDomainAlias,
  addDomainGroup,
  getDomainAddresses,
  memberChanges,
  normalizeLocalPart,
  removeDomainAlias,
  removeDomainGroup,
  setDomainCatchAll,
  updateDomainGroup,
} from "@/storefront/lib/domain-addresses";
import { addAccountDomain, verifyAccountDomain } from "@/storefront/lib/domains";
import { createShopOrder, ShopApiError } from "@/storefront/lib/shop";
import { shopCopy } from "@/storefront/lib/shop-copy";
import { MockShopStore, SEAT_PRODUCT } from "@/storefront/mock/shop";
import { DOMAIN_ROUTES, SHOP_ROUTES } from "@/storefront/worker/shop";

/**
 * The addresses on a live buyer domain ("Addresses on a buyer domain" in docs/storefront-api.md; mail's
 * apps/console/src/lib/shop/buyer-addresses.ts): the client of the seven routes, the Worker's route table and the dev mock.
 */

const ORIGIN = "http://localhost:4321";
const NOW = Date.parse("2026-11-24T00:00:00Z");
const ADDRESS_ROUTES = [
  "account/domains/addresses",
  "account/domains/aliases/add",
  "account/domains/aliases/remove",
  "account/domains/groups/add",
  "account/domains/groups/update",
  "account/domains/groups/remove",
  "account/domains/catch-all",
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** An addresses answer as mail's getBuyerDomainAddresses gives it. */
const sample = {
  domain: { id: "domainabcdefghi", name: "example.org" },
  editable: true,
  mailboxes: ["alice@example.org", "bob@example.org", "carol@example.org"],
  members: ["alice@example.org", "bob@example.org", "carol@example.org"],
  aliases: [{ id: "alias1", address: "sales@example.org", target: "alice@example.org", enabled: true }],
  groups: [
    {
      id: "list_domainabcdefghi_1",
      address: "team@example.org",
      description: "Everyone",
      members: ["alice@example.org", "carol@example.org"],
    },
  ],
  catchAll: null,
  limits: { aliases: 50, groups: 20, members: 50 },
};

function respond(body: unknown, status = 200) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return Response.json(body, { status });
  });
  return calls;
}

test("addresses: the seven routes are proxied as POSTs like the other domain routes", () => {
  for (const route of ADDRESS_ROUTES) {
    expect(SHOP_ROUTES[route], route).toStrictEqual(["POST"]);
    // Only the account cookie is forwarded to them, and a mail before them answers a JSON 404.
    expect(DOMAIN_ROUTES, route).toContain(route);
  }
});

test("addresses: the client reads mail's answers and sends what mail takes", async () => {
  let calls = respond(sample);
  expect(await getDomainAddresses("domainabcdefghi")).toStrictEqual(sample);
  expect(calls[0]).toMatchObject({ body: { id: "domainabcdefghi" } });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/domains\/addresses$/);

  calls = respond({ alias: sample.aliases[0] });
  expect(await addDomainAlias("domainabcdefghi", "sales", "alice@example.org")).toStrictEqual(sample.aliases[0]);
  expect(calls[0]).toMatchObject({ body: { id: "domainabcdefghi", username: "sales", target: "alice@example.org" } });

  calls = respond({ ok: true });
  await removeDomainAlias("domainabcdefghi", "alias1");
  expect(calls[0]).toMatchObject({ body: { id: "domainabcdefghi", aliasId: "alias1" } });
  await removeDomainGroup("domainabcdefghi", "list_domainabcdefghi_1");
  expect(calls[1]).toMatchObject({ body: { id: "domainabcdefghi", groupId: "list_domainabcdefghi_1" } });

  const group = sample.groups[0]!;
  calls = respond({ group });
  expect(await addDomainGroup("domainabcdefghi", "team", group.members, "")).toStrictEqual(group);
  // An empty description is not sent at all.
  expect(calls[0]!.body).toStrictEqual({ id: "domainabcdefghi", username: "team", members: group.members });
  // Saving a group's members sends only the difference.
  await updateDomainGroup("domainabcdefghi", group, ["alice@example.org", "bob@example.org"]);
  expect(calls[1]!.body).toStrictEqual({
    id: "domainabcdefghi",
    groupId: group.id,
    addMembers: ["bob@example.org"],
    removeMembers: ["carol@example.org"],
  });

  calls = respond({ catchAll: null });
  expect(await setDomainCatchAll("domainabcdefghi", null)).toBeNull();
  expect(calls[0]!.body).toStrictEqual({ id: "domainabcdefghi", destination: null });
});

test("addresses: a mail without them reads as not offered; its refusals and anything malformed fail", async () => {
  // A mail before address management: its 404 page, passed on by the Worker as a JSON 404 without a code.
  respond({ error: "Endpoint not found." }, 404);
  expect(await getDomainAddresses("domainabcdefghi")).toBeNull();
  // Not this account's domain is mail's coded 404, which is a refusal and not "not offered".
  respond({ error: "Domain not found.", code: "domain_not_found", messages: { en: "Domain not found." } }, 404);
  await expect(getDomainAddresses("domainabcdefghi")).rejects.toMatchObject({ status: 404, code: "domain_not_found" });
  respond({ error: "You can manage this domain's aliases, group addresses and catch-all once it is live." }, 409);
  await expect(getDomainAddresses("domainabcdefghi")).rejects.toMatchObject({ status: 409 });
  for (const broken of [
    { ...sample, editable: "yes" },
    { ...sample, aliases: [{ id: "", address: "a@example.org", target: "b@example.org", enabled: true }] },
    { ...sample, groups: [{ ...sample.groups[0], members: "alice@example.org" }] },
    { ...sample, limits: { aliases: 50, groups: 20 } },
    { ...sample, catchAll: 1 },
  ]) {
    respond(broken);
    await expect(getDomainAddresses("domainabcdefghi")).rejects.toBeInstanceOf(ShopApiError);
  }
});

test("addresses: member changes and the typed name are tidied as mail reads them", () => {
  expect(memberChanges(["A@example.org", "b@example.org"], ["a@example.org", "c@example.org"])).toStrictEqual({
    addMembers: ["c@example.org"],
    removeMembers: ["b@example.org"],
  });
  expect(memberChanges(["a@example.org"], ["a@example.org"])).toStrictEqual({ addMembers: [], removeMembers: [] });
  expect(normalizeLocalPart("  Sales@Example.org ", "example.org")).toBe("sales");
  expect(normalizeLocalPart("sales", "example.org")).toBe("sales");
  // Another domain is left for mail to refuse.
  expect(normalizeLocalPart("sales@other.example", "example.org")).toBe("sales@other.example");
});

test("addresses: every message the panel shows has wording in both languages", () => {
  const keys = Object.keys(shopCopy.en).filter((key) => /^(address|alias|group|catchAll)/.test(key));
  expect(keys.length).toBeGreaterThan(30);
  for (const key of keys) expect(Object.keys(shopCopy.zh), key).toContain(key);
  expect(shopCopy.en.addressAdded("team@example.org")).toBe("team@example.org is ready.");
  expect(shopCopy.zh.groupSaved("team@example.org")).toBe("team@example.org 的成员已保存。");
});

/* ---- The dev mock ---- */

function browser(store: MockShopStore) {
  const jar = new Map<string, string>();
  const send = async (route: string, options: { body?: unknown; lang?: string } = {}) => {
    const get = ["catalog", "account", "account/mailboxes", "account/domains"].includes(route);
    const headers = new Headers(options.lang ? { "Accept-Language": options.lang } : {});
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    if (cookie) headers.set("Cookie", cookie);
    if (!get) {
      headers.set("Origin", ORIGIN);
      headers.set(
        "Content-Type",
        route === "pay" ? "application/x-www-form-urlencoded" : "application/json; charset=utf-8",
      );
    }
    const body =
      route === "pay"
        ? new URLSearchParams(options.body as Record<string, string>).toString()
        : JSON.stringify(options.body ?? {});
    const response = await store.fetch(
      route,
      new Request(`${ORIGIN}/api/shop/${route}`, { method: get ? "GET" : "POST", headers, ...(get ? {} : { body }) }),
    );
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = line.split(";")[0]!.split("=");
      if (value) jar.set(name!, value);
      else jar.delete(name!);
    }
    return response;
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
    send(String(url).split("/api/shop/")[1]!, {
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      lang: new Headers(init?.headers).get("Accept-Language") ?? undefined,
    }),
  );
  return { send };
}

/** A buyer of the demo seat plan with a live domain (no approval) and two mailboxes on it. */
async function liveDomain(name = "example.org") {
  const store = new MockShopStore(() => NOW, true, true, true, true, false);
  const client = browser(store);
  vi.spyOn(console, "info").mockImplementation(() => {});
  await client.send("account/login", { body: { email: "owner@example.com" } });
  const link = vi.mocked(console.info).mock.calls.at(-1)![0] as string;
  await client.send("account/verify", { body: { token: new URL(link.split("：")[1]!).searchParams.get("login") } });
  const orderId = await createShopOrder(SEAT_PRODUCT.id, "en", "", "ldc", "", 3);
  await client.send("pay", { body: { orderId, lang: "en" } });
  const domain = await addAccountDomain(name, "en");
  const status = (await verifyAccountDomain(domain.id, "en")).domain.status;
  // A `suspended-` name is suspended by the provider as it is verified: no mailbox can be set up on it.
  if (status === "suspended") return { store, client, domain, orderId };
  expect(status).toBe("live");
  for (const username of ["alice", "bob"]) {
    const created = await client.send("account/mailboxes/create", {
      body: { orderId, domain: name, username, password: "Correct-horse-9" },
    });
    expect(created.status).toBe(201);
  }
  return { store, client, domain, orderId };
}

test("dev shop: aliases, groups and the catch-all on a live domain follow mail's rules", async () => {
  const { client, domain, orderId } = await liveDomain();
  // A mailbox of the buyer on the shop's shared domain: never a member, an alias target or the catch-all here.
  const shared = await client.send("account/mailboxes/create", {
    body: { orderId, domain: "abnormalhq.com", username: "carol-owner", password: "Correct-horse-9" },
  });
  expect(shared.status).toBe(201);
  const empty = (await getDomainAddresses(domain.id, undefined, "en"))!;
  expect(empty).toMatchObject({
    editable: true,
    mailboxes: ["alice@example.org", "bob@example.org"],
    aliases: [],
    groups: [],
    catchAll: null,
    limits: { aliases: 50, groups: 20, members: 50 },
  });

  const alias = await addDomainAlias(domain.id, "sales", "alice@example.org", "en");
  expect(alias).toMatchObject({ address: "sales@example.org", target: "alice@example.org", enabled: true });
  // A name in use, a malformed name and a target that is not the buyer's mailbox on this domain are refused in mail's words.
  await expect(addDomainAlias(domain.id, "bob", "alice@example.org", "en")).rejects.toMatchObject({
    status: 409,
    message: "This address is already used by a mailbox, alias or group address. Try another.",
  });
  await expect(addDomainAlias(domain.id, "-bad", "alice@example.org", "en")).rejects.toMatchObject({ status: 400 });
  for (const target of ["someone@elsewhere.example", "carol-owner@abnormalhq.com"])
    await expect(addDomainAlias(domain.id, "info", target, "en")).rejects.toMatchObject({
      status: 409,
      message: "Mail can only go to one of your mailboxes on this domain.",
    });

  // A group's members are the buyer's own mailboxes on this domain only.
  for (const outside of ["outsider@elsewhere.example", "carol-owner@abnormalhq.com"])
    await expect(addDomainGroup(domain.id, "team", [outside], "", "en")).rejects.toMatchObject({
      status: 409,
      message: "Group members can only be your mailboxes on this domain.",
    });
  await expect(setDomainCatchAll(domain.id, "carol-owner@abnormalhq.com", "en")).rejects.toMatchObject({ status: 409 });
  await expect(addDomainGroup(domain.id, "team", [], "", "en")).rejects.toMatchObject({ status: 400 });
  const group = await addDomainGroup(domain.id, "team", ["alice@example.org"], "Everyone", "en");
  expect(group).toMatchObject({ address: "team@example.org", description: "Everyone", members: ["alice@example.org"] });
  const saved = await updateDomainGroup(domain.id, group, ["bob@example.org"], "en");
  expect(saved.members).toStrictEqual(["bob@example.org"]);
  await expect(updateDomainGroup(domain.id, saved, [], "en")).rejects.toMatchObject({ status: 400 });
  // A description-only change through the route, as mail takes it.
  const described = await client.send("account/domains/groups/update", {
    body: { id: domain.id, groupId: group.id, description: "Support desk" },
  });
  expect(((await described.json()) as { group: { description: string } }).group.description).toBe("Support desk");
  const tooLong = await client.send("account/domains/groups/update", {
    body: { id: domain.id, groupId: group.id, description: "x".repeat(201) },
  });
  expect(tooLong.status).toBe(400);

  expect(await setDomainCatchAll(domain.id, "bob@example.org", "en")).toBe("bob@example.org");
  await expect(setDomainCatchAll(domain.id, "sales@example.org", "en")).rejects.toMatchObject({ status: 409 });

  const now = (await getDomainAddresses(domain.id, undefined, "en"))!;
  expect(now.aliases.map((item) => item.address)).toStrictEqual(["sales@example.org"]);
  expect(now.groups.map((item) => [item.address, item.members])).toStrictEqual([
    ["team@example.org", ["bob@example.org"]],
  ]);
  expect(now.catchAll).toBe("bob@example.org");

  await removeDomainAlias(domain.id, alias.id, "en");
  await removeDomainGroup(domain.id, group.id, "en");
  expect(await setDomainCatchAll(domain.id, null, "en")).toBeNull();
  await expect(removeDomainAlias(domain.id, alias.id, "en")).rejects.toMatchObject({ status: 404 });
  expect(await getDomainAddresses(domain.id, undefined, "en")).toMatchObject({
    aliases: [],
    groups: [],
    catchAll: null,
  });
});

test("dev shop: a domain that is not live, suspended or someone else's has no address management to offer", async () => {
  const { domain } = await liveDomain("suspended-example.org");
  // Suspended by the provider: shown, not changeable.
  expect(await getDomainAddresses(domain.id, undefined, "en")).toMatchObject({ editable: false });
  await expect(addDomainAlias(domain.id, "sales", "alice@suspended-example.org", "en")).rejects.toMatchObject({
    status: 409,
  });
  // Not this account's domain: mail's coded 404.
  await expect(getDomainAddresses("abcdefghijklmno", undefined, "en")).rejects.toMatchObject({
    status: 404,
    code: "domain_not_found",
  });
  // A reservation is not live yet.
  const pending = await addAccountDomain("pending-two.example", "en");
  await expect(getDomainAddresses(pending.id, undefined, "en")).rejects.toMatchObject({ status: 409 });
});

test("dev shop: replacing a whole roster of long addresses fits in one request", async () => {
  const name = "engineering.example-company.com";
  const { client, domain } = await liveDomain(name);
  // 100 long addresses in one update, as a full replacement of a 50-member roster sends: over the 4 KiB of other requests.
  const roster = Array.from({ length: 50 }, (_, n) => `employee-${100 + n}@${name}`);
  const next = Array.from({ length: 50 }, (_, n) => `employee-${150 + n}@${name}`);
  const body = { id: domain.id, groupId: "list_x", addMembers: next, removeMembers: roster };
  expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeGreaterThan(4096);
  // Not refused for its size (413): the answer is about the group itself, which does not exist here.
  const response = await client.send("account/domains/groups/update", { body });
  expect(response.status).toBe(404);
  expect(await response.json()).toStrictEqual({ error: "找不到这个群组地址。" });

  // The longest roster mail takes: 100 addresses of 318 characters, well past 16 KiB, still under the 40 KiB cap.
  const longest = (n: number) => `${String(n).padStart(64, "a")}@${"b".repeat(253)}`;
  const full = {
    id: domain.id,
    groupId: "list_x",
    addMembers: Array.from({ length: 50 }, (_, n) => longest(n)),
    removeMembers: Array.from({ length: 50 }, (_, n) => longest(50 + n)),
  };
  const size = new TextEncoder().encode(JSON.stringify(full)).length;
  expect(size).toBeGreaterThan(16384);
  expect(size).toBeLessThanOrEqual(40960);
  expect((await client.send("account/domains/groups/update", { body: full })).status).toBe(404);
  // Anything past the cap is refused for its size.
  const over = await client.send("account/domains/groups/update", {
    body: { ...full, description: "x".repeat(10000) },
  });
  expect(over.status).toBe(413);
});
