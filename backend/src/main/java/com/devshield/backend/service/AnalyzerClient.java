package com.devshield.backend.service;

import com.devshield.backend.model.FileRecord;
import com.devshield.backend.model.Finding;
import com.devshield.backend.model.Signal;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * HTTP client that calls the analyzer microservice at http://localhost:8001/analyze.
 * On connection failure, returns an empty list (caller treats it as UNKNOWN/unreachable).
 */
@Component
public class AnalyzerClient {

    private final String analyzerUrl;
    private final RestTemplate restTemplate;
    private final ObjectMapper mapper;

    public AnalyzerClient(
            @Value("${devshield.analyzer.url:http://localhost:8001/analyze}") String analyzerUrl) {
        this.analyzerUrl = analyzerUrl;
        this.restTemplate = new RestTemplate();
        this.mapper = new ObjectMapper();
    }

    /**
     * Sends file records to the analyzer and returns findings.
     * Returns empty list if analyzer is unreachable.
     */
    public List<Finding> analyze(String workspacePath, List<FileRecord> files) {
        if (files.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("workspacePath", workspacePath);

        List<Map<String, Object>> fileList = new ArrayList<>();
        for (FileRecord fr : files) {
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("id", fr.getId());
            f.put("relativePath", fr.getRelativePath());
            f.put("extension", fr.getExtension());
            f.put("size", fr.getSize());
            f.put("sha256", fr.getSha256());
            f.put("modifiedTime", fr.getModifiedTime());
            f.put("changeType", fr.getChangeType());
            fileList.add(f);
        }
        request.put("files", fileList);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(analyzerUrl, request, Map.class);
            if (response == null) {
                return Collections.emptyList();
            }

            List<Finding> findings = new ArrayList<>();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rawFindings =
                    (List<Map<String, Object>>) response.getOrDefault("findings", Collections.emptyList());

            for (Map<String, Object> raw : rawFindings) {
                Finding f = new Finding();
                f.setFileId((String) raw.get("fileId"));
                f.setScore(raw.get("score") instanceof Number ? ((Number) raw.get("score")).intValue() : 0);
                f.setRiskLevel((String) raw.get("riskLevel"));
                f.setRecommendation((String) raw.get("recommendation"));
                f.setExplanation((String) raw.get("explanation"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> rawSignals =
                        (List<Map<String, Object>>) raw.getOrDefault("signals", Collections.emptyList());
                List<Signal> signals = new ArrayList<>();
                for (Map<String, Object> s : rawSignals) {
                    Signal sig = new Signal(
                            (String) s.get("id"),
                            s.get("weight") instanceof Number ? ((Number) s.get("weight")).intValue() : 0,
                            (String) s.get("detail")
                    );
                    signals.add(sig);
                }
                f.setSignals(signals);
                findings.add(f);
            }
            return findings;

        } catch (ResourceAccessException e) {
            // Analyzer is unreachable (ConnectException, timeout, etc.)
            return Collections.emptyList();
        } catch (Exception e) {
            // Any other IO/parse error — treat as unreachable
            return Collections.emptyList();
        }
    }
}
