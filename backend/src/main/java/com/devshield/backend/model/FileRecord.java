package com.devshield.backend.model;

/**
 * Represents a file discovered during the workspace scan.
 */
public class FileRecord {
    private String id;
    private String relativePath;
    private String absolutePath;
    private String extension;
    private long size;
    private String sha256;
    private String modifiedTime;
    private String changeType; // NEW | MODIFIED | UNCHANGED | DELETED

    public FileRecord() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRelativePath() { return relativePath; }
    public void setRelativePath(String relativePath) { this.relativePath = relativePath; }

    public String getAbsolutePath() { return absolutePath; }
    public void setAbsolutePath(String absolutePath) { this.absolutePath = absolutePath; }

    public String getExtension() { return extension; }
    public void setExtension(String extension) { this.extension = extension; }

    public long getSize() { return size; }
    public void setSize(long size) { this.size = size; }

    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }

    public String getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(String modifiedTime) { this.modifiedTime = modifiedTime; }

    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
}
