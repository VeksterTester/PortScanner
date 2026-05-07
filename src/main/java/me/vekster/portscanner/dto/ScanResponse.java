package me.vekster.portscanner.dto;

import java.util.List;

public record ScanResponse(String ip, List<PortResult> results, long durationMs) {

    public record PortResult(int port, String state) {

    }

}
