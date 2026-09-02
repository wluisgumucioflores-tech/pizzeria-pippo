plugins {
    java
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.saas"
version = "0.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencyManagement {
    imports {
        mavenBom("org.springframework.ai:spring-ai-bom:1.0.0")
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    // Robust HTTP client for S2S calls to NestJS. Avoids the JDK HttpClient
    // bug (EOF from keep-alive connection reuse / h2c upgrade against
    // Node/Express servers). Spring detects it and uses it by default.
    implementation("org.apache.httpcomponents.client5:httpclient5")
    // Local Ollama inference (Spring AI). The concrete model is resolved
    // at runtime from NestJS (ai_models catalog), never hardcoded here.
    implementation("org.springframework.ai:spring-ai-starter-model-ollama")
    // Phase 8: cloud providers. Anthropic for Claude; the OpenAI starter
    // also covers "openai_compatible" (Qwen cloud, DeepSeek, etc. via
    // its own baseURL) — same client, different endpoint.
    implementation("org.springframework.ai:spring-ai-starter-model-anthropic")
    implementation("org.springframework.ai:spring-ai-starter-model-openai")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
