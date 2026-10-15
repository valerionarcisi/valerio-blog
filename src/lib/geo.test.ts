import { describe, test, expect } from "vitest";
import { parseNetlifyGeo, countryFromGeo } from "./geo";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

describe("parseNetlifyGeo", () => {
  test("base64 JSON with country.code", () => {
    expect(
      parseNetlifyGeo(
        b64({ city: "Rome", country: { code: "it", name: "Italy" } }),
      ),
    ).toBe("IT");
  });

  test("base64url variant", () => {
    const v = b64({ country: { code: "FR" }, subdivision: { name: "é>?" } })
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(parseNetlifyGeo(v)).toBe("FR");
  });

  test("raw and URL-encoded JSON", () => {
    expect(parseNetlifyGeo('{"country":{"code":"DE"}}')).toBe("DE");
    expect(
      parseNetlifyGeo(encodeURIComponent('{"country":{"code":"ES"}}')),
    ).toBe("ES");
  });

  test("country as plain string", () => {
    expect(parseNetlifyGeo(b64({ country: "GB" }))).toBe("GB");
  });

  test("garbage, empty, invalid codes -> null", () => {
    expect(parseNetlifyGeo(null)).toBeNull();
    expect(parseNetlifyGeo("")).toBeNull();
    expect(parseNetlifyGeo("%%%not-json")).toBeNull();
    expect(parseNetlifyGeo(b64({ country: { code: "ITA" } }))).toBeNull();
    expect(parseNetlifyGeo(b64({ country: { code: "XX" } }))).toBeNull();
    expect(parseNetlifyGeo(b64({ city: "Rome" }))).toBeNull();
  });
});

describe("countryFromGeo", () => {
  test("context geo wins over header", () => {
    const h = new Headers({ "x-nf-geo": b64({ country: { code: "IT" } }) });
    expect(countryFromGeo(h, { country: { code: "US" } })).toBe("US");
  });

  test("falls back to header, then null", () => {
    expect(
      countryFromGeo(
        new Headers({ "x-nf-geo": b64({ country: { code: "IT" } }) }),
      ),
    ).toBe("IT");
    expect(countryFromGeo(new Headers(), undefined)).toBeNull();
  });
});
