package com.devshield.backend.controller;

import com.devshield.backend.model.ScanResult;
import com.devshield.backend.service.ScanService;
import com.devshield.backend.service.ScanService.ScanState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.*;

/**
 * Handles workspace-level operations: scan, findings retrieval, and baseline approval.
 */
@RestController
@RequestMapping("/api/workspace")
public class ScanController {

    private final ScanService scanService;

    public ScanController(ScanService scanService) {
        this.scanService = scanService;
    }

    /**
     * POST /api/workspace/scan
     */
    @PostMapping("/scan")
    public ResponseEntity<?> scan(@RequestBody Map<String, String> body) {
        String workspacePath = body.get("workspacePath");
        if (workspacePath == null || workspacePath.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "MISSING_WORKSPACE_PATH",
                            "message", "workspacePath is required."));
        }
        try {
            ScanResult result = scanService.scan(workspacePath);
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "SCAN_FAILED", "message", e.getMessage()));
        }
    }

    /**
     * GET /api/workspace/findings
     */
    @GetMapping("/findings")
    public ResponseEntity<?> findings() {
        ScanState state = scanService.getLastScan();
        if (state == null) {
            return ResponseEntity.ok(Map.of("scanId", "", "findings", Collections.emptyList()));
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("scanId", state.scanId());
        response.put("findings", state.findings());
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/workspace/baseline/approve
     */
    @PostMapping("/baseline/approve")
    public ResponseEntity<?> approveBaseline(@RequestBody(required = false) Map<String, Object> body) {
        try {
            Map<String, Object> result = scanService.approveBaseline();
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "NO_SCAN", "message", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "BASELINE_FAILED", "message", e.getMessage()));
        }
    }
}
