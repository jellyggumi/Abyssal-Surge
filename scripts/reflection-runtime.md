# Stage reflection runtime

`run_stage_reflection.py` is a server/CI operator tool. It does not modify game files, approve or reject a phase, create an evidence record, or silently call a provider. Its JSON output is a bounded input to human review only.

## Installation

Use Python 3.11+ and an isolated environment outside browser-delivered files:

```sh
python -m venv .venv-reflection
. .venv-reflection/bin/activate
python -m pip install -r scripts/reflection-requirements.txt
```

The local validation command needs only those dependencies. For a model run, add exactly the selected provider extra; the example below is deliberately not a command to run against this repository's static app:

```sh
python -m pip install 'pydantic-ai-slim[openai]==2.11.0'
```

Record the resolved lockfile with the non-public reflection artifact. Do not put a provider credential, OIDC token, raw model output, or reflection output in `assets/`, the service-worker cache, or any browser-delivered file.

## Local, model-free validation

The evidence packet and candidate result are separate on purpose: local mode never invents a finding, a risk, a disposition, or a next-stage decision. It validates both files, verifies all local non-external evidence locations (and supplied SHA-256 values), verifies that the result exactly preserves packet evidence, and only then atomically writes canonical JSON.

```sh
python scripts/run_stage_reflection.py validate \
  --evidence scripts/fixtures/reflection/example-stage-evidence.json \
  --result scripts/fixtures/reflection/example-stage-result.json \
  --output /tmp/abyssal-stage-reflection.json
```

The output schema is `abyssal-surge.reflection` version `1.0`. It has a bounded `status` gate disposition, copied evidence references, strict findings/corrective-action lists, and a bounded `next_stage_decision`. `approved` and `rejected` are intentionally absent: a named human must make a terminal decision outside this runner.

An invalid packet is rejected before the candidate result is parsed or an output path is created/overwritten:

```sh
rm -f /tmp/abyssal-invalid-reflection.json
python scripts/run_stage_reflection.py validate \
  --evidence scripts/fixtures/reflection/invalid-stage-evidence.json \
  --result scripts/fixtures/reflection/example-stage-result.json \
  --output /tmp/abyssal-invalid-reflection.json
```

## Explicit PydanticAI path

No model call occurs without `--use-model`, an installed `pydantic_ai` module, and all explicit server/CI configuration:

```sh
export REFLECTION_MODEL_PROVIDER=openai
export REFLECTION_MODEL_NAME='<provider model name>'
export REFLECTION_MODEL_CREDENTIAL_ENV=OPENAI_API_KEY
export OPENAI_API_KEY='<secret held outside this repository>'
python scripts/run_stage_reflection.py model \
  --use-model \
  --evidence scripts/fixtures/reflection/example-stage-evidence.json \
  --output /tmp/abyssal-model-reflection.json
```

`REFLECTION_MODEL_API_KEY` may be used as an internal alias only for the supported provider names `openai`, `anthropic`, `google`, `groq`, and `mistral`; otherwise set `REFLECTION_MODEL_CREDENTIAL_ENV` to the provider's actual credential variable. The runner validates the evidence before importing/invoking PydanticAI, constrains the agent to `StageReflectionResultV1`, revalidates the output against the original evidence packet, and writes only after all checks pass. It does not retry provider transport failures and permits one schema-repair retry through PydanticAI.
