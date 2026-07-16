#!/usr/bin/env python3
"""Generate original Shadow Lord audio through explicitly selected remote APIs.

The script is offline-safe: only the `elevenlabs-sfx` and `gemini-narration`
commands issue network requests, and each requires an explicit output path.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
import wave
from pathlib import Path
from typing import Mapping

ELEVENLABS_SOUND_EFFECT_URL = "https://api.elevenlabs.io/v1/sound-generation"
GEMINI_TTS_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/gemini-2.5-flash-preview-tts:generateContent"
)
MIN_AUDIO_BYTES = 128

# These are original setting prompts, not third-party character or soundtrack prompts.
SFX_PROMPTS = {
    "extract": (
        "Original Shadow Lord game sound effect: an iron seal fractures in a silent "
        "black archive, followed by one restrained abyssal bass impact. No music, no voices."
    ),
    "domain": (
        "Original Shadow Lord game sound effect: a distant obsidian gate opens under "
        "cold violet wind, with sparse stone grit and a low supernatural resonance. "
        "No music, no voices."
    ),
    "ambient": (
        "Original Shadow Lord game ambience: wind crosses the Cinder Span, a fractured "
        "obsidian bridge above a red abyss; occasional ember crackle and far-off stone groan. "
        "No melody, no voices."
    ),
}
NARRATION_PROMPT = (
    "Speak in a calm, grave fantasy narrator voice: \"The Cinder Span remembers every "
    "oath the abyss has claimed.\""
)


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


def atomic_write(destination: Path, payload: bytes) -> None:
    if len(payload) < MIN_AUDIO_BYTES:
        raise MediaGenerationError(
            f"Refusing to write undersized audio payload ({len(payload)} bytes; minimum {MIN_AUDIO_BYTES})"
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent, delete=False
        ) as temporary:
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        if temporary_path.stat().st_size != len(payload):
            temporary_path.unlink(missing_ok=True)
            raise MediaGenerationError("Atomic audio write failed byte-count verification")
        os.replace(temporary_path, destination)
    except OSError as error:
        raise MediaGenerationError(f"Could not write output file: {error.strerror or error}") from error


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


def request_bytes(url: str, headers: Mapping[str, str], body: dict[str, object], timeout: float) -> bytes:
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
            return response.read()
    except urllib.error.HTTPError as error:
        summary = summarize_http_error(error, tuple(headers.values()))
        raise MediaGenerationError(f"HTTP {error.code} from remote media API: {summary}") from error
    except urllib.error.URLError as error:
        raise MediaGenerationError(f"Could not reach remote media API: {error.reason}") from error
    except TimeoutError as error:
        raise MediaGenerationError("Remote media API request timed out") from error


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
    atomic_write(output, payload)
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
    if args.dry_run:
        print(json.dumps({"mode": "dry-run", "provider": "gemini", "prompt_id": "narration", "output": str(output)}))
        return
    key = require_key(selected_environment(args.env_file), "GEMINI_API_KEY")
    response = request_bytes(
        GEMINI_TTS_URL,
        {"x-goog-api-key": key},
        {
            "contents": [{"parts": [{"text": NARRATION_PROMPT}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": args.voice}}},
            },
        },
        args.timeout,
    )
    pcm, sample_rate = extract_gemini_pcm(response)
    wav_bytes = pcm_as_wav(pcm, sample_rate)
    atomic_write(output, wav_bytes)
    print(json.dumps({"provider": "gemini", "prompt_id": "narration", "output": str(output), "bytes": len(wav_bytes)}))


def validate_audio(args: argparse.Namespace) -> None:
    path = Path(args.input)
    try:
        size = path.stat().st_size
    except OSError as error:
        raise MediaGenerationError(f"Could not inspect input file: {error.strerror or error}") from error
    if size < MIN_AUDIO_BYTES:
        raise MediaGenerationError(f"Audio input is undersized ({size} bytes)")
    with path.open("rb") as handle:
        signature = handle.read(12)
    recognized = signature.startswith((b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"RIFF"))
    if not recognized:
        raise MediaGenerationError("Audio input is neither recognizable MP3 nor WAV data")
    print(json.dumps({"mode": "validate", "input": str(path), "bytes": size, "valid": True}))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate original Shadow Lord audio. Remote requests happen only in generation commands."
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    elevenlabs = subcommands.add_parser("elevenlabs-sfx", help="Generate an original lore sound effect as MP3")
    elevenlabs.add_argument("--output", required=True, help="Explicit destination .mp3 filename")
    elevenlabs.add_argument("--prompt-id", choices=sorted(SFX_PROMPTS), required=True, help="Original lore sound prompt")
    elevenlabs.add_argument("--duration", type=float, default=3.0, help="Sound-effect duration in seconds")
    elevenlabs.add_argument("--prompt-influence", type=float, default=0.5, help="ElevenLabs prompt influence (0 to 1)")
    elevenlabs.add_argument("--env-file", type=Path, help="Explicit dotenv file; otherwise use process environment")
    elevenlabs.add_argument("--timeout", type=float, default=60.0, help="HTTP request timeout in seconds")
    elevenlabs.add_argument("--dry-run", action="store_true", help="Validate the plan without reading credentials or sending a request")
    elevenlabs.set_defaults(handler=generate_elevenlabs)

    gemini = subcommands.add_parser("gemini-narration", help="Generate original lore narration as PCM WAV")
    gemini.add_argument("--output", required=True, help="Explicit destination .wav filename")
    gemini.add_argument("--voice", default="Kore", help="Gemini prebuilt voice name")
    gemini.add_argument("--env-file", type=Path, help="Explicit dotenv file; otherwise use process environment")
    gemini.add_argument("--timeout", type=float, default=60.0, help="HTTP request timeout in seconds")
    gemini.add_argument("--dry-run", action="store_true", help="Validate the plan without reading credentials or sending a request")
    gemini.set_defaults(handler=generate_gemini)

    validate = subcommands.add_parser("validate", help="Check an existing MP3 or WAV without any network access")
    validate.add_argument("--input", required=True, help="Existing .mp3 or .wav audio file")
    validate.set_defaults(handler=validate_audio)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "duration") and args.duration <= 0:
        parser.error("--duration must be positive")
    if not 0 <= getattr(args, "prompt_influence", 0.5) <= 1:
        parser.error("--prompt-influence must be between 0 and 1")
    try:
        args.handler(args)
    except MediaGenerationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
