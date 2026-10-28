export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }

  return result;
}

export interface ReorderOperation {
  rangeStart: number;
  insertBefore: number;
}

/** Build single-item moves that transform positions 0…length-1 into target. */
export function createReorderPlan(length: number, target: readonly number[]): ReorderOperation[] {
  const current = Array.from({ length }, (_, index) => index);
  const operations: ReorderOperation[] = [];

  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    const currentIndex = current.indexOf(target[targetIndex], targetIndex);
    if (currentIndex === targetIndex) {
      continue;
    }

    operations.push({ rangeStart: currentIndex, insertBefore: targetIndex });
    const [item] = current.splice(currentIndex, 1);
    current.splice(targetIndex, 0, item);
  }

  return operations;
}

export function shuffledOrder<T>(items: readonly T[], random?: () => number): T[] {
  if (items.length < 2) {
    return [...items];
  }

  const result = shuffle(items, random);

  // Avoid leaving the playlist visibly unchanged. Rotation also works when the
  // shuffle happened to produce the original order.
  if (result.every((item, index) => item === items[index])) {
    result.push(result.shift() as T);
  }

  return result;
}
