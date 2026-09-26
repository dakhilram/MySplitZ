const AUTONOMOUS_TEST_RUN_KEY = "mysplitz-autonomous-test-run-id";

/**
 * Marks writes made by the local QA browser run. This is intentionally
 * development-only so production users can never create test-tagged records.
 */
export function autonomousTestMetadata() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return {};

  try {
    const testRunId = window.sessionStorage.getItem(AUTONOMOUS_TEST_RUN_KEY);
    if (!testRunId?.startsWith("e2e-")) return {};

    return { isAutonomousTest: true, testRunId };
  } catch {
    return {};
  }
}

export { AUTONOMOUS_TEST_RUN_KEY };
