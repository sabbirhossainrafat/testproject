import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SITE } from "../js/data/site.js";

describe("interest groups", () => {
  const grouped = SITE.interestGroups.flatMap((group) => group.interests);

  it("shows every listed interest in exactly one group, so none is silently dropped", () => {
    for (const interest of SITE.interests) {
      assert.equal(grouped.filter((value) => value === interest).length, 1, interest);
    }
  });

  it("only groups interests that exist in the interest list", () => {
    for (const interest of grouped) {
      assert.ok(SITE.interests.includes(interest), interest);
    }
  });

  it("has unique, non-empty ids and labels (ids become element ids)", () => {
    const ids = SITE.interestGroups.map((group) => group.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const group of SITE.interestGroups) {
      assert.match(group.id, /^[a-z][a-z0-9-]*$/);
      assert.ok(group.label.trim().length > 0);
      assert.ok(group.interests.length > 0);
    }
  });
});

describe("ambition statement", () => {
  it("is a non-empty string", () => {
    assert.equal(typeof SITE.ambition, "string");
    assert.ok(SITE.ambition.trim().length > 0);
  });
});
