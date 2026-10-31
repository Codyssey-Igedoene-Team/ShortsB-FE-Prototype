import test from "node:test";
import assert from "node:assert/strict";
import { restore, persist, type StoragePort } from "../src/domain/storage";
import { defaults, LEGACY_KEY, STORAGE_KEY } from "../src/domain/reading";
function memory(initial: [string, string][] = []) {
  const data = new Map(initial);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
test("corrupt new storage is backed up and legacy data recovered before overwrite", () => {
  const old = JSON.stringify({ ...defaults(), saved: ["waiting"] });
  const storage = memory([
    [STORAGE_KEY, "{broken"],
    [LEGACY_KEY, old],
  ]);
  const result = restore(storage);
  assert.equal(result.canWrite, true);
  assert.deepEqual(result.state.saved, ["waiting"]);
  assert.ok(
    [...storage.data].some(
      ([key, value]) =>
        key.startsWith(STORAGE_KEY + ".recovery.") && value === "{broken",
    ),
  );
  assert.equal(storage.getItem(LEGACY_KEY), old);
});
test("a full storage area never permits corrupt data to be overwritten without backup", () => {
  const storage: StoragePort = {
    getItem: () => "{broken",
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(restore(storage).canWrite, false);
  assert.equal(persist(storage, defaults()), false);
});
