package com.devshield.backend.controller;

import com.devshield.backend.model.Finding;
import com.devshield.backend.service.ScanService;
import com.devshield.backend.service.ScanService.ScanState;
import com.devshield.backend.store.BaselineStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Handles per-file operations: lookup by id, search, and quarantine.
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final DateTimeFormatter ISO =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private final ScanService scanService;
    private final BaselineStore baselineStore;
    private final ObjectMapper objectMapper;

    public FileController(ScanService scanService, BaselineStore baselineStore) {
        this.scanService = scanService;
        this.baselineStore = baselineStore;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * GET /api/files/search?q={query}
     * Must be declared before /{id} so "search" isn't treated as an id.
     */
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam("q") String query) {
        List<Finding> results = scanService.search(query);
        List<Map<String, Object>> slim = results.stream().map(f -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fileId", f.getFileId());
            m.put("relativePath", f.getRelativePath());
            m.put("riskLevel", f.getRiskLevel());
            m.put("score", f.getScore());
            m.put("recommendation", f.getRecommendation());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("query", query, "results", slim));
    }

    /**
     * GET /api/files/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getFile(@PathVariable("id") String id) {
        Finding finding = scanService.findingById(id);
        if (finding == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "FILE_NOT_FOUND",
                            "message", "No file with id '" + id + "' found in the current scan."));
        }
        return ResponseEntity.ok(buildFileResponse(finding));
    }

    /**
     * POST /api/files/{id}/quarantine
     */
    @PostMapping("/{id}/quarantine")
    public ResponseEntity<?> quarantine(
            @PathVariable("id") String id,
            @RequestBody(required = false) Map<String, Object> body) {

        // Confirm body
        boolean confirmed = body != null && Boolean.TRUE.equals(body.get("confirmed"));
        if (!confirmed) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "CONFIRMATION_REQUIRED",
                    "message", "Quarantine requires explicit confirmation. Send { \"confirmed\": true } in the request body."
            ));
        }

        Finding finding = scanService.findingById(id);
        if (finding == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "FILE_NOT_FOUND",
                    "message", "No file with id '" + id + "' found in the current scan."
            ));
        }

        if (finding.isQuarantined()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "ALREADY_QUARANTINED",
                    "message", "File is already quarantined."
            ));
        }

        String workspacePath = scanService.getLastWorkspacePath();
        try {
            Path quarantineDir = baselineStore.devshieldDir(workspacePath).resolve("quarantine");
            Files.createDirectories(quarantineDir);

            // Determine destination filename: <fileId>_<filename>
            String originalAbsPath = finding.getAbsolutePath();
            Path srcPath = Paths.get(originalAbsPath);
            String filename = srcPath.getFileName().toString();
            String destFilename = finding.getFileId() + "_" + filename;
            Path destPath = quarantineDir.resolve(destFilename);

            // Move file
            Files.move(srcPath, destPath, StandardCopyOption.REPLACE_EXISTING);

            // Relative quarantine path
            Path workspaceRoot = Paths.get(workspacePath);
            String quarantineRelPath = workspaceRoot.relativize(destPath).toString().replace('\\', '/');

            String timestamp = ISO.format(Instant.now());

            // Build signal reason string
            String reason = "";
            if (finding.getSignals() != null && !finding.getSignals().isEmpty()) {
                reason = finding.getSignals().stream()
                        .map(s -> s.getId())
                        .collect(Collectors.joining(", "));
            }

            // Append to manifest
            appendToManifest(quarantineDir, originalAbsPath, quarantineRelPath,
                    finding.getSha256(), reason, timestamp);

            // Mark as quarantined in memory
            finding.setQuarantined(true);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("fileId", finding.getFileId());
            response.put("relativePath", finding.getRelativePath());
            response.put("quarantinePath", quarantineRelPath);
            response.put("sha256", finding.getSha256());
            response.put("reason", reason);
            response.put("quarantinedAt", timestamp);
            response.put("restorable", true);

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "QUARANTINE_FAILED", "message", e.getMessage()));
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Map<String, Object> buildFileResponse(Finding f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fileId", f.getFileId());
        m.put("relativePath", f.getRelativePath());
        m.put("absolutePath", f.getAbsolutePath());
        m.put("extension", f.getExtension());
        m.put("size", f.getSize());
        m.put("sha256", f.getSha256());
        m.put("modifiedTime", f.getModifiedTime());
        m.put("changeType", f.getChangeType());
        m.put("riskLevel", f.getRiskLevel());
        m.put("score", f.getScore());
        m.put("signals", f.getSignals());
        m.put("recommendation", f.getRecommendation());
        m.put("explanation", f.getExplanation());
        m.put("quarantined", f.isQuarantined());
        return m;
    }

    @SuppressWarnings("unchecked")
    private void appendToManifest(Path quarantineDir, String originalPath, String quarantinePath,
                                   String sha256, String reason, String timestamp) throws IOException {
        Path manifestFile = quarantineDir.resolve("manifest.json");
        List<Map<String, Object>> entries = new ArrayList<>();

        if (Files.exists(manifestFile)) {
            try {
                entries = objectMapper.readValue(manifestFile.toFile(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception ignored) {
                // corrupt manifest, start fresh
            }
        }

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("originalPath", originalPath);
        entry.put("quarantinePath", quarantinePath);
        entry.put("sha256", sha256);
        entry.put("reason", reason);
        entry.put("timestamp", timestamp);
        entries.add(entry);

        objectMapper.writerWithDefaultPrettyPrinter().writeValue(manifestFile.toFile(), entries);
    }
}
