# react-native-testsmith

Production-ready, local-first CLI for React Native unit testing with Jest and React Native Testing Library.

## Why this exists

- Automates painful Jest + RN config
- Scans your components/screens and builds metadata
- Generates stable test templates quickly
- Keeps everything local (no external API needed)

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
react-native-testsmith setup
react-native-testsmith setup --dry-run
react-native-testsmith setup --with-native-mocks
react-native-testsmith setup --skip-install
react-native-testsmith scan
react-native-testsmith generate
react-native-testsmith ai-setup
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx
react-native-testsmith doctor
react-native-testsmith doctor --json
```

## Typical workflow

```bash
react-native-testsmith init
react-native-testsmith setup
react-native-testsmith scan
react-native-testsmith generate
react-native-testsmith ai-setup
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply --run-jest
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
react-native-testsmith setup
```

5. Scan project components/screens

```bash
react-native-testsmith scan
```

6. Generate baseline test templates

```bash
react-native-testsmith generate
```

7. Bootstrap local AI runtime (Ollama + model)

```bash
react-native-testsmith ai-setup
```

8. Generate/improve tests with AI for a specific file

```bash
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply --run-jest
```

9. Validate setup health

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

## Test output structure

`generate` mirrors your source structure in `__tests__` when `testFileStyle` is `tests-dir`.

Example:
- `src/components/Button.tsx` -> `__tests__/components/Button.test.tsx`
- `src/screens/auth/Login.js` -> `__tests__/screens/auth/Login.test.js`

## Local AI enhancement

`ai-enhance` uses a local Ollama model (no external API):

```bash
react-native-testsmith ai-setup
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply
react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --model qwen2.5-coder:7b --apply --run-jest
```

Notes:
- `ai-setup` checks Ollama, starts service if needed, and downloads model automatically.
- First-time model download may take several minutes. This is one-time per model.
- Without `--apply`, the command runs in preview mode and prints output.
- If `--run-jest` is set and Jest fails, AI auto-fix retries run (based on `ai.maxRetries`).

## CI

GitHub Actions CI is included at `.github/workflows/ci.yml`:
- typecheck
- build
- test

## Notes

- Generated tests are templates and should be refined by developers.
- Use `--force` if you want to overwrite existing generated files.

## Sponsor request

`react-native-testsmith` is currently local-first and free to use.

If this project saves your team time, please sponsor development so we can:
- maintain and improve templates faster
- add broader framework support
- provide optional hosted model inference in the future
- keep docs, CI, and releases production-grade

Interested in sponsoring? Open an issue with title `Sponsorship` and we will coordinate.
