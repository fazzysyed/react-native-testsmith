# react-native-testsmith
[![CI](https://github.com/fazzysyed/react-native-testsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/fazzysyed/react-native-testsmith/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/react-native-testsmith.svg)](https://www.npmjs.com/package/react-native-testsmith)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-grade React Native testing CLI for Jest + React Native Testing Library, now with API-first AI generation.

## v0.1.2 Announcement

- API-first workflow is now the default.
- `init` runs setup automatically.
- `generate` runs full pipeline: scan + API check + per-file AI test generation.
- Large files are chunked automatically for free-tier model limits.
- Terminal progress is shown per file with final response/generated counters.
- Reliability improvements include timeout, retries, and failed-file rerun mode.

## Cloud API stack (current)

Built with FastAPI, hosted on Hugging Face Spaces.  
Uses LLaMA 3.3 70B via Groq for fast inference.

Send any React Native component as plain text to `/generate-tests` and get:
- component summary
- key test scenarios
- full Jest + React Native Testing Library test file

System prompt is engineered to cover:
- rendering
- interactions
- state changes
- async behavior
- edge cases
- accessibility

## Why this CLI exists

- remove repetitive RN Jest setup pain
- standardize test scaffolding across projects
- speed up test writing without blocking manual refinement

## Install

```bash
npm i -g react-native-testsmith
```

Or inside a project:

```bash
npm i -D react-native-testsmith
```

## Main commands

```bash
react-native-testsmith init
react-native-testsmith generate
react-native-testsmith generate --failed-only
react-native-testsmith doctor
react-native-testsmith doctor --json
```

## Quickstart (recommended)

1. Go to your React Native app

```bash
cd mobileApp
```

2. Initialize config + Jest setup

```bash
react-native-testsmith init
```

3. Run full AI generation pipeline

```bash
react-native-testsmith generate
```

4. Retry only failed files if needed

```bash
react-native-testsmith generate --failed-only
```

## Environment variables

- `RN_TESTSMITH_API_URL` (optional override for default API endpoint)
- `RN_TESTSMITH_API_KEY` (optional auth token)
- `RN_TESTSMITH_API_CHUNK_SIZE` (default: `12000`)
- `RN_TESTSMITH_API_TIMEOUT_MS` (default: `120000`)
- `RN_TESTSMITH_API_RETRIES` (default: `2`)
- `RN_TESTSMITH_API_BACKOFF_MS` (default: `2000`)

## Output behavior

- `generate` scans `.tsx/.jsx/.ts/.js` including root `App.ts/js/tsx/jsx`
- test files mirror source structure under `__tests__`
- failed API files are saved to `.react-native-testsmith/failed-files.json`

## Important note from maintainer

I built this CLI solo.  
I have tried to make it production-level ready, but there may still be issues.

I am very open to:
- bug reports
- feature discussions
- architecture suggestions

## Looking for collaborators and sponsors

I want to turn this into a broader testing ecosystem, not just a CLI.

Why sponsorship matters:
- host models on our own infrastructure
- use more efficient and stronger models
- improve reliability and throughput
- add richer workflows beyond test scaffolding

If you are interested in collaborating or sponsoring, please open an issue titled:
- `Collaboration`
- `Sponsorship`

For shared commits, use a `Co-authored-by: Name <email>` trailer in the message body so GitHub attributes work to every author.

## Hashtags

#ReactNative #Jest #Testing #ReactNativeTestingLibrary #FastAPI #HuggingFace #Groq #OpenSource #DevTools #TypeScript
