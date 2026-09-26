package com.devshield.backend.indexer;

import com.devshield.backend.model.FileRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Walks the workspace directory tree and collects FileRecords.
 * Skips .git, node_modules, target, and .devshield directories.
 */
@Component
public class FileIndexer {

    private static final Set<String> SKIP_DIRS = Set.of(".git", "node_modules", "target", ".devshield");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")
            .withZone(ZoneOffset.UTC);

    private final HashIndex hashIndex;

    public FileIndexer(HashIndex hashIndex) {
        this.hashIndex = hashIndex;
    }

    /**
     * Indexes all files under the given workspace root, skipping excluded directories.
     */
    public List<FileRecord> index(Path workspaceRoot) throws IOException {
        List<FileRecord> records = new ArrayList<>();

        Files.walkFileTree(workspaceRoot, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                String name = dir.getFileName() != null ? dir.getFileName().toString() : "";
                if (SKIP_DIRS.contains(name) && !dir.equals(workspaceRoot)) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                if (!attrs.isRegularFile()) {
                    return FileVisitResult.CONTINUE;
                }

                Path relative = workspaceRoot.relativize(file);
                String relativeStr = relative.toString().replace('\\', '/');

                String extension = "";
                String fileName = file.getFileName().toString();
                int dotIdx = fileName.lastIndexOf('.');
                if (dotIdx > 0 && dotIdx < fileName.length() - 1) {
                    extension = fileName.substring(dotIdx + 1).toLowerCase();
                }

                String modifiedTime = ISO.format(attrs.lastModifiedTime().toInstant());
                long size = attrs.size();

                // ID = first 8 hex chars of SHA-256 of the relative path string
                String id = hashIndex.hashString(relativeStr).substring(0, 8);

                FileRecord record = new FileRecord();
                record.setId(id);
                record.setRelativePath(relativeStr);
                record.setAbsolutePath(file.toAbsolutePath().toString());
                record.setExtension(extension);
                record.setSize(size);
                record.setModifiedTime(modifiedTime);
                // SHA-256 of actual content is set later by ScanService (lazy, based on diff)
                record.setSha256(null);

                records.add(record);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) {
                // skip unreadable files
                return FileVisitResult.CONTINUE;
            }
        });

        return records;
    }
}
