import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listCompanies } from "@/lib/services/companies";
import { faviconsOn } from "@/lib/domain/settings-flags";
import { CompanySiteForm } from "@/components/company-site-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MARKS } from "../../../artifact-src/core/marks";

export const metadata = { title: "Companies" };

/**
 * Every company anybody has named, and where each one lives on the web.
 *
 * The address is the only thing this page is for. `companies.url` has existed
 * since the first migration and nothing could write it, which is why the
 * logos never appeared: the switch was off, and even on there was no address
 * to load one from.
 *
 * Nothing here guesses. A name resolved to whoever owns the matching .com
 * would put a stranger's logo beside a live job, and a wrong logo is worse
 * than none — wrong silently, confidently, on the surface a recruiter scans
 * fastest. So the companies with no address are listed first, because that is
 * the work this page exists for.
 */
export default async function CompaniesPage() {
  const db = getDb();
  const companies = listCompanies(db);
  const favicons = faviconsOn();
  const missing = companies.filter((company) => !company.url);
  const known = companies.filter((company) => company.url);

  return (
    <div>
      <PageHeader
        title={`${MARKS.company} Companies`}
        description="Every company named on a job or against a person. Record a company's web address and its logo appears wherever that company is — the jobs list, the people list, a job's own page."
      />

      {companies.length === 0 ? (
        <Card>
          <EmptyState
            title="No companies yet"
            detail="A company appears here the moment somebody names one on a job or records where a person works."
          >
            <Link
              href="/searches/new"
              className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90"
            >
              Start a job
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {missing.length > 0 && (
            <Card title={`🔍 No address yet (${missing.length})`}>
              <p className="mb-2 text-[13px] text-ink-muted">
                These draw their initials until somebody says where they live.
                Nothing is fetched for a company on this list.
              </p>
              <ul className="space-y-2">
                {missing.map((company) => (
                  <li key={company.name} className="min-w-0">
                    <p className="mb-1 text-[13.5px] text-ink">
                      {company.name}
                      <span className="ml-2 text-[12px] text-ink-faint">
                        {company.jobs > 0 &&
                          `${MARKS.job} ${company.jobs} job${company.jobs === 1 ? "" : "s"}`}
                        {company.jobs > 0 && company.people > 0 && " · "}
                        {company.people > 0 &&
                          `${MARKS.person} ${company.people}`}
                      </span>
                    </p>
                    <CompanySiteForm
                      name={company.name}
                      url={null}
                      favicons={favicons}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {known.length > 0 && (
            <Card title={`🌐 On the web (${known.length})`}>
              <p className="mb-2 text-[13px] text-ink-muted">
                {favicons
                  ? "Their own icon, loaded from their own address — never from a favicon service, which would send every employer on this desk to a third party in one request."
                  : "Favicons are switched off (TALENTOS_FAVICONS=off), so these draw their initials."}
              </p>
              <ul className="space-y-2">
                {known.map((company) => (
                  <li key={company.name} className="min-w-0">
                    <p className="mb-1 text-[13.5px] text-ink">
                      {company.name}
                      <span className="ml-2 text-[12px] text-ink-faint">
                        {company.jobs > 0 &&
                          `${MARKS.job} ${company.jobs} job${company.jobs === 1 ? "" : "s"}`}
                        {company.jobs > 0 && company.people > 0 && " · "}
                        {company.people > 0 &&
                          `${MARKS.person} ${company.people}`}
                      </span>
                    </p>
                    <CompanySiteForm
                      name={company.name}
                      url={company.url}
                      favicons={favicons}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
