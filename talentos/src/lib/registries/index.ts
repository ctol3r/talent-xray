/**
 * Registry status and link-outs (Wave E). Registries without a public
 * JSON API — state medical and nursing boards, GMC/NMC, certification
 * bodies — stay link-outs by construction (backlog).
 */
import { NPPES_SEARCH_PAGE, resolveNppesMode, type NppesMode } from "./nppes";

export interface RegistryStatus {
  nppes: { configured: boolean; mode: NppesMode };
}

export function registryStatus(): RegistryStatus {
  const mode = resolveNppesMode();
  return { nppes: { configured: mode !== "off", mode } };
}

export const REGISTRY_LINK_OUTS = {
  nppes: { label: "NPI Registry search (CMS)", url: NPPES_SEARCH_PAGE },
} as const;

/** The label copy every surface uses — identity and taxonomy, not reachability. */
export const REGISTRY_MATCH_LABEL = "registry-matched · CMS NPPES";
export const REGISTRY_MATCH_EXPLAINER =
  "Identity and licence taxonomy as recorded by CMS on the date shown. It says who this person is and what they are enumerated as; it does not say how to reach them, whether they are currently licensed in a given state, or whether they will respond. An NPI is not proof of licensure.";
