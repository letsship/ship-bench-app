import { describe, expect, it } from "vitest";
import { filterMembersByName, matchesMemberSearch } from "./member-search";

describe("matchesMemberSearch", () => {
  it("matches case-insensitively", () => {
    expect(matchesMemberSearch("Ada Lovelace", "ada")).toBe(true);
    expect(matchesMemberSearch("Ada Lovelace", "LOVE")).toBe(true);
  });

  it("matches a partial substring anywhere in the name", () => {
    expect(matchesMemberSearch("Grace Hopper", "e hop")).toBe(true);
  });

  it("treats an empty query as matching everyone", () => {
    expect(matchesMemberSearch("Grace Hopper", "")).toBe(true);
  });

  it("treats a whitespace-only query as matching everyone", () => {
    expect(matchesMemberSearch("Grace Hopper", "   ")).toBe(true);
  });

  it("returns false when the name does not contain the query", () => {
    expect(matchesMemberSearch("Grace Hopper", "xyz")).toBe(false);
  });
});

describe("filterMembersByName", () => {
  const members = [{ name: "Ada Lovelace" }, { name: "Grace Hopper" }, { name: "Alan Turing" }];

  it("narrows to members whose name contains the query", () => {
    expect(filterMembersByName(members, "a").map((m) => m.name)).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
      "Alan Turing",
    ]);
    expect(filterMembersByName(members, "grace").map((m) => m.name)).toEqual(["Grace Hopper"]);
  });

  it("returns everyone for an empty query", () => {
    expect(filterMembersByName(members, "")).toEqual(members);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterMembersByName(members, "zzz")).toEqual([]);
  });
});
