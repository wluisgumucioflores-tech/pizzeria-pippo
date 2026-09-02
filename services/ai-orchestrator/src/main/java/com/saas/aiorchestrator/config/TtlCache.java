package com.saas.aiorchestrator.config;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

// Minimal in-process TTL cache (lazy expiry on read, no background eviction) — not
// general-purpose, just enough for RuntimeConfigClient/SystemPromptClient's small key space.
public class TtlCache<K, V> {

    private final Duration ttl;
    private final Clock clock;
    private final Map<K, Entry<V>> entries = new ConcurrentHashMap<>();

    public TtlCache(Duration ttl) {
        this(ttl, Clock.systemUTC());
    }

    TtlCache(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    public V get(K key, Function<K, V> loader) {
        Entry<V> cached = entries.get(key);
        if (cached != null && cached.isFresh(clock)) {
            return cached.value();
        }
        V value = loader.apply(key);
        entries.put(key, new Entry<>(value, clock.instant().plus(ttl)));
        return value;
    }

    private record Entry<V>(V value, Instant expiresAt) {
        boolean isFresh(Clock clock) {
            return clock.instant().isBefore(expiresAt);
        }
    }
}
