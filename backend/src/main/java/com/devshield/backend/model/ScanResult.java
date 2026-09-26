package com.devshield.backend.model;

/**
 * Aggregated result of a workspace scan.
 */
public class ScanResult {
    private String scanId;
    private String workspacePath;
    private int totalFiles;
    private int newFiles;
    private int modifiedFiles;
    private int deletedFiles;
    private int analyzedFiles;
    private int lowCount;
    private int mediumCount;
    private int highCount;
    private long durationMs;
    private String baselineApprovedAt;

    public ScanResult() {}

    public String getScanId() { return scanId; }
    public void setScanId(String scanId) { this.scanId = scanId; }

    public String getWorkspacePath() { return workspacePath; }
    public void setWorkspacePath(String workspacePath) { this.workspacePath = workspacePath; }

    public int getTotalFiles() { return totalFiles; }
    public void setTotalFiles(int totalFiles) { this.totalFiles = totalFiles; }

    public int getNewFiles() { return newFiles; }
    public void setNewFiles(int newFiles) { this.newFiles = newFiles; }

    public int getModifiedFiles() { return modifiedFiles; }
    public void setModifiedFiles(int modifiedFiles) { this.modifiedFiles = modifiedFiles; }

    public int getDeletedFiles() { return deletedFiles; }
    public void setDeletedFiles(int deletedFiles) { this.deletedFiles = deletedFiles; }

    public int getAnalyzedFiles() { return analyzedFiles; }
    public void setAnalyzedFiles(int analyzedFiles) { this.analyzedFiles = analyzedFiles; }

    public int getLowCount() { return lowCount; }
    public void setLowCount(int lowCount) { this.lowCount = lowCount; }

    public int getMediumCount() { return mediumCount; }
    public void setMediumCount(int mediumCount) { this.mediumCount = mediumCount; }

    public int getHighCount() { return highCount; }
    public void setHighCount(int highCount) { this.highCount = highCount; }

    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }

    public String getBaselineApprovedAt() { return baselineApprovedAt; }
    public void setBaselineApprovedAt(String baselineApprovedAt) { this.baselineApprovedAt = baselineApprovedAt; }
}
