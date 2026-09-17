import "@testing-library/jest-dom/vitest";

// Keep interaction tests hermetic: never mutate the live Enter Cloud demo
// dataset — the data layer falls back to its in-memory adapter in tests.
(globalThis as { __FINSIGHT_FORCE_MEMORY__?: boolean }).__FINSIGHT_FORCE_MEMORY__ = true;
