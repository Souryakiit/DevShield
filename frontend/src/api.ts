/**
 * api.ts — single API layer.
 * Screens never import fetch or mock data directly — they use these functions.
 * When USE_MOCKS=true the functions return static JSON from /mocks/*.json.
 */
import { API_BASE_URL, USE_MOCKS } from './config';
import type {
  ScanResult,
  FindingsResponse,
  FileDetail,
  SearchResponse,
  QuarantineSuccess,
  BaselineApproveResult,
} from './types';

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, null, 'Backend unreachable. Run scripts/run-all.ps1 to start the services.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message
      ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, body, msg);
  }
  return body as T;
}

async function mockFetch<T>(mockFile: string): Promise<T> {
  const res = await fetch(`/mocks/${mockFile}`);
  if (!res.ok) throw new Error(`Mock not found: ${mockFile}`);
  return res.json() as Promise<T>;
}

// ----------------------------------------------------------------
// scan
// ----------------------------------------------------------------
export async function scanWorkspace(workspacePath: string): Promise<ScanResult> {
  if (USE_MOCKS) return mockFetch<ScanResult>('scan.json');
  return apiFetch<ScanResult>('/api/workspace/scan', {
    method: 'POST',
    body: JSON.stringify({ workspacePath }),
  });
}

// ----------------------------------------------------------------
// findings
// ----------------------------------------------------------------
export async function getFindings(): Promise<FindingsResponse> {
  if (USE_MOCKS) return mockFetch<FindingsResponse>('findings.json');
  return apiFetch<FindingsResponse>('/api/workspace/findings');
}

// ----------------------------------------------------------------
// file detail
// ----------------------------------------------------------------
export async function getFileDetail(id: string): Promise<FileDetail> {
  if (USE_MOCKS) return mockFetch<FileDetail>('file-detail.json');
  return apiFetch<FileDetail>(`/api/files/${id}`);
}

// ----------------------------------------------------------------
// search
// ----------------------------------------------------------------
export async function searchFiles(query: string): Promise<SearchResponse> {
  if (USE_MOCKS) return mockFetch<SearchResponse>('file-search.json');
  return apiFetch<SearchResponse>(`/api/files/search?q=${encodeURIComponent(query)}`);
}

// ----------------------------------------------------------------
// quarantine
// ----------------------------------------------------------------
export async function quarantineFile(id: string): Promise<QuarantineSuccess> {
  if (USE_MOCKS) return mockFetch<QuarantineSuccess>('quarantine-success.json');
  return apiFetch<QuarantineSuccess>(`/api/files/${id}/quarantine`, {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  });
}

// ----------------------------------------------------------------
// baseline approve
// ----------------------------------------------------------------
export async function approveBaseline(): Promise<BaselineApproveResult> {
  if (USE_MOCKS) return mockFetch<BaselineApproveResult>('baseline-approve.json');
  return apiFetch<BaselineApproveResult>('/api/workspace/baseline/approve', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export { ApiError };
