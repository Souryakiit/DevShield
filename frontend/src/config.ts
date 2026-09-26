// Central config — all env-driven values go here.
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

export const USE_MOCKS: boolean =
  (import.meta.env.VITE_USE_MOCKS as string | undefined) === 'true';
