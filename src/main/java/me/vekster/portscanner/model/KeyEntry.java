package me.vekster.portscanner.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class KeyEntry {

    @JsonProperty("key")
    private String key;
    @JsonProperty("usesLeft")
    private int usesLeft;

    public KeyEntry() {
    }

    public KeyEntry(String key, int usesLeft) {
        this.key = key;
        this.usesLeft = usesLeft;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public int getUsesLeft() {
        return usesLeft;
    }

    public void setUsesLeft(int usesLeft) {
        this.usesLeft = usesLeft;
    }

}
