package me.vekster.portscanner.controller;

import me.vekster.portscanner.dto.KeyVerifyRequest;
import me.vekster.portscanner.dto.KeyVerifyResponse;
import me.vekster.portscanner.dto.ScanRequest;
import me.vekster.portscanner.dto.ScanResponse;
import me.vekster.portscanner.service.KeyService;
import me.vekster.portscanner.service.PortScanService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ScanController {

    private final KeyService keyService;
    private final PortScanService portScanService;

    public ScanController(KeyService keyService, PortScanService portScanService) {
        this.keyService = keyService;
        this.portScanService = portScanService;
    }

    @PostMapping("/keys/verify")
    public ResponseEntity<KeyVerifyResponse> verifyKey(@Valid @RequestBody KeyVerifyRequest req) {
        int usesLeft = keyService.getRemainingUses(req.key());
        return ResponseEntity.ok(new KeyVerifyResponse(true, usesLeft));
    }

    @PostMapping("/scans/execute")
    public ResponseEntity<?> executeScan(@Valid @RequestBody ScanRequest req) {
        if (!req.acceptedDisclaimer()) {
            return ResponseEntity.badRequest().body(Map.of("error", "You must confirm authorization before scanning."));
        }
        try {
            InetAddress.getByName(req.ip());
        } catch (UnknownHostException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid IP address format"));
        }

        int remainingUses = keyService.consumeUse(req.key());
        long start = System.currentTimeMillis();
        var results = portScanService.scan(req.ip(), req.ports());
        long duration = System.currentTimeMillis() - start;

        return ResponseEntity.ok(new ScanResponse(req.ip(), results, duration));
    }

}
