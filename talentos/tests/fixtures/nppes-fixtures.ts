/**
 * NPPES v2.1 payload fixtures (Wave E). Deliberately carry fields the
 * adapter must NOT keep — a mailing address, enumeration dates, and the
 * demographic field the real API returns — so the allow-list test can
 * assert none of their values leak. Lives under tests/, which the
 * fair-hiring grep does not scan.
 */
export const NPPES_SEARCH_PAYLOAD = {
  result_count: 2,
  results: [
    {
      number: "1234567893",
      enumeration_type: "NPI-1",
      created_epoch: "1136073600",
      last_updated_epoch: "1704067200",
      basic: {
        first_name: "PRIYA",
        last_name: "PATEL",
        credential: "MD",
        sole_proprietor: "NO",
        gender: "F",
        enumeration_date: "2006-01-01",
        status: "A",
      },
      addresses: [
        {
          address_purpose: "MAILING",
          address_1: "PO BOX 999",
          city: "HOUSTON",
          state: "TX",
          postal_code: "770010999",
          telephone_number: "713-555-0000",
        },
        {
          address_purpose: "LOCATION",
          address_1: "100 CLINIC WAY",
          city: "AUSTIN",
          state: "TX",
          postal_code: "787010000",
          telephone_number: "512-555-0100",
        },
      ],
      taxonomies: [
        {
          code: "207Q00000X",
          desc: "Family Medicine",
          state: "TX",
          license: "TX12345",
          primary: true,
        },
      ],
      identifiers: [{ identifier: "SECRET-ID-1", desc: "Other" }],
    },
    {
      number: "1987654321",
      enumeration_type: "NPI-1",
      basic: {
        first_name: "PRIYA",
        last_name: "PATEL",
        credential: "DO",
        gender: "F",
      },
      addresses: [
        { address_purpose: "LOCATION", city: "OAKLAND", state: "CA" },
      ],
      taxonomies: [
        {
          code: "207R00000X",
          desc: "Internal Medicine",
          state: "CA",
          primary: true,
        },
      ],
    },
    { number: "0000000000", basic: { first_name: "", last_name: "" } },
  ],
};

export const NPPES_ERROR_PAYLOAD = {
  Errors: [
    { description: "Invalid state value", field: "state", number: "01" },
  ],
};

/** Values that must never appear in a mapped record. */
export const NPPES_FORBIDDEN_VALUES = [
  "PO BOX 999",
  "HOUSTON",
  "713-555-0000",
  "770010999",
  "SECRET-ID-1",
  "1136073600",
  "2006-01-01",
  '"F"',
  "sole_proprietor",
];
