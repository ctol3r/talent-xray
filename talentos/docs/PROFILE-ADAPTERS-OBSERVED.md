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

## GitHub's limits, measured (2026-09-08)

The lane is on (`TALENTOS_PROFILES_GITHUB=1`) and the numbers behind it were
taken from the API rather than from its documentation:

| Request                              | Answer | Left of 60 |
| ------------------------------------ | ------ | ---------- |
| `GET /rate_limit`                    | 200    | 60         |
| `GET /users/octocat`                 | 200    | 59         |
| `GET /users/octocat/social_accounts` | 200    | 58         |

Three facts follow, and only one of them is the headline number.

- **A person costs two requests**, so the keyless limit is **thirty people an
  hour per IP**, not sixty. A token raises 60 to 5,000, which is 2,500 people.
- **Asking what is left is free.** `/rate_limit` read 60 of 60 before and after
  itself, so the budget can be checked without spending it.
- **`x-ratelimit-reset` is a UTC epoch second.** It is said back to the reader
  in their own time.

Re-observed through the adapter itself on 2026-09-08: `octocat` still yields
one address (the blog), the two requests were spaced 1,108 ms apart by the new
pacing, and the budget seen afterwards was `limit 60, remaining 55`. Unchanged
from 2026-09-07 except for the pacing.

The two limits that share a status code are in `src/lib/profiles/github.ts`
and in D-111: the counter (`x-ratelimit-remaining: 0`) and GitHub's own
"slow down" (`retry-after`, counter still positive). Neither was reproduced
deliberately — exceeding a limit to watch it happen is the one experiment not
worth running — so both are covered by fixtures in
`tests/unit/declared-links.test.ts` against the documented shapes, and a bad
token was confirmed live to answer 401 `Bad credentials` with no rate-limit
headers at all.
