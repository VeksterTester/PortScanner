package me.vekster.portscanner.service;

import me.vekster.portscanner.dto.ScanResponse;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.*;

@Service
public class PortScanService {

    private final ExecutorService executor;
    private final int timeoutMs;

    public PortScanService(@Value("${scanner.max-threads}") int maxThreads,
                           @Value("${scanner.timeout-ms}") int timeoutMs) {
        this.timeoutMs = timeoutMs;
        this.executor = Executors.newFixedThreadPool(maxThreads, r -> {
            Thread t = new Thread(r, "port-scanner-worker");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) executor.shutdownNow();
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    public List<ScanResponse.PortResult> scan(String targetIp, String portsCsv) {
        List<Integer> ports = parsePorts(portsCsv);
        List<Callable<ScanResponse.PortResult>> tasks = ports.stream()
                .map(port -> (Callable<ScanResponse.PortResult>) () -> checkPort(targetIp, port))
                .toList();

        try {
            List<Future<ScanResponse.PortResult>> futures = executor.invokeAll(tasks, timeoutMs * 2L, TimeUnit.MILLISECONDS);
            List<ScanResponse.PortResult> results = new ArrayList<>();

            for (int i = 0; i < futures.size(); i++) {
                try {
                    results.add(futures.get(i).get());
                } catch (CancellationException e) {
                    results.add(new ScanResponse.PortResult(ports.get(i), "FILTERED"));
                } catch (ExecutionException e) {
                    results.add(new ScanResponse.PortResult(ports.get(i), "CLOSED"));
                }
            }
            return results;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Port scan interrupted", e);
        }
    }

    private ScanResponse.PortResult checkPort(String ip, int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(ip, port), timeoutMs);
            return new ScanResponse.PortResult(port, "ОТКРЫТ");
        } catch (IOException e) {
            return new ScanResponse.PortResult(port, "ЗАКРЫТ");
        }
    }

    private List<Integer> parsePorts(String csv) {
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Integer::parseInt)
                .peek(p -> {
                    if (p < 1 || p > 65535) throw new IllegalArgumentException("Port out of valid range: " + p);
                })
                .distinct()
                .limit(100)
                .toList();
    }

}
