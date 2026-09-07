/**
 * Asking the person (Wave H2).
 *
 * A recruiter who has collected ten public addresses for someone has, under
 * GDPR Article 14, a duty to tell that person within one month — and the
 * cheapest way to discharge it is also the only way to get the strongest
 * evidence there is: ask them which addresses are actually theirs.
 *
 * This module builds that message and records what came back. It sends
 * nothing. There is no outbox, no SMTP, no webhook: the recruiter copies the
 * text into their own mail client, and afterwards tells the app they sent it.
 * A unit test spies on `fetch` to keep it that way.
 *
 * The person's reply text is never stored. Only which addresses they
 * confirmed, which they denied, and which they added.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  confirmationChannelSchema,
  noticeResolutionSchema,
} from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import { candidateSources, candidates, searchProjects } from "@/lib/db/schema";
import { scanTextForProtectedTraits } from "@/lib/domain/fair-hiring";
import { SURFACE_FAMILY_LABELS } from "@/lib/domain/surface-families";
import { addProfileLink, listProfileLinks, suppressUrl } from "./profile-links";

export interface ConfirmationDraft {
  subject: string;
  body: string;
  /** The addresses named in the draft, in the order they are numbered. */
  listed: { sourceId: string; url: string; familyWord: string }[];
}

/**
 * The message. Every element GDPR Article 14 requires is a fixed point of
 * this function and is asserted by a test, because a notice missing them is
 * not a notice and the clock it stops was never really stopped:
 *
 *  14(1)(a) who is asking            → the `[Your name]` / `[Your company]` line
 *  14(1)(c) why, and on what basis   → the "why you are hearing from me" paragraph
 *  14(1)(d) what is held             → the numbered list of addresses
 *  14(2)(a) how long                 → the retention sentence
 *  14(2)(f) where it came from       → "public web pages" and the surface words
 *  14(2)(c) / 21 the right to object → its own headed paragraph
 *  15       how to see or delete it  → the `[your email]` line
 *
 * Placeholders are left in square brackets so an unfinished draft is visibly
 * unfinished rather than accidentally sent with a gap.
 */
export function buildConfirmationDraft(
  candidate: { name: string },
  project: { name: string; roleTitle: string },
  links: { id: string; url: string; family: string }[],
): ConfirmationDraft {
  const listed = links.map((link) => ({
    sourceId: link.id,
    url: link.url,
    familyWord:
      SURFACE_FAMILY_LABELS[
        link.family as keyof typeof SURFACE_FAMILY_LABELS
      ] ?? "web page",
  }));

  const numbered = listed
    .map((item, index) => `${index + 1}. ${item.url}  [${item.familyWord}]`)
    .join("\n");

  const subject = `Are these public profiles yours? — ${project.roleTitle}`;

  const body = [
    `Hello ${candidate.name},`,
    "",
    `I am [Your name] at [Your company], and I am hiring for a ${project.roleTitle}. I am writing to you about that role, and to tell you what I hold about you and to correct it.`,
    "",
    "Why you are hearing from me. I found these pages on the public web while looking for people who might suit the role. I have not been given your details by anyone, and I hold them because I have a legitimate interest in contacting suitable candidates. You can object to that at any time, and I have set out how below.",
    "",
    "What I hold. Web addresses only — the pages themselves were never copied, and I hold no email address or phone number for you unless you send me one:",
    "",
    numbered || "(no addresses)",
    "",
    "What I would like to know. Which of these are actually yours? If any belong to someone else, tell me the number and I will delete it. If I have missed one you would rather I used, send it and I will use that instead.",
    "",
    "How long I keep it. Until this search closes, and then I delete it, unless you ask me to delete it sooner.",
    "",
    "Your right to object.",
    "You can tell me to stop using your details at any time, and I will delete everything I hold about you and not contact you again. You can also ask me for a copy of it. Either way, reply to this message or write to [your email]. You can also complain to your national data protection authority.",
    "",
    "[Your name]",
    "[Your company] · [your email]",
  ].join("\n");

  return { subject, body, listed };
}

/** Everything the confirmation page needs, in one read. */
export function confirmationWorkspace(db: Db, candidateId: string) {
  const candidate = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();
  if (!candidate) throw new Error("Candidate not found.");
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, candidate.searchProjectId))
    .get();
  if (!project) throw new Error("Search not found.");
  const links = listProfileLinks(db, candidateId);
  const draft = buildConfirmationDraft(
    candidate,
    { name: project.name, roleTitle: project.roleTitle },
    links.map((l) => ({ id: l.id, url: l.url, family: l.family })),
  );
  return { candidate, project, links, draft };
}

export const recordRequestSentInput = z.object({
  candidateId: z.string().min(1),
  channel: confirmationChannelSchema,
  sentAt: z.string().min(4),
});

/**
 * The recruiter states that they sent the message. The app cannot know this
 * and does not pretend to: it records a human's word, with a date.
 */
export function recordRequestSent(
  db: Db,
  raw: z.input<typeof recordRequestSentInput>,
) {
  const input = recordRequestSentInput.parse(raw);
  db.update(candidates)
    .set({
      noticeResolution: "sent",
      noticeResolvedAt: input.sentAt,
      noticeNote: `via ${input.channel}`,
    })
    .where(eq(candidates.id, input.candidateId))
    .run();
}

export const resolveNoticeInput = z.object({
  candidateId: z.string().min(1),
  resolution: noticeResolutionSchema,
  note: z.string().max(200).optional(),
});

/**
 * The other two ways the duty ends. `exempt` requires a written reason,
 * because the Article 14(5) exemptions are narrow and a bare claim of one is
 * not a record of anything.
 */
export function resolveNotice(db: Db, raw: z.input<typeof resolveNoticeInput>) {
  const input = resolveNoticeInput.parse(raw);
  if (input.resolution === "sent") {
    throw new Error(
      "Record that you sent the message on the confirmation page, with the date and channel.",
    );
  }
  if (input.resolution === "exempt" && !input.note?.trim()) {
    throw new Error(
      "An exemption needs a written reason. The Article 14(5) exemptions are narrow.",
    );
  }
  if (input.note) {
    const hits = scanTextForProtectedTraits(input.note);
    if (hits.length > 0) {
      throw new Error(
        `That note mentions ${hits.map((h) => h.trait).join(", ")}, which a hiring record must not weigh.`,
      );
    }
  }
  db.update(candidates)
    .set({
      noticeResolution: input.resolution,
      noticeResolvedAt: new Date().toISOString(),
      noticeNote: input.note ?? null,
    })
    .where(eq(candidates.id, input.candidateId))
    .run();
}

export const recordAnswerInput = z.object({
  candidateId: z.string().min(1),
  respondedAt: z.string().min(4),
  channel: confirmationChannelSchema,
  answers: z
    .array(
      z.object({
        sourceId: z.string().min(1),
        answer: z.enum(["theirs", "not_theirs", "no_answer"]),
      }),
    )
    .max(100)
    .default([]),
  /** Addresses the person offered themselves. */
  addedUrls: z.array(z.string().min(4)).max(10).default([]),
});

export interface AnswerResult {
  confirmed: number;
  removed: number;
  added: number;
}

/**
 * Record what the person said. One transaction, three effects:
 *  - "theirs" becomes the strongest tier in the system, dated and attributed;
 *  - "not theirs" is deleted AND suppressed, so it cannot walk back in by
 *    paste, import, capture, sweep or a platform read;
 *  - an address they offered is stored as theirs, and needs no surface opt-in
 *    because the expectation test is met by the person handing it over.
 *
 * Their words are not stored. Only these three facts.
 */
export function recordCandidateAnswer(
  db: Db,
  raw: z.input<typeof recordAnswerInput>,
): AnswerResult {
  const input = recordAnswerInput.parse(raw);
  const rows = listProfileLinks(db, input.candidateId);
  let confirmed = 0;
  let removed = 0;
  let added = 0;

  db.transaction((tx) => {
    for (const answer of input.answers) {
      const row = rows.find((r) => r.id === answer.sourceId);
      if (!row) continue;
      if (answer.answer === "theirs") {
        tx.update(candidateSources)
          .set({
            provenance: "candidate_provided",
            assertedBy: "the person",
            confirmedAt: input.respondedAt,
            confirmedVia: input.channel,
          })
          .where(eq(candidateSources.id, row.id))
          .run();
        confirmed += 1;
      } else if (answer.answer === "not_theirs") {
        tx.update(candidateSources)
          .set({ originSourceId: null })
          .where(eq(candidateSources.originSourceId, row.id))
          .run();
        tx.delete(candidateSources)
          .where(eq(candidateSources.id, row.id))
          .run();
        removed += 1;
      }
    }
  });

  // Suppression and new addresses run outside the transaction because both
  // go through the guard, which reads the database it is protecting.
  for (const answer of input.answers) {
    if (answer.answer !== "not_theirs") continue;
    const row = rows.find((r) => r.id === answer.sourceId);
    if (!row) continue;
    suppressUrl(db, {
      url: row.url,
      candidateId: input.candidateId,
      reason: "denied_by_person",
      note: "The person said this address is not theirs.",
    });
  }

  for (const url of input.addedUrls) {
    addProfileLink(db, {
      candidateId: input.candidateId,
      url,
      addedVia: "candidate_answer",
      provenance: "candidate_provided",
      assertedBy: "the person",
      confirmedAt: input.respondedAt,
    });
    added += 1;
  }

  return { confirmed, removed, added };
}
