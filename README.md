# react-native-testsmith
[![CI](https://github.com/fazzysyed/react-native-testsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/fazzysyed/react-native-testsmith/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/react-native-testsmith.svg)](https://www.npmjs.com/package/react-native-testsmith)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-ready CLI for React Native unit testing with Jest and React Native Testing Library.

## Why this exists

- Automates painful Jest + RN config
- Scans your components/screens and builds metadata
- Generates stable test templates quickly
- Supports API-driven AI test generation with chunking for large files

## Install

```bash
npm i -g react-native-testsmith
```

Or inside a project:

```bash
npm i -D react-native-testsmith
```

For local development from this repo:

```bash
npm i
npm run build
npm i -g .
react-native-testsmith --help
```

If you see `command not found`, install globally (`npm i -g .`) or run with `npx`.

## Commands

```bash
react-native-testsmith init
react-native-testsmith generate
react-native-testsmith ai-setup
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx
react-native-testsmith doctor
react-native-testsmith doctor --json
```

## Typical workflow

```bash
react-native-testsmith init
react-native-testsmith generate
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply
```

## Full setup steps (end-to-end)

1. Install CLI

```bash
npm i -g react-native-testsmith
```

2. Move to your React Native app

```bash
cd mobileApp
```

3. Create config

```bash
react-native-testsmith init
```

4. Configure Jest and required mocks

```bash
# already done by init
# optional manual run:
react-native-testsmith setup
```

5. Run complete generation pipeline (scan + API check + per-file AI generation)

```bash
react-native-testsmith generate
```

6. Verify API runtime setup (optional standalone check)

```bash
react-native-testsmith ai-setup
```

7. Generate/improve tests with AI for a specific file

```bash
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply --run-jest
```

8. Validate setup health

```bash
react-native-testsmith doctor
react-native-testsmith doctor --json
```

## Setup output

`setup` creates:
- `jest.config.js`
- `jest.setup.ts`
- `__mocks__/fileMock.tsx`
- `__mocks__/styleMock.ts`
- RN mock shims for common libraries
- installs `@testing-library/react-native` if missing

When you pass `--with-native-mocks`, setup also creates:
- `__mocks__/react-native-config.ts`
- `__mocks__/react-native-device-info.ts`
- `__mocks__/react-native-vector-icons-MaterialIcons.ts`

Use `--dry-run` to preview all setup changes safely before writing files.

`init` runs setup automatically. You can still run `setup` directly when needed.

## Test output structure

`generate` mirrors your source structure in `__tests__` when `testFileStyle` is `tests-dir`.

Example:
- `src/components/Button.tsx` -> `__tests__/components/Button.test.tsx`
- `src/screens/auth/Login.js` -> `__tests__/screens/auth/Login.test.js`

## AI enhancement (API)

`ai-enhance` uses an API backend:

```bash
react-native-testsmith ai-setup
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --model default --apply --run-jest
```

Notes:
- `ai-setup` checks API endpoint connectivity.
- Without `--apply`, the command runs in preview mode and prints output.
- If `--run-jest` is set and Jest fails, AI auto-fix retries run (based on `ai.maxRetries`).
- `RN_TESTSMITH_API_URL` overrides endpoint and `RN_TESTSMITH_API_KEY` is optional.
- For long files, API runtime automatically chunks input and synthesizes a final test response.
- `scan` includes `App.ts`, `App.js`, `App.tsx`, and `App.jsx` at project root.
- `generate` shows per-file progress and final counts for AI responses and generated files.

## CI

GitHub Actions CI is included at `.github/workflows/ci.yml`:
- typecheck
- build
- test

## Notes

- Generated tests are templates and should be refined by developers.
- Use `--force` if you want to overwrite existing generated files.

## Sponsor request

`react-native-testsmith` is currently free to use.

If this project saves your team time, please sponsor development so we can:
- maintain and improve templates faster
- add broader framework support
- provide optional hosted model inference in the future
- keep docs, CI, and releases production-grade

Interested in sponsoring? Open an issue with title `Sponsorship` and we will coordinate.
