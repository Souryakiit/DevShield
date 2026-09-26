package com.devshield.backend.indexer;

import com.devshield.backend.model.FileRecord;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * In-memory index of FileRecords keyed by file extension.
 */
@Component
public class ExtensionIndex {

    private final Map<String, List<FileRecord>> index = new HashMap<>();

    public void build(List<FileRecord> records) {
        index.clear();
        for (FileRecord r : records) {
            String ext = r.getExtension() != null ? r.getExtension() : "";
            index.computeIfAbsent(ext, k -> new ArrayList<>()).add(r);
        }
    }

    public List<FileRecord> getByExtension(String extension) {
        return index.getOrDefault(extension.toLowerCase(), Collections.emptyList());
    }

    public Map<String, List<FileRecord>> getAll() {
        return Collections.unmodifiableMap(index);
    }
}
