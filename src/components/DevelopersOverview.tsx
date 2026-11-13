import { Fragment } from "react";
import { TextLink } from "@/components/ui/text-link";
import { apiReference, developersContent } from "@/content/developers";
import { developerApi, type Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { groupId, type ApiOperation } from "@/lib/api-reference";
import { developersStructuredData } from "@/lib/structured-data";
import { DocArticle } from "./DocArticle";
import { Icon } from "./Icon";
import { JsonLd } from "./JsonLd";
import { RichText } from "@/storefront/components/RichText";

/**
 * The developer documentation (/developers/, /zh/developers/): how to get a key and call the management API, in the help
 * articles' layout, then every operation of the API grouped by area under the last section ("API reference"). The text is
 * src/content/developers/; the operations come from mail's OpenAPI document through src/content/developers/reference.ts.
 */
export function DevelopersOverview({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  const d = t.developers;
  const content = developersContent[lang];
  // A fixed date from the content, not the clock: the page is prerendered.
  const reviewed = new Intl.DateTimeFormat(t.legal.dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${content.reviewed}T00:00:00Z`),
  );
  return (
    <>
      <JsonLd data={developersStructuredData(lang)} />
      <DocArticle
        lang={lang}
        eyebrow={d.eyebrow}
        title={content.title}
        summary={content.summary}
        trail={[]}
        crumb={d.navLabel}
        sections={content.sections}
        slots={{
          errors: <ErrorTable copy={d.errors} />,
          reference: (
            <div className="mt-8 grid gap-10 text-base/body">
              {apiReference.groups.map((group) => (
                <section className="min-w-0" aria-labelledby={groupId(group.tag)} key={group.tag}>
                  <h3
                    className="scroll-mt-24 text-lg/[1.4] font-medium text-foreground"
                    id={groupId(group.tag)}
                    lang="en"
                  >
                    {group.tag}
                  </h3>
                  <p className="mt-2 text-sm/body text-muted-foreground" lang="en">
                    {group.description}
                  </p>
                  <div className="mt-4 overflow-x-auto rounded-panel border border-border">
                    <table className="w-full min-w-[34rem] border-collapse text-left text-sm/[1.55]">
                      <thead className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                            {d.reference.operation}
                          </th>
                          <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                            {d.reference.summary}
                          </th>
                          <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                            {d.reference.scope}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.operations.map((operation) => (
                          <OperationRow key={operation.operationId} operation={operation} copy={d.reference} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          ),
        }}
        meta={
          <>
            {d.reviewedLabel}
            {t.legal.colon}
            <time dateTime={content.reviewed}>{reviewed}</time>
            {" · "}
            {d.versionLabel}
            {t.legal.colon}
            <span className="font-mono">{apiReference.version}</span>
          </>
        }
      >
        <nav
          className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-7"
          aria-label={t.legal.relatedLabel}
        >
          <TextLink asChild>
            <a href={developerApi.openapi}>
              {d.specLink} <Icon name="arrow" className="size-4" />
            </a>
          </TextLink>
          <TextLink asChild>
            <a href={links.status}>
              {d.statusLink} <Icon name="up-right" className="size-4" />
            </a>
          </TextLink>
        </nav>
      </DocArticle>
    </>
  );
}

function OperationRow({
  operation,
  copy,
}: {
  operation: ApiOperation;
  copy: { deprecated: string; perOperation: string; originalKey: string };
}) {
  return (
    <tr className="border-b border-border align-top last:border-b-0" id={operation.operationId}>
      <td className="px-4 py-3 font-mono text-[13px]">
        <div className="flex items-baseline gap-2">
          <span className="w-[3.6rem] shrink-0 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">
            {operation.method.toUpperCase()}
          </span>
          <span className="min-w-0 text-foreground">
            {/* A long path breaks after a slash, never inside a segment. */}
            {operation.path.split("/").map((segment, index) => (
              <Fragment key={index}>
                {index > 0 && (
                  <>
                    /<wbr />
                  </>
                )}
                {segment}
              </Fragment>
            ))}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-foreground" lang="en">
        {operation.summary}
        {operation.deprecated && (
          <span className="ml-2 rounded-chip border border-border px-1.5 text-[11px] text-muted-foreground">
            {copy.deprecated}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-muted-foreground">
        {operation.keyRule === "original-key" ? (
          <span className="font-sans whitespace-normal">{copy.originalKey}</span>
        ) : (
          <>
            {operation.keyRule === "per-operation" && <span className="block font-sans">{copy.perOperation}</span>}
            {operation.scopes.join(", ")}
          </>
        )}
      </td>
    </tr>
  );
}

/**
 * Every error code of the API (the document's x-error-codes), one table per area in the document's order. Meanings and
 * actions are the document's English, like the operation summaries.
 */
function ErrorTable({ copy }: { copy: ReturnType<typeof useCopy>["t"]["developers"]["errors"] }) {
  const areas = [...new Set(apiReference.errors.map((entry) => entry.area))];
  return (
    <div className="mt-8 grid gap-10 text-base/body">
      {areas.map((area) => (
        <section className="min-w-0" aria-labelledby={`errors-${area}`} key={area}>
          <h3 className="scroll-mt-24 text-lg/[1.4] font-medium text-foreground" id={`errors-${area}`}>
            {copy.areas[area] ?? area}
          </h3>
          <div className="mt-4 overflow-x-auto rounded-panel border border-border">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm/[1.55]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                    {copy.code}
                  </th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                    {copy.status}
                  </th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                    {copy.meaning}
                  </th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                    {copy.action}
                  </th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap" scope="col">
                    {copy.retry}
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiReference.errors
                  .filter((entry) => entry.area === area)
                  .map((entry) => (
                    <tr
                      className="border-b border-border align-top last:border-b-0"
                      id={`error-${entry.code}`}
                      key={entry.code}
                    >
                      <td className="px-4 py-3 font-mono text-[13px] text-foreground">
                        <span>
                          {/* A long code breaks after an underscore, never inside a word. */}
                          {entry.code.split("_").map((part, index) => (
                            <Fragment key={index}>
                              {index > 0 && (
                                <>
                                  _<wbr />
                                </>
                              )}
                              {part}
                            </Fragment>
                          ))}
                        </span>
                        {entry.reserved && (
                          <span className="ml-2 rounded-chip border border-border px-1.5 font-sans text-[11px] text-muted-foreground">
                            {copy.reserved}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap text-muted-foreground">
                        {entry.statuses.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-foreground" lang="en">
                        <RichText text={entry.meaning} code />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" lang="en">
                        <RichText text={entry.action} code />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {copy.retryValues[entry.retry]}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
