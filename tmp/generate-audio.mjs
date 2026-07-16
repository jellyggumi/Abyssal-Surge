#!/usr/bin/env node
// Shadow Lord (Abyssal Surge) audio generation — Wave A
// SFX via ElevenLabs Sound Generation API, Korean narration via TTS (eleven_multilingual_v2).
// Re-runnable: skips files that already exist unless --force is passed.
// Usage: node tmp/generate-audio.mjs [--force] [--only sfx|tts] [--list-voices]

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'assets/audio');
const ENV_PATH = resolve(ROOT, '.env.game-audio');

// -- env loading: parse file directly, never rely on process.env --------------
function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const { ELEVENLABS_API_KEY } = loadEnv(ENV_PATH);
if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY missing in .env.game-audio');
  process.exit(1);
}

const API = 'https://api.elevenlabs.io/v1';
const HEADERS = { 'xi-api-key': ELEVENLABS_API_KEY };

// -- catalog -------------------------------------------------------------------
// SFX: dark fantasy cues, 0.8–1.5s, one-shot (not seamless loops).
const SFX = [
  { file: 'reward.mp3',      duration: 1.5, prompt: 'dark choral shimmer, ancient blessing chime, dark fantasy, single one-shot cue' },
  { file: 'possess.mp3',     duration: 1.4, prompt: 'whispering shadow takeover, ethereal grip, dark fantasy, single one-shot cue' },
  { file: 'capture.mp3',     duration: 1.2, prompt: 'heavy banner slam onto stone, resonant, dark fantasy, single one-shot impact' },
  { file: 'materialize.mp3', duration: 1.3, prompt: 'shadow smoke coalescing into solid form, whoosh, dark fantasy, single one-shot cue' },
  { file: 'assault.mp3',     duration: 1.2, prompt: 'massive dark energy strike impact, dark fantasy, single one-shot impact' },
  { file: 'hunt.mp3',        duration: 1.0, prompt: 'low sonar ping, void echo, dark fantasy, single one-shot cue' },
];

// Narration: Korean, low male voice, model eleven_multilingual_v2.
const NARR = [
  { file: 'narr-intro.mp3',   text: '심연의 문이 열렸다. 그림자 군주여, 일어나라.' },
  { file: 'narr-stage1.mp3',  text: '잿빛 교량, 신더 스팬. 재의 메아리를 사냥하고 영혼을 거두어라.' },
  { file: 'narr-stage2.mp3',  text: '장막 성채, 베일 시타델. 빙의의 힘이 깨어난다. 두 거점을 동시에 장악하라.' },
  { file: 'narr-stage3.mp3',  text: '메아리 왕좌. 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라.' },
  { file: 'narr-victory.mp3', text: '침묵한 문 앞에서, 그림자 군단이 왕좌에 오른다.' },
  { file: 'narr-defeat.mp3',  text: '군단의 닻이 끊어졌다. 다시, 일어나라.' },
];

// Voice: deep male, works well for Korean via multilingual v2.
// NOTE: API key lacks voices_read scope (GET /v1/voices -> 401), so we use the
// ElevenLabs premade voice Daniel (same ID on every account). Verified with a
// short Korean TTS probe before full generation. Override via VOICE_ID env var.
const VOICE_ID = process.env.VOICE_ID || 'onwK4e9ZLuTAKqWW03F9'; // Daniel — deep male narrator

const VOICE_SETTINGS = { stability: 0.55, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true };

// -- helpers -------------------------------------------------------------------
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

async function post(url, body, accept = 'audio/mpeg') {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Object.assign(new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`), { status: res.status });
  }
  return Buffer.from(await res.arrayBuffer());
}

async function listVoices() {
  const res = await fetch(`${API}/voices`, { headers: HEADERS });
  if (!res.ok) throw new Error(`voices HTTP ${res.status}`);
  const { voices } = await res.json();
  for (const v of voices) {
    console.log(`${v.voice_id}  ${v.name}  labels=${JSON.stringify(v.labels)}`);
  }
}

async function genSfx({ file, prompt, duration }) {
  const out = resolve(OUT_DIR, file);
  if (!FORCE && existsSync(out)) return { file, skipped: true, bytes: statSync(out).size };
  const buf = await post(`${API}/sound-generation`, {
    text: prompt,
    duration_seconds: duration,
    prompt_influence: 0.6,
  });
  writeFileSync(out, buf);
  return { file, bytes: buf.length, prompt, duration };
}

async function genTts({ file, text }) {
  const out = resolve(OUT_DIR, file);
  if (!FORCE && existsSync(out)) return { file, skipped: true, bytes: statSync(out).size };
  const buf = await post(
    `${API}/text-to-speech/${VOICE_ID}?output_format=mp3_44100_96`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: VOICE_SETTINGS },
  );
  writeFileSync(out, buf);
  return { file, bytes: buf.length, text };
}

// -- main ----------------------------------------------------------------------
async function main() {
  if (args.includes('--list-voices')) return listVoices();
  mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  if (ONLY !== 'tts') {
    for (const item of SFX) {
      try {
        const r = await genSfx(item);
        console.log(r.skipped ? `skip ${r.file} (${r.bytes}B)` : `sfx  ${r.file} ${r.bytes}B`);
        results.push({ ...r, kind: 'sfx', ok: true });
      } catch (e) {
        console.error(`FAIL sfx ${item.file}: ${e.message}`);
        results.push({ file: item.file, kind: 'sfx', ok: false, status: e.status, error: e.message });
      }
    }
  }
  if (ONLY !== 'sfx') {
    for (const item of NARR) {
      try {
        const r = await genTts(item);
        console.log(r.skipped ? `skip ${r.file} (${r.bytes}B)` : `tts  ${r.file} ${r.bytes}B`);
        results.push({ ...r, kind: 'tts', ok: true });
      } catch (e) {
        console.error(`FAIL tts ${item.file}: ${e.message}`);
        results.push({ file: item.file, kind: 'tts', ok: false, status: e.status, error: e.message });
      }
    }
  }
  writeFileSync(resolve(ROOT, 'tmp/audio-gen-results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\ndone: ${results.length - failed.length} ok, ${failed.length} failed`);
  if (failed.length) process.exitCode = 2;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
