/**
 * Import fixtures (Wave D). Each carries one column a fair-hiring pattern
 * blocks, one duplicate pair, quoted commas, CRLF and a BOM where noted.
 * Fixtures live outside src/ on purpose: tests/unit/fair-hiring.test.ts
 * greps src/ for the very words these headers contain.
 */
export const HIREEZ_CSV = [
  "﻿Full Name,Title,Company,Location,LinkedIn URL,Email,Phone,Skills,Gender",
  'Ada Example,"Staff Engineer, Platform",Example Labs,"Austin, TX",https://www.linkedin.com/in/ada-example,ada@example.com,+1 512 555 0100,"Rust; Go; Kubernetes",F',
  "Ben Sample,Research Engineer,Sample Corp,London,https://linkedin.com/in/ben-sample/,ben@example.com,,Python;PyTorch,M",
  "Ada Example,Staff Engineer,Example Labs,Austin,https://linkedin.com/in/ada-example,,,Rust,F",
  "Cara Fixture,ML Engineer,Fixture Inc,Berlin,https://linkedin.com/in/cara-fixture,cara@example.com,,JAX,",
].join("\r\n");

export const LINKEDIN_RECRUITER_CSV = [
  "First Name,Last Name,Current Title,Current Company,Location,Profile URL,Date of Birth",
  "Dana,Fixture,Principal Engineer,Fixture Inc,Berlin,https://www.linkedin.com/in/dana-fixture,1980-01-01",
  "Eli,Sample,Engineer,Sample Corp,Paris,https://www.linkedin.com/in/eli-sample,1985-02-02",
].join("\n");

export const GENERIC_ATS_CSV = [
  "Name,Title,Company,Location,Profile,Email,Certifications,Veteran Status",
  "Fay Example,SRE,Example Labs,Remote,https://example.org/fay,fay@example.com,CKA; AWS SA,No",
].join("\n");

export const HEARTBEAT_CSV = [
  "NPI,First Name,Last Name,Specialty,Credential,License State,Facility,City,State,Personal Email,Mobile,Age",
  "1234567893,Priya,Patel,Family Medicine,MD,TX,Austin Clinic,Austin,TX,priya@example.com,+1 512 555 0199,44",
  "not-an-npi,Quinn,Sample,Nurse Practitioner,NP,CA,Bay Clinic,Oakland,CA,,,39",
].join("\n");

export const RAGGED_CSV = [
  "Name,Title",
  "Gus Ragged",
  'Hana Extra,Engineer,"has, comma"',
].join("\n");

export const JSON_EXPORT = JSON.stringify({
  results: [
    {
      name: "Ivo Json",
      title: "Engineer",
      company: "Json Co",
      location: "Lisbon",
      profile: { url: "https://linkedin.com/in/ivo-json" },
      skills: ["Rust", "Go"],
    },
    { name: "", title: "No name" },
  ],
});
