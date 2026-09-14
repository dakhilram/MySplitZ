import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeFirestoreData } from "../lib/firestore-serialization.ts";
import { createPersonSavePayload } from "../lib/person-payload.ts";

test("Firestore sanitizer removes undefined without changing valid values", () => {
  const created = new Date("2026-09-13T12:00:00.000Z");
  const result = sanitizeFirestoreData({
    name: "Dad",
    amount: undefined,
    zero: 0,
    enabled: false,
    empty: "",
    nullable: null,
    created,
    nested: { keep: "yes", omit: undefined },
    entries: [0, false, "", null, undefined, { keep: 1, omit: undefined }],
  });

  assert.deepEqual(result, {
    name: "Dad",
    zero: 0,
    enabled: false,
    empty: "",
    nullable: null,
    created,
    nested: { keep: "yes" },
    entries: [0, false, "", null, { keep: 1 }],
  });
  assert.equal(result.created, created);
});

test("person save payload is valid with only a name or optional details", () => {
  const nameOnly = createPersonSavePayload({ id: "person-1", name: "Dad" });
  const optional = createPersonSavePayload({
    id: "person-2",
    name: "Venu",
    phone: "98765 43210",
    email: "venu@example.test",
    notes: "Family member",
  });

  assert.deepEqual(nameOnly, { id: "person-1", name: "Dad" });
  assert.deepEqual(optional, {
    id: "person-2",
    name: "Venu",
    phone: "98765 43210",
    email: "venu@example.test",
    notes: "Family member",
  });
  assert.equal("amount" in nameOnly, false);
  assert.equal("amount" in optional, false);
});
