/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CircleDollarSign,
  Download,
  Landmark,
  LayoutDashboard,
  MapPinned,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db, firebaseSetupMessage } from "@/lib/firebase";
import { sampleData } from "@/lib/demo-data";
import { sanitizeFirestoreData } from "@/lib/firestore-serialization";
import { createPersonSavePayload } from "@/lib/person-payload";
import {
  parseRoute,
  routeUrl,
  type AppPage,
  type RecordFilters,
} from "@/lib/routing";

type Person = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  archived?: boolean;
};
type Trip = {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  memberIds: string[];
  archived?: boolean;
};
type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  tripId: string;
  paidBy: string;
  participantIds: string[];
  splitMethod?: string;
  splits?: Record<string, number>;
};
type Settlement = {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  note?: string;
  tripId?: string;
};
type Activity = {
  id: string;
  text: string;
  date: string;
  kind: string;
  amount?: number;
  tripId?: string;
};
type Data = {
  people: Person[];
  trips: Trip[];
  expenses: Expense[];
  settlements: Settlement[];
  activity: Activity[];
};
type WriteResult = { ok: true } | { ok: false; message: string };
type Row = {
  sourceId?: string;
  date: string;
  type: string;
  description: string;
  tripId?: string;
  trip: string;
  from: string;
  to: string;
  debit: number;
  credit: number;
  balance: number;
  note: string;
};
const today = () => new Date().toISOString().slice(0, 10),
  uid = () => crypto.randomUUID(),
  money = (n = 0) =>
    `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
  date = (d?: string) =>
    d
      ? new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
const seed: Data = {
  people: [
    { id: "p1", name: "Dad", phone: "98765 43210", notes: "Trip organiser" },
    { id: "p2", name: "Venu" },
    { id: "p3", name: "Brahmam" },
    { id: "p4", name: "Lakshmi" },
  ],
  trips: [
    {
      id: "t1",
      name: "Goa Trip 2026",
      description: "Family holiday",
      startDate: "2026-02-14",
      endDate: "2026-02-18",
      memberIds: ["p1", "p2", "p3", "p4"],
    },
  ],
  expenses: [
    {
      id: "e1",
      title: "Hotel stay",
      amount: 18000,
      category: "Stay",
      date: "2026-02-14",
      tripId: "t1",
      paidBy: "p1",
      participantIds: ["p1", "p2", "p3", "p4"],
      splitMethod: "equal",
      note: "Four nights",
    },
    {
      id: "e2",
      title: "Dinner by the beach",
      amount: 2400,
      category: "Food",
      date: "2026-02-15",
      tripId: "t1",
      paidBy: "p2",
      participantIds: ["p1", "p2", "p3", "p4"],
      splitMethod: "equal",
    },
  ],
  settlements: [
    {
      id: "s1",
      from: "p3",
      to: "p1",
      amount: 2000,
      date: "2026-02-16",
      tripId: "t1",
      note: "Part payment",
    },
  ],
  activity: [
    {
      id: "a1",
      text: "Brahmam paid Dad",
      date: "2026-02-16",
      kind: "settlement",
      amount: 2000,
      tripId: "t1",
    },
    {
      id: "a2",
      text: "Dinner by the beach added",
      date: "2026-02-15",
      kind: "expense",
      amount: 2400,
      tripId: "t1",
    },
  ],
};
const nav = [
  ["dashboard", "Home", LayoutDashboard],
  ["trips", "Trips", MapPinned],
  ["people", "People", Users],
  ["ledger", "Ledger", BookOpen],
  ["daybook", "Daybook", ReceiptText],
] as const;
const recordPages = new Set<AppPage>(["ledger", "daybook"]);
const ledgerTypes = new Set([
  "all",
  "Expense paid",
  "Expense share",
  "Settlement paid",
  "Settlement received",
]);
function useData() {
  const [data, setData] = useState<Data>(seed),
    [loading, setLoading] = useState(true),
    [cloud, setCloud] = useState(false),
    [connectionError, setConnectionError] = useState<string | null>(null);
  useEffect(() => {
    const cached = localStorage.getItem("dads-trip-book");
    if (cached) setData(JSON.parse(cached));
    if (!db) {
      setLoading(false);
      return;
    }
    setCloud(true);
    const names = [
        "people",
        "trips",
        "expenses",
        "settlements",
        "activity",
      ] as const,
      loaded: Partial<Data> = {};
    const stop = names.map((name) =>
      onSnapshot(
        collection(db, name),
        (snap) => {
          (loaded as any)[name] = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          if (names.every((n) => loaded[n])) {
            setData(loaded as Data);
            setLoading(false);
          }
        },
        () => {
          setCloud(false);
          setConnectionError(
            "Firestore could not be reached. Check the Firebase project configuration and Firestore rules.",
          );
          setLoading(false);
        },
      ),
    );
    return () => stop.forEach((x) => x());
  }, []);
  const failureMessage = (error: unknown, action: "save" | "delete") => {
    const code = (error as { code?: string } | null)?.code;
    if (code === "permission-denied")
      return "Firestore denied this change. Check the Firestore rules and try again.";
    if (code === "unavailable")
      return "Firestore is temporarily unavailable. Check your connection and try again.";
    if (code === "invalid-argument")
      return "Some saved details are invalid. Review the form and try again.";
    return action === "save"
      ? "Could not save this record. Please try again."
      : "Could not delete this record. Please try again.";
  };
  const save = async (name: keyof Data, value: any): Promise<WriteResult> => {
    if (!value || typeof value.id !== "string" || !value.id) {
      return { ok: false, message: "This record is missing an ID and could not be saved." };
    }
    const serialized = sanitizeFirestoreData(value);
    try {
      if (cloud && db) await setDoc(doc(db, name, serialized));
      else
      setData((p) => {
        const n = {
          ...p,
          [name]: [
            ...(p[name] as any[]).filter((x) => x.id !== value.id),
            serialized,
          ],
        };
        localStorage.setItem("dads-trip-book", JSON.stringify(n));
        return n;
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: failureMessage(error, "save") };
    }
  };
  const remove = async (name: keyof Data, id: string): Promise<WriteResult> => {
    try {
      if (cloud && db) await deleteDoc(doc(db, name, id));
      else
      setData((p) => {
        const n = {
          ...p,
          [name]: (p[name] as any[]).filter((x) => x.id !== id),
        };
        localStorage.setItem("dads-trip-book", JSON.stringify(n));
        return n;
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: failureMessage(error, "delete") };
    }
  };
  return { data, loading, cloud, connectionError, save, remove };
}
const name = (data: Data, id?: string) =>
    data.people.find((p) => p.id === id)?.name || "—",
  tripName = (data: Data, id?: string) =>
    data.trips.find((t) => t.id === id)?.name || "—";
function tripBalances(data: Data, tripId?: string) {
  const out: Record<string, number> = Object.fromEntries(
    data.people.map((p) => [p.id, 0]),
  );
  data.expenses
    .filter((e) => !tripId || e.tripId === tripId)
    .forEach((e) => {
      out[e.paidBy] += e.amount;
      e.participantIds.forEach(
        (id) =>
          (out[id] -=
            e.splits?.[id] ?? e.amount / e.participantIds.length),
      );
    });
  data.settlements
    .filter((s) => !tripId || s.tripId === tripId)
    .forEach((s) => {
      out[s.from] += s.amount;
      out[s.to] -= s.amount;
    });
  return out;
}
function suggestions(data: Data, tripId: string) {
  const b = tripBalances(data, tripId),
    creditors = Object.entries(b)
      .filter(([, v]) => v > 0.005)
      .map(([id, amount]) => ({ id, amount })),
    debtors = Object.entries(b)
      .filter(([, v]) => v < -0.005)
      .map(([id, value]) => ({ id, amount: -value })),
    out: any[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.005) i++;
    if (creditors[j].amount < 0.005) j++;
  }
  return out;
}
function downloadTripReport(data: Data, trip: Trip) {
  const report = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }),
    expenses = data.expenses.filter((expense) => expense.tripId === trip.id),
    settlements = data.settlements.filter((settlement) => settlement.tripId === trip.id),
    balances = tripBalances(data, trip.id),
    totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0),
    memberRows = trip.memberIds.map((id) => {
      const paid = expenses
          .filter((expense) => expense.paidBy === id)
          .reduce((sum, expense) => sum + expense.amount, 0),
        owed = expenses.reduce(
          (sum, expense) =>
            sum +
            (expense.participantIds.includes(id)
              ? (expense.splits?.[id] ??
                expense.amount / expense.participantIds.length)
              : 0),
          0,
        ),
        balance = balances[id] || 0,
        status =
          Math.abs(balance) < 0.005
            ? "Settled up"
            : balance > 0
              ? `Should receive ${money(balance)}`
              : `Owes ${money(balance)}`;
      return [name(data, id), money(paid), money(owed), money(balance), status];
    }),
    section = (title: string, head: string[][], body: any[][], startY: number) => {
      report.setFontSize(12);
      report.setTextColor(21, 93, 88);
      report.text(title, 14, startY - 4);
      report.setTextColor(20, 47, 45);
      autoTable(report, {
        startY,
        head,
        body,
        theme: "grid",
        showHead: "everyPage",
        styles: {
          fontSize: 7,
          cellPadding: 1.6,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: { fillColor: [21, 93, 88] },
        alternateRowStyles: { fillColor: [247, 251, 249] },
      });
      return (report as any).lastAutoTable.finalY as number;
    };
  report.setFontSize(18);
  report.setTextColor(20, 47, 45);
  report.text("MySplitZ — Final Trip Report", 14, 14);
  report.setFontSize(11);
  report.text(trip.name, 14, 21);
  report.setFontSize(9);
  [
    `Dates: ${date(trip.startDate)} to ${date(trip.endDate)}`,
    `Status: ${trip.archived ? "Archived (read-only)" : "Active"}`,
    `Description: ${trip.description || "—"}`,
    `Total trip spending: ${money(totalSpent)}`,
    `Created: ${date(today())}`,
  ].forEach((line, index) => report.text(line, 14, 28 + index * 5));
  report.setFontSize(8);
  report.text("MySplitZ", 14, 8);
  section(
    "Members and balances",
    [["Member", "Total paid", "Total owed", "Net balance", "Status"]],
    memberRows,
    57,
  );
  report.addPage();
  report.setFontSize(8);
  report.text("MySplitZ — Final Trip Report", 14, 8);
  section(
    "Expenses",
    [["Date", "Title", "Category", "Paid by", "Participants", "Split method", "Amount", "Notes"]],
    expenses.length
      ? expenses.map((expense) => [
          date(expense.date),
          expense.title,
          expense.category,
          name(data, expense.paidBy),
          expense.participantIds.map((id) => name(data, id)).join(", "),
          expense.splitMethod || "equal",
          money(expense.amount),
          expense.note || "—",
        ])
      : [["No expenses recorded", "", "", "", "", "", "", ""]],
    17,
  );
  report.addPage();
  report.setFontSize(8);
  report.text("MySplitZ — Final Trip Report", 14, 8);
  let y = section(
    "Settlements",
    [["Date", "From", "To", "Amount", "Notes"]],
    settlements.length
      ? settlements.map((settlement) => [
          date(settlement.date),
          name(data, settlement.from),
          name(data, settlement.to),
          money(settlement.amount),
          settlement.note || "—",
        ])
      : [["No settlements recorded", "", "", "", ""]],
    17,
  );
  if (y > 175) {
    report.addPage();
    report.setFontSize(8);
    report.text("MySplitZ — Final Trip Report", 14, 8);
    y = 17;
  }
  section(
    "Final minimum settlement suggestions",
    [["From", "To", "Amount"]],
    suggestions(data, trip.id).length
      ? suggestions(data, trip.id).map((suggestion) => [
          name(data, suggestion.from),
          name(data, suggestion.to),
          money(suggestion.amount),
        ])
      : [["No settlement needed", "", ""]],
    y + 16,
  );
  report.save(`${slug(trip.name)}-final-trip-report-${today()}.pdf`);
}
function rows(data: Data, personId: string) {
  const out: Row[] = [];
  data.expenses.forEach((e) => {
    const share =
        e.splits?.[personId] ?? e.amount / e.participantIds.length,
      payer = name(data, e.paidBy),
      tr = tripName(data, e.tripId),
      method = e.splitMethod || "equal";
    if (e.paidBy === personId)
      out.push({
        sourceId: e.id,
        date: e.date,
        type: "Expense paid",
        description: `${e.title} (${method} split)`,
        tripId: e.tripId,
        trip: tr,
        from: payer,
        to: e.participantIds.map((id) => name(data, id)).join(", "),
        debit: 0,
        credit: e.amount,
        balance: 0,
        note: e.note || "",
      });
    if (e.participantIds.includes(personId))
      out.push({
        sourceId: e.id,
        date: e.date,
        type: "Expense share",
        description: `${e.title} (${method} split)`,
        tripId: e.tripId,
        trip: tr,
        from: payer,
        to: name(data, personId),
        debit: share,
        credit: 0,
        balance: 0,
        note: e.note || "",
      });
  });
  data.settlements.forEach((s) => {
    const tr = tripName(data, s.tripId);
    if (s.from === personId)
      out.push({
        date: s.date,
        type: "Settlement paid",
        description: "Repayment",
        tripId: s.tripId,
        trip: tr,
        from: name(data, s.from),
        to: name(data, s.to),
        debit: 0,
        credit: s.amount,
        balance: 0,
        note: s.note || "",
      });
    if (s.to === personId)
      out.push({
        date: s.date,
        type: "Settlement received",
        description: "Repayment",
        tripId: s.tripId,
        trip: tr,
        from: name(data, s.from),
        to: name(data, s.to),
        debit: s.amount,
        credit: 0,
        balance: 0,
        note: s.note || "",
      });
  });
  let b = 0;
  return out
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ ...r, balance: (b += r.credit - r.debit) }));
}
const Metric = ({ label, value, note, icon }: any) => (
  <section className="metric">
    {icon && <span>{icon}</span>}
    <div>
      <p>{label}</p>
      <h2>{value}</h2>
      {note && <small>{note}</small>}
    </div>
  </section>
);
const Status = ({ value }: any) => (
  <span className={`status ${value >= 0 ? "receive" : "owe"}`}>
    {Math.abs(value) < 0.005
      ? "Settled up"
      : value >= 0
        ? `You should receive ${money(value)}`
        : `You need to pay ${money(value)}`}
  </span>
);
const Empty = ({ children }: any) => <div className="empty">{children}</div>;
export default function Home() {
  const { data, loading, cloud, connectionError, save, remove } = useData(),
    [page, setPage] = useState<AppPage>("dashboard"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [person, setPerson] = useState("p1"),
    [tripFilter, setTripFilter] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [transactionType, setTransactionType] = useState("all"),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const defaultPerson = useCallback(
    (tripId = "all") => {
      const trip = data.trips.find((item: Trip) => item.id === tripId);
      const candidates = trip
        ? trip.memberIds
            .map((id) => data.people.find((item: Person) => item.id === id))
            .filter((item): item is Person => Boolean(item && !item.archived))
        : data.people.filter((item: Person) => !item.archived);
      return candidates.find((item) => item.id === "p1")?.id || candidates[0]?.id || "";
    },
    [data.people, data.trips],
  );

  const resolveRecordFilters = useCallback(
    (requested: Partial<RecordFilters>): RecordFilters => {
      const requestedTrip = requested.tripId ?? "all";
      const tripId =
        requestedTrip !== "all" && data.trips.some((trip: Trip) => trip.id === requestedTrip)
          ? requestedTrip
          : "all";
      const allowedPeople =
        tripId === "all"
          ? data.people.filter((item: Person) => !item.archived)
          : (data.trips.find((trip: Trip) => trip.id === tripId)?.memberIds || [])
              .map((id) => data.people.find((item: Person) => item.id === id))
              .filter((item): item is Person => Boolean(item && !item.archived));
      const requestedPerson = requested.personId || "";
      const personId = allowedPeople.some((item) => item.id === requestedPerson)
        ? requestedPerson
        : defaultPerson(tripId);

      return {
        personId,
        tripId,
        from: requested.from || "",
        to: requested.to || "",
        type: ledgerTypes.has(requested.type || "all") ? requested.type || "all" : "all",
      };
    },
    [data.people, data.trips, defaultPerson],
  );

  useEffect(() => {
    const applyUrl = () => {
      const requestedRoute = parseRoute(window.location.search);
      const nextPage = requestedRoute.page;
      const filters = resolveRecordFilters({
        ...requestedRoute.filters,
      });
      setPage(nextPage);
      setTripFilter(filters.tripId);
      setPerson(filters.personId);
      setFrom(filters.from);
      setTo(filters.to);
      setTransactionType(nextPage === "ledger" ? filters.type : "all");

      const canonical = routeUrl(nextPage, filters, window.location.pathname);
      if (`${window.location.pathname}${window.location.search}` !== canonical)
        window.history.replaceState({}, "", canonical);
    };
    const handlePopState = () => {
      setNotice(null);
      setModal(null);
      setEditing(null);
      applyUrl();
    };
    applyUrl();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [data.people, data.trips, resolveRecordFilters]);

  const navigate = useCallback(
    (nextPage: AppPage, requested: Partial<RecordFilters> = {}, replace = false) => {
      const isCurrentRecordPage = recordPages.has(page);
      const filters = resolveRecordFilters({
        personId: requested.personId ?? (isCurrentRecordPage ? person : defaultPerson()),
        tripId: requested.tripId ?? (isCurrentRecordPage ? tripFilter : "all"),
        from: requested.from ?? (isCurrentRecordPage ? from : ""),
        to: requested.to ?? (isCurrentRecordPage ? to : ""),
        type: requested.type ?? (page === "ledger" ? transactionType : "all"),
      });
      const url = routeUrl(nextPage, filters, window.location.pathname);
      window.history[replace ? "replaceState" : "pushState"]({}, "", url);
      if (nextPage !== page) {
        setNotice(null);
        setModal(null);
        setEditing(null);
      }
      setPage(nextPage);
      setTripFilter(filters.tripId);
      setPerson(filters.personId);
      setFrom(filters.from);
      setTo(filters.to);
      setTransactionType(nextPage === "ledger" ? filters.type : "all");
    },
    [defaultPerson, from, page, person, resolveRecordFilters, to, transactionType, tripFilter],
  );

  const updateRecordFilters = useCallback(
    (requested: Partial<RecordFilters>) => navigate(page, requested, true),
    [navigate, page],
  );
  const bal = useMemo(() => tripBalances(data), [data]),
    isArchivedTrip = (tripId?: string) =>
      Boolean(data.trips.find((trip: Trip) => trip.id === tripId)?.archived),
    open = (type: any, item: any = null) => {
      const relatedTripId = type === "trip" ? item?.id : item?.tripId;
      if (
        relatedTripId &&
        isArchivedTrip(relatedTripId) &&
        ["trip", "expense", "settlement"].includes(type)
      ) {
        alert("This trip is archived. Restore it before making changes.");
        return;
      }
      setEditing(item);
      setModal(type);
    },
    activity = async (text: string, kind: string, amount?: number, tripId?: string) =>
      save("activity", {
        id: uid(),
        text,
        kind,
        amount,
        tripId,
        date: today(),
      }),
    archiveTrip = async (trip: Trip) => {
      if (!confirm(`Archive ${trip.name}? Its records will remain available as read-only.`)) return;
      const result = await save("trips", { ...trip, archived: true });
      if (result.ok) {
        await activity(`${trip.name} archived`, "trip", undefined, trip.id);
        setNotice(`${trip.name} archived.`);
      } else setNotice(result.message);
    },
    restoreTrip = async (trip: Trip) => {
      const result = await save("trips", { ...trip, archived: false });
      if (result.ok) {
        await activity(`${trip.name} restored`, "trip", undefined, trip.id);
        setNotice(`${trip.name} restored.`);
      } else setNotice(result.message);
    },
    archivePerson = async (personToArchive: Person) => {
      if (!confirm(`Archive ${personToArchive.name}? Their past records will remain available.`))
        return;
      const result = await save("people", createPersonSavePayload({ ...personToArchive, archived: true }));
      if (result.ok) {
        setNotice(`${personToArchive.name} archived.`);
      } else setNotice(result.message);
    },
    destroy = async (type: keyof Data, item: any) => {
      if (
        (type === "expenses" || type === "settlements") &&
        isArchivedTrip(item.tripId)
      ) {
        alert("This trip is archived. Restore it before deleting records.");
        return;
      }
      if (!confirm(`Delete this ${type.slice(0, -1)}? This cannot be undone.`))
        return;
      const result = await remove(type, item.id);
      if (result.ok) {
        await activity(
          `${item.title || item.name || "Record"} deleted`,
          `deleted`,
          item.amount,
          item.tripId,
        );
        setNotice("Record deleted.");
      } else setNotice(result.message);
    };
  const isDevelopment = process.env.NODE_ENV !== "production";
  const loadSampleData = async () => {
    let added = 0;
    for (const collectionName of ["people", "trips", "expenses", "settlements"] as const) {
      for (const record of sampleData[collectionName]) {
        if (!(data[collectionName] as any[]).some((item) => item.id === record.id)) {
          const result = await save(collectionName, record);
          if (!result.ok) {
            setNotice(result.message);
            return;
          }
          added += 1;
        }
      }
    }
    setNotice(added ? `${added} sample records loaded.` : "Sample data is already loaded.");
  };
  const clearSampleData = async () => {
    if (!confirm("Clear only the sample records? Your own records will remain.")) return;
    let removed = 0;
    for (const collectionName of ["expenses", "settlements", "trips", "people"] as const) {
      for (const record of (data[collectionName] as any[]).filter((item) => item.isDemo)) {
        const result = await remove(collectionName, record.id);
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
        removed += 1;
      }
    }
    setNotice(removed ? "Sample data cleared." : "No sample data was found.");
  };
  if (loading)
    return (
      <main className="loading">
        <WalletCards size={32} />
        <p>Opening MySplitZ…</p>
      </main>
    );
  return (
    <main className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Landmark size={20} />
          </span>
          <span>
            <b>MySplitZ</b>
          </span>
          <button className="icon mobile-close" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <p className="eyebrow">YOUR TRAVEL MONEY</p>
        {nav.map(([key, label, Icon]) => (
          <button
            key={key}
            className={`nav-link ${page === key ? "active" : ""}`}
            onClick={() => {
              navigate(key);
              setMenu(false);
            }}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
        <div className="side-note">
          <span className={`dot ${cloud ? "cloud" : ""}`} />
          {cloud ? "Saving to Firestore" : "Saved on this device"}
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          onClick={() => setMenu(false)}
          aria-label="Close menu"
        />
      )}
      <section className="workspace">
        <header className="topbar">
          <button className="icon menu-button" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <p className="eyebrow">
              {page === "dashboard" ? "GOOD MORNING" : "MYSPLITZ"}
            </p>
            <h1>
              {
                (
                  {
                    dashboard: "Money, clear and simple",
                    trips: "Your trips",
                    people: "People",
                    ledger: "Ledger",
                    daybook: "Daybook",
                  } as any
                )[page]
              }
            </h1>
          </div>
          <button
            className="primary small"
            onClick={() =>
              open(
                page === "people"
                  ? "person"
                  : page === "trips"
                    ? "trip"
                    : "expense",
              )
            }
          >
            <Plus size={18} />
            <span>
              {page === "people"
                ? "Person"
                : page === "trips"
                  ? "Trip"
                  : "Expense"}
            </span>
          </button>
        </header>
        {(firebaseSetupMessage || connectionError) && (
          <div className="firebase-message" role="status">
            {firebaseSetupMessage || connectionError}
          </div>
        )}
        {notice && (
          <div className="app-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}
        {isDevelopment && <div className="dev-tools"><button onClick={loadSampleData}>Load Sample Data</button><button onClick={clearSampleData}>Clear Sample Data</button></div>}
        {page === "dashboard" && (
          <Dashboard data={data} bal={bal} setPage={navigate} open={open} />
        )}{" "}
        {page === "trips" && (
          <Trips
            data={data}
            open={open}
            remove={destroy}
            setPage={navigate}
            notify={setNotice}
            archiveTrip={archiveTrip}
            restoreTrip={restoreTrip}
          />
        )}{" "}
        {page === "people" && (
          <People
            data={data}
            bal={bal}
            search={search}
            setSearch={setSearch}
            open={open}
            remove={destroy}
            person={person}
            setPerson={setPerson}
            setPage={navigate}
            archive={archivePerson}
          />
        )}{" "}
        {page === "ledger" && (
          <Records
            kind="ledger"
            data={data}
            person={person}
            tripFilter={tripFilter}
            from={from}
            to={to}
            type={transactionType}
            updateFilters={updateRecordFilters}
            notify={setNotice}
          />
        )}{" "}
        {page === "daybook" && (
          <Records
            kind="daybook"
            data={data}
            person={person}
            tripFilter={tripFilter}
            from={from}
            to={to}
            type={transactionType}
            updateFilters={updateRecordFilters}
            notify={setNotice}
          />
        )}
      </section>
      <nav className="bottom-nav">
        {nav.map(([key, label, Icon]) => (
          <button
            key={key}
            className={page === key ? "active" : ""}
            onClick={() => navigate(key)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {modal && (
        <Form
          type={modal}
          editing={editing}
          data={data}
          save={async (type: any, value: any, a: any) => {
            const saved = await save(type, value);
            if (!saved.ok) return saved;
            if (a) await activity(a.text, a.kind, value.amount, value.tripId);
            setNotice(
              type === "people"
                ? `${value.name} ${a?.text?.includes("updated") ? "updated" : "added"} successfully`
                : `${a?.text || "Record"} saved.`,
            );
            setModal(null);
            setEditing(null);
            return saved;
          }}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
function Dashboard({ data, bal, setPage, open }: any) {
  const [tripId, setTripId] = useState(""),
    [personId, setPersonId] = useState(""),
    people = data.people.filter((p: Person) => !p.archived),
    spend = data.expenses.reduce((a: number, e: Expense) => a + e.amount, 0),
    tb = tripId ? tripBalances(data, tripId) : {},
    r =
      tripId && personId
        ? rows(data, personId).filter((x) => x.tripId === tripId)
        : [],
    paid = r
      .filter((x) => x.type === "Expense paid")
      .reduce((a, x) => a + x.credit, 0),
    owed = r
      .filter((x) => x.type === "Expense share")
      .reduce((a, x) => a + x.debit, 0),
    settledPaid = r
      .filter((x) => x.type === "Settlement paid")
      .reduce((a, x) => a + x.credit, 0),
    settledReceived = r
      .filter((x) => x.type === "Settlement received")
      .reduce((a, x) => a + x.debit, 0),
    advice =
      tripId && personId
        ? suggestions(data, tripId).filter(
            (x) => x.from === personId || x.to === personId,
          )
        : [];
  return (
    <div className="page">
      <div className="summary-grid">
        <Metric
          icon={<ReceiptText />}
          label="Trip spending"
          value={money(spend)}
          note="Across active trips"
        />
        <Metric
          icon={<MapPinned />}
          label="Active trips"
          value={data.trips.filter((t: Trip) => !t.archived).length}
          note="Ready to open"
        />
        <Metric
          icon={<Users />}
          label="People"
          value={people.length}
          note="In your book"
        />
      </div>
      <div className="quick">
        <p className="section-label">QUICK ACTIONS</p>
        <div>
          <button onClick={() => open("expense")}>
            <Plus />
            Add expense
          </button>
          <button onClick={() => open("settlement")}>
            <CircleDollarSign />
            Record repayment
          </button>
          <button onClick={() => open("person")}>
            <Users />
            Add person
          </button>
          <button onClick={() => open("trip")}>
            <MapPinned />
            New trip
          </button>
        </div>
      </div>
      <section className="panel balance-summary">
        <div className="panel-title">
          <div>
            <p className="section-label">TRIP BALANCE SUMMARY</p>
            <h2>See one person’s position for one trip</h2>
          </div>
        </div>
        <div className="filters compact">
          <label>
            Select a trip
            <select value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">Choose a trip</option>
              {data.trips
                .filter((t: Trip) => !t.archived)
                .map((t: Trip) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Select a person
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Choose a person</option>
              {people
                .filter(
                  (p: Person) =>
                    !tripId ||
                    data.trips
                      .find((t: Trip) => t.id === tripId)
                      ?.memberIds.includes(p.id),
                )
                .map((p: Person) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {tripId && personId ? (
          <div className="trip-result">
            <p>
              <b>{tripName(data, tripId)}</b> · {name(data, personId)}
            </p>
            <div className="summary-grid small-metrics">
              <Metric label="Paid" value={money(paid)} />
              <Metric label="Owed" value={money(owed)} />
              <Metric label="Settlements paid" value={money(settledPaid)} />
              <Metric
                label="Settlements received"
                value={money(settledReceived)}
              />
              <Metric
                label="Net balance"
                value={money(tb[personId] || 0)}
                note={<Status value={tb[personId] || 0} />}
              />
            </div>
            <div className="advice">
              <b>
                {Math.abs(tb[personId] || 0) < 0.005
                  ? "Settled up"
                  : tb[personId] >= 0
                    ? "People who should pay this person"
                    : "People this person should pay"}
              </b>
              {advice.length ? (
                advice.map((a: any, i: number) => (
                  <p key={i}>
                    {name(data, a.from)} → {name(data, a.to)}{" "}
                    <strong>{money(a.amount)}</strong>
                  </p>
                ))
              ) : (
                <p>No settlement needed.</p>
              )}
            </div>
          </div>
        ) : (
          <Empty>
            Select a trip and person to see an accurate trip-only balance.
          </Empty>
        )}
      </section>
      <div className="two-col">
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="section-label">BALANCES</p>
              <h2>Who needs to settle up?</h2>
            </div>
            <button className="text-button" onClick={() => setPage("ledger")}>
              Open ledger
            </button>
          </div>
          <div className="balance-list">
            {people.map((p: Person) => (
              <div key={p.id}>
                <div className="avatar">{p.name[0]}</div>
                <span className="grow">
                  <b>{p.name}</b>
                  <small>
                    {bal[p.id] >= 0
                      ? "Paid more than their share"
                      : "Needs to pay their share"}
                  </small>
                </span>
                <Status value={bal[p.id] || 0} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="section-label">RECENT ACTIVITY</p>
              <h2>Latest updates</h2>
            </div>
          </div>
          {[...data.activity]
            .sort((a: Activity, b: Activity) => b.date.localeCompare(a.date))
            .slice(0, 5)
            .map((a: Activity) => (
              <div className="activity-row" key={a.id}>
                <span className="activity-icon">
                  <ReceiptText size={17} />
                </span>
                <div>
                  <b>{a.text}</b>
                  <small>
                    {date(a.date)}{" "}
                    {a.tripId && ` · ${tripName(data, a.tripId)}`}
                  </small>
                </div>
                {a.amount && <strong>{money(a.amount)}</strong>}
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}
function Trips({
  data,
  open,
  remove,
  setPage,
  notify,
  archiveTrip,
  restoreTrip,
}: any) {
  const [tripSearch, setTripSearch] = useState(""),
    trips = [...data.trips]
      .filter((trip: Trip) =>
        trip.name.toLowerCase().includes(tripSearch.trim().toLowerCase()),
      )
      .sort((a: Trip, b: Trip) => Number(a.archived) - Number(b.archived));
  return (
    <div className="page">
      <p className="page-intro">
        Every trip stays separate, with its own expenses, members and settlements.
        Archived trips stay available for reports and exports.
      </p>
      <label className="trip-search search">
        <Search size={18} />
        <input
          value={tripSearch}
          onChange={(event) => setTripSearch(event.target.value)}
          placeholder="Search active or archived trips"
        />
      </label>
      <div className="cards">
        {trips.map((t: Trip) => {
          const es = data.expenses.filter((e: Expense) => e.tripId === t.id),
            preferred = t.memberIds.includes("p1") ? "p1" : t.memberIds[0],
            isArchived = Boolean(t.archived);
      const view = (page: string) => {
        setPage(page, { tripId: t.id, personId: preferred });
      };
          return (
            <article className="trip-card" key={t.id}>
              <div className="trip-banner">
                <span>
                  <MapPinned size={22} />
                </span>
                {isArchived && <span className="archived-badge">Archived</span>}
                <button
                  className="icon light"
                  onClick={() => open("trip", t)}
                  disabled={isArchived}
                  aria-label="Edit trip"
                  title={isArchived ? "Restore the trip before editing" : "Edit trip"}
                >
                  •••
                </button>
              </div>
              <div className="trip-content">
                <h2>{t.name}</h2>
                <p>
                  {date(t.startDate)} — {date(t.endDate)}
                </p>
                <div className="trip-stats">
                  <span>
                    <b>{t.memberIds.length}</b> members
                  </span>
                  <span>
                    <b>
                      {money(
                        es.reduce((a: number, e: Expense) => a + e.amount, 0),
                      )}
                    </b>{" "}
                    spent
                  </span>
                </div>
                <div className="card-actions">
                  <button onClick={() => view("ledger")}>View ledger</button>
                  <button onClick={() => view("daybook")}>Daybook</button>
                  <button onClick={() => {
                    try {
                      downloadTripReport(data, t);
                      notify("Final trip report downloaded.");
                    } catch {
                      notify("Could not download the final trip report. Please try again.");
                    }
                  }}>
                    <Download size={15} />
                    Download Final Trip Report PDF
                  </button>
                  <button
                    className="primary"
                    disabled={isArchived}
                    title={isArchived ? "Restore the trip before adding expenses" : undefined}
                    onClick={() =>
                      open("expense", {
                        tripId: t.id,
                        participantIds: t.memberIds,
                        paidBy: t.memberIds[0],
                      })
                    }
                  >
                    <Plus />
                    Expense
                  </button>
                </div>
                <div className="trip-detail-actions">
                  {isArchived ? (
                    <button onClick={() => restoreTrip(t)}>Restore Trip</button>
                  ) : (
                    <button className="danger" onClick={() => archiveTrip(t)}>
                      Archive Trip
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <p className="section-label">ALL TRIP EXPENSES</p>
            <h2>Recent expenses</h2>
          </div>
        </div>
        <ExpenseTable data={data} open={open} remove={remove} />
      </section>
    </div>
  );
}
function People({
  data,
  bal,
  search,
  setSearch,
  open,
  remove,
  person,
  setPerson,
  setPage,
  archive,
}: any) {
  const active = data.people.filter((p: Person) => !p.archived),
    picked = active.find((p: Person) => p.id === person) || active[0],
    r = picked ? rows(data, picked.id) : [],
    paid = r
      .filter((x) => x.type === "Expense paid")
      .reduce((a, x) => a + x.credit, 0),
    owed = r
      .filter((x) => x.type === "Expense share")
      .reduce((a, x) => a + x.debit, 0),
    sp = r
      .filter((x) => x.type === "Settlement paid")
      .reduce((a, x) => a + x.credit, 0),
    sr = r
      .filter((x) => x.type === "Settlement received")
      .reduce((a, x) => a + x.debit, 0),
    trips = data.trips.filter(
      (t: Trip) => picked && t.memberIds.includes(picked.id),
    ),
    items = active.filter((p: Person) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <div className="page">
      <section className="mobile-person-picker">
        <label>
          Select a person
          <select
            value={picked?.id || ""}
            onChange={(e) => setPerson(e.target.value)}
          >
            {active.map((p: Person) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
          />
        </div>
      </section>
      <div className="people-layout">
        <section className="panel people-panel">
          <div className="people-list">
            {items.map((p: Person) => (
              <button
                className={
                  p.id === picked?.id ? "person-row selected" : "person-row"
                }
                onClick={() => setPerson(p.id)}
                key={p.id}
              >
                <span className="avatar">{p.name[0]}</span>
                <span>
                  <b>{p.name}</b>
                  <small>{p.phone || "No phone number"}</small>
                </span>
                <Status value={bal[p.id] || 0} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel profile">
          {picked ? (
            <>
              <div className="profile-head">
                <div className="large-avatar">{picked.name[0]}</div>
                <div>
                  <h2>{picked.name}</h2>
                  <p>
                    {picked.phone || "No phone"}
                    {picked.email && ` · ${picked.email}`}
                  </p>
                </div>
                <button className="icon" onClick={() => open("person", picked)}>
                  Edit
                </button>
              </div>
              <div className="profile-grid">
                <Metric label="Total paid" value={money(paid)} />
                <Metric label="Total owed" value={money(owed)} />
                <Metric label="Settlements paid" value={money(sp)} />
                <Metric label="Settlements received" value={money(sr)} />
                <Metric
                  label="Current balance"
                  value={money(bal[picked.id])}
                  note={<Status value={bal[picked.id] || 0} />}
                />
              </div>
              <div className="profile-block">
                <b>Trips</b>
                <p>
                  {trips.length
                    ? trips.map((t: Trip) => t.name).join(" · ")
                    : "Not added to a trip yet"}
                </p>
              </div>
              <div className="profile-block">
                <b>Recent transactions</b>
                <Ledger rows={r.slice(-5).reverse()} compact />
              </div>
              <div className="profile-actions">
                <button onClick={() => setPage("ledger", { personId: picked.id })}>
                  Open ledger
                </button>
                <button onClick={() => setPage("daybook", { personId: picked.id })}>
                  Open daybook
                </button>
                <button onClick={() => archive(picked)}>Archive</button>
                <button
                  className="danger"
                  onClick={() => remove("people", picked.id)}
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <Empty>Add a person to begin.</Empty>
          )}
        </section>
      </div>
    </div>
  );
}
function ExpenseTable({ data, open, remove }: any) {
  return data.expenses.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Expense</th>
            <th>Trip</th>
            <th>Paid by</th>
            <th>Date</th>
            <th className="amount">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...data.expenses]
            .sort((a: Expense, b: Expense) => b.date.localeCompare(a.date))
            .map((e: Expense) => {
              const isArchived = Boolean(
                data.trips.find((trip: Trip) => trip.id === e.tripId)?.archived,
              );
              return <tr key={e.id}>
                <td>
                  <b>{e.title}</b>
                  <small>{e.category}</small>
                </td>
                <td>{tripName(data, e.tripId)}</td>
                <td>{name(data, e.paidBy)}</td>
                <td>{date(e.date)}</td>
                <td className="amount">
                  <b>{money(e.amount)}</b>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => open("expense", e)}
                    disabled={isArchived}
                    title={isArchived ? "Restore the trip before editing" : undefined}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button danger-text"
                    onClick={() => remove("expenses", e)}
                    disabled={isArchived}
                    title={isArchived ? "Restore the trip before deleting" : undefined}
                  >
                    Delete
                  </button>
                </td>
              </tr>;
            })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Add the first expense for a clear trip record.</Empty>
  );
}
function Records({
  kind,
  data,
  person,
  tripFilter,
  from,
  to,
  type,
  updateFilters,
  notify,
}: any) {
  const picked =
      data.people.find((p: Person) => p.id === person) ||
      data.people.find((p: Person) => !p.archived),
    all = picked ? rows(data, picked.id) : [],
    filtered = all.filter(
      (r) =>
        (tripFilter === "all" || r.tripId === tripFilter) &&
        (!from || r.date >= from) &&
        (!to || r.date <= to) &&
        (type === "all" || r.type === type),
    ),
    paid = filtered
      .filter((r) => r.type === "Expense paid")
      .reduce((a, r) => a + r.credit, 0),
    owed = filtered
      .filter((r) => r.type === "Expense share")
      .reduce((a, r) => a + r.debit, 0),
    final = filtered.length ? filtered[filtered.length - 1].balance : 0,
    groups = filtered.reduce((a: any, r) => {
      (a[r.date] ||= []).push(r);
      return a;
    }, {}),
    reportName = kind === "ledger" ? "MySplitZ — Ledger" : "MySplitZ — Daybook",
    trip = tripFilter === "all" ? "All trips" : tripName(data, tripFilter),
    visibleExpenseIds = new Set(
      filtered.flatMap((row: Row) => (row.sourceId ? [row.sourceId] : [])),
    ),
    visibleExpenses = data.expenses.filter((expense: Expense) =>
      visibleExpenseIds.has(expense.id),
    ),
    ledgerHeaders = [
      "Date",
      "Type",
      "Description",
      "Trip",
      "From",
      "To",
      "Debit",
      "Credit",
      "Balance",
      "Notes",
    ],
    expenseHeaders = [
      "Date",
      "Title",
      "Category",
      "Trip",
      "Amount",
      "Paid By",
      "Participants",
      "Split Method",
      "Notes",
    ],
    exportFile = (report: string, extension: string) =>
      reportFileName({
        trip,
        person: picked?.name || "person",
        report,
        extension,
      }),
    downloadCsv = (headers: string[], values: (string | number)[][], report: string) =>
      downloadBlob(
        new Blob(
          [
            `\ufeff${[headers, ...values]
              .map((row) => row.map(csvCell).join(","))
              .join("\r\n")}`,
          ],
          { type: "text/csv;charset=utf-8" },
        ),
        exportFile(report, "csv"),
      ),
    downloadExpensesExcel = async () => {
      const { Workbook } = await import("exceljs"),
        workbook = new Workbook(),
        worksheet = workbook.addWorksheet("MySplitZ Expenses");
      workbook.creator = "MySplitZ";
      worksheet.views = [{ state: "frozen", ySplit: 5 }];
      worksheet.mergeCells("A1:I1");
      worksheet.getCell("A1").value = "MySplitZ — Trip Expenses";
      worksheet.getCell("A1").font = {
        name: "Arial",
        size: 14,
        bold: true,
        color: { argb: "FF155D58" },
      };
      worksheet.getCell("A1").alignment = { vertical: "middle" };
      worksheet.getRow(1).height = 24;
      worksheet.getRow(3).values = [
        "Person",
        picked?.name || "No person",
        "Trip",
        trip,
        "From",
        from ? date(from) : "Beginning",
        "To",
        to ? date(to) : "Today",
      ];
      worksheet.getRow(4).values = [
        "Transaction type",
        type === "all" ? "All transactions" : type,
        "Created",
        date(today()),
      ];
      worksheet.getRow(3).eachCell((cell) => {
        cell.font = { name: "Arial", size: 10 };
      });
      worksheet.getRow(4).eachCell((cell) => {
        cell.font = { name: "Arial", size: 10 };
      });
      worksheet.getCell("A3").font = { name: "Arial", size: 10, bold: true };
      worksheet.getCell("C3").font = { name: "Arial", size: 10, bold: true };
      worksheet.getCell("E3").font = { name: "Arial", size: 10, bold: true };
      worksheet.getCell("G3").font = { name: "Arial", size: 10, bold: true };
      worksheet.getCell("A4").font = { name: "Arial", size: 10, bold: true };
      worksheet.getCell("C4").font = { name: "Arial", size: 10, bold: true };
      worksheet.columns = [
        { width: 15 },
        { width: 28 },
        { width: 16 },
        { width: 25 },
        { width: 15 },
        { width: 18 },
        { width: 34 },
        { width: 16 },
        { width: 34 },
      ];
      worksheet.getRow(5).values = expenseHeaders;
      worksheet.getRow(5).eachCell((cell) => {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF155D58" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
      worksheet.getRow(5).height = 30;
      visibleExpenses.forEach((expense: Expense) => {
        worksheet.addRow([
          new Date(`${expense.date}T12:00:00`),
          expense.title,
          expense.category,
          tripName(data, expense.tripId),
          expense.amount,
          name(data, expense.paidBy),
          expense.participantIds.map((id) => name(data, id)).join(", "),
          expense.splitMethod || "equal",
          expense.note || "",
        ]);
      });
      worksheet.getColumn(1).numFmt = "[$-en-IN]d mmm yyyy";
      worksheet.getColumn(5).numFmt = "₹#,##0.00;[Red]-₹#,##0.00";
      worksheet.getColumn(5).alignment = { horizontal: "right" };
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < 6) return;
        row.eachCell((cell) => {
          cell.alignment = { vertical: "top", wrapText: true };
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        exportFile("trip-expenses", "xlsx"),
      );
    };
  const runExport = (action: () => void | Promise<void>, label: string) => {
    void Promise.resolve()
      .then(action)
      .then(() => notify(`${label} downloaded.`))
      .catch(() => notify(`Could not download ${label}. Please try again.`));
  };
  const pdf = () => {
    const d = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    d.setFontSize(18);
    d.text(reportName, 14, 14);
    d.setFontSize(10);
    [
      `Person: ${picked?.name || "No person"}`,
      `Created: ${date(today())}`,
      `Trip: ${trip}`,
      `From: ${from ? date(from) : "Beginning"}`,
      `To: ${to ? date(to) : "Today"}`,
    ].forEach((line, i) => d.text(line, 14, 21 + i * 5));
    d.setFontSize(10);
    d.text(`Total paid: ${money(paid)}   Total owed: ${money(owed)}   Net balance: ${money(final)}`, 14, 49);
    let body: any[] = [];
    if (kind === "daybook")
      Object.entries(groups).forEach(([day, rs]: any) => {
        body.push([
          {
            content: date(day),
            colSpan: 10,
            styles: { fillColor: [229, 240, 235], fontStyle: "bold" },
          },
        ]);
        rs.forEach((r: Row) => body.push(rowCells(r)));
        const x = rs as Row[];
        body.push([
          {
            content: `Daily totals — paid ${money(x.reduce((a, r) => a + r.credit, 0))}, owed ${money(x.reduce((a, r) => a + r.debit, 0))}, end balance ${money(x[x.length - 1].balance)}`,
            colSpan: 10,
            styles: { fillColor: [247, 251, 249], fontStyle: "bold" },
          },
        ]);
        body.push([
          {
            content: `Daily settlements ${money(x.filter((row) => row.type.includes("Settlement")).reduce((sum, row) => sum + row.credit + row.debit, 0))}`,
            colSpan: 10,
            styles: { fillColor: [247, 251, 249], fontStyle: "bold" },
          },
        ]);
      });
    else body = filtered.map(rowCells);
    autoTable(d, {
      startY: 56,
      head: [
        [
          "Date",
          "Type",
          "Description",
          "Trip",
          "Paid / sent by",
          "Share for / received by",
          "Debit",
          "Credit",
          "Balance",
          "Notes",
        ],
      ],
      body,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: { fillColor: [21, 93, 88] },
      alternateRowStyles: { fillColor: [247, 251, 249] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 34 },
        3: { cellWidth: 28 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { halign: "right", cellWidth: 20 },
        7: { halign: "right", cellWidth: 20 },
        8: { halign: "right", cellWidth: 22 },
        9: { cellWidth: 43 },
      },
      didDrawPage: () => {
        d.setFontSize(8);
        d.text(reportName, 14, 8);
      },
    });
    d.save(`${(picked?.name || "person").replace(/\s+/g, "-")}-${kind}.pdf`);
  };
  return (
    <div className="page">
      <div className="record-head">
        <div>
          <p className="page-intro">
            {kind === "ledger"
              ? "Track one person’s money for one trip."
              : "See one person’s activity day by day for one trip."}
          </p>
          <div className="report-details">
            Person: <b>{picked?.name}</b> · Created: <b>{date(today())}</b> ·
            Trip:{" "}
            <b>
              {tripFilter === "all" ? "All trips" : tripName(data, tripFilter)}
            </b>
          </div>
        </div>
        <details className="export-menu">
          <summary>
            <Download size={17} />
            Export
          </summary>
          <div className="export-options">
          <button className="primary" onClick={() => runExport(pdf, "PDF")}>Download PDF</button>
          <button
            className="export-button"
            onClick={() => runExport(
              () => downloadCsv(ledgerHeaders, ledgerExportRows(filtered), kind),
              `${kind === "ledger" ? "Ledger" : "Daybook"} CSV`,
            )}
          >
            Download {kind === "ledger" ? "Ledger" : "Daybook"} CSV
          </button>
          <button
            className="export-button"
            onClick={() => runExport(
              () => downloadCsv(
                expenseHeaders,
                expenseExportRows(data, visibleExpenses),
                "trip-expenses",
              ),
              "Trip Expenses CSV",
            )}
          >
            Download Trip Expenses CSV
          </button>
          <button className="export-button" onClick={() => runExport(downloadExpensesExcel, "Trip Expenses Excel")}>
            Download Trip Expenses Excel
          </button>
          </div>
        </details>
      </div>
      <section className="filters">
        <label>
          Person
          <select
            value={picked?.id || ""}
            onChange={(e) => updateFilters({ personId: e.target.value })}
          >
            {data.people
              .filter((p: Person) => !p.archived)
              .map((p: Person) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Trip
          <select
            value={tripFilter}
            onChange={(e) => updateFilters({ tripId: e.target.value })}
          >
            <option value="all">All trips</option>
            {data.trips.map((t: Trip) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {kind === "ledger" && (
          <label>
            Transaction type
            <select value={type} onChange={(e) => updateFilters({ type: e.target.value })}>
              <option value="all">All transactions</option>
              <option>Expense paid</option>
              <option>Expense share</option>
              <option>Settlement paid</option>
              <option>Settlement received</option>
            </select>
          </label>
        )}
        <label>
          From date
          <input
            type="date"
            value={from}
            onChange={(e) => updateFilters({ from: e.target.value })}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={to}
            onChange={(e) => updateFilters({ to: e.target.value })}
          />
        </label>
      </section>
      <div className="record-summary">
        <Metric label="Total paid" value={money(paid)} />
        <Metric label="Total owed" value={money(owed)} />
        <Metric
          label="Net balance"
          value={money(final)}
          note={<Status value={final} />}
        />
      </div>
      {kind === "ledger" ? (
        <section className="panel table-panel">
          <div className="panel-title">
            <div>
              <h2>Transactions</h2>
              <p className="record-count">{filtered.length} records</p>
            </div>
          </div>
          <Ledger rows={filtered} />
        </section>
      ) : (
        <section className="daybook">
          <div className="panel-title daybook-title">
            <div>
              <h2>Daily activity</h2>
              <p className="record-count">{filtered.length} records</p>
            </div>
          </div>
          {Object.keys(groups).length ? (
            Object.entries(groups).map(([d, rs]: any) => (
              <article className="day-card" key={d}>
                <div className="day-heading">
                  <h2>{date(d)}</h2>
                  <span>
                    End of day: <b>{money(rs[rs.length - 1].balance)}</b>
                  </span>
                </div>
                <div className="day-stats">
                  <span><small>Transactions</small><b>{rs.length}</b></span>
                  <span><small>Daily paid</small><b>{money(rs.reduce((a: number, r: Row) => a + r.credit, 0))}</b></span>
                  <span><small>Daily owed</small><b>{money(rs.reduce((a: number, r: Row) => a + r.debit, 0))}</b></span>
                  <span><small>Settlements</small><b>{money(rs.filter((r: Row) => r.type.includes("Settlement")).reduce((a: number, r: Row) => a + r.credit + r.debit, 0))}</b></span>
                  <span><small>End-of-day balance</small><b>{money(rs[rs.length - 1].balance)}</b></span>
                </div>
                <Ledger rows={rs} />
                <p className="daily-total">
                  Paid{" "}
                  {money(rs.reduce((a: number, r: Row) => a + r.credit, 0))} ·
                  Owed {money(rs.reduce((a: number, r: Row) => a + r.debit, 0))}{" "}
                  · Settlements{" "}
                  {money(
                    rs
                      .filter((r: Row) => r.type.includes("Settlement"))
                      .reduce((a: number, r: Row) => a + r.credit + r.debit, 0),
                  )}
                </p>
              </article>
            ))
          ) : (
            <Empty>No records match these filters.</Empty>
          )}
        </section>
      )}
    </div>
  );
}
function rowCells(r: Row) {
  return [
    date(r.date),
    r.type,
    r.description,
    r.trip,
    r.from,
    r.to,
    r.debit ? money(r.debit) : "",
    r.credit ? money(r.credit) : "",
    money(r.balance),
    r.note,
  ];
}
const csvCell = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  },
  slug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "report",
  downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
  reportFileName = ({ trip, person, report, extension }: { trip: string; person: string; report: string; extension: string }) =>
    `${slug(trip)}-${slug(person)}-${slug(report)}-${today()}.${extension}`,
  expenseExportRows = (data: Data, expenses: Expense[]) =>
    expenses.map((expense) => [
      date(expense.date),
      expense.title,
      expense.category,
      tripName(data, expense.tripId),
      expense.amount,
      name(data, expense.paidBy),
      expense.participantIds.map((id) => name(data, id)).join(", "),
      expense.splitMethod || "equal",
      expense.note || "",
    ]),
  ledgerExportRows = (items: Row[]) =>
    items.map((row) => [
      date(row.date),
      row.type,
      row.description,
      row.trip,
      row.from,
      row.to,
      row.debit,
      row.credit,
      row.balance,
      row.note,
    ]);
function Ledger({ rows, compact }: any) {
  return rows.length ? (
    <div className={`table-wrap ledger-wrap ${compact ? "compact-table" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Trip</th>
            <th>Paid / sent by</th>
            <th>Share for / received by</th>
            <th className="amount">Debit</th>
            <th className="amount">Credit</th>
            <th className="amount">Balance</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: Row, i: number) => (
            <tr key={i}>
              <td className="sticky">{date(r.date)}</td>
              <td>
                <span className="pill">{r.type}</span>
              </td>
              <td>
                <b>{r.description}</b>
              </td>
              <td>{r.trip}</td>
              <td>{r.from}</td>
              <td>{r.to}</td>
              <td className="amount">{r.debit ? money(r.debit) : "—"}</td>
              <td className="amount">{r.credit ? money(r.credit) : "—"}</td>
              <td
                className={`amount ${r.balance >= 0 ? "positive" : "negative"}`}
              >
                <b>{money(r.balance)}</b>
              </td>
              <td className="notes">{r.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No transactions match these filters.</Empty>
  );
}
function Form({ type, editing, data, save, close }: any) {
  const [form, setForm] = useState<any>(
    () =>
      editing ||
      (type === "person"
        ? { name: "", phone: "", email: "", notes: "" }
        : type === "trip"
          ? {
              name: "",
              description: "",
              startDate: today(),
              endDate: today(),
              memberIds: [],
            }
          : type === "expense"
            ? {
                title: "",
                amount: "",
                category: "Food",
                date: today(),
                tripId: data.trips.find((trip: Trip) => !trip.archived)?.id || "",
                paidBy: data.people[0]?.id || "",
                participantIds: data.people.map((p: Person) => p.id),
                splitMethod: "equal",
                splits: {},
                note: "",
              }
            : {
                from: data.people[0]?.id || "",
                to: data.people[1]?.id || "",
                amount: "",
                date: today(),
                tripId: "",
                note: "",
              }),
  );
  const [isSaving, setIsSaving] = useState(false),
    [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    if (!formError) return;
    const timeout = window.setTimeout(() => setFormError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [formError]);
  const update = (k: string, v: any) => {
      setFormError(null);
      setForm((p: any) => ({ ...p, [k]: v }));
    },
    toggle = (k: string, id: string) =>
      update(
        k,
        form[k].includes(id)
          ? form[k].filter((x: string) => x !== id)
          : [...form[k], id],
      ),
    participants = form.participantIds || [],
    amount = Number(form.amount) || 0,
    splitMethod = form.splitMethod || "equal",
    splitValues = form.splits || {},
    splitTotal = participants.reduce((total: number, id: string) => total + Number(splitValues[id] || 0), 0),
    exactInvalid = splitMethod === "exact" && Math.abs(splitTotal - amount) > 0.01,
    percentageInvalid = splitMethod === "percentage" && Math.abs(splitTotal - 100) > 0.01,
    calculatedSplits = Object.fromEntries(participants.map((id: string) => [id, splitMethod === "equal" ? amount / participants.length : splitMethod === "percentage" ? amount * Number(splitValues[id] || 0) / 100 : Number(splitValues[id] || 0)]));
  const reject = (message: string) => {
    setFormError(message);
    return false;
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isSaving) return;
      const selectedTrip = data.trips.find((trip: Trip) => trip.id === form.tripId);
      if (
        ((type === "expense" || type === "settlement") && selectedTrip?.archived) ||
        (type === "trip" && editing?.archived)
      ) {
        return reject("This trip is archived. Restore it before making changes.");
      }
      if (
        type === "expense" &&
        (!form.title ||
          Number(form.amount) <= 0 ||
          !form.tripId ||
          !form.paidBy ||
          !form.participantIds.length)
      )
        return reject("Add a title, valid amount, trip, payer and at least one participant.");
      if (type === "expense" && selectedTrip &&
        (!selectedTrip.memberIds.includes(form.paidBy) ||
          form.participantIds.some((id: string) => !selectedTrip.memberIds.includes(id)))
      )
        return reject("The payer and participants must be members of the selected trip.");
      if (exactInvalid) return reject(`Exact split total must equal ${money(amount)}.`);
      if (percentageInvalid) return reject("Percentage split total must equal 100%.");
      if (type === "person" && !form.name.trim()) return reject("Enter a name.");
      if (type === "person" && form.email && !/^\S+@\S+\.\S+$/.test(form.email))
        return reject("Enter a valid email address.");
      if (type === "trip" && !form.name.trim()) return reject("Enter a trip name.");
      if (type === "trip" && (!form.startDate || !form.endDate || form.startDate > form.endDate))
        return reject("Enter a valid trip date range.");
      if (type === "trip" && !form.memberIds.length)
        return reject("Add at least one trip member.");
      if (
        type === "settlement" &&
        (Number(form.amount) <= 0 ||
          !form.from ||
          !form.to ||
          form.from === form.to)
      )
        return reject("Choose two different people and a valid amount.");
      if (type === "settlement" && selectedTrip &&
        (!selectedTrip.memberIds.includes(form.from) || !selectedTrip.memberIds.includes(form.to)))
        return reject("Settlement people must be members of the selected trip.");
      const id = editing?.id || uid();
      const collection =
        type === "person"
          ? "people"
          : type === "trip"
            ? "trips"
            : type === "expense"
              ? "expenses"
              : "settlements";
      const item =
        type === "person"
          ? createPersonSavePayload({
              id,
              name: form.name,
              phone: form.phone,
              email: form.email,
              notes: form.notes,
              archived: editing?.archived,
            })
          : type === "trip"
            ? {
                id,
                name: form.name.trim(),
                description: form.description || "",
                startDate: form.startDate,
                endDate: form.endDate,
                memberIds: form.memberIds,
                ...(editing?.archived ? { archived: true } : {}),
              }
            : type === "expense"
              ? {
                  id,
                  title: form.title.trim(),
                  amount,
                  category: form.category,
                  date: form.date,
                  tripId: form.tripId,
                  paidBy: form.paidBy,
                  participantIds: form.participantIds,
                  splitMethod,
                  splits: calculatedSplits,
                  note: form.note || "",
                }
              : {
                  id,
                  from: form.from,
                  to: form.to,
                  amount,
                  date: form.date,
                  ...(form.tripId ? { tripId: form.tripId } : {}),
                  note: form.note || "",
                };
      setIsSaving(true);
      try {
        const saved = await save(collection, item, {
          text: `${type === "expense" ? item.title : type === "trip" ? item.name : type === "person" ? item.name : "Settlement"} ${editing ? "updated" : "added"}`,
          kind: type,
          tripId: item.tripId,
        });
        if (!saved.ok) setFormError(saved.message);
      } catch {
        setFormError("Could not save this record. Please try again.");
      } finally {
        setIsSaving(false);
      }
    };
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-title">
          <div>
            <p className="section-label">MYSPLITZ</p>
            <h2>
              {editing
                ? `Edit ${type}`
                : type === "settlement"
                  ? "Record a repayment"
                  : `Add ${type}`}
            </h2>
          </div>
          <button type="button" className="icon" onClick={close} disabled={isSaving}>
            <X />
          </button>
        </div>
        {formError && (
          <p className="form-error" role="alert">
            <span>{formError}</span>
            <button type="button" onClick={() => setFormError(null)} aria-label="Dismiss error">
              <X size={15} />
            </button>
          </p>
        )}
        {type === "person" && (
          <>
            <Field
              label="Name"
              value={form.name}
              update={(v: any) => update("name", v)}
              required
            />
            <Field
              label="Phone number"
              value={form.phone}
              update={(v: any) => update("phone", v)}
            />
            <Field
              label="Email"
              value={form.email}
              update={(v: any) => update("email", v)}
              type="email"
            />
            <Field
              label="Notes"
              value={form.notes}
              update={(v: any) => update("notes", v)}
              textarea
            />
          </>
        )}
        {type === "trip" && (
          <>
            <Field
              label="Trip name"
              value={form.name}
              update={(v: any) => update("name", v)}
              required
            />
            <Field
              label="Description"
              value={form.description}
              update={(v: any) => update("description", v)}
              textarea
            />
            <div className="field-grid">
              <Field
                label="Start date"
                value={form.startDate}
                update={(v: any) => update("startDate", v)}
                type="date"
              />
              <Field
                label="End date"
                value={form.endDate}
                update={(v: any) => update("endDate", v)}
                type="date"
              />
            </div>
            <Checks
              title="Members"
              people={data.people}
              values={form.memberIds}
              toggle={(id: string) => toggle("memberIds", id)}
            />
          </>
        )}
        {type === "expense" && (
          <>
            <Field
              label="What was it for?"
              value={form.title}
              update={(v: any) => update("title", v)}
              required
            />
            <div className="field-grid">
              <Field
                label="Amount (₹)"
                value={form.amount}
                update={(v: any) => update("amount", v)}
                type="number"
              />
              <Field
                label="Date"
                value={form.date}
                update={(v: any) => update("date", v)}
                type="date"
              />
            </div>
            <label className="field">
              Category
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              >
                {["Food", "Stay", "Travel", "Tickets", "Shopping", "Other"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              Trip
              <select
                value={form.tripId}
                onChange={(e) => {
                  const t = data.trips.find(
                    (x: Trip) => x.id === e.target.value,
                  );
                  update("tripId", e.target.value);
                  if (t) update("participantIds", t.memberIds);
                }}
              >
                <option value="">Choose trip</option>
                {data.trips.filter((t: Trip) => !t.archived).map((t: Trip) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Paid by
              <select
                value={form.paidBy}
                onChange={(e) => update("paidBy", e.target.value)}
              >
                {data.people.map((p: Person) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Split method
              <select value={splitMethod} onChange={(e) => update("splitMethod", e.target.value)}>
                <option value="equal">Equal split</option>
                <option value="exact">Exact amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
            <Checks
              title={splitMethod === "equal" ? "Split equally between" : "Participants"}
              people={data.people.filter(
                (p: Person) =>
                  !form.tripId ||
                  data.trips
                    .find((t: Trip) => t.id === form.tripId)
                    ?.memberIds.includes(p.id),
              )}
              values={form.participantIds}
              toggle={(id: string) => toggle("participantIds", id)}
            />
            {splitMethod !== "equal" && <div className="split-inputs">{participants.map((id: string) => <label key={id} className="field">{name(data, id)}<input type="number" min="0" step="0.01" value={splitValues[id] ?? ""} onChange={(e) => update("splits", { ...splitValues, [id]: e.target.value })} placeholder={splitMethod === "exact" ? "₹ Amount" : "Percentage"} aria-label={`${name(data, id)} ${splitMethod === "exact" ? "exact amount" : "percentage"}`}/></label>)}</div>}
            {splitMethod !== "equal" && <p className={`split-note ${exactInvalid || percentageInvalid ? "split-error" : ""}`}>{splitMethod === "exact" ? <>Exact total: <b>{money(splitTotal)}</b> of <b>{money(amount)}</b>{exactInvalid && " — totals must match."}</> : <>Percentage total: <b>{splitTotal}%</b> of <b>100%</b>{percentageInvalid && " — totals must equal 100%."}</>}</p>}
            {splitMethod === "equal" && <p className="split-note">
              Each person’s share:{" "}
              <b>
                {form.participantIds.length && form.amount
                  ? money(Number(form.amount) / form.participantIds.length)
                  : "₹0"}
              </b>
            </p>}
            <Field
              label="Note"
              value={form.note}
              update={(v: any) => update("note", v)}
              textarea
            />
          </>
        )}
        {type === "settlement" && (
          <>
            <label className="field">
              From (who paid)
              <select
                value={form.from}
                onChange={(e) => update("from", e.target.value)}
              >
                {data.people.map((p: Person) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              To (who received)
              <select
                value={form.to}
                onChange={(e) => update("to", e.target.value)}
              >
                {data.people.map((p: Person) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-grid">
              <Field
                label="Amount (₹)"
                value={form.amount}
                update={(v: any) => update("amount", v)}
                type="number"
              />
              <Field
                label="Date"
                value={form.date}
                update={(v: any) => update("date", v)}
                type="date"
              />
            </div>
            <label className="field">
              Trip (optional)
              <select
                value={form.tripId}
                onChange={(e) => update("tripId", e.target.value)}
              >
                <option value="">Not linked to a trip</option>
                {data.trips.filter((t: Trip) => !t.archived).map((t: Trip) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Note"
              value={form.note}
              update={(v: any) => update("note", v)}
              textarea
            />
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={close} disabled={isSaving}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : editing ? "Save changes" : "Save record"}
          </button>
        </div>
      </form>
    </div>
  );
}
function Field({
  label,
  value,
  update,
  type = "text",
  required,
  textarea,
}: any) {
  return (
    <label className="field">
      {label}
      {textarea ? (
        <textarea
          value={value || ""}
          onChange={(e) => update(e.target.value)}
        />
      ) : (
        <input
          required={required}
          type={type}
          min={type === "number" ? "0.01" : undefined}
          step={type === "number" ? "0.01" : undefined}
          value={value || ""}
          onChange={(e) => update(e.target.value)}
        />
      )}
    </label>
  );
}
function Checks({ title, people, values, toggle }: any) {
  return (
    <fieldset className="check-list">
      <legend>{title}</legend>
      {people.map((p: Person) => (
        <label key={p.id}>
          <input
            type="checkbox"
            checked={values.includes(p.id)}
            onChange={() => toggle(p.id)}
          />
          <span className="avatar">{p.name[0]}</span>
          {p.name}
        </label>
      ))}
    </fieldset>
  );
}
