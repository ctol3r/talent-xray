"use client";

import { useState } from "react";
import {
  companyFaviconUrls,
  companyMark,
} from "../../artifact-src/core/company-mark";

/**
 * The company's own logo, beside its name.
 *
 * The real one — the icon a browser puts in the tab — loaded from the
 * company's own site and never from a favicon service, which would mean
 * handing somebody else the list of every employer this workspace looks at.
 *
 * **The initials are the fallback, not the thing.** They are drawn first so a
 * list has something to scan the instant it renders, and the moment a logo
 * loads they are hidden rather than left showing through a transparent PNG.
 *
 * A tab's logo is rarely at `/favicon.ico` — that is the twenty-year-old
 * default, and a modern site declares its icon with `<link rel="icon">`
 * pointing wherever it likes. Reading that link means fetching the home page,
 * which is behind the policy gate and off in most installs. So the browser
 * walks the handful of paths sites actually serve, on the bare host and on
 * `www.`, and stops at the first that loads. It costs one request when the
 * first works, and it turns "initials" into "a logo" for most of the rest.
 */
export function CompanyMark({
  name,
  url,
  favicons = false,
  size = 18,
}: {
  name: string;
  url?: string | null;
  favicons?: boolean;
  size?: number;
}) {
  const candidates = favicons ? companyFaviconUrls(url) : [];
  /** How far down the list of places a logo might be we have got. */
  const [tried, setTried] = useState(0);
  const [shown, setShown] = useState(false);
  const mark = companyMark(name);
  const icon = candidates[tried];

  return (
    <span
      // The name is already beside this everywhere it is used, so the mark
      // itself is decoration and announcing it twice is noise.
      aria-hidden
      title={name}
      style={{
        width: size,
        height: size,
        // Once a logo is up, the drawn square gets out of its way: a logo on a
        // coloured tile is a logo somebody has put a badge behind.
        background: shown ? "transparent" : mark.background,
        color: mark.foreground,
        fontSize: Math.round(size * 0.46),
      }}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] align-text-bottom font-semibold tracking-tight select-none"
    >
      {!shown && mark.initials}
      {icon && (
        /* eslint-disable-next-line @next/next/no-img-element --
           a third-party origin this deliberately does not proxy or optimise:
           the drawn mark is already the fallback, and next/image would need
           every employer's host allow-listed in the build config. */
        <img
          key={icon}
          src={icon}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setShown(true)}
          // Not there, or not an image. Try the next place a site might keep
          // it; when the list runs out the initials are already underneath.
          onError={() => setTried((at) => at + 1)}
          className={`absolute inset-0 h-full w-full object-contain ${
            shown ? "" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}
