package com.devshield.backend;

import com.devshield.backend.indexer.ExtensionIndex;
import com.devshield.backend.indexer.FileIndexer;
import com.devshield.backend.indexer.FilenameIndex;
import com.devshield.backend.indexer.HashIndex;
import com.devshield.backend.model.FileRecord;
import com.devshield.backend.model.Finding;
import com.devshield.backend.service.AnalyzerClient;
import com.devshield.backend.service.ScanService;
import com.devshield.backend.service.ScanService.ScanState;
import com.devshield.backend.store.BaselineStore;
import com.devshield.backend.store.BaselineStore.BaselineData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScanServiceTest {

    @TempDir
    Path workspace;

    private ScanService scanService;
    private AnalyzerClient mockAnalyzerClient;
    private BaselineStore baselineStore;

    @BeforeEach
    void setUp() {
        HashIndex hashIndex = new HashIndex();
        FileIndexer fileIndexer = new FileIndexer(hashIndex);
        FilenameIndex filenameIndex = new FilenameIndex();
        ExtensionIndex extensionIndex = new ExtensionIndex();
        baselineStore = new BaselineStore();
        mockAnalyzerClient = mock(AnalyzerClient.class);

        // By default, analyzer returns empty list (unreachable)
        when(mockAnalyzerClient.analyze(anyString(), anyList()))
                .thenReturn(Collections.emptyList());

        scanService = new ScanService(fileIndexer, hashIndex, filenameIndex,
                extensionIndex, baselineStore, mockAnalyzerClient);
    }

    @Test
    void firstScanWithNoBaseline_allFilesAreNew() throws IOException {
        // Create test files
        Files.writeString(workspace.resolve("alpha.txt"), "alpha content");
        Files.writeString(workspace.resolve("beta.txt"), "beta content");
        Path subdir = workspace.resolve("subdir");
        Files.createDirectories(subdir);
        Files.writeString(subdir.resolve("gamma.txt"), "gamma content");

        var result = scanService.scan(workspace.toString());

        assertEquals(3, result.getTotalFiles(), "total files should be 3");
        assertEquals(3, result.getNewFiles(), "all 3 files should be NEW");
        assertEquals(0, result.getModifiedFiles());
        assertEquals(0, result.getDeletedFiles());
        assertEquals(3, result.getAnalyzedFiles(), "all 3 NEW files should be analyzed");
        assertNull(result.getBaselineApprovedAt(), "no baseline yet");
    }

    @Test
    void secondScanAfterBaseline_onlyModifiedFileIsAnalyzed() throws Exception {
        // Create files
        Path fileA = workspace.resolve("alpha.txt");
        Path fileB = workspace.resolve("beta.txt");
        Files.writeString(fileA, "alpha content");
        Files.writeString(fileB, "beta content");

        // First scan
        scanService.scan(workspace.toString());

        // Approve baseline
        scanService.approveBaseline();

        // Modify fileA — change content and force mtime update
        Thread.sleep(50); // ensure mtime is different
        Files.writeString(fileA, "alpha content MODIFIED");
        // Force the mtime to be different (some filesystems have coarse granularity)
        fileA.toFile().setLastModified(System.currentTimeMillis() + 2000);

        // Reset mock for second scan
        when(mockAnalyzerClient.analyze(anyString(), anyList()))
                .thenReturn(Collections.emptyList());

        // Second scan
        var result = scanService.scan(workspace.toString());

        assertEquals(2, result.getTotalFiles());
        assertEquals(1, result.getModifiedFiles(), "only alpha.txt should be MODIFIED");
        assertEquals(0, result.getNewFiles());
        assertEquals(0, result.getDeletedFiles());
        assertEquals(1, result.getAnalyzedFiles(), "only the modified file should be analyzed");
        assertNotNull(result.getBaselineApprovedAt(), "baseline should have been recorded");

        // Verify analyzer was called with exactly 1 file
        verify(mockAnalyzerClient, times(2)).analyze(anyString(), anyList());
        // The second call should have exactly 1 file
        var captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(mockAnalyzerClient, atLeastOnce()).analyze(anyString(), captor.capture());
        List<List> allCalls = captor.getAllValues();
        // Last call is the second scan
        assertEquals(1, allCalls.get(1).size(), "second scan should analyze exactly 1 file");
    }

    @Test
    void unchangedFilesAreNotAnalyzed() throws IOException {
        Path fileA = workspace.resolve("stable.txt");
        Files.writeString(fileA, "stable content");

        // First scan → approve baseline
        scanService.scan(workspace.toString());
        scanService.approveBaseline();

        // Second scan without any changes
        var result = scanService.scan(workspace.toString());

        assertEquals(1, result.getTotalFiles());
        assertEquals(0, result.getNewFiles());
        assertEquals(0, result.getModifiedFiles());
        assertEquals(0, result.getAnalyzedFiles(), "unchanged file should not be analyzed");
    }

    @Test
    void deletedFilesCountedCorrectly() throws IOException {
        Path fileA = workspace.resolve("will_delete.txt");
        Path fileB = workspace.resolve("stays.txt");
        Files.writeString(fileA, "delete me");
        Files.writeString(fileB, "stay");

        // First scan → approve
        scanService.scan(workspace.toString());
        scanService.approveBaseline();

        // Delete fileA
        Files.delete(fileA);

        // Second scan
        var result = scanService.scan(workspace.toString());

        assertEquals(1, result.getTotalFiles(), "only stays.txt remains");
        assertEquals(1, result.getDeletedFiles(), "one file was deleted");
    }

    @Test
    void analyzerUnreachable_findingsHaveUnknownRiskLevel() throws IOException {
        Files.writeString(workspace.resolve("suspicious.sh"), "rm -rf /");

        // Analyzer returns empty list (simulates unreachable)
        when(mockAnalyzerClient.analyze(anyString(), anyList()))
                .thenReturn(Collections.emptyList());

        scanService.scan(workspace.toString());

        ScanState state = scanService.getLastScan();
        assertNotNull(state);
        assertEquals(1, state.findings().size());

        Finding f = state.findings().get(0);
        assertEquals("UNKNOWN", f.getRiskLevel());
        assertEquals("REVIEW", f.getRecommendation());
        assertTrue(f.getExplanation().contains("Analyzer unreachable"));
    }
}
