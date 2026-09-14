import assert from "node:assert/strict";
import test from "node:test";
import { parseRoute, routeUrl } from "../lib/routing.ts";

const filters = {
  personId: "demo-dad",
  tripId: "demo-goa",
  from: "2026-02-14",
  to: "2026-02-18",
  type: "Expense paid",
};

test("Home route clears Ledger filters while preserving the GitHub Pages base path", () => {
  assert.equal(routeUrl("dashboard", filters, "/MySplitZ/"), "/MySplitZ/?view=home");
});

test("Ledger and Daybook filters restore from the URL", () => {
  assert.deepEqual(
    parseRoute("?view=ledger&tripId=demo-goa&personId=demo-dad&from=2026-02-14&to=2026-02-18&type=Expense+paid"),
    { page: "ledger", filters },
  );
  assert.deepEqual(
    parseRoute("?view=daybook&tripId=demo-goa&personId=demo-dad&from=2026-02-14&to=2026-02-18"),
    { page: "daybook", filters: { ...filters, type: "all" } },
  );
});
