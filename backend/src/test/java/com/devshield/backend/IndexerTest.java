package com.devshield.backend;

import com.devshield.backend.indexer.FileIndexer;
import com.devshield.backend.indexer.HashIndex;
import com.devshield.backend.model.FileRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class IndexerTest {

    @TempDir
    Path tempDir;

    private FileIndexer createIndexer() {
        return new FileIndexer(new HashIndex());
    }

    @Test
    void indexesCorrectNumberOfFiles() throws IOException {
        // Create a few files in the workspace
        Files.writeString(tempDir.resolve("readme.txt"), "hello");
        Files.writeString(tempDir.resolve("main.java"), "public class Main {}");
        Path subdir = tempDir.resolve("src");
        Files.createDirectories(subdir);
        Files.writeString(subdir.resolve("App.java"), "class App {}");

        List<FileRecord> records = createIndexer().index(tempDir);

        assertEquals(3, records.size(), "Should index exactly 3 files");
    }

    @Test
    void skipsGitDirectory() throws IOException {
        Files.writeString(tempDir.resolve("code.js"), "console.log('hi')");

        // Create .git directory with a file inside
        Path gitDir = tempDir.resolve(".git");
        Files.createDirectories(gitDir);
        Files.writeString(gitDir.resolve("HEAD"), "ref: refs/heads/main");
        Files.createDirectories(gitDir.resolve("objects"));
        Files.writeString(gitDir.resolve("objects").resolve("pack"), "binary");

        List<FileRecord> records = createIndexer().index(tempDir);

        // Only code.js should be indexed, not .git contents
        assertEquals(1, records.size(), "Should skip .git directory");
        assertEquals("code.js", records.get(0).getRelativePath());
    }

    @Test
    void skipsNodeModulesDirectory() throws IOException {
        Files.writeString(tempDir.resolve("index.js"), "module.exports = {}");

        Path nodeModules = tempDir.resolve("node_modules");
        Files.createDirectories(nodeModules);
        Files.writeString(nodeModules.resolve("lodash.js"), "lodash");

        List<FileRecord> records = createIndexer().index(tempDir);

        assertEquals(1, records.size(), "Should skip node_modules");
    }

    @Test
    void skipsTargetDirectory() throws IOException {
        Files.writeString(tempDir.resolve("pom.xml"), "<project/>");

        Path target = tempDir.resolve("target");
        Files.createDirectories(target);
        Files.writeString(target.resolve("app.jar"), "binary");

        List<FileRecord> records = createIndexer().index(tempDir);

        assertEquals(1, records.size(), "Should skip target directory");
    }

    @Test
    void fileRecordHasExpectedFields() throws IOException {
        Path file = tempDir.resolve("example.json");
        Files.writeString(file, "{\"key\":\"value\"}");

        List<FileRecord> records = createIndexer().index(tempDir);
        assertEquals(1, records.size());

        FileRecord r = records.get(0);
        assertEquals("example.json", r.getRelativePath());
        assertEquals("json", r.getExtension());
        assertNotNull(r.getId(), "id should not be null");
        assertEquals(8, r.getId().length(), "id should be 8 hex chars");
        assertTrue(r.getSize() > 0, "size should be positive");
        assertNotNull(r.getModifiedTime(), "modifiedTime should not be null");
        assertNotNull(r.getAbsolutePath(), "absolutePath should not be null");
    }

    @Test
    void fileIdIsFirst8HexCharsOfRelativePathHash() throws IOException {
        Files.writeString(tempDir.resolve("test.txt"), "content");

        List<FileRecord> records = createIndexer().index(tempDir);
        assertEquals(1, records.size());

        FileRecord r = records.get(0);
        // Verify the id is exactly 8 chars and all hex
        assertEquals(8, r.getId().length());
        assertTrue(r.getId().matches("[0-9a-f]{8}"), "id should be 8 lowercase hex chars");
    }
}
