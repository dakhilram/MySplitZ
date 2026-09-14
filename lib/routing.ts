export type AppPage = "dashboard" | "trips" | "people" | "ledger" | "daybook";

export type RecordFilters = {
  personId: string;
  tripId: string;
  from: string;
  to: string;
  type: string;
};

const recordPages = new Set<AppPage>(["ledger", "daybook"]);

export const pageFromView = (view: string | null): AppPage =>
  view === "trips" || view === "people" || view === "ledger" || view === "daybook"
    ? view
    : "dashboard";

export const viewFromPage = (page: AppPage) =>
  page === "dashboard" ? "home" : page;

export function routeUrl(
  page: AppPage,
  filters: RecordFilters,
  pathname = "/",
) {
  const query = new URLSearchParams({ view: viewFromPage(page) });
  if (recordPages.has(page)) {
    if (filters.tripId !== "all") query.set("tripId", filters.tripId);
    if (filters.personId) query.set("personId", filters.personId);
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (page === "ledger" && filters.type !== "all") query.set("type", filters.type);
  }
  return `${pathname}?${query.toString()}`;
}

export function parseRoute(search: string) {
  const query = new URLSearchParams(search);
  return {
    page: pageFromView(query.get("view") || query.get("page")),
    filters: {
      tripId: query.get("tripId") || "all",
      personId: query.get("personId") || "",
      from: query.get("from") || "",
      to: query.get("to") || "",
      type: query.get("type") || "all",
    },
  };
}
