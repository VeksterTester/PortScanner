package me.vekster.portscanner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ScanRequest(
        @NotBlank String key,
        @NotBlank String ip,
        @NotBlank @Pattern(regexp = "^[\\d,\\s]+$") String ports,
        boolean acceptedDisclaimer
) {

}
