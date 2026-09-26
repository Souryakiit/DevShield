package com.devshield.backend.store;

import com.devshield.backend.model.BaselineEntry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * Reads and writes the baseline snapshot stored in <workspace>/.devshield/baseline.json.
 *
 * JSON structure:
 * {
 *   "approvedAt": "...",
 *   "files": { "<relativePath>": { size, modifiedTime, sha256 }, ... }
 * }
 */
@Component
public class BaselineStore {

    private static final String DEVSHIELD_DIR = ".devshield";
    private static final String BASELINE_FILE = "baseline.json";

    private final ObjectMapper mapper;

    public BaselineStore() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public BaselineData load(String workspacePath) throws IOException {
        Path baselineFile = baselinePath(workspacePath);
        if (!Files.exists(baselineFile)) {
            return null;
        }
        Map<String, Object> raw = mapper.readValue(baselineFile.toFile(),
                new TypeReference<Map<String, Object>>() {});

        String approvedAt = (String) raw.get("approvedAt");

        @SuppressWarnings("unchecked")
        Map<String, Map<String, Object>> filesRaw =
                (Map<String, Map<String, Object>>) raw.getOrDefault("files", Collections.emptyMap());

        Map<String, BaselineEntry> files = new HashMap<>();
        for (Map.Entry<String, Map<String, Object>> e : filesRaw.entrySet()) {
            Map<String, Object> v = e.getValue();
            long size = v.get("size") instanceof Number ? ((Number) v.get("size")).longValue() : 0L;
            String modifiedTime = (String) v.get("modifiedTime");
            String sha256 = (String) v.get("sha256");
            files.put(e.getKey(), new BaselineEntry(size, modifiedTime, sha256));
        }

        return new BaselineData(approvedAt, files);
    }

    public void save(String workspacePath, BaselineData data) throws IOException {
        Path dir = devshieldDir(workspacePath);
        Files.createDirectories(dir);
        Path baselineFile = dir.resolve(BASELINE_FILE);

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("approvedAt", data.approvedAt());

        Map<String, Object> filesMap = new LinkedHashMap<>();
        for (Map.Entry<String, BaselineEntry> e : data.files().entrySet()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("size", e.getValue().getSize());
            entry.put("modifiedTime", e.getValue().getModifiedTime());
            entry.put("sha256", e.getValue().getSha256());
            filesMap.put(e.getKey(), entry);
        }
        root.put("files", filesMap);

        mapper.writeValue(baselineFile.toFile(), root);
    }

    public Path devshieldDir(String workspacePath) {
        return Paths.get(workspacePath).resolve(DEVSHIELD_DIR);
    }

    private Path baselinePath(String workspacePath) {
        return devshieldDir(workspacePath).resolve(BASELINE_FILE);
    }

    public record BaselineData(String approvedAt, Map<String, BaselineEntry> files) {}
}
