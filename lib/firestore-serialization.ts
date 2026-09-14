/**
 * Removes values Firestore cannot serialize without changing meaningful values.
 * Only plain objects are traversed so Firestore Timestamp, DocumentReference,
 * Date, GeoPoint, FieldValue, and other SDK instances remain untouched.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export function sanitizeFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as T;
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, sanitizeFirestoreData(item)]),
  ) as T;
}
