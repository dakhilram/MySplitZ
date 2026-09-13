const demo = (id: string, value: Record<string, unknown>) => ({ id: `demo-${id}`, isDemo: true, ...value });

export const sampleData = {
  people: [
    demo("dad", { name: "Dad", phone: "98765 43210", notes: "Sample trip organiser" }),
    demo("venu", { name: "Venu" }), demo("brahmam", { name: "Brahmam" }),
    demo("lakshmi", { name: "Lakshmi" }), demo("akhil", { name: "Akhil" }),
  ],
  trips: [
    demo("goa", { name: "Goa Trip 2026", description: "Sample beach holiday", startDate: "2026-02-14", endDate: "2026-02-18", memberIds: ["demo-dad", "demo-venu", "demo-brahmam", "demo-lakshmi", "demo-akhil"] }),
    demo("chennai", { name: "Chennai Family Visit", startDate: "2026-04-04", endDate: "2026-04-06", memberIds: ["demo-dad", "demo-venu", "demo-lakshmi"] }),
    demo("hyderabad", { name: "Hyderabad Weekend Trip", startDate: "2026-05-16", endDate: "2026-05-17", memberIds: ["demo-dad", "demo-brahmam", "demo-akhil"] }),
  ],
  expenses: [
    demo("g1", { title: "Hotel stay", amount: 18000, category: "Hotel", date: "2026-02-14", tripId: "demo-goa", paidBy: "demo-dad", participantIds: ["demo-dad", "demo-venu", "demo-brahmam", "demo-lakshmi", "demo-akhil"], splitMethod: "equal", note: "Four nights" }),
    demo("g2", { title: "Idli breakfast", amount: 750, category: "Food", date: "2026-02-15", tripId: "demo-goa", paidBy: "demo-venu", participantIds: ["demo-dad", "demo-venu", "demo-brahmam", "demo-lakshmi", "demo-akhil"], splitMethod: "equal", note: "Beach road café" }),
    demo("g3", { title: "Airport taxi", amount: 2800, category: "Travel", date: "2026-02-14", tripId: "demo-goa", paidBy: "demo-dad", participantIds: ["demo-dad", "demo-venu", "demo-brahmam", "demo-lakshmi", "demo-akhil"], splitMethod: "percentage", splits: { "demo-dad": 560, "demo-venu": 560, "demo-brahmam": 560, "demo-lakshmi": 560, "demo-akhil": 560 }, note: "Percentage split, 20% each" }),
    demo("g4", { title: "Dolphin tickets", amount: 3750, category: "Tickets", date: "2026-02-16", tripId: "demo-goa", paidBy: "demo-lakshmi", participantIds: ["demo-dad", "demo-venu", "demo-brahmam"], splitMethod: "exact", splits: { "demo-dad": 1250, "demo-venu": 1250, "demo-brahmam": 1250 }, note: "Exact amount split" }),
    demo("g5", { title: "Dinner by the beach", amount: 4250, category: "Food", date: "2026-02-16", tripId: "demo-goa", paidBy: "demo-brahmam", participantIds: ["demo-dad", "demo-venu", "demo-brahmam", "demo-lakshmi", "demo-akhil"], splitMethod: "equal", note: "Seafood dinner" }),
    demo("g6", { title: "Fuel", amount: 1600, category: "Fuel", date: "2026-02-17", tripId: "demo-goa", paidBy: "demo-akhil", participantIds: ["demo-dad", "demo-akhil"], splitMethod: "exact", splits: { "demo-dad": 800, "demo-akhil": 800 }, note: "Scooter fuel" }),
    demo("g7", { title: "Market shopping", amount: 3200, category: "Shopping", date: "2026-02-17", tripId: "demo-goa", paidBy: "demo-dad", participantIds: ["demo-dad", "demo-lakshmi", "demo-akhil"], splitMethod: "percentage", splits: { "demo-dad": 1600, "demo-lakshmi": 960, "demo-akhil": 640 }, note: "50%, 30%, 20% split" }),
    demo("g8", { title: "Lunch", amount: 2100, category: "Food", date: "2026-02-18", tripId: "demo-goa", paidBy: "demo-venu", participantIds: ["demo-dad", "demo-venu", "demo-brahmam", "demo-lakshmi", "demo-akhil"], splitMethod: "equal", note: "Last day lunch" }),
    demo("c1", { title: "Family dinner", amount: 3600, category: "Food", date: "2026-04-04", tripId: "demo-chennai", paidBy: "demo-lakshmi", participantIds: ["demo-dad", "demo-venu", "demo-lakshmi"], splitMethod: "equal", note: "Mylapore dinner" }),
    demo("c2", { title: "Train tickets", amount: 5400, category: "Travel", date: "2026-04-04", tripId: "demo-chennai", paidBy: "demo-dad", participantIds: ["demo-dad", "demo-venu", "demo-lakshmi"], splitMethod: "equal", note: "Return train" }),
    demo("c3", { title: "Temple tickets", amount: 900, category: "Tickets", date: "2026-04-05", tripId: "demo-chennai", paidBy: "demo-venu", participantIds: ["demo-dad", "demo-venu", "demo-lakshmi"], splitMethod: "equal", note: "Entry passes" }),
    demo("h1", { title: "Hotel room", amount: 6600, category: "Hotel", date: "2026-05-16", tripId: "demo-hyderabad", paidBy: "demo-akhil", participantIds: ["demo-dad", "demo-brahmam", "demo-akhil"], splitMethod: "equal", note: "Weekend stay" }),
    demo("h2", { title: "Charminar tickets", amount: 450, category: "Tickets", date: "2026-05-16", tripId: "demo-hyderabad", paidBy: "demo-dad", participantIds: ["demo-dad", "demo-brahmam", "demo-akhil"], splitMethod: "equal", note: "Monument entry" }),
  ],
  settlements: [
    demo("s1", { from: "demo-brahmam", to: "demo-dad", amount: 2200, date: "2026-02-18", tripId: "demo-goa", note: "Goa repayment" }),
    demo("s2", { from: "demo-venu", to: "demo-dad", amount: 1200, date: "2026-04-06", tripId: "demo-chennai", note: "Train share" }),
    demo("s3", { from: "demo-brahmam", to: "demo-akhil", amount: 1000, date: "2026-05-17", tripId: "demo-hyderabad", note: "Hotel repayment" }),
  ],
};
