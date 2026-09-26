package com.devshield.backend;

import com.devshield.backend.controller.FileController;
import com.devshield.backend.indexer.ExtensionIndex;
import com.devshield.backend.indexer.FileIndexer;
import com.devshield.backend.indexer.FilenameIndex;
import com.devshield.backend.indexer.HashIndex;
import com.devshield.backend.model.Finding;
import com.devshield.backend.model.Signal;
import com.devshield.backend.service.AnalyzerClient;
import com.devshield.backend.service.ScanService;
import com.devshield.backend.store.BaselineStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class QuarantineTest {

    @TempDir
    Path workspace;

    private ScanService scanService;
    private FileController fileController;
    private BaselineStore baselineStore;

    @BeforeEach
    void setUp() throws IOException {
        HashIndex hashIndex = new HashIndex();
        FileIndexer fileIndexer = new FileIndexer(hashIndex);
        FilenameIndex filenameIndex = new FilenameIndex();
        ExtensionIndex extensionIndex = new ExtensionIndex();
        baselineStore = new BaselineStore();
        AnalyzerClient mockAnalyzer = mock(AnalyzerClient.class);

        // Analyzer returns a HIGH finding for all files
        when(mockAnalyzer.analyze(anyString(), anyList())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            var files = (List<com.devshield.backend.model.FileRecord>) inv.getArgument(1);
            List<Finding> findings = new ArrayList<>();
            for (var fr : files) {
                Finding f = new Finding();
                f.setFileId(fr.getId());
                f.setRiskLevel("HIGH");
                f.setScore(90);
                f.setSignals(List.of(new Signal("magic_mismatch", 50, "Test signal")));
                f.setRecommendation("QUARANTINE_REVIEW");
                f.setExplanation("Test explanation");
                findings.add(f);
            }
            return findings;
        });

        scanService = new ScanService(fileIndexer, hashIndex, filenameIndex,
                extensionIndex, baselineStore, mockAnalyzer);
        fileController = new FileController(scanService, baselineStore);

        // Create a target file and scan
        Path malicious = workspace.resolve("malicious.exe");
        Files.writeString(malicious, "MZ fake executable content");
        scanService.scan(workspace.toString());
    }

    private String getFirstFindingId() {
        return scanService.getLastScan().findings().get(0).getFileId();
    }

    @Test
    void quarantineWithConfirmedFalse_returns400() {
        String fileId = getFirstFindingId();

        ResponseEntity<?> response = fileController.quarantine(fileId, Map.of("confirmed", false));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("CONFIRMATION_REQUIRED", body.get("error"));
    }

    @Test
    void quarantineWithMissingBody_returns400() {
        String fileId = getFirstFindingId();

        ResponseEntity<?> response = fileController.quarantine(fileId, null);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void quarantineWithConfirmedTrue_movesFileAndCreatesManifest() throws IOException {
        String fileId = getFirstFindingId();
        Finding finding = scanService.findingById(fileId);
        assertNotNull(finding);

        // Verify file exists before quarantine
        Path originalFile = Path.of(finding.getAbsolutePath());
        assertTrue(Files.exists(originalFile), "file should exist before quarantine");

        ResponseEntity<?> response = fileController.quarantine(fileId, Map.of("confirmed", true));

        assertEquals(HttpStatus.OK, response.getStatusCode());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(fileId, body.get("fileId"));
        assertNotNull(body.get("quarantinePath"));
        assertNotNull(body.get("quarantinedAt"));
        assertEquals(true, body.get("restorable"));

        // File should have been moved
        assertFalse(Files.exists(originalFile), "original file should be moved away");

        // Quarantine dir should exist with the file
        Path quarantineDir = baselineStore.devshieldDir(workspace.toString()).resolve("quarantine");
        assertTrue(Files.exists(quarantineDir), "quarantine directory should exist");

        // Manifest should exist
        Path manifest = quarantineDir.resolve("manifest.json");
        assertTrue(Files.exists(manifest), "manifest.json should exist");
        String manifestContent = Files.readString(manifest);
        assertTrue(manifestContent.contains(fileId), "manifest should contain file id");
    }

    @Test
    void quarantinedFindingMarkedInMemory() throws IOException {
        String fileId = getFirstFindingId();

        fileController.quarantine(fileId, Map.of("confirmed", true));

        Finding finding = scanService.findingById(fileId);
        assertNotNull(finding);
        assertTrue(finding.isQuarantined(), "finding should be marked as quarantined");
    }

    @Test
    void quarantineNonExistentFile_returns404() {
        ResponseEntity<?> response = fileController.quarantine("deadbeef", Map.of("confirmed", true));

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}
