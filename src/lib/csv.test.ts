import { describe, test, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  test("plain values, null and numbers", () => {
    expect(csvCell("abc")).toBe("abc");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(-3)).toBe("-3"); // numbers are never formulas
    expect(csvCell(NaN)).toBe("");
  });
  test("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
    expect(csvCell("l1\r\nl2")).toBe('"l1\r\nl2"');
  });
  test.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx", "\rx"])(
    "neutralises formula injection: %j",
    (v) => {
      const out = csvCell(v);
      expect(out.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );
  test("injection guard and quoting combine", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(
      `"'=HYPERLINK(""http://x"",""y"")"`,
    );
  });
  test("a value merely containing = is untouched", () => {
    expect(csvCell("a=b")).toBe("a=b");
    expect(csvCell("/blog/a-b")).toBe("/blog/a-b");
  });
  test("toCsv: header, CRLF, trailing newline", () => {
    expect(toCsv(["a", "b"], [["x", 1], ["y,z", null]])).toBe(
      'a,b\r\nx,1\r\n"y,z",\r\n',
    );
    expect(toCsv(["a"], [])).toBe("a\r\n");
  });
});
