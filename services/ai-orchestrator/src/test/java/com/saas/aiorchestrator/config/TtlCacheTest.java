package com.saas.aiorchestrator.config;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

class TtlCacheTest {

    @Test
    void returnsCachedValueWithinTtl() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofSeconds(30), clock);
        AtomicInteger loads = new AtomicInteger();
        Function<String, String> loader = key -> {
            loads.incrementAndGet();
            return "value-" + key;
        };

        String first = cache.get("a", loader);
        clock.advance(Duration.ofSeconds(10));
        String second = cache.get("a", loader);

        assertThat(first).isEqualTo("value-a");
        assertThat(second).isEqualTo("value-a");
        assertThat(loads.get()).isEqualTo(1);
    }

    @Test
    void reloadsAfterTtlExpires() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        TtlCache<String, Integer> cache = new TtlCache<>(Duration.ofSeconds(30), clock);
        AtomicInteger counter = new AtomicInteger();
        Function<String, Integer> loader = key -> counter.incrementAndGet();

        cache.get("a", loader);
        clock.advance(Duration.ofSeconds(31));
        cache.get("a", loader);

        assertThat(counter.get()).isEqualTo(2);
    }

    @Test
    void cachesDifferentKeysIndependently() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofSeconds(30), clock);

        assertThat(cache.get("a", key -> "value-" + key)).isEqualTo("value-a");
        assertThat(cache.get("b", key -> "value-" + key)).isEqualTo("value-b");
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
