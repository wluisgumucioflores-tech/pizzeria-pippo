# Self-contained build context (no monorepo workspace deps), e.g.:
#   docker build -t pippo-ai-orchestrator services/ai-orchestrator

# ---- Stage 1: build ----
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app

# Wrapper + build files first so the dependency-resolution layer only
# re-runs when they change, not on every source edit.
COPY gradlew ./
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
RUN ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# ---- Stage 2: runtime ----
FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8090
# OLLAMA_BASE_URL, BACKEND_URL, PIPPO_INTERNAL_TOKEN, ANTHROPIC_API_KEY, etc.
# are injected at `docker run` time (see application.yml), never baked in.
ENTRYPOINT ["java", "-jar", "app.jar"]
