/** Move an array item from one index to another (immutable). */
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  if (from === to) return array;
  if (from < 0 || to < 0 || from >= array.length || to >= array.length) {
    return array;
  }
  const next = array.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
