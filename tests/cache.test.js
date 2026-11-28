import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readCachedJson, writeCachedJson } from "../js/lib/cache.js";

// localStorage test doubles. They stand in for the browser so that the failure modes
// (blocked storage, corrupt data, full storage) can be exercised deterministically.
function installStorage(storage) {
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
}

afterEach(() => {
  delete globalThis.localStorage;
});

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    data
  };
}

describe("readCachedJson", () => {
  it("returns the parsed value that was stored", () => {
    installStorage(memoryStorage({ k: JSON.stringify({ a: [1, 2] }) }));
    assert.deepEqual(readCachedJson("k"), { a: [1, 2] });
  });

  it("returns null for a missing key", () => {
    installStorage(memoryStorage());
    assert.equal(readCachedJson("missing"), null);
  });

  it("returns null for malformed JSON instead of throwing", () => {
    installStorage(memoryStorage({ k: "{not json" }));
    assert.equal(readCachedJson("k"), null);
  });

  it("returns null when storage access throws", () => {
    installStorage({ getItem() { throw new Error("SecurityError"); } });
    assert.equal(readCachedJson("k"), null);
  });

  it("returns null when localStorage does not exist", () => {
    assert.equal(typeof globalThis.localStorage, "undefined");
    assert.equal(readCachedJson("k"), null);
  });
});

describe("writeCachedJson", () => {
  it("stores a JSON string and reports success", () => {
    const storage = memoryStorage();
    installStorage(storage);
    assert.equal(writeCachedJson("k", { savedAt: 1, list: ["x"] }), true);
    assert.equal(storage.data.k, JSON.stringify({ savedAt: 1, list: ["x"] }));
    assert.deepEqual(readCachedJson("k"), { savedAt: 1, list: ["x"] });
  });

  it("reports failure instead of throwing when storage is full or blocked", () => {
    installStorage({ setItem() { throw new Error("QuotaExceededError"); } });
    assert.equal(writeCachedJson("k", { a: 1 }), false);
  });

  it("reports failure when localStorage does not exist", () => {
    assert.equal(writeCachedJson("k", { a: 1 }), false);
  });

  it("reports failure for values that cannot be serialised", () => {
    installStorage(memoryStorage());
    const circular = {};
    circular.self = circular;
    assert.equal(writeCachedJson("k", circular), false);
  });
});
