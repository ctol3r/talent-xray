import { DEFAULT_GATEWAY_URL, HSALClient } from "@hsal/sdk";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * HSAL is an external, local-first runtime. The workstation reaches it only over
 * HTTP with a capability token issued by `pnpm hsal auth issue talentos`
 * in the HSAL repository. No token → the Diagnosis view explains how to pair.
 */
export interface HSALConfig {
  baseUrl: string;
  token: string | undefined;
}

export function getHSALConfig(): HSALConfig {
  return {
    baseUrl: process.env.HSAL_GATEWAY_URL ?? DEFAULT_GATEWAY_URL,
    token: process.env.HSAL_TOKEN,
  };
}

export class HSALNotConfiguredError extends Error {
  constructor() {
    super(
      `HSAL_TOKEN is not set. In the HSAL repository run \`pnpm hsal auth issue talentos\` and put the token in ${PRODUCT_NAME}'s environment as HSAL_TOKEN.`,
    );
    this.name = "HSALNotConfiguredError";
  }
}

export function getHSALClient(): HSALClient {
  const cfg = getHSALConfig();
  if (!cfg.token) throw new HSALNotConfiguredError();
  return new HSALClient({ baseUrl: cfg.baseUrl, token: cfg.token });
}

export interface HSALStatus {
  configured: boolean;
  reachable: boolean;
  baseUrl: string;
  actorId?: string;
  error?: string;
}

export async function getHSALStatus(): Promise<HSALStatus> {
  const cfg = getHSALConfig();
  const status: HSALStatus = {
    configured: Boolean(cfg.token),
    reachable: false,
    baseUrl: cfg.baseUrl,
  };
  try {
    const probe = new HSALClient({ baseUrl: cfg.baseUrl });
    await probe.health();
    status.reachable = true;
    if (cfg.token) {
      const who = await new HSALClient({
        baseUrl: cfg.baseUrl,
        token: cfg.token,
      }).whoami();
      status.actorId = who.capability.actorId;
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
  }
  return status;
}

/** The human actor the workstation acts for on a given search. Human ids are explicit, never inferred from AI output. */
export function humanActorIdFor(searchProjectId: string): string {
  return (
    process.env.HSAL_HUMAN_ACTOR_ID ??
    `human:recruiter-${searchProjectId.toLowerCase()}`
  );
}
