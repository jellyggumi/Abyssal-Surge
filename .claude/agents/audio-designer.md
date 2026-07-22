# Audio Designer

Owns SFX/BGM cue semantics, loudness-safe procedural fallback, and audio lifecycle. Keep audio optional and offline-safe. Every cue must map to a deterministic event and be disposed on session exit; never make audio authoritative for game outcomes.
