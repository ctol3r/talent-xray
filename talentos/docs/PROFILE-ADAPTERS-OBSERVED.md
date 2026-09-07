# Declared-link adapters — live observation (2026-09-07)

D-021: an adapter is "built, not observed" until one real request and its
response have been seen. This records that observation for all four.

Targets are deliberately public and non-private: GitHub's own test account,
a Keybase co-founder's public proofs, the fictional researcher ORCID uses in
its own documentation, and an author who died in 2001. One request per
person, made by the owner on the owner's machine with every flag set
explicitly. Reproduce with:

```bash
TALENTOS_PROFILES_GITHUB=1 TALENTOS_PROFILES_KEYBASE=1 TALENTOS_PROFILES_ORCID=1 TALENTOS_PROFILES_WIKIDATA=1 pnpm tsx scripts/observe-profiles.mts
```

## What came back, after mapping

| Adapter  | Target                | Addresses | Notes                                                                                  |
| -------- | --------------------- | --------- | -------------------------------------------------------------------------------------- |
| GitHub   | `octocat`             | 1         | only `blog`; that account has no social accounts set, which is the common case         |
| Keybase  | `max`                 | 6         | twitter, github, reddit, hackernews and two DNS-proved domains, all `reciprocal: true` |
| ORCID    | `0000-0002-1825-0097` | 3         | university page, Wikipedia, Scopus author id                                           |
| Wikidata | `Q42`                 | 1         | official website only; the person predates the social identifiers                      |

Nothing that must not leak did. The GitHub response carried `email`,
`company`, `location`, `bio`, `avatar_url` and follower counts; none appears
in the mapped output. The ORCID response carried creation timestamps for
every entry; none survives, because a career start year is an age proxy. The
Wikidata entity carried date of birth, sex or gender and citizenship claims;
the mapper reads a fixed list of identifier properties and never touched
them.

## What the observation changed

- **Keybase's proof timestamp.** The API answers with its current verdict and
  no original proof date, so the label now reads "reported on `<date>`"
  rather than "checked on `<date>`". The date is when Keybase told us, which
  is what we can honestly say.
- **Coverage, stated plainly.** One GitHub account with a filled-in profile
  yields several addresses; `octocat` yields one. Keybase yields the most per
  account of anything tested, and has the fewest accounts. This is why the
  sweep exists: no adapter covers a clinical or sales candidate at all.

## Not observed

A GitHub account with `social_accounts` populated, and a Wikidata person with
modern social identifiers. Both are covered by fixtures in
`tests/unit/declared-links.test.ts`; neither has been seen live. Worth one
more read when a real candidate has them.
