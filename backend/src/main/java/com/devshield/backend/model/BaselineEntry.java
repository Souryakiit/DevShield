package com.devshield.backend.model;

/**
 * Represents a single entry in the baseline snapshot for one file.
 */
public class BaselineEntry {
    private long size;
    private String modifiedTime;
    private String sha256;

    public BaselineEntry() {}

    public BaselineEntry(long size, String modifiedTime, String sha256) {
        this.size = size;
        this.modifiedTime = modifiedTime;
        this.sha256 = sha256;
    }

    public long getSize() { return size; }
    public void setSize(long size) { this.size = size; }

    public String getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(String modifiedTime) { this.modifiedTime = modifiedTime; }

    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
}
