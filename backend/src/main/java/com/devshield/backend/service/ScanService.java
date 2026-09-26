package com.devshield.backend.service;

import com.devshield.backend.indexer.ExtensionIndex;
import com.devshield.backend.indexer.FileIndexer;
import com.devshield.backend.indexer.FilenameIndex;
import com.devshield.backend.indexer.HashIndex;
import com.devshield.backend.model.*;
import com.devshield.backend.store.BaselineStore;
import com.devshield.backend.store.BaselineStore.BaselineData;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * Core scan service. Orchestrates indexing, diffing against the baseline,
 * calling the analyzer, and storing results in memory.
 */
@Service
public class ScanService {

    private static final DateTimeFormatter ISO =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private final FileIndexer fileIndexer;
    private final HashIndex hashIndex;
    private final FilenameIndex filenameIndex;
    private final ExtensionIndex extensionIndex;
    private final BaselineStore baselineStore;
    private final AnalyzerClient analyzerClient;

    // In-memory state of last scan
    private final AtomicReference<ScanState> lastScan = new AtomicReference<>(null);

    public ScanService(FileIndexer fileIndexer, HashIndex hashIndex,
                       FilenameIndex filenameIndex, ExtensionIndex extensionIndex,
                       BaselineStore baselineStore, AnalyzerClient analyzerClient) {
        this.fileIndexer = fileIndexer;
        this.hashIndex = hashIndex;
        this.filenameIndex = filenameIndex;
        this.extensionIndex = extensionIndex;
        this.baselineStore = baselineStore;
        this.analyzerClient = analyzerClient;
    }

    /**
     * Runs a full workspace scan and returns the result summary.
     */
    public ScanResult scan(String workspacePath) throws IOException {
        long startMs = System.currentTimeMillis();

        Path root = Paths.get(workspacePath);

        // 1. Index all files
        List<FileRecord> currentFiles = fileIndexer.index(root);

        // 2. Load baseline
        BaselineData baseline = baselineStore.load(workspacePath);
        Map<String, BaselineEntry> baselineFiles =
                baseline != null ? baseline.files() : Collections.emptyMap();

        // 3. Diff
        List<FileRecord> toAnalyze = new ArrayList<>();
        int newFiles = 0, modifiedFiles = 0;

        Map<String, FileRecord> currentByPath = new LinkedHashMap<>();
        for (FileRecord fr : currentFiles) {
            currentByPath.put(fr.getRelativePath(), fr);
        }

        for (FileRecord fr : currentFiles) {
            BaselineEntry entry = baselineFiles.get(fr.getRelativePath());
            if (entry == null) {
                // NEW
                fr.setChangeType("NEW");
                fr.setSha256(hashIndex.hashFile(Paths.get(fr.getAbsolutePath())));
                toAnalyze.add(fr);
                newFiles++;
            } else if (fr.getSize() == entry.getSize()
                    && fr.getModifiedTime().equals(entry.getModifiedTime())) {
                // UNCHANGED — reuse baseline hash
                fr.setChangeType("UNCHANGED");
                fr.setSha256(entry.getSha256());
            } else {
                // MODIFIED — rehash
                fr.setChangeType("MODIFIED");
                fr.setSha256(hashIndex.hashFile(Paths.get(fr.getAbsolutePath())));
                toAnalyze.add(fr);
                modifiedFiles++;
            }
        }

        // 4. Deleted files (in baseline but not in current)
        int deletedFiles = 0;
        for (String path : baselineFiles.keySet()) {
            if (!currentByPath.containsKey(path)) {
                deletedFiles++;
            }
        }

        // 5. Call analyzer
        List<Finding> analyzerFindings = analyzerClient.analyze(workspacePath, toAnalyze);
        boolean analyzerUnreachable = analyzerFindings.isEmpty() && !toAnalyze.isEmpty();

        // Map analyzer findings by fileId
        Map<String, Finding> findingByFileId = new HashMap<>();
        for (Finding f : analyzerFindings) {
            findingByFileId.put(f.getFileId(), f);
        }

        // 6. Build full findings list
        List<Finding> findings = new ArrayList<>();
        for (FileRecord fr : toAnalyze) {
            Finding finding = findingByFileId.get(fr.getId());
            if (finding == null) {
                // Analyzer unreachable or didn't return this file
                finding = new Finding();
                finding.setFileId(fr.getId());
                finding.setRiskLevel("UNKNOWN");
                finding.setScore(0);
                finding.setSignals(Collections.emptyList());
                finding.setRecommendation("REVIEW");
                finding.setExplanation("Analyzer unreachable. Manual review required.");
            }
            // Enrich with FileRecord data
            finding.setRelativePath(fr.getRelativePath());
            finding.setAbsolutePath(fr.getAbsolutePath());
            finding.setExtension(fr.getExtension());
            finding.setChangeType(fr.getChangeType());
            finding.setSize(fr.getSize());
            finding.setSha256(fr.getSha256());
            finding.setModifiedTime(fr.getModifiedTime());
            finding.setQuarantined(false);
            findings.add(finding);
        }

        // 7. Count risk levels
        int lowCount = 0, mediumCount = 0, highCount = 0;
        for (Finding f : findings) {
            switch (f.getRiskLevel()) {
                case "LOW" -> lowCount++;
                case "HIGH" -> highCount++;
                case "MEDIUM", "UNKNOWN" -> mediumCount++; // UNKNOWN lumped with MEDIUM
            }
        }

        long durationMs = System.currentTimeMillis() - startMs;

        String scanId = "scan-" + Instant.now().toString().substring(0, 10) + "-"
                + String.format("%03d", Math.abs((int) (System.currentTimeMillis() % 1000)));

        // 8. Build indexes
        filenameIndex.build(currentFiles);
        extensionIndex.build(currentFiles);

        // 9. Store in memory
        lastScan.set(new ScanState(scanId, workspacePath, currentFiles, findings));

        ScanResult result = new ScanResult();
        result.setScanId(scanId);
        result.setWorkspacePath(workspacePath);
        result.setTotalFiles(currentFiles.size());
        result.setNewFiles(newFiles);
        result.setModifiedFiles(modifiedFiles);
        result.setDeletedFiles(deletedFiles);
        result.setAnalyzedFiles(toAnalyze.size());
        result.setLowCount(lowCount);
        result.setMediumCount(mediumCount);
        result.setHighCount(highCount);
        result.setDurationMs(durationMs);
        result.setBaselineApprovedAt(baseline != null ? baseline.approvedAt() : null);

        return result;
    }

    /**
     * Approves the current scan state as the new baseline.
     */
    public Map<String, Object> approveBaseline() throws IOException {
        ScanState state = lastScan.get();
        if (state == null) {
            throw new IllegalStateException("No scan has been run yet.");
        }

        String approvedAt = ISO.format(Instant.now());

        Map<String, BaselineEntry> files = new LinkedHashMap<>();
        for (FileRecord fr : state.currentFiles()) {
            files.put(fr.getRelativePath(),
                    new BaselineEntry(fr.getSize(), fr.getModifiedTime(), fr.getSha256()));
        }

        BaselineData data = new BaselineData(approvedAt, files);
        baselineStore.save(state.workspacePath(), data);

        // Count unresolved HIGH findings
        long unresolvedHigh = state.findings().stream()
                .filter(f -> "HIGH".equals(f.getRiskLevel()) && !f.isQuarantined())
                .count();

        String baselineId = "baseline-" + approvedAt.substring(0, 10) + "-"
                + String.format("%03d", Math.abs((int) (System.currentTimeMillis() % 1000)));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("baselineId", baselineId);
        response.put("workspacePath", state.workspacePath());
        response.put("approvedAt", approvedAt);
        response.put("filesTracked", state.currentFiles().size());
        response.put("unresolvedHighFindings", unresolvedHigh);
        response.put("message", "Baseline approved. " + state.currentFiles().size()
                + " files tracked. Next scan will diff against this state.");

        return response;
    }

    /**
     * Returns findings from the last scan.
     */
    public ScanState getLastScan() {
        return lastScan.get();
    }

    /**
     * Returns a specific finding by fileId, or null.
     */
    public Finding findingById(String fileId) {
        ScanState state = lastScan.get();
        if (state == null) return null;
        return state.findings().stream()
                .filter(f -> f.getFileId().equals(fileId))
                .findFirst()
                .orElse(null);
    }

    /**
     * Search findings by relativePath substring.
     */
    public List<Finding> search(String query) {
        ScanState state = lastScan.get();
        if (state == null) return Collections.emptyList();
        String lq = query.toLowerCase();
        return state.findings().stream()
                .filter(f -> f.getRelativePath().toLowerCase().contains(lq))
                .collect(Collectors.toList());
    }

    /**
     * Returns the workspace path from the last scan.
     */
    public String getLastWorkspacePath() {
        ScanState state = lastScan.get();
        return state != null ? state.workspacePath() : null;
    }

    public record ScanState(
            String scanId,
            String workspacePath,
            List<FileRecord> currentFiles,
            List<Finding> findings
    ) {}
}
