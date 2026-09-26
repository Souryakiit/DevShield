package com.devshield.backend.indexer;

import com.devshield.backend.model.FileRecord;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * In-memory index of FileRecords keyed by filename (last path segment).
 */
@Component
public class FilenameIndex {

    private final Map<String, List<FileRecord>> index = new HashMap<>();

    public void build(List<FileRecord> records) {
        index.clear();
        for (FileRecord r : records) {
            String path = r.getRelativePath();
            int lastSlash = path.lastIndexOf('/');
            String filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
            index.computeIfAbsent(filename, k -> new ArrayList<>()).add(r);
        }
    }

    public List<FileRecord> getByFilename(String filename) {
        return index.getOrDefault(filename, Collections.emptyList());
    }

    public Map<String, List<FileRecord>> getAll() {
        return Collections.unmodifiableMap(index);
    }
}
