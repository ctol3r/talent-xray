"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
export function ReviewResumeLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        try {
          const query = localStorage.getItem(`review:${href}`);
          if (query) {
            e.preventDefault();
            router.push(`${href}?${new URLSearchParams(query)}`);
          }
        } catch {
          /* Browser storage may be disabled; ordinary navigation still works. */
        }
      }}
    >
      {children}
    </Link>
  );
}
