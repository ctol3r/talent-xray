/**
 * The address rules, as a table. Every row is a way a URL that looks like the
 * open web turns out to be something else.
 */
import { describe, expect, it } from "vitest";
import {
  baseDomain,
  checkAddress,
  classifyResolvedAddress,
  parseIpv4,
  parseIpv6,
} from "@/lib/fetch/address";

describe("address literals", () => {
  it("reads a dotted quad and refuses ambiguous ones", () => {
    expect(parseIpv4("8.8.8.8")).toEqual([8, 8, 8, 8]);
    // A leading zero is octal to some resolvers and decimal to others.
    expect(parseIpv4("010.1.1.1")).toBeNull();
    expect(parseIpv4("1.2.3")).toBeNull();
    expect(parseIpv4("256.1.1.1")).toBeNull();
    expect(parseIpv4("0x7f.1.1.1")).toBeNull();
  });

  it("reads compressed and v4-tailed IPv6", () => {
    expect(parseIpv6("::1")?.slice(-2)).toEqual([0, 1]);
    expect(parseIpv6("::ffff:127.0.0.1")?.slice(-4)).toEqual([127, 0, 0, 1]);
    expect(parseIpv6("fe80::1")?.[0]).toBe(0xfe);
    expect(parseIpv6("fe80::1%eth0")).toBeNull();
    expect(parseIpv6("1:2:3")).toBeNull();
  });
});

describe("classifyResolvedAddress", () => {
  const refused = [
    "127.0.0.1",
    "10.0.0.5",
    "172.16.3.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "198.18.0.1",
    "203.0.113.9",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "2001:0:1::",
    "3fff::1",
    "5f00::1",
    "100::1",
    // The transition prefixes, unwrapped and re-checked.
    "fec0::1",
    "64:ff9b:1::a9fe:a9fe",
    "::ffff:127.0.0.1",
    "::ffff:10.1.1.1",
    "64:ff9b::192.168.0.1",
    "::127.0.0.1",
  ];
  for (const ip of refused) {
    it(`refuses ${ip}`, () => {
      expect(classifyResolvedAddress(ip).ok).toBe(false);
    });
  }

  const allowed = [
    "8.8.8.8",
    "93.184.216.34",
    "2606:2800:220:1::",
    "::ffff:8.8.8.8",
  ];
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      expect(classifyResolvedAddress(ip).ok).toBe(true);
    });
  }
});

describe("checkAddress", () => {
  const rows: [string, boolean, string][] = [
    ["https://example.com/team", true, "an ordinary page"],
    ["http://example.com/team", false, "cleartext"],
    ["ftp://example.com/x", false, "not the web"],
    ["file:///etc/passwd", false, "not the web"],
    ["https://user:pw@example.com/", false, "credentials in the address"],
    ["https://example.com:8443/", false, "a non-standard port"],
    ["https://127.0.0.1/", false, "an address literal"],
    ["https://[::1]/", false, "an address literal"],
    ["https://8.8.8.8/", false, "an address literal, even a public one"],
    ["https://localhost/", false, "a reserved name"],
    ["https://thing.local/", false, "a reserved suffix"],
    ["https://intranet/", false, "a single label"],
    ["https://x.onion/", false, "not the open web"],
    ["https://example.com./", true, "a trailing dot, normalised away"],
    ["https://example.com../", true, "two trailing dots, normalised away too"],
    [`https://example.com/${"a".repeat(2100)}`, false, "longer than we open"],
  ];
  for (const [url, ok, why] of rows) {
    it(`${ok ? "allows" : "refuses"} ${url.slice(0, 48)} — ${why}`, () => {
      expect(checkAddress(url).verdict.ok).toBe(ok);
    });
  }

  it("normalises the origin and drops every trailing dot", () => {
    const { address } = checkAddress("https://Example.COM./team");
    expect(address?.origin).toBe("https://example.com");
    expect(address?.host).toBe("example.com");
    // A second dot survives a single strip, and every comparison downstream —
    // the reserved suffixes, this deployment's own origin, the registry — is a
    // string comparison against a name without one.
    const twice = checkAddress("https://web.archive.org../x");
    expect(twice.address?.host).toBe("web.archive.org");
    // And the URL handed to the transport carries the name the gate decided on.
    expect(twice.address?.url.hostname).toBe("web.archive.org");
  });

  it("refuses a host with an empty label inside it", () => {
    expect(checkAddress("https://a..b.example.com/").verdict.ok).toBe(false);
  });

  it("refuses this deployment's own origin", () => {
    const out = checkAddress("https://sourcing.talentos-app.com/x", {
      selfOrigins: ["https://sourcing.talentos-app.com"],
    });
    expect(out.verdict.reason).toContain("this application");
  });
});

describe("baseDomain", () => {
  it("keeps two-label public suffixes together", () => {
    expect(baseDomain("www.eng.cam.ac.uk")).toBe("cam.ac.uk");
    expect(baseDomain("people.example.co.uk")).toBe("example.co.uk");
    expect(baseDomain("a.b.example.com")).toBe("example.com");
    expect(baseDomain("example.com")).toBe("example.com");
  });
});
