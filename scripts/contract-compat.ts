import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Document = Record<string, unknown>;
interface ContractLock {
  repository: string;
  revision: string;
  artifact: string;
  sha256: string;
}
const REPOSITORY = "abnormalhq/abnormalhq";
const ARTIFACT = "docs/onboard-contract.json";
// Extensibility is explicit: e.g. payRequestFields is input, despite its Fields suffix.
const RESPONSE_FIELD_LISTS = new Set([
  "contract.shop.publicOrderFields",
  "contract.shop.seats.planFields",
  "contract.shop.seats.accountFields",
  "contract.shop.quote.fields",
  "contract.shop.quote.priceFields",
  "contract.shop.quote.couponFields",
  "contract.shop.quote.unavailableFields",
  "contract.shop.buyerDomains.domainFields",
  "contract.shop.buyerDomains.ownershipFields",
  "contract.shop.buyerDomains.recordFields",
  "contract.shop.usdt.catalogFields",
  "contract.shop.usdt.catalogChainFields",
  "contract.shop.usdt.orderAnswerFields",
  "contract.shop.usdt.productFields",
  "contract.shop.usdt.seatPlanFields",
  "contract.shop.usdt.payFields",
  "contract.shop.refusalFields",
  "contract.status.fields",
]);

/** A provider must preserve everything the deployed consumer knows. Unknown enum values and input constraints need a migration. */
export function compatibilityErrors(provider: unknown, consumer: unknown, path = "contract"): string[] {
  if (path.endsWith(".$comment")) return [];
  if (path === "contract.version" && Number.isInteger(provider) && Number.isInteger(consumer))
    return Number(provider) >= Number(consumer) ? [] : [`${path}: provider version is older`];
  if (Array.isArray(consumer)) {
    if (!Array.isArray(provider)) return [`${path}: missing array`];
    // Only routes/methods and response field lists are open to additions. Request fields and enums remain closed.
    const extensible = path.endsWith(".routes") || path.includes(".routes.") || RESPONSE_FIELD_LISTS.has(path);
    const wanted = consumer.map((value) => JSON.stringify(value));
    const offered = provider.map((value) => JSON.stringify(value));
    return wanted.every((value) => offered.includes(value)) &&
      (extensible || JSON.stringify(offered) === JSON.stringify(wanted))
      ? []
      : [`${path}: removed or changed values${extensible ? "" : " (closed enum/input list)"}`];
  }
  if (consumer && typeof consumer === "object") {
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) return [`${path}: missing object`];
    return Object.entries(consumer).flatMap(([key, value]) =>
      compatibilityErrors((provider as Document)[key], value, `${path}.${key}`),
    );
  }
  return provider === consumer ? [] : [`${path}: removed or changed value`];
}

export function verifyArtifact(source: string, lock: ContractLock): Document {
  if (
    lock.repository !== REPOSITORY ||
    lock.artifact !== ARTIFACT ||
    !/^[a-f0-9]{40}$/.test(lock.revision) ||
    !/^[a-f0-9]{64}$/.test(lock.sha256)
  )
    throw new Error("Invalid canonical contract lock");
  if (createHash("sha256").update(source).digest("hex") !== lock.sha256)
    throw new Error("Canonical contract checksum mismatch");
  return JSON.parse(source) as Document;
}
async function remoteContract(revision: string): Promise<string> {
  const response = await fetch(`https://raw.githubusercontent.com/${REPOSITORY}/${revision}/${ARTIFACT}`, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Cannot read canonical contract (${response.status})`);
  const body = await response.text();
  if (body.length > 128_000) throw new Error("Canonical contract exceeds size limit");
  return body;
}

/** Also used by the private mail repository, from an immutable checkout of this public source. No private-repo token is needed. */
export async function checkContracts(args: string[]): Promise<void> {
  const option = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
  };
  const lock = JSON.parse(readFileSync(option("--lock", "docs/onboard-contract.lock.json"), "utf8")) as ContractLock;
  const provider = JSON.parse(readFileSync(option("--provider", ARTIFACT), "utf8")) as Document;
  const consumerPath = option("--consumer", "");
  const consumer = verifyArtifact(
    consumerPath ? readFileSync(consumerPath, "utf8") : await remoteContract(lock.revision),
    lock,
  );
  const errors = compatibilityErrors(provider, consumer);
  if (args.includes("--latest"))
    errors.push(...compatibilityErrors(provider, JSON.parse(await remoteContract("main"))));
  if (errors.length) throw new Error(`Incompatible storefront contract:\n${[...new Set(errors)].join("\n")}`);
  console.log("Canonical storefront contract: compatible");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkContracts(process.argv.slice(2));
}
