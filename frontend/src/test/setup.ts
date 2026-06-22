import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.stubEnv("VITE_APP_ENV", "test");
vi.stubEnv("VITE_USE_MOCKS", "false");
vi.stubEnv("VITE_MOCK_DELAY_MS", "0");
vi.stubEnv("VITE_MOCK_SCENARIO", "success");
vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
