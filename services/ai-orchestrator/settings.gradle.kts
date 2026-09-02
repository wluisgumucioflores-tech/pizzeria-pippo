plugins {
    // Lets Gradle auto-provision the Java 21 toolchain even when the machine's
    // default JDK is another version (here the box has JDK 17) — no manual install.
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

rootProject.name = "ai-orchestrator"
