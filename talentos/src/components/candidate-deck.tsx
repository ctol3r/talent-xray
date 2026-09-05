"use client";
import { ReviewResumeLink } from "./review-resume-link";
import { useState } from "react";
import { cardPose, deckOrder, nextInDeck } from "../../artifact-src/core/deck";
export function CandidateDeck({
  searchProjectId,
  candidates,
}: {
  searchProjectId: string;
  candidates: {
    id: string;
    name: string;
    currentTitle: string | null;
    stage: string;
  }[];
}) {
  const [front, setFront] = useState<string | null>(candidates[0]?.id ?? null),
    [deck, setDeck] = useState(false);
  return (
    <section
      className="candidate-deck"
      aria-label="Candidate review navigation"
    >
      <button
        className="rounded border px-3 py-2 mb-4"
        onClick={() => setDeck(!deck)}
      >
        {deck ? "Show compact list" : "Show candidate deck"}
      </button>
      {deck ? (
        <div
          tabIndex={0}
          aria-label="Candidate deck. Use left and right arrows to change the front card."
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              setFront(
                nextInDeck(candidates, front, e.key === "ArrowRight" ? 1 : -1),
              );
            }
          }}
          style={{
            position: "relative",
            height: 410,
            overflow: "auto",
            paddingTop: 245,
          }}
        >
          {deckOrder(candidates, front).map((c, i) => {
            const p = cardPose(i);
            return (
              p.visible && (
                <article
                  key={c.id}
                  style={{
                    position: "absolute",
                    width: 300,
                    height: 150,
                    border: "1px solid #9cbbb4",
                    borderTop: "5px solid #33867d",
                    borderRadius: 12,
                    background: "#f5faf7",
                    padding: 16,
                    transform: `translate(${p.x}px,${p.y}px) scale(${p.scale})`,
                    transformOrigin: "top left",
                    zIndex: p.z,
                  }}
                >
                  <button
                    className="font-semibold"
                    onClick={() => setFront(c.id)}
                  >
                    {c.name}
                  </button>
                  <p>{c.currentTitle}</p>
                  <p>{c.stage}</p>
                  <ReviewResumeLink
                    className="underline text-teal-800"
                    href={`/searches/${searchProjectId}/candidates/${c.id}/review`}
                  >
                    Open CV–JD comparison
                  </ReviewResumeLink>
                </article>
              )
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-3 mb-6">
          {candidates.map((c) => (
            <li key={c.id}>
              <ReviewResumeLink
                className="underline text-teal-800"
                href={`/searches/${searchProjectId}/candidates/${c.id}/review`}
              >
                Review {c.name} · CV ↔ JD
              </ReviewResumeLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
