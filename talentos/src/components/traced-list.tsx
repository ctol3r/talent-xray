import type { TracedItem } from "@/lib/core/payloads";
import { ProvenanceBadge } from "./ui";

/** Renders a provenance-tracked criterion list. */
export function TracedList({
  title,
  items,
  tone,
}: {
  title: string;
  items: TracedItem[];
  tone?: "warn" | "bad";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3
        className={`mb-1.5 text-[11.5px] font-semibold tracking-wider uppercase ${
          tone === "bad"
            ? "text-bad"
            : tone === "warn"
              ? "text-warn"
              : "text-ink-faint"
        }`}
      >
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={item.id ?? i}
            className="flex items-start justify-between gap-3 rounded border border-edge bg-panel2/50 px-3 py-1.5"
          >
            <span className="text-[13px] leading-5">{item.text}</span>
            <span className="mt-0.5 shrink-0">
              <ProvenanceBadge source={item.provenance} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StringList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-[11.5px] font-semibold tracking-wider text-ink-faint uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="rounded border border-edge bg-panel2/50 px-2 py-0.5 text-[12.5px]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
