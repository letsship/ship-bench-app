import { describe, expect, it } from "vitest";
import { filterMembers, matchesMemberQuery, membersSubtitle } from "./member-search";

const MEMBERS = [
  { name: "Alice Ng", email: "alice@x.com" },
  { name: "Bob Stone", email: "bob@studio.test" },
  { name: "Carla Diaz", email: "carla.d@x.com" },
];

describe("matchesMemberQuery", () => {
  it("matches a partial name", () => {
    expect(matchesMemberQuery(MEMBERS[1], "stone")).toBe(true);
  });

  it("matches a partial email", () => {
    expect(matchesMemberQuery(MEMBERS[2], "d@x")).toBe(true);
  });

  it("ignores letter case", () => {
    expect(matchesMemberQuery(MEMBERS[0], "ALI")).toBe(true);
    expect(matchesMemberQuery({ name: "x", email: "alice@x.com" }, "ALICE@X")).toBe(true);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(matchesMemberQuery(MEMBERS[0], "  alice  ")).toBe(true);
  });

  it("treats an empty or whitespace query as matching everyone", () => {
    expect(matchesMemberQuery(MEMBERS[0], "")).toBe(true);
    expect(matchesMemberQuery(MEMBERS[0], "   ")).toBe(true);
  });
});

describe("filterMembers", () => {
  it("returns every member for an empty query", () => {
    expect(filterMembers(MEMBERS, "")).toEqual(MEMBERS);
  });

  it("returns every member for a whitespace-only query", () => {
    expect(filterMembers(MEMBERS, "   ")).toEqual(MEMBERS);
  });

  it("keeps only members whose name or email contains the query", () => {
    expect(filterMembers(MEMBERS, "x.com")).toEqual([MEMBERS[0], MEMBERS[2]]);
    expect(filterMembers(MEMBERS, "BOB")).toEqual([MEMBERS[1]]);
  });

  it("returns an empty list when nobody matches", () => {
    expect(filterMembers(MEMBERS, "zed")).toEqual([]);
  });

  it("preserves the extra fields of the members it returns", () => {
    const rich = [{ id: "m1", name: "Alice Ng", email: "alice@x.com", status: "active" }];
    expect(filterMembers(rich, "alice")).toEqual(rich);
  });
});

describe("membersSubtitle", () => {
  it("shows the studio total for an empty query", () => {
    expect(membersSubtitle(42, 42, "")).toBe("42 people at the studio");
  });

  it("shows the studio total for a whitespace-only query", () => {
    expect(membersSubtitle(42, 42, "   ")).toBe("42 people at the studio");
  });

  it("shows matched of total for a non-empty query", () => {
    expect(membersSubtitle(3, 42, "ali")).toBe("3 of 42 people");
  });

  it("shows zero matches for a query nobody satisfies", () => {
    expect(membersSubtitle(0, 42, "zed")).toBe("0 of 42 people");
  });
});
