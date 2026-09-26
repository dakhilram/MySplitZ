import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { AUTONOMOUS_TEST_RUN_KEY } from "../lib/autonomous-test";

const testRunId = `e2e-${Date.now()}`;
const suffix = testRunId.slice(-8);
const personA = `__E2E__ Person A ${suffix}`;
const personB = `__E2E__ Person B ${suffix}`;
const personC = `__E2E__ Person C ${suffix}`;
const tripName = `__E2E__ Trip ${suffix}`;

const localEnv = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const qaDb = getFirestore(
  initializeApp(
    {
      apiKey: localEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: localEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: localEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: localEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: localEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: localEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    `autonomous-qa-${testRunId}`,
  ),
);

type RecordMap = Record<string, Record<string, unknown>>;
const testCollections = ["activity", "expenses", "settlements", "trips", "people"] as const;

async function recordsForRun() {
  const entries = await Promise.all(
    testCollections.map(async (collectionName) => {
      const snapshot = await getDocs(
        query(collection(qaDb, collectionName), where("testRunId", "==", testRunId)),
      );
      return [
        collectionName,
        Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()])),
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as RecordMap;
}

async function cleanupTestRun() {
  for (const collectionName of testCollections) {
    const snapshot = await getDocs(
      query(collection(qaDb, collectionName), where("testRunId", "==", testRunId)),
    );
    await Promise.all(snapshot.docs.map((item) => deleteDoc(doc(qaDb, collectionName, item.id))));
  }
}

async function installTestRun(page: Page) {
  await page.addInitScript(
    ({ key, runId }) => window.sessionStorage.setItem(key, runId),
    { key: AUTONOMOUS_TEST_RUN_KEY, runId: testRunId },
  );
}

async function savePerson(page: Page, personName: string, consoleErrors: string[]) {
  await page.getByRole("button", { name: "Person", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add person" })).toBeVisible();
  await page.getByLabel("Name").fill(personName);
  await page.getByRole("button", { name: "Save record" }).click();
  try {
    await expect(page.getByRole("heading", { name: "Add person" })).toBeHidden({ timeout: 15_000 });
  } catch {
    const formError = await page.locator(".form-error").textContent();
    throw new Error(
      `Person save did not complete. Form error: ${formError || "none"}; browser errors: ${consoleErrors.join(" | ") || "none"}.`,
    );
  }
  await expect(page.getByRole("status")).toContainText("added successfully");
}

async function download(page: Page, buttonName: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const file = await event;
  expect((await file.createReadStream()) !== null).toBeTruthy();
}

test("autonomous Firestore and application QA", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("dialog", (dialog) => void dialog.accept());

  await cleanupTestRun();
  try {
    await installTestRun(page);
    await page.goto("/?view=home");
    await expect(page.getByText("MySplitZ").first()).toBeVisible();
    await expect(page.getByText("Saving to Firestore")).toBeVisible();

    await page.getByRole("button", { name: "People", exact: true }).first().click();
    await expect(page).toHaveURL(/\?view=people$/);
    await savePerson(page, personA, consoleErrors);
    let runRecords = await recordsForRun();
    const savedA = Object.entries(runRecords.people).find(([, value]) => value.name === personA);
    expect(savedA).toBeTruthy();
    expect(savedA?.[1]).toMatchObject({ isAutonomousTest: true, testRunId, name: personA });

    await page.getByRole("button", { name: personA, exact: false }).first().click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Phone number").fill("9876543210");
    await page.getByLabel("Email").fill(`qa-${suffix}@example.test`);
    await page.getByLabel("Notes").fill("Autonomous QA record");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Edit person" })).toBeHidden();
    runRecords = await recordsForRun();
    expect(runRecords.people[savedA?.[0] || ""]).toMatchObject({
      phone: "9876543210",
      email: `qa-${suffix}@example.test`,
      notes: "Autonomous QA record",
    });

    await savePerson(page, personB, consoleErrors);
    await savePerson(page, personC, consoleErrors);
    await page.getByRole("button", { name: personA, exact: false }).first().click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("archived");
    runRecords = await recordsForRun();
    expect(runRecords.people[savedA?.[0] || ""]).toMatchObject({ archived: true });

    await page.getByRole("button", { name: personB, exact: false }).first().click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(personB)).toHaveCount(0);
    await savePerson(page, personB, consoleErrors);

    await page.getByRole("button", { name: "Trips", exact: true }).first().click();
    await expect(page).toHaveURL(/\?view=trips$/);
    await page.getByRole("button", { name: "Trip", exact: true }).click();
    await page.getByLabel("Trip name").fill(tripName);
    await page.getByLabel("Description").fill("Autonomous QA trip");
    await page.getByLabel("Start date").fill("2026-09-01");
    await page.getByLabel("End date").fill("2026-09-03");
    await page.getByRole("checkbox", { name: personB }).check();
    await page.getByRole("checkbox", { name: personC }).check();
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByText(tripName)).toBeVisible();
    runRecords = await recordsForRun();
    const savedTrip = Object.entries(runRecords.trips).find(([, value]) => value.name === tripName);
    expect(savedTrip?.[1]).toMatchObject({
      isAutonomousTest: true,
      testRunId,
      memberIds: expect.arrayContaining([expect.any(String), expect.any(String)]),
    });

    const tripCard = page.locator(".trip-card", { hasText: tripName });
    await tripCard.getByRole("button", { name: "Edit trip" }).click();
    await page.getByLabel("Description").fill("Autonomous QA trip, edited");
    await page.getByRole("button", { name: "Save changes" }).click();
    runRecords = await recordsForRun();
    expect(runRecords.trips[savedTrip?.[0] || ""]).toMatchObject({
      description: "Autonomous QA trip, edited",
    });

    const addExpense = async (
      title: string,
      amount: string,
      method: "equal" | "exact" | "percentage",
      payer?: string,
    ) => {
      await tripCard.getByRole("button", { name: "Expense", exact: true }).click();
      await page.getByLabel("What was it for?").fill(title);
      await page.getByLabel("Amount (₹)").fill(amount);
      await page.getByLabel("Date").fill("2026-09-02");
      if (payer) await page.getByLabel("Paid by").selectOption({ label: payer });
      await page.getByLabel("Split method").selectOption(method);
      if (method === "exact") {
        await page.getByLabel(`${personB} exact amount`).fill("40");
        await page.getByLabel(`${personC} exact amount`).fill("60");
      }
      if (method === "percentage") {
        await page.getByLabel(`${personB} percentage`).fill("25");
        await page.getByLabel(`${personC} percentage`).fill("75");
      }
      await page.getByRole("button", { name: "Save record" }).click();
      await expect(page.getByRole("heading", { name: "Add expense" })).toBeHidden();
    };

    await addExpense("__E2E__ Equal meal", "120", "equal", personB);
    await addExpense("__E2E__ Exact tickets", "100", "exact", personC);
    await addExpense("__E2E__ Percentage hotel", "200", "percentage", personB);
    runRecords = await recordsForRun();
    const expenses = Object.values(runRecords.expenses);
    expect(expenses).toHaveLength(3);
    expect(expenses.every((item) => item.isAutonomousTest && item.testRunId === testRunId)).toBeTruthy();
    expect(expenses.find((item) => item.title === "__E2E__ Exact tickets")).toMatchObject({
      amount: 100,
      splitMethod: "exact",
    });
    expect(expenses.find((item) => item.title === "__E2E__ Percentage hotel")).toMatchObject({
      amount: 200,
      splitMethod: "percentage",
    });

    await page.getByRole("button", { name: "Home", exact: true }).first().click();
    await expect(page).toHaveURL(/\?view=home$/);
    await page.getByRole("button", { name: "Record repayment", exact: true }).click();
    await page.getByLabel("From (who paid)").selectOption({ label: personB });
    await page.getByLabel("To (who received)").selectOption({ label: personC });
    await page.getByLabel("Amount (₹)").fill("25");
    await page.getByLabel("Date").fill("2026-09-03");
    await page.getByLabel("Trip (optional)").selectOption({ label: tripName });
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByRole("heading", { name: "Record a repayment" })).toBeHidden();
    runRecords = await recordsForRun();
    expect(Object.values(runRecords.settlements)).toHaveLength(1);

    await page.getByRole("button", { name: "Trips", exact: true }).first().click();
    await tripCard.getByRole("button", { name: "View ledger", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`\\?view=ledger&tripId=${savedTrip?.[0]}&personId=`));
    await expect(page.getByText("__E2E__ Equal meal")).toBeVisible();
    await page.reload();
    await expect(page.getByText("__E2E__ Exact tickets")).toBeVisible();
    await page.getByLabel("Person").selectOption({ label: personC });
    await expect(page).toHaveURL(new RegExp(`view=ledger&tripId=${savedTrip?.[0]}`));
    await page.getByLabel("Transaction type").selectOption("Expense paid");
    await expect(page).toHaveURL(/type=Expense\+paid/);
    await page.getByLabel("Transaction type").selectOption("all");
    await page.getByRole("button", { name: "Export" }).click();
    await download(page, "Download PDF");
    await download(page, "Download Ledger CSV");
    await download(page, "Download Trip Expenses CSV");
    await download(page, "Download Trip Expenses Excel");
    await expect(page).toHaveURL(new RegExp(`view=ledger&tripId=${savedTrip?.[0]}`));

    await page.getByRole("button", { name: "Daybook", exact: true }).first().click();
    await expect(page).toHaveURL(/\?view=daybook/);
    await expect(page.getByText("__E2E__ Percentage hotel")).toBeVisible();
    await page.getByRole("button", { name: "Export" }).click();
    await download(page, "Download PDF");
    await download(page, "Download Daybook CSV");
    await expect(page).toHaveURL(/\?view=daybook/);

    await page.getByRole("button", { name: "Trips", exact: true }).first().click();
    await download(tripCard, "Download Final Trip Report PDF");
    await tripCard.getByRole("button", { name: "Archive Trip", exact: true }).click();
    await expect(tripCard.getByRole("button", { name: "Restore Trip", exact: true })).toBeVisible();
    await expect(tripCard.getByRole("button", { name: "Expense", exact: true })).toBeDisabled();
    await download(tripCard, "Download Final Trip Report PDF");
    await tripCard.getByRole("button", { name: "Restore Trip", exact: true }).click();
    await expect(tripCard.getByRole("button", { name: "Archive Trip", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "People", exact: true }).first().click();
    await expect(page).toHaveURL(/\?view=people$/);
    await page.getByRole("button", { name: "Home", exact: true }).first().click();
    await expect(page).toHaveURL(/\?view=home$/);
    await expect(consoleErrors).toEqual([]);
  } finally {
    await cleanupTestRun();
    expect(Object.values(await recordsForRun()).flatMap(Object.values)).toHaveLength(0);
  }
});

test("mobile navigation retains canonical page URLs", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?view=home");
  await page.getByRole("button", { name: "People", exact: true }).last().click();
  await expect(page).toHaveURL(/\?view=people$/);
  await page.getByRole("button", { name: "Home", exact: true }).last().click();
  await expect(page).toHaveURL(/\?view=home$/);
});
