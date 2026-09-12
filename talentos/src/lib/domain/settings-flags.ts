/**
 * Switches the owner sets in the environment, read in one place.
 *
 * Each of these says next to it why it is where it is, rather than leaving
 * the default to be inferred from the code that reads it.
 */

/**
 * Whether a company's own favicon is shown over its drawn mark.
 *
 * **On by default**, at the owner's instruction. It was off because loading a
 * favicon tells that company's server that somebody looked, and in a
 * recruiting tool the list of employers a workspace is looking at is not a
 * neutral fact. That is still true; the owner has weighed it and wants the
 * logos, which is their call to make about their own desk.
 *
 * Two things keep the cost as small as it can be, and neither is optional:
 * the icon is fetched from the company's **own** address and never from a
 * favicon service, which would send every employer on the desk to a third
 * party in one request; and no address is ever guessed from a name, so
 * nothing is fetched for a company whose site nobody has recorded.
 *
 * `TALENTOS_FAVICONS=off` turns them back off.
 */
export function faviconsOn(raw = process.env.TALENTOS_FAVICONS): boolean {
  return (raw ?? "").trim().toLowerCase() !== "off";
}
