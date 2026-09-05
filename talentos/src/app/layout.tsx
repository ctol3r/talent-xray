import type { Metadata } from "next";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product";
import { getDb } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";
import { listSearchProjects } from "@/lib/services/search-projects";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDb();
  await seed(db);
  const searches = await listSearchProjects(db);
  return (
    <html lang="en">
      <body>
        <AppShell
          productName={PRODUCT_NAME}
          searches={searches.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
          }))}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
