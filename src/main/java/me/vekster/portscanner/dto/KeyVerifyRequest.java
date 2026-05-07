package me.vekster.portscanner.dto;

import jakarta.validation.constraints.NotBlank;

public record KeyVerifyRequest(@NotBlank String key) {

}
