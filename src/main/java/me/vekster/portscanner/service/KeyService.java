package me.vekster.portscanner.service;

import me.vekster.portscanner.model.KeyEntry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Service
public class KeyService {

    private final Path keyFilePath = Paths.get("keys.json");
    private final ObjectMapper mapper = new ObjectMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    public int getRemainingUses(String key) {
        lock.readLock().lock();
        try {
            List<KeyEntry> entries = loadKeys();
            return entries.stream()
                    .filter(e -> e.getKey().equals(key))
                    .mapToInt(KeyEntry::getUsesLeft)
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Invalid or unknown access key"));
        } catch (IOException e) {
            throw new RuntimeException("Failed to read key storage", e);
        } finally {
            lock.readLock().unlock();
        }
    }

    public int consumeUse(String key) {
        lock.writeLock().lock();
        try {
            List<KeyEntry> entries = loadKeys();
            for (KeyEntry entry : entries) {
                if (entry.getKey().equals(key)) {
                    if (entry.getUsesLeft() <= 0) {
                        throw new IllegalStateException("This access key has no remaining uses");
                    }
                    entry.setUsesLeft(entry.getUsesLeft() - 1);
                    saveKeys(entries);
                    return entry.getUsesLeft();
                }
            }
            throw new IllegalArgumentException("Invalid or unknown access key");
        } catch (IOException e) {
            throw new RuntimeException("Failed to update key storage", e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private List<KeyEntry> loadKeys() throws IOException {
        if (!Files.exists(keyFilePath)) {
            Files.writeString(keyFilePath, "[]");
        }
        return mapper.readValue(keyFilePath.toFile(), new TypeReference<>() {
        });
    }

    private void saveKeys(List<KeyEntry> entries) throws IOException {
        mapper.writeValue(keyFilePath.toFile(), entries);
    }

}
