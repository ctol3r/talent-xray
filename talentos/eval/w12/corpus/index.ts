import { conversations as a } from "./a-cais";
import { conversations as b } from "./b-icu-nurse";
import { conversations as c } from "./c-enterprise-ae";
import { conversations as d } from "./d-cnc-machinist";
import { conversations as e } from "./e-cfo";
import { conversations as f } from "./f-propulsion";
import { conversations as g } from "./g-semiconductor";
import { conversations as h } from "./h-principal";
import { conversations as i } from "./i-executive-chef";
import { conversations as j } from "./j-datacenter-electrician";
import { conversations as x } from "./x-extra";
import {
  conversationSchema,
  type Conversation,
  type ParsedConversation,
} from "../schema";

export const CORPUS: Conversation[] = [
  ...a,
  ...b,
  ...c,
  ...d,
  ...e,
  ...f,
  ...g,
  ...h,
  ...i,
  ...j,
  ...x,
];

/** Validated corpus. Throws on any malformed conversation. */
export function loadCorpus(): ParsedConversation[] {
  const seen = new Set<string>();
  return CORPUS.map((raw) => {
    const parsed = conversationSchema.parse(raw);
    if (seen.has(parsed.id))
      throw new Error(`Duplicate conversation id ${parsed.id}`);
    seen.add(parsed.id);
    return parsed;
  });
}
