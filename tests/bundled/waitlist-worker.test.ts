import { expect, test, vi } from "vitest";
import type { DoppelWaitlistBindings } from "../../waitlist-bindings";
import worker from "../../worker";

const req = () =>
  new Request("https://abnormalhq.com/api/waitlist/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://abnormalhq.com", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ email: " Access@Example.com ", lang: "zh" }),
  });
const otherBindings = {
  MAIL_ORIGIN: "https://console.abnormalhq.com",
  MAIL: {
    fetch: async () => {
      throw new Error("Must not reach Mail");
    },
  },
  ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
};

test("production waitlist is routed before the API catch-all, stays disabled and receives security headers", async () => {
  const availability = await worker.fetch(new Request(req().url), otherBindings, { waitUntil() {} });
  expect(availability.status).toBe(200);
  expect(await availability.json()).toEqual({ mode: "closed" });
  const response = await worker.fetch(req(), otherBindings, { waitUntil() {} });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "registration_closed", mode: "closed" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});

test("enabled adapter awaits the bound D1 write and never sends access credentials", async () => {
  let finish!: () => void;
  type DB = DoppelWaitlistBindings["DOPPEL_WAITLIST_DB"];
  type Statement = ReturnType<DB["prepare"]>;
  type EmptyResult = Awaited<ReturnType<Statement["run"]>> & { results: never[] };
  const run = vi.fn<() => Promise<EmptyResult>>(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            success: true,
            results: [],
            meta: {
              duration: 0,
              size_after: 0,
              rows_read: 0,
              rows_written: 1,
              last_row_id: 1,
              changed_db: true,
              changes: 1,
            },
          });
      }),
  );
  const bind = vi.fn<Statement["bind"]>();
  const statement: Statement = { run, bind, first: vi.fn(), all: vi.fn(), raw: vi.fn() };
  bind.mockReturnValue(statement);
  const prepare = vi.fn<DB["prepare"]>(() => statement);
  const limit = vi.fn(async () => ({ success: true }));
  const db: DB = { prepare, batch: vi.fn(), exec: vi.fn(), withSession: vi.fn(), dump: vi.fn() };
  const env = {
    ...otherBindings,
    DOPPEL_WAITLIST_ENABLED: "true",
    DOPPEL_WAITLIST_DB: db,
    DOPPEL_WAITLIST_LIMITER: { limit },
  };
  let answered = false;
  const availability = await worker.fetch(new Request(req().url), env, { waitUntil() {} });
  expect(await availability.json()).toEqual({ mode: "open" });
  expect(prepare).not.toHaveBeenCalled();
  expect(limit).not.toHaveBeenCalled();
  const pending = worker.fetch(req(), env, { waitUntil() {} }).then((response) => {
    answered = true;
    return response;
  });
  await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(answered).toBe(false);
  expect(limit).toHaveBeenCalledWith({ key: "doppel:192.0.2.1" });
  expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/VALUES \(\?, \?\) ON CONFLICT\(email\) DO NOTHING/));
  expect(bind).toHaveBeenCalledWith("access@example.com", "zh");
  finish();
  const response = await pending;
  expect(response.status).toBe(200);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(response.headers.has("location")).toBe(false);
  expect(await response.json()).toEqual({ ok: true, mode: "open" });
  run.mockRejectedValueOnce(new Error("storage failed"));
  const failed = await worker.fetch(req(), env, { waitUntil() {} });
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ error: "unavailable" });
});
