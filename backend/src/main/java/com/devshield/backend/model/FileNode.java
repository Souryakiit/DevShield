package com.devshield.backend.model;

import java.util.List;

/**
 * Represents a node in the directory tree structure.
 */
public class FileNode {
    private String name;
    private String path;
    private List<FileNode> children;

    public FileNode() {}

    public FileNode(String name, String path) {
        this.name = name;
        this.path = path;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public List<FileNode> getChildren() { return children; }
    public void setChildren(List<FileNode> children) { this.children = children; }
}
