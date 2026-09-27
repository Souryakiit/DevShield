// Shared TypeScript types mirroring CONTRACTS.md shapes.

export interface Signal {
  id: string;
  weight: number;
  detail: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type Recommendation = 'ALLOW' | 'REVIEW' | 'QUARANTINE_REVIEW';
export type ChangeType = 'NEW' | 'MODIFIED' | 'DELETED' | 'UNCHANGED';

export interface Finding {
  fileId: string;
  relativePath: string;
  riskLevel: RiskLevel;
  score: number;
  signals: Signal[];
  recommendation: Recommendation;
  explanation: string;
  changeType: ChangeType;
  size: number;
  sha256: string;
  modifiedTime: string;
  quarantined?: boolean;
}

export interface ScanResult {
  scanId: string;
  workspacePath: string;
  totalFiles: number;
  newFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  analyzedFiles: number;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  durationMs: number;
  baselineApprovedAt: string | null;
}

export interface FindingsResponse {
  scanId: string;
  findings: Finding[];
}

export interface FileDetail extends Finding {
  absolutePath: string;
  extension: string;
}

export interface SearchResult {
  fileId: string;
  relativePath: string;
  riskLevel: RiskLevel | null;
  score: number | null;
  recommendation: Recommendation | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface QuarantineSuccess {
  fileId: string;
  relativePath: string;
  quarantinePath: string;
  sha256: string;
  reason: string;
  quarantinedAt: string;
  restorable: boolean;
}

export interface UploadResult {
  workspacePath: string;
  fileCount: number;
  sessionId: string;
  scanResult?: ScanResult;
  findings?: Finding[];
}

export interface BaselineApproveResult {
  baselineId: string;
  workspacePath: string;
  approvedAt: string;
  filesTracked: number;
  unresolvedHighFindings: number;
  message: string;
}

export interface HashLookupResult {
  hash: string;
  found: boolean;
  verdict: 'MALICIOUS' | 'NOT_FOUND';
  source: string | null;
  message: string;
}
