/**
 * Normalisation primitives for the sourcing engine.
 *
 * Ported from Hu (`app/extract/normalize.py`). Every comparison in the query
 * language, the ontology, the ranker and the resolver runs through these, so
 * they are pure, dependency-free and deterministic — the artifact build and
 * the server share them byte for byte.
 */

const NAME_TITLES = new Set([
  "dr",
  "dr.",
  "prof",
  "prof.",
  "professor",
  "mr",
  "mr.",
  "mrs",
  "mrs.",
  "ms",
  "ms.",
  "mx",
  "mx.",
  "sir",
  "rev",
  "rev.",
]);

const NAME_SUFFIXES = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "phd",
  "md",
  "mba",
  "msc",
  "ms",
  "ma",
  "bs",
  "ba",
  "pe",
  "esq",
  "rn",
  "dvm",
  "faan",
  "facs",
  "cfa",
  "cpa",
  "shrm-scp",
  "sphr",
]);

const ORG_STOPWORDS = new Set([
  "inc",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "company",
  "co",
  "gmbh",
  "plc",
  "sa",
  "ag",
  "nv",
  "holdings",
  "group",
  "the",
  "labs",
  "laboratories",
  "technologies",
  "technology",
  "systems",
  "solutions",
  "international",
  "worldwide",
  "university",
  "univ",
  "institute",
  "college",
  "school",
  "department",
  "dept",
  "center",
  "centre",
  "foundation",
]);

/**
 * Metro aliasing: a city and its metro are not different answers. Extend by
 * adding rows, never by loosening the matcher.
 */
export const LOCATION_ALIASES: Record<string, string> = {
  sf: "san francisco bay area",
  "san francisco": "san francisco bay area",
  "bay area": "san francisco bay area",
  "sf bay area": "san francisco bay area",
  "silicon valley": "san francisco bay area",
  "palo alto": "san francisco bay area",
  "mountain view": "san francisco bay area",
  "menlo park": "san francisco bay area",
  sunnyvale: "san francisco bay area",
  "san jose": "san francisco bay area",
  "santa clara": "san francisco bay area",
  oakland: "san francisco bay area",
  berkeley: "san francisco bay area",
  fremont: "san francisco bay area",
  "redwood city": "san francisco bay area",
  emeryville: "san francisco bay area",
  nyc: "new york metropolitan area",
  "new york": "new york metropolitan area",
  "new york city": "new york metropolitan area",
  brooklyn: "new york metropolitan area",
  manhattan: "new york metropolitan area",
  "jersey city": "new york metropolitan area",
  boston: "greater boston",
  somerville: "greater boston",
  seattle: "puget sound",
  bellevue: "puget sound",
  redmond: "puget sound",
  tacoma: "puget sound",
  "greater london": "london",
  "city of london": "london",
  westminster: "london",
  "greater manchester": "manchester",
  "greater birmingham": "birmingham",
  "greater munich": "munich",
  münchen: "munich",
  muenchen: "munich",
  köln: "cologne",
  koeln: "cologne",
  göteborg: "gothenburg",
  goteborg: "gothenburg",
  zürich: "zurich",
  zuerich: "zurich",
  bengaluru: "bangalore",
  bombay: "mumbai",
  "6th of october city": "cairo",
  aichi: "nagoya",
  "aix en provence": "marseille",
  "akron ohio": "cleveland",
  alcobendas: "madrid",
  "alexandria virginia": "washington dc",
  allschwil: "basel",
  almere: "amsterdam",
  alpharetta: "atlanta",
  altrincham: "manchester",
  amstelveen: "amsterdam",
  anaheim: "orange county",
  "ann arbor": "detroit",
  "annapolis maryland": "baltimore",
  antibes: "nice",
  "arlington virginia": "washington dc",
  "auburn hills michigan": "detroit",
  "aurora colorado": "denver",
  "bad homburg": "frankfurt",
  badalona: "barcelona",
  baerum: "oslo",
  ballerup: "copenhagen",
  barueri: "sao paulo",
  "bath somerset": "bristol",
  "beaverton oregon": "portland oregon",
  bekasi: "jakarta",
  "bellevue washington": "puget sound",
  "berkeley california": "san francisco bay area",
  "bethesda maryland": "washington dc",
  birkenhead: "liverpool",
  blagnac: "toulouse",
  blanchardstown: "dublin",
  "bloomington minnesota": "minneapolis saint paul",
  boblingen: "stuttgart",
  "boca raton": "miami",
  bochum: "ruhr area",
  bogor: "jakarta",
  "bonifacio global city": "manila",
  bonn: "cologne",
  "boulder colorado": "denver",
  "boulogne billancourt": "paris",
  bracknell: "thames valley",
  bradford: "leeds",
  brampton: "toronto",
  "brentwood tennessee": "nashville",
  "broomfield colorado": "denver",
  "brossard quebec": "montreal",
  "burbank california": "los angeles",
  burnaby: "vancouver",
  "cambridge ma": "greater boston",
  "cambridge massachusetts": "greater boston",
  "cambridge ontario": "waterloo ontario",
  cambridgeshire: "cambridge",
  "camden new jersey": "philadelphia",
  "camden town": "london",
  "canary wharf": "london",
  "carlsbad california": "san diego",
  "cary north carolina": "raleigh durham",
  cascais: "lisbon",
  "cedar park texas": "austin",
  "chandler arizona": "phoenix",
  "chapel hill north carolina": "raleigh durham",
  "cherry hill new jersey": "philadelphia",
  chiba: "tokyo",
  "chula vista": "san diego",
  citywest: "dublin",
  "clayton missouri": "st louis",
  "clearwater florida": "tampa",
  clerkenwell: "london",
  "columbia maryland": "baltimore",
  "concord north carolina": "charlotte",
  conshohocken: "philadelphia",
  coquitlam: "vancouver",
  "coral gables": "miami",
  "costa mesa california": "orange county",
  "county antrim": "belfast",
  "covington kentucky": "cincinnati",
  crolles: "grenoble",
  croydon: "london",
  "culver city": "los angeles",
  cupertino: "san francisco bay area",
  cyberjaya: "kuala lumpur",
  "dartmouth nova scotia": "halifax nova scotia",
  "davis california": "sacramento",
  "dearborn michigan": "detroit",
  "decatur georgia": "atlanta",
  delft: "the hague",
  diegem: "brussels",
  difc: "dubai",
  dortmund: "ruhr area",
  "draper utah": "salt lake city",
  "dublin ohio": "columbus ohio",
  duisburg: "ruhr area",
  "dun laoghaire": "dublin",
  "eagan minnesota": "minneapolis saint paul",
  "east bay california": "san francisco bay area",
  "east kilbride": "glasgow",
  "edina minnesota": "minneapolis saint paul",
  "el poblado": "medellin",
  "el segundo": "los angeles",
  "electronic city": "bangalore",
  envigado: "medellin",
  erlangen: "nuremberg",
  escazu: "san jose costa rica",
  "esch sur alzette": "luxembourg",
  eschborn: "frankfurt",
  espoo: "helsinki",
  "essen germany": "ruhr area",
  "evanston illinois": "chicago",
  "everett washington": "puget sound",
  faridabad: "delhi ncr",
  "folsom california": "sacramento",
  fornebu: "oslo",
  "fort lauderdale": "miami",
  "fort mill south carolina": "charlotte",
  "franklin tennessee": "nashville",
  frederiksberg: "copenhagen",
  fremantle: "perth australia",
  "frisco texas": "dallas fort worth",
  gachibowli: "hyderabad",
  gandhinagar: "ahmedabad",
  gangnam: "seoul",
  garching: "munich",
  gateshead: "newcastle upon tyne",
  gauteng: "johannesburg",
  gdynia: "gdansk",
  ghaziabad: "delhi ncr",
  "gilbert arizona": "phoenix",
  giza: "cairo",
  "golden horseshoe": "toronto",
  "grand canal dock": "dublin",
  "greater noida": "delhi ncr",
  guarulhos: "sao paulo",
  "guelph ontario": "waterloo ontario",
  gurgaon: "delhi ncr",
  gurugram: "delhi ncr",
  "gush dan": "tel aviv",
  haarlem: "amsterdam",
  haidian: "beijing",
  hakata: "fukuoka",
  "hamilton ontario": "toronto",
  hammersmith: "london",
  harrogate: "leeds",
  herzliya: "tel aviv",
  "high wycombe": "thames valley",
  "hillsboro oregon": "portland oregon",
  hinjewadi: "pune",
  "hitec city": "hyderabad",
  "hitech city": "hyderabad",
  hoboken: "new york metropolitan area",
  hoofddorp: "amsterdam",
  "hospitalet de llobregat": "barcelona",
  huddersfield: "leeds",
  "huntersville north carolina": "charlotte",
  ikeja: "lagos",
  "ile de france": "paris",
  incheon: "seoul",
  "irvine california": "orange county",
  "irving texas": "dallas fort worth",
  islington: "london",
  ismaning: "munich",
  "issy les moulineaux": "paris",
  jumeirah: "dubai",
  kanagawa: "tokyo",
  "kanata ontario": "ottawa",
  kansai: "osaka",
  "katy texas": "houston",
  keihanshin: "osaka",
  "kendall square": "greater boston",
  "king of prussia": "philadelphia",
  "kirchberg luxembourg": "luxembourg",
  "kirkland washington": "puget sound",
  kista: "stockholm",
  "kitchener ontario": "waterloo ontario",
  "kobe japan": "osaka",
  "kongens lyngby": "copenhagen",
  koramangala: "bangalore",
  kowloon: "hong kong",
  "la defense": "paris",
  "la jolla": "san diego",
  "lake mary florida": "orlando",
  "lake oswego oregon": "portland oregon",
  "las condes": "santiago chile",
  "las rozas": "madrid",
  "laval quebec": "montreal",
  "leamington spa": "coventry",
  "lehi utah": "salt lake city",
  leith: "edinburgh",
  leixlip: "dublin",
  lekki: "lagos",
  "levallois perret": "paris",
  leverkusen: "cologne",
  lisburn: "belfast",
  "long beach california": "los angeles",
  longueuil: "montreal",
  "los alamos new mexico": "new mexico",
  "lower hutt": "wellington new zealand",
  "lund sweden": "malmo",
  lysaker: "oslo",
  maadi: "cairo",
  maidenhead: "thames valley",
  makati: "manila",
  "manhattan beach california": "los angeles",
  "marietta georgia": "atlanta",
  "markham ontario": "toronto",
  marousi: "athens",
  martinsried: "munich",
  "mason ohio": "cincinnati",
  matosinhos: "porto",
  "mclean virginia": "washington dc",
  "menlo park california": "san francisco bay area",
  merignac: "bordeaux",
  merseyside: "liverpool",
  "mesa arizona": "phoenix",
  "metairie louisiana": "new orleans",
  meylan: "grenoble",
  meyrin: "geneva",
  "miami beach": "miami",
  midrand: "johannesburg",
  mississauga: "toronto",
  monza: "milan",
  "morrisville north carolina": "raleigh durham",
  "mountain view california": "san francisco bay area",
  "murfreesboro tennessee": "nashville",
  "naperville illinois": "chicago",
  naucalpan: "mexico city",
  "navi mumbai": "mumbai",
  "nepean ontario": "ottawa",
  neuss: "dusseldorf",
  "new cairo": "cairo",
  "new taipei": "taipei",
  "new territories": "hong kong",
  "newark new jersey": "new york metropolitan area",
  "newbury berkshire": "thames valley",
  "newport beach california": "orange county",
  "newport wales": "cardiff",
  niteroi: "rio de janeiro",
  noida: "delhi ncr",
  "north york": "toronto",
  "novi beograd": "belgrade",
  "oakland county michigan": "detroit",
  "oakville ontario": "toronto",
  oeiras: "lisbon",
  offenbach: "frankfurt",
  "ogden utah": "salt lake city",
  "orange county florida": "orlando",
  ortigas: "manila",
  osasco: "sao paulo",
  otaniemi: "helsinki",
  "overland park kansas": "kansas city",
  pangyo: "seoul",
  "paris saclay": "paris",
  parramatta: "sydney",
  "pasadena california": "los angeles",
  pasig: "manila",
  "petah tikva": "tel aviv",
  "petaling jaya": "kuala lumpur",
  "pimpri chinchwad": "pune",
  piraeus: "athens",
  "plano texas": "dallas fort worth",
  "polanco mexico city": "mexico city",
  potsdam: "berlin",
  "pozuelo de alarcon": "madrid",
  "provo utah": "salt lake city",
  pudong: "shanghai",
  putrajaya: "kuala lumpur",
  "queens new york": "new york metropolitan area",
  "quezon city": "manila",
  "ramat gan": "tel aviv",
  randburg: "johannesburg",
  ratingen: "dusseldorf",
  rawalpindi: "islamabad",
  "reading berkshire": "thames valley",
  "redmond washington": "puget sound",
  "reston virginia": "washington dc",
  "richardson texas": "dallas fort worth",
  "richmond british columbia": "vancouver",
  rijswijk: "the hague",
  "rio rancho new mexico": "new mexico",
  "roseville california": "sacramento",
  "roswell georgia": "atlanta",
  rotherham: "sheffield",
  "round rock texas": "austin",
  "saint petersburg florida": "tampa",
  saitama: "tokyo",
  salford: "manchester",
  "san jose ca": "san francisco bay area",
  "san jose california": "san francisco bay area",
  "san pedro garza garcia": "monterrey",
  sandnes: "stavanger",
  sandton: "johannesburg",
  "sandy springs georgia": "atlanta",
  sandyford: "dublin",
  "sant cugat del valles": "barcelona",
  "santa ana california": "orange county",
  "santa clara california": "san francisco bay area",
  "santa monica": "los angeles",
  "santo andre": "sao paulo",
  "scarborough ontario": "toronto",
  "schaumburg illinois": "chicago",
  schiphol: "amsterdam",
  "scottsdale arizona": "phoenix",
  secunderabad: "hyderabad",
  seongnam: "seoul",
  "sesto san giovanni": "milan",
  sharjah: "dubai",
  shibuya: "tokyo",
  shinjuku: "tokyo",
  shoreditch: "london",
  "silicon hills": "austin",
  sindelfingen: "stuttgart",
  sintra: "lisbon",
  "slough berkshire": "thames valley",
  solihull: "birmingham",
  solna: "stockholm",
  "somerville massachusetts": "greater boston",
  "sophia antipolis": "nice",
  sopot: "gdansk",
  "south yorkshire": "sheffield",
  "southfield michigan": "detroit",
  "st petersburg florida": "tampa",
  "stamford connecticut": "new york metropolitan area",
  "staten island": "new york metropolitan area",
  stellenbosch: "cape town",
  stockport: "manchester",
  "stratford london": "london",
  "sugar land texas": "houston",
  sundbyberg: "stockholm",
  sunderland: "newcastle upon tyne",
  "surrey british columbia": "vancouver",
  "sutton coldfield": "birmingham",
  suwon: "seoul",
  "tacoma washington": "puget sound",
  taguig: "manila",
  tangerang: "jakarta",
  taoyuan: "taipei",
  "tempe arizona": "phoenix",
  thane: "mumbai",
  "the bronx": "new york metropolitan area",
  "the woodlands texas": "houston",
  "thu duc": "ho chi minh city",
  tlaquepaque: "guadalajara",
  "towson maryland": "baltimore",
  "tres cantos": "madrid",
  "troy michigan": "detroit",
  "tyne and wear": "newcastle upon tyne",
  "tysons corner": "washington dc",
  unterfohring: "munich",
  "vancouver washington": "portland oregon",
  vantaa: "helsinki",
  "vaughan ontario": "toronto",
  veldhoven: "eindhoven",
  "victoria island": "lagos",
  "vila nova de gaia": "porto",
  "villeneuve d ascq": "lille",
  villeurbanne: "lyon",
  wakefield: "leeds",
  "waltham massachusetts": "greater boston",
  "west midlands": "birmingham",
  "west palm beach": "miami",
  "west yorkshire": "leeds",
  "western cape": "cape town",
  "westerville ohio": "columbus ohio",
  whitefield: "bangalore",
  "wilmington delaware": "philadelphia",
  wimbledon: "london",
  "windsor berkshire": "thames valley",
  "winter park florida": "orlando",
  winterthur: "zurich",
  wirral: "liverpool",
  wokingham: "thames valley",
  wolverhampton: "birmingham",
  yokohama: "tokyo",
  zapopan: "guadalajara",
  zaventem: "brussels",
  zhongguancun: "beijing",
  zoetermeer: "the hague",
  "zug switzerland": "zurich",
};

/** Free mail hosts. A shared one never implies a shared employer. */
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "qq.com",
  "163.com",
]);

/** Strip diacritics so "Björn" and "Bjorn" are one person. */
export function stripAccents(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function collapseWs(value: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Collapse horizontal whitespace but keep line structure. CV text carries
 * meaning in its layout — "Head of X, Acme (2019–present)" is a line, not a
 * sentence — and flattening it destroys the only cue that it is a job record.
 */
export function collapseLines(value: string): string {
  const lines = (value ?? "")
    .split("\n")
    .map((l) => l.replace(/[^\S\n]+/g, " ").trim());
  const out: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line) {
      blanks = 0;
      out.push(line);
    } else {
      blanks += 1;
      if (blanks === 1) out.push("");
    }
  }
  return out.join("\n").trim();
}

export function normalizeText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const lowered = stripAccents(String(value)).toLowerCase();
  return collapseWs(lowered.replace(/[^a-z0-9\s\-']/g, " "));
}

/** Human-presentable spelling. CV headers shout; result pages should not. */
export function displayName(value: string | null | undefined): string {
  const cleaned = collapseWs(value ?? "");
  if (!cleaned) return "";
  const letters = [...cleaned].filter((c) => /[a-z]/i.test(c));
  if (letters.length === 0 || !letters.every((c) => c === c.toUpperCase()))
    return cleaned;
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return cleaned
    .split(" ")
    .map((token) => {
      const lower = token.toLowerCase();
      if (lower.startsWith("mc") && lower.length > 3)
        return `Mc${cap(lower.slice(2))}`;
      if (
        (lower.startsWith("o'") || lower.startsWith("d'")) &&
        lower.length > 2
      ) {
        return `${lower[0].toUpperCase()}'${cap(lower.slice(2))}`;
      }
      if (lower.includes("-")) return lower.split("-").map(cap).join("-");
      return cap(lower);
    })
    .join(" ");
}

/** Lowercase, accent-free, honorific- and suffix-free personal name. */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = stripAccents(value)
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/,/g, " ");
  let tokens = collapseWs(cleaned).split(" ").filter(Boolean);
  tokens = tokens.filter((t) => !NAME_TITLES.has(t));
  while (
    tokens.length > 0 &&
    NAME_SUFFIXES.has(tokens[tokens.length - 1].replace(/\./g, ""))
  ) {
    tokens.pop();
  }
  tokens = tokens
    .map((t) =>
      t.length > 2 ? t.replace(/[^\w\s]/g, "") : t.replace(/\./g, ""),
    )
    .filter(Boolean);
  return tokens.join(" ");
}

export function nameTokens(value: string | null | undefined): string[] {
  return normalizeName(value).split(" ").filter(Boolean);
}

/** "Sarah J. Chen" → "s chen". Used for blocking on abbreviated forms. */
export function nameInitialsKey(value: string | null | undefined): string {
  const toks = nameTokens(value);
  if (toks.length === 0) return "";
  if (toks.length === 1) return toks[0];
  return `${toks[0][0]} ${toks[toks.length - 1]}`;
}

export function normalizeOrganization(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const base = normalizeText(value).replace(
    /\b(inc|llc|ltd|corp|co|gmbh|plc)\b\.?/g,
    " ",
  );
  let tokens = base.split(" ").filter((t) => t && !ORG_STOPWORDS.has(t));
  // An organisation made entirely of stopwords ("The Group") still has a name.
  if (tokens.length === 0) tokens = base.split(" ").filter(Boolean);
  return collapseWs(tokens.join(" "));
}

export function normalizeTitle(value: string | null | undefined): string {
  if (!value) return "";
  const base = normalizeText(value).replace(
    /\b(senior|sr|junior|jr|lead|principal|staff|head of|chief|vp|vice president|director of|director|manager of|manager)\b/g,
    " ",
  );
  return collapseWs(base);
}

export function normalizeLocation(value: string | null | undefined): string {
  if (!value) return "";
  const base = collapseWs(
    normalizeText(value).replace(/\b(usa|united states|us|remote)\b/g, " "),
  );
  if (base in LOCATION_ALIASES) return LOCATION_ALIASES[base];
  const head = base.split(" ").slice(0, 3);
  for (const width of [3, 2, 1]) {
    const probe = head.slice(0, width).join(" ");
    if (probe in LOCATION_ALIASES) return LOCATION_ALIASES[probe];
  }
  return base;
}

export function normalizeCapability(value: string | null | undefined): string {
  return collapseWs(
    normalizeText(value).replace(
      /\b(engineering|engineer|engineers)\b/g,
      "engineering",
    ),
  );
}

export function normalizeEmail(value: string | null | undefined): string {
  if (!value) return "";
  return collapseWs(value)
    .toLowerCase()
    .replace(/^[<>.,;:()[\]]+|[<>.,;:()[\]]+$/g, "");
}

export function emailDomain(value: string | null | undefined): string {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1);
}

/** Best-effort eTLD+1 without a public-suffix dependency. */
export function registrableDomain(host: string): string {
  let h = (host ?? "").toLowerCase().trim().replace(/^\.+/, "");
  if (h.startsWith("www.")) h = h.slice(4);
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  const twoLevel = new Set([
    "co.uk",
    "ac.uk",
    "org.uk",
    "gov.uk",
    "com.au",
    "co.jp",
    "co.nz",
    "com.br",
  ]);
  if (twoLevel.has(parts.slice(-2).join(".")) && parts.length >= 3)
    return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export function urlDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ref",
  "referrer",
  "mc_cid",
  "mc_eid",
]);

/** Strip fragments, tracking params, trailing slash and default ports. */
export function canonicalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return url.trim();
  }
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  const port =
    parsed.port && !["80", "443"].includes(parsed.port)
      ? `:${parsed.port}`
      : "";
  let path = (parsed.pathname || "/").replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const kept: string[] = [];
  parsed.searchParams.forEach((v, k) => {
    if (!TRACKING_PARAMS.has(k.toLowerCase())) kept.push(`${k}=${v}`);
  });
  kept.sort();
  const query = kept.length > 0 ? `?${kept.join("&")}` : "";
  return `${(parsed.protocol || "https:").toLowerCase()}//${host}${port}${path}${query}`;
}

export function tokenSet(value: string | null | undefined): Set<string> {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function tokenOverlap(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return jaccard(tokenSet(a), tokenSet(b));
}

/**
 * 0..1 similarity tuned for personal names: full-token match dominates,
 * initial-compatible middle names are tolerated, a differing surname is fatal.
 */
export function nameSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return 0;

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  let matched = 0;
  const used = new Set<number>();
  for (const token of short) {
    for (let i = 0; i < long.length; i += 1) {
      if (used.has(i)) continue;
      const other = long[i];
      if (token === other) {
        matched += 1;
        used.add(i);
        break;
      }
      // "S." answers "Sarah": an initial is a compatible spelling, not a
      // different name. Only credited at partial weight.
      if ((token.length === 1 || other.length === 1) && token[0] === other[0]) {
        matched += 0.75;
        used.add(i);
        break;
      }
    }
  }
  return Math.min(1, matched / long.length);
}
