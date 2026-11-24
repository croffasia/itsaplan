// Buckets a list by a key, keeping the order the keys first appear in, so a grouped list
// follows the order its source list came in.
export function groupInOrder<T, K>(items: T[], key: (item: T) => K): [K, T[]][] {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const group = key(item);
    const bucket = groups.get(group);
    if (bucket) bucket.push(item);
    else groups.set(group, [item]);
  }
  return [...groups];
}
