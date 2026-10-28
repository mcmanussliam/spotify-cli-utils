import assert from "node:assert/strict";
import test from "node:test";
import { createReorderPlan, shuffle, shuffledOrder, type ReorderOperation } from "./shuffle.js";

function applyOperation<T>(items: T[], operation: ReorderOperation): void {
  const [item] = items.splice(operation.rangeStart, 1);
  const insertionIndex = operation.rangeStart < operation.insertBefore
    ? operation.insertBefore - 1
    : operation.insertBefore;
  items.splice(insertionIndex, 0, item);
}

test("shuffle preserves every entry, including duplicates", () => {
  const original = ["a", "b", "a", "c", "b"];
  const result = shuffle(original, () => 0.42);

  assert.deepEqual(original, ["a", "b", "a", "c", "b"]);
  assert.deepEqual([...result].sort(), [...original].sort());
});

test("shuffledOrder changes the order when shuffle returns the original order", () => {
  const original = ["a", "b", "c"];
  const result = shuffledOrder(original, () => 0.999999);

  assert.deepEqual(result, ["b", "c", "a"]);
});

test("shuffledOrder handles empty and single-entry playlists", () => {
  assert.deepEqual(shuffledOrder([]), []);
  assert.deepEqual(shuffledOrder(["a"]), ["a"]);
});

test("reorder plan shuffles and restores entries with duplicates and unavailable items", () => {
  const original: (string | null)[] = ["a", null, "b", "a", "c", null];
  const indices = Array.from({ length: original.length }, (_, index) => index);
  const target = shuffledOrder(indices, () => 0.42);
  const operations = createReorderPlan(original.length, target);
  const result = [...original];

  for (const operation of operations) {
    applyOperation(result, operation);
  }
  assert.deepEqual(result, target.map((index) => original[index]));

  for (const operation of [...operations].reverse()) {
    applyOperation(result, {
      rangeStart: operation.insertBefore,
      insertBefore: operation.rangeStart + 1,
    });
  }
  assert.deepEqual(result, original);
});
