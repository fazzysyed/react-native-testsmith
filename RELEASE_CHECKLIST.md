# Release Checklist (v0.1.0)

Use this checklist before publishing `react-native-testsmith`.

## 1) Code quality gate

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] CI workflow is green on `main`

## 2) Verify docs

- [ ] README install instructions are correct
- [ ] command examples reflect current CLI options
- [ ] AI setup notes mention first-time model download delay
- [ ] sponsorship section is present and up to date

## 3) Validate package metadata

- [ ] package name is correct: `react-native-testsmith`
- [ ] `bin` points to `dist/bin.js`
- [ ] license is present
- [ ] keywords and description are relevant
- [ ] files list includes only publishable assets (`dist`, `README.md`, `LICENSE`)

## 4) Smoke-test package locally

- [ ] `npm pack`
- [ ] install tarball in a clean sample project
- [ ] run: `react-native-testsmith --help`
- [ ] run: `react-native-testsmith setup --dry-run`
- [ ] run: `react-native-testsmith scan` and `generate`

## 5) Versioning + changelog

- [ ] bump version in `package.json` (e.g. `0.1.0`)
- [ ] add release notes/changelog section
- [ ] commit version and docs updates

## 6) Publish

- [ ] ensure npm account is logged in: `npm whoami`
- [ ] publish: `npm publish --access public`
- [ ] verify package page and install command

## 7) Post-release

- [ ] create GitHub release/tag `v0.1.0`
- [ ] announce in README / social / community channels
- [ ] open follow-up issues for next milestone
