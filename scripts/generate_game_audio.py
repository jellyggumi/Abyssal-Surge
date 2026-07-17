#!/usr/bin/env python3
"""Generate original Abyssal Surge audio through explicitly selected remote APIs.

The script is offline-safe by default: only `--generate` on a generation command
may read credentials or send a network request.
"""

from __future__ import annotations

import argparse
import base64
import datetime as datetime_module
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Final, Mapping

ELEVENLABS_SOUND_EFFECT_URL = "https://api.elevenlabs.io/v1/sound-generation"
GEMINI_TTS_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/gemini-2.5-flash-preview-tts:generateContent"
)
MIN_AUDIO_BYTES = 128
MAX_SOURCE_BYTES = 8 * 1024 * 1024
PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class AudioProfile:
    """Limits for a reviewed runtime cue role."""

    min_duration_ms: int
    max_duration_ms: int
    max_output_bytes: int
    channels: int
    bitrate_kbps: int


AUDIO_PROFILES: Final[Mapping[str, AudioProfile]] = {
    "sfx": AudioProfile(500, 3_000, 100 * 1024, 1, 128),
    "narration": AudioProfile(1_000, 12_000, 250 * 1024, 1, 96),
    "ambience": AudioProfile(5_000, 60_000, 1024 * 1024, 2, 128),
    "music": AudioProfile(10_000, 60_000, 1024 * 1024, 2, 128),
}


@dataclass(frozen=True)
class AudioDetails:
    """Locally probed audio container and stream facts."""

    media_type: str
    codec: str
    sample_rate_hz: int
    channels: int
    duration_ms: int

# These are original setting prompts, not third-party character or soundtrack prompts.
SFX_PROMPTS = {
    "extract": (
        "Original Abyssal Surge game sound effect: an iron seal fractures in a silent "
        "black archive, followed by one restrained abyssal bass impact. No music, no voices."
    ),
    "domain": (
        "Original Abyssal Surge game sound effect: a distant obsidian gate opens under "
        "cold violet wind, with sparse stone grit and a low supernatural resonance. "
        "No music, no voices."
    ),
    "ambient": (
        "Original Abyssal Surge game ambience: wind crosses the Cinder Span, a fractured "
        "obsidian bridge above a red abyss; occasional ember crackle and far-off stone groan. "
        "No melody, no voices."
    ),
    "bgm": (
        "Original Abyssal Surge game main theme: a grand, dark orchestral loop for the "
        "Abyssal Surge lobby. Slow rising low string drone and distant war drums, "
        "building into a restrained wordless choir swell over deep brass, with a cold "
        "metallic shimmer suggesting a dimensional gate. Ominous, epic, mysterious, "
        "cinematic dark fantasy tone. No lyrics, no spoken words, seamless loop-friendly."
    ),
}

@dataclass(frozen=True)
class NarrationPrompt:
    """Locked Korean narration text for one runtime narration identifier."""

    text: str


NARRATION_CATALOG: Final[Mapping[str, NarrationPrompt]] = {
    "intro": NarrationPrompt("심연의 문이 열렸다. 그림자 군주여, 일어나라."),
    "cinder-span": NarrationPrompt("잿빛 교량, 신더 스팬. 재의 메아리를 사냥하고 영혼을 거두어라."),
    "veil-citadel": NarrationPrompt("장막 성채, 베일 시타델. 빙의의 힘이 깨어난다. 두 거점을 동시에 장악하라."),
    "echo-throne": NarrationPrompt("메아리 왕좌. 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."),
    "victory": NarrationPrompt("침묵한 문 앞에서, 그림자 군단이 왕좌에 오른다."),
    "defeat": NarrationPrompt("군단의 닻이 끊어졌다. 다시, 일어나라."),
}


class MediaGenerationError(RuntimeError):
    """A request or media payload could not safely produce an output asset."""


def parse_env_file(path: Path) -> dict[str, str]:
    """Read a deliberately selected dotenv file without executing its contents."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise MediaGenerationError(f"Could not read env file: {error.strerror or error}") from error

    values: dict[str, str] = {}
    assignment = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$")
    for line_number, raw_line in enumerate(lines, start=1):
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = assignment.match(raw_line)
        if not match:
            raise MediaGenerationError(f"Invalid env assignment at line {line_number}")
        key, value = match.groups()
        if (value.startswith("\"") and value.endswith("\"")) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        values[key] = value
    return values


def selected_environment(env_file: Path | None) -> Mapping[str, str]:
    """Use either the selected file or the process environment, never an implicit file."""
    return parse_env_file(env_file) if env_file else os.environ


def require_key(environment: Mapping[str, str], name: str) -> str:
    key = environment.get(name, "").strip()
    if not key:
        raise MediaGenerationError(f"Missing required credential in selected environment: {name}")
    return key


def atomic_write(destination: Path, payload: bytes, validator: callable) -> None:
    """Validate generated bytes in a sibling temporary file before promotion."""
    if len(payload) < MIN_AUDIO_BYTES:
        raise MediaGenerationError(
            f"Refusing to write undersized audio payload ({len(payload)} bytes; minimum {MIN_AUDIO_BYTES})"
        )
    if len(payload) > MAX_SOURCE_BYTES:
        raise MediaGenerationError(
            f"Refusing to write oversized audio payload ({len(payload)} bytes; maximum {MAX_SOURCE_BYTES})"
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent, delete=False
        ) as temporary:
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        if temporary_path.stat().st_size != len(payload):
            raise MediaGenerationError("Atomic audio write failed byte-count verification")
        validator(temporary_path)
        os.replace(temporary_path, destination)
        temporary_path = None
    except OSError as error:
        raise MediaGenerationError(f"Could not write output file: {error.strerror or error}") from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def sha256_file(path: Path) -> str:
    """Hash a file without loading a provider asset into memory."""
    digest = hashlib.sha256()
    try:
        with path.open("rb") as source:
            while chunk := source.read(64 * 1024):
                digest.update(chunk)
    except OSError as error:
        raise MediaGenerationError(f"Could not hash audio file: {error.strerror or error}") from error
    return digest.hexdigest()


def inspect_audio(path: Path) -> AudioDetails:
    """Read local container facts through ffprobe; this never contacts a provider."""
    if not shutil.which("ffprobe"):
        raise MediaGenerationError("ffprobe is required for local audio validation but was not found on PATH")
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name,sample_rate,channels",
        "-of",
        "json",
        str(path),
    ]
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=15)
    except OSError as error:
        raise MediaGenerationError(f"Could not execute ffprobe: {error.strerror or error}") from error
    except subprocess.TimeoutExpired as error:
        raise MediaGenerationError("ffprobe timed out while reading audio input") from error
    if result.returncode:
        detail = " ".join(result.stderr.split())[:240]
        raise MediaGenerationError(f"ffprobe rejected audio input: {detail or 'unknown probe failure'}")
    try:
        payload = json.loads(result.stdout)
        stream = payload["streams"][0]
        duration_seconds = float(payload["format"]["duration"])
        format_names = set(payload["format"]["format_name"].split(","))
        codec = stream["codec_name"]
        sample_rate_hz = int(stream["sample_rate"])
        channels = int(stream["channels"])
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise MediaGenerationError("ffprobe returned incomplete audio metadata") from error
    if not math.isfinite(duration_seconds) or duration_seconds <= 0 or sample_rate_hz <= 0 or channels <= 0:
        raise MediaGenerationError("ffprobe returned invalid audio duration or stream metadata")
    if "mp3" in format_names and codec == "mp3":
        media_type = "audio/mpeg"
    elif "wav" in format_names and codec.startswith("pcm_"):
        media_type = "audio/wav"
    else:
        raise MediaGenerationError(
            "Audio must be an MP3/MPEG stream or a WAV containing PCM or IEEE-float audio"
        )
    return AudioDetails(
        media_type=media_type,
        codec=codec,
        sample_rate_hz=sample_rate_hz,
        channels=channels,
        duration_ms=round(duration_seconds * 1000),
    )

def validate_generated_mp3(path: Path) -> None:
    """Reject a provider response unless the staged bytes decode as MP3 audio."""
    details = inspect_audio(path)
    if details.media_type != "audio/mpeg" or details.codec != "mp3":
        raise MediaGenerationError("Generated output must decode as MP3 audio")


def validate_generated_wav(path: Path) -> None:
    """Reject a provider response unless the staged bytes decode as PCM WAV audio."""
    details = inspect_audio(path)
    if details.media_type != "audio/wav" or not details.codec.startswith("pcm_"):
        raise MediaGenerationError("Generated output must decode as PCM WAV audio")


def profile_for(role: str) -> AudioProfile:
    return AUDIO_PROFILES[role]


def validate_audio_file(path: Path, role: str) -> tuple[AudioDetails, int]:
    """Validate source identity, container, duration, and conservative input size."""
    if path.suffix.lower() not in {".mp3", ".wav"}:
        raise MediaGenerationError("Audio input extension must be .mp3 or .wav")
    try:
        if not path.is_file():
            raise MediaGenerationError("Audio input must be a regular file")
        size = path.stat().st_size
    except OSError as error:
        raise MediaGenerationError(f"Could not inspect input file: {error.strerror or error}") from error
    if size < MIN_AUDIO_BYTES:
        raise MediaGenerationError(f"Audio input is undersized ({size} bytes)")
    if size > MAX_SOURCE_BYTES:
        raise MediaGenerationError(
            f"Audio input exceeds the safe staging limit ({size} bytes; maximum {MAX_SOURCE_BYTES})"
        )
    details = inspect_audio(path)
    expected_type = "audio/mpeg" if path.suffix.lower() == ".mp3" else "audio/wav"
    if details.media_type != expected_type:
        raise MediaGenerationError(
            f"Audio extension/type mismatch: {path.suffix.lower()} does not contain {details.media_type}"
        )
    profile = profile_for(role)
    if not profile.min_duration_ms <= details.duration_ms <= profile.max_duration_ms:
        raise MediaGenerationError(
            f"{role} duration must be {profile.min_duration_ms}–{profile.max_duration_ms} ms; "
            f"observed {details.duration_ms} ms"
        )
    if details.media_type == "audio/mpeg" and size > profile.max_output_bytes:
        raise MediaGenerationError(
            f"{role} MP3 exceeds its delivery byte limit ({size} bytes; maximum {profile.max_output_bytes})"
        )
    return details, size


def ensure_runtime_destination(raw_destination: str) -> Path:
    """Constrain imports to the checked-out web project's audio directory."""
    destination = Path(raw_destination)
    if destination.is_absolute() or destination.suffix.lower() != ".mp3":
        raise MediaGenerationError("Import destination must be a relative assets/audio/*.mp3 path")
    if destination.parts[:2] != ("assets", "audio") or len(destination.parts) != 3:
        raise MediaGenerationError("Import destination must name one file directly under assets/audio/")
    resolved = (PROJECT_ROOT / destination).resolve()
    audio_root = (PROJECT_ROOT / "assets" / "audio").resolve()
    if resolved.parent != audio_root:
        raise MediaGenerationError("Import destination escapes the assets/audio directory")
    return resolved


def copy_file_atomically(
    source: Path, destination: Path, profile: AudioProfile
) -> tuple[AudioDetails, int, str]:
    """Validate copied MP3 bytes in a temporary file before replacing the destination."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with source.open("rb") as input_handle, tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{destination.name}.", suffix=".mp3", dir=destination.parent, delete=False
        ) as output_handle:
            temporary_path = Path(output_handle.name)
            while chunk := input_handle.read(64 * 1024):
                output_handle.write(chunk)
            output_handle.flush()
            os.fsync(output_handle.fileno())
        details, size = validate_runtime_output(temporary_path, profile)
        digest = sha256_file(temporary_path)
        os.replace(temporary_path, destination)
        return details, size, digest
    except OSError as error:
        raise MediaGenerationError(f"Could not import audio file: {error.strerror or error}") from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def transcode_wav_atomically(
    source: Path, destination: Path, profile: AudioProfile
) -> tuple[AudioDetails, int, str]:
    """Transcode a validated WAV locally into the runtime MP3 profile."""
    if not shutil.which("ffmpeg"):
        raise MediaGenerationError(
            "ffmpeg is required to import WAV as runtime MP3 but was not found on PATH; "
            "provide a delivery-compatible MP3 instead"
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{destination.name}.", suffix=".mp3", dir=destination.parent, delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
        command = [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-vn",
            "-map",
            "0:a:0",
            "-ac",
            str(profile.channels),
            "-ar",
            "44100",
            "-c:a",
            "libmp3lame",
            "-b:a",
            f"{profile.bitrate_kbps}k",
            str(temporary_path),
        ]
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=60)
        if result.returncode:
            detail = " ".join(result.stderr.split())[:240]
            raise MediaGenerationError(f"ffmpeg could not transcode WAV input: {detail or 'unknown conversion failure'}")
        details, size = validate_runtime_output(temporary_path, profile)
        digest = sha256_file(temporary_path)
        os.replace(temporary_path, destination)
        return details, size, digest
    except OSError as error:
        raise MediaGenerationError(f"Could not execute local WAV conversion: {error.strerror or error}") from error
    except subprocess.TimeoutExpired as error:
        raise MediaGenerationError("ffmpeg timed out while converting WAV input") from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def validate_runtime_output(path: Path, profile: AudioProfile) -> tuple[AudioDetails, int]:
    """Verify the exact bytes that would be added to the static project."""
    details = inspect_audio(path)
    try:
        size = path.stat().st_size
    except OSError as error:
        raise MediaGenerationError(f"Could not inspect imported output: {error.strerror or error}") from error
    if details.media_type != "audio/mpeg" or details.codec != "mp3":
        raise MediaGenerationError("Runtime output must be MP3 audio")
    if details.sample_rate_hz != 44_100 or details.channels != profile.channels:
        raise MediaGenerationError(
            f"Runtime output must be 44100 Hz/{profile.channels} channel MP3; "
            f"observed {details.sample_rate_hz} Hz/{details.channels} channels"
        )
    if not profile.min_duration_ms <= details.duration_ms <= profile.max_duration_ms:
        raise MediaGenerationError("Runtime output duration changed outside its approved role limit")
    if size > profile.max_output_bytes:
        raise MediaGenerationError(
            f"Runtime output exceeds byte limit ({size} bytes; maximum {profile.max_output_bytes})"
        )
    return details, size




def required_text(value: str | None, field: str, maximum_bytes: int) -> str:
    text = (value or "").strip()
    if not text:
        raise MediaGenerationError(f"--{field.replace('_', '-')} is required for import")
    if "\x00" in text or len(text.encode("utf-8")) > maximum_bytes:
        raise MediaGenerationError(f"--{field.replace('_', '-')} is invalid or too long")
    return text


def opaque_source_reference(value: str | None) -> str:
    """Keep private download URLs and their credential-bearing query strings out of records."""
    reference = required_text(value, "source_reference", 500)
    if re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", reference) or "?" in reference or "#" in reference:
        raise MediaGenerationError(
            "--source-reference must be an opaque non-secret identifier, not a URL, query, or fragment"
        )
    return reference


def import_provenance(args: argparse.Namespace) -> dict[str, str]:
    """Capture supplied source provenance without querying or storing any credential."""
    provenance = {
        "request_id": required_text(args.request_id, "request_id", 128),
        "prompt": required_text(args.prompt, "prompt", 1500),
        "provider": required_text(args.provider, "provider", 200),
        "provider_model": required_text(args.provider_model, "provider_model", 200),
        "source_reference": opaque_source_reference(args.source_reference),
    }
    for field in ("provider_model_version", "provider_job_reference", "provider_generated_at", "imported_by"):
        value = getattr(args, field)
        if value is not None:
            provenance[field] = required_text(value, field, 500)
    return provenance


class RejectRedirects(urllib.request.HTTPRedirectHandler):
    """Treat redirect responses as errors so credential headers never leave the API host."""

    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def summarize_http_error(error: urllib.error.HTTPError, sensitive_values: tuple[str, ...]) -> str:
    try:
        response = json.loads(error.read().decode("utf-8", errors="replace"))
        detail = response.get("error", response)
        message = detail.get("message", "") if isinstance(detail, dict) else ""
    except (OSError, UnicodeError, json.JSONDecodeError):
        message = ""
    message = " ".join(message.split())[:240]
    for value in sensitive_values:
        message = message.replace(value, "[redacted]")
    return message or str(error.reason)


def request_bytes(
    url: str,
    headers: Mapping[str, str],
    body: dict[str, object],
    timeout: float,
    maximum_bytes: int = MAX_SOURCE_BYTES,
) -> bytes:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        opener = urllib.request.build_opener(RejectRedirects())
        with opener.open(request, timeout=timeout) as response:
            if response.status < 200 or response.status >= 300:
                raise MediaGenerationError(f"HTTP {response.status} from remote media API")
            content_length = response.headers.get("Content-Length")
            if content_length is not None and int(content_length) > maximum_bytes:
                raise MediaGenerationError(
                    f"Remote media response exceeds the safe staging limit ({content_length} bytes; maximum {maximum_bytes})"
                )
            payload = bytearray()
            while chunk := response.read(min(64 * 1024, maximum_bytes - len(payload) + 1)):
                payload.extend(chunk)
                if len(payload) > maximum_bytes:
                    raise MediaGenerationError(
                        f"Remote media response exceeds the safe staging limit (maximum {maximum_bytes} bytes)"
                    )
            return bytes(payload)
    except urllib.error.HTTPError as error:
        summary = summarize_http_error(error, tuple(headers.values()))
        raise MediaGenerationError(f"HTTP {error.code} from remote media API: {summary}") from error
    except urllib.error.URLError as error:
        raise MediaGenerationError(f"Could not reach remote media API: {error.reason}") from error
    except TimeoutError as error:
        raise MediaGenerationError("Remote media API request timed out") from error
    except ValueError as error:
        raise MediaGenerationError("Remote media API returned an invalid Content-Length") from error

def generate_elevenlabs(args: argparse.Namespace) -> None:
    output = Path(args.output)
    if output.suffix.lower() != ".mp3":
        raise MediaGenerationError("ElevenLabs sound-effect output must use an explicit .mp3 filename")
    prompt = SFX_PROMPTS[args.prompt_id]
    if args.dry_run:
        print(json.dumps({"mode": "dry-run", "provider": "elevenlabs", "prompt_id": args.prompt_id, "output": str(output)}))
        return
    key = require_key(selected_environment(args.env_file), "ELEVENLABS_API_KEY")
    payload = request_bytes(
        ELEVENLABS_SOUND_EFFECT_URL,
        {"xi-api-key": key, "Accept": "audio/mpeg"},
        {"text": prompt, "duration_seconds": args.duration, "prompt_influence": args.prompt_influence},
        args.timeout,
    )
    if not payload.startswith((b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")):
        raise MediaGenerationError("ElevenLabs response was not recognizable MP3 audio")
    atomic_write(output, payload, validate_generated_mp3)
    print(json.dumps({"provider": "elevenlabs", "prompt_id": args.prompt_id, "output": str(output), "bytes": len(payload)}))


def extract_gemini_pcm(response_bytes: bytes) -> tuple[bytes, int]:
    try:
        response = json.loads(response_bytes)
        parts = response["candidates"][0]["content"]["parts"]
        inline_data = next(part["inlineData"] for part in parts if "inlineData" in part)
        mime_type = inline_data.get("mimeType", "")
        sample_rate_match = re.fullmatch(r"audio/L16;\s*rate=(\d+)", mime_type, flags=re.IGNORECASE)
        if not sample_rate_match:
            raise MediaGenerationError(f"Gemini returned unsupported audio MIME type: {mime_type or 'missing'}")
        pcm = base64.b64decode(inline_data["data"], validate=True)
        sample_rate = int(sample_rate_match.group(1))
    except (KeyError, IndexError, StopIteration, json.JSONDecodeError, ValueError) as error:
        raise MediaGenerationError("Gemini response did not contain valid PCM narration audio") from error
    if len(pcm) < MIN_AUDIO_BYTES or len(pcm) % 2 or sample_rate <= 0:
        raise MediaGenerationError("Gemini returned invalid PCM narration bytes")
    return pcm, sample_rate


def l16_network_to_wav_pcm(pcm: bytes) -> bytes:
    """Convert Gemini's network-order 16-bit linear PCM into WAV's little-endian PCM."""
    converted = bytearray(len(pcm))
    converted[0::2] = pcm[1::2]
    converted[1::2] = pcm[0::2]
    return bytes(converted)


def pcm_as_wav(pcm: bytes, sample_rate: int) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(l16_network_to_wav_pcm(pcm))
    return buffer.getvalue()


def generate_gemini(args: argparse.Namespace) -> None:
    output = Path(args.output)
    if output.suffix.lower() != ".wav":
        raise MediaGenerationError("Gemini narration output must use an explicit .wav filename")
    prompt = NARRATION_CATALOG[args.narration_id]
    plan = {
        "provider": "gemini",
        "narration_id": args.narration_id,
        "text": prompt.text,
        "planned_output": {"path": str(output), "format": "wav"},
    }
    if args.dry_run:
        print(json.dumps({"mode": "dry-run", **plan}, ensure_ascii=False))
        return
    key = require_key(selected_environment(args.env_file), "GEMINI_API_KEY")
    response = request_bytes(
        GEMINI_TTS_URL,
        {"x-goog-api-key": key},
        {
            "contents": [{"parts": [{"text": prompt.text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": args.voice}}},
            },
        },
        args.timeout,
    )
    pcm, sample_rate = extract_gemini_pcm(response)
    wav_bytes = pcm_as_wav(pcm, sample_rate)
    atomic_write(output, wav_bytes, validate_generated_wav)
    print(json.dumps({"mode": "generated", **plan, "bytes": len(wav_bytes)}, ensure_ascii=False))


def audio_facts(details: AudioDetails) -> dict[str, object]:
    return asdict(details)


def validate_audio(args: argparse.Namespace) -> None:
    """Validate local input only; this path has no provider or credential access."""
    path = Path(args.input)
    details, size = validate_audio_file(path, args.role)
    profile = profile_for(args.role)
    print(
        json.dumps(
            {
                "mode": "validate",
                "network": "not-used",
                "valid": True,
                "role": args.role,
                "input": {
                    "path": str(path),
                    "bytes": size,
                    "sha256": sha256_file(path),
                    **audio_facts(details),
                },
                "limits": asdict(profile),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


def import_audio(args: argparse.Namespace) -> None:
    """Import a traced local source without mutating manifest, app, or cache files."""
    source = Path(args.input)
    profile = profile_for(args.role)
    provenance = import_provenance(args)
    source_details, source_size = validate_audio_file(source, args.role)
    destination = ensure_runtime_destination(args.destination)
    if source.resolve() == destination:
        raise MediaGenerationError("Import source and destination must be different files")
    if destination.exists() and not args.replace:
        raise MediaGenerationError(
            f"Refusing to replace existing audio without --replace: {destination.relative_to(PROJECT_ROOT)}"
        )
    if source_details.media_type == "audio/mpeg":
        output_details, output_size, output_sha256 = copy_file_atomically(source, destination, profile)
        # The staged copy is the exact source that was atomically promoted.
        source_details, source_size, source_sha256 = output_details, output_size, output_sha256
    else:
        source_sha256 = sha256_file(source)
        output_details, output_size, output_sha256 = transcode_wav_atomically(source, destination, profile)
    output_path = destination.relative_to(PROJECT_ROOT).as_posix()
    provider_label = provenance["provider"] + " — " + provenance["provider_model"]
    if "provider_model_version" in provenance:
        provider_label += f" ({provenance['provider_model_version']})"
    job_reference = provenance.get("provider_job_reference", "not-supplied")
    imported_at = datetime_module.datetime.now(datetime_module.timezone.utc).isoformat()
    record: dict[str, object] = {
        "mode": "import",
        "network": "not-used",
        "imported_at": imported_at,
        "role": args.role,
        "provenance": provenance,
        "input": {
            "path": str(source),
            "bytes": source_size,
            "sha256": source_sha256,
            **audio_facts(source_details),
        },
        "output": {
            "path": output_path,
            "bytes": output_size,
            "sha256": output_sha256,
            **audio_facts(output_details),
        },
        "manifest_record": {
            "filename": output_path,
            "media_type": "audio/mpeg",
            "bytes": output_size,
            "generated_by": provider_label,
            "source_key_art": [],
            "source_assets": [],
            "derivation": (
                "Chatbot-generated audio imported manually from request "
                f"{provenance['request_id']}; validated locally. Provider job reference: {job_reference}."
            ),
            "sha256": output_sha256,
        },
    }
    print(json.dumps(record, ensure_ascii=False, sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate or explicitly import local Abyssal Surge audio. "
            "Import and validate never read credentials or send network requests."
        )
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    validate = subcommands.add_parser("validate", help="Validate a local MP3/WAV; no network access")
    validate.add_argument("--input", required=True, help="Existing local .mp3 or .wav audio file")
    validate.add_argument("--role", choices=sorted(AUDIO_PROFILES), required=True, help="Runtime cue role")
    validate.set_defaults(handler=validate_audio)

    imported = subcommands.add_parser(
        "import",
        help="Validate then atomically import a traced local source; prints a manifest record and changes no manifests",
    )
    imported.add_argument("--input", required=True, help="Existing local .mp3 or .wav audio file")
    imported.add_argument(
        "--destination", required=True, help="Relative runtime target, exactly assets/audio/<name>.mp3"
    )
    imported.add_argument("--role", choices=sorted(AUDIO_PROFILES), required=True, help="Runtime cue role")
    imported.add_argument("--request-id", required=True, help="Caller-supplied production request ID")
    imported.add_argument("--prompt", required=True, help="Original supplied sound-generation prompt")
    imported.add_argument("--provider", required=True, help="Actual external/user audio provider name")
    imported.add_argument("--provider-model", required=True, help="Actual external/user audio model name")
    imported.add_argument("--provider-model-version", help="Provider model version when supplied")
    imported.add_argument("--provider-job-reference", help="Provider job/reference ID when supplied")
    imported.add_argument("--provider-generated-at", help="Provider generation timestamp when supplied")
    imported.add_argument(
        "--source-reference", required=True, help="Operator source/download reference; no credential or signed URL"
    )
    imported.add_argument("--imported-by", help="Accountable importing operator")
    imported.add_argument("--replace", action="store_true", help="Explicitly replace an existing runtime file")
    imported.set_defaults(handler=import_audio)

    elevenlabs = subcommands.add_parser("elevenlabs-sfx", help="Opt-in remote generation of an original SFX as MP3")
    elevenlabs.add_argument("--output", required=True, help="Explicit destination .mp3 filename")
    elevenlabs.add_argument("--prompt-id", choices=sorted(SFX_PROMPTS), required=True, help="Original lore sound prompt")
    elevenlabs.add_argument("--duration", type=float, default=3.0, help="Sound-effect duration in seconds")
    elevenlabs.add_argument("--prompt-influence", type=float, default=0.5, help="ElevenLabs prompt influence (0 to 1)")
    elevenlabs.add_argument("--env-file", type=Path, help="Explicit dotenv file; otherwise use process environment")
    elevenlabs.add_argument("--timeout", type=float, default=60.0, help="HTTP request timeout in seconds")
    elevenlabs_mode = elevenlabs.add_mutually_exclusive_group(required=True)
    elevenlabs_mode.add_argument("--dry-run", action="store_true", help="Validate the plan without reading credentials or sending a request")
    elevenlabs_mode.add_argument("--generate", action="store_true", help="Read credentials and send a remote generation request")
    elevenlabs.set_defaults(handler=generate_elevenlabs)

    gemini = subcommands.add_parser("gemini-narration", help="Opt-in remote generation of one locked narration ID as WAV")
    gemini.add_argument("--output", required=True, help="Explicit destination .wav filename")
    gemini.add_argument("--narration-id", choices=sorted(NARRATION_CATALOG), required=True, help="Locked runtime narration identifier")
    gemini.add_argument("--voice", default="Kore", help="Gemini prebuilt voice name")
    gemini.add_argument("--env-file", type=Path, help="Explicit dotenv file; otherwise use process environment")
    gemini.add_argument("--timeout", type=float, default=60.0, help="HTTP request timeout in seconds")
    gemini_mode = gemini.add_mutually_exclusive_group(required=True)
    gemini_mode.add_argument("--dry-run", action="store_true", help="Print the locked plan without reading credentials or sending a request")
    gemini_mode.add_argument("--generate", action="store_true", help="Read credentials and send a remote generation request")
    gemini.set_defaults(handler=generate_gemini)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    arguments = sys.argv[1:] if argv is None else argv
    if not arguments:
        parser.print_help()
        print("\nNo provider call was made. Use `validate` for a local source or `import` to add one safely.")
        return 0
    args = parser.parse_args(arguments)
    if hasattr(args, "duration") and args.duration <= 0:
        parser.error("--duration must be positive")
    if hasattr(args, "timeout") and args.timeout <= 0:
        parser.error("--timeout must be positive")
    if not 0 <= getattr(args, "prompt_influence", 0.5) <= 1:
        parser.error("--prompt-influence must be between 0 and 1")
    if hasattr(args, "voice") and not args.voice.strip():
        parser.error("--voice must not be empty")
    try:
        args.handler(args)
    except MediaGenerationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
