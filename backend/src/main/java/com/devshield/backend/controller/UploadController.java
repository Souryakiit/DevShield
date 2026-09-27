package com.devshield.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * Accepts a folder upload from the browser (webkitdirectory), saves to a temp
 * directory, and returns the path so the frontend can trigger a scan.
 *
 * POST /api/workspace/upload
 *   multipart/form-data fields:
 *     files[]  — the uploaded files
 *     paths[]  — matching webkitRelativePath for each file (same order)
 */
@RestController
@RequestMapping("/api/workspace")
public class UploadController {

    private static final Path UPLOAD_BASE = Paths.get(System.getProperty("java.io.tmpdir"), "devshield-uploads");

    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("paths") List<String> paths) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "NO_FILES", "message", "No files received."));
        }
        if (paths == null || paths.size() != files.size()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "PATH_MISMATCH", "message", "paths[] count must match files[] count."));
        }

        String sessionId = "upload-" + UUID.randomUUID().toString().substring(0, 8);
        Path dest = UPLOAD_BASE.resolve(sessionId);

        try {
            Files.createDirectories(dest);

            for (int i = 0; i < files.size(); i++) {
                MultipartFile file = files.get(i);
                String relativePath = sanitizePath(paths.get(i));

                Path target = dest.resolve(relativePath).normalize();
                if (!target.startsWith(dest)) {
                    // Path traversal guard
                    continue;
                }
                Files.createDirectories(target.getParent());
                file.transferTo(target);
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("workspacePath", dest.toAbsolutePath().toString());
            response.put("fileCount", files.size());
            response.put("sessionId", sessionId);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "UPLOAD_FAILED", "message", e.getMessage()));
        }
    }

    private String sanitizePath(String raw) {
        // Strip leading slashes and collapse ..
        return raw.replaceAll("^\\.+/", "").replaceAll("\\.\\./", "");
    }
}
