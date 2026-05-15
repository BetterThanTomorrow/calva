# Calva Release Process

This document describes the Calva release process, including the happy path and troubleshooting common issues.

## Overview

Calva releases are automated through CircleCI. The release process is triggered by pushing a version tag to the repository.

Releases are published to:

- GitHub Releases
- VS Code Marketplace
- Open VSX Registry

## Prerequisites

- You must be on the `dev` branch
- Your branch must be clean (no uncommitted changes)
- Your branch must be up-to-date with remote
- There should be unreleased changes in the changelog (otherwise you'll be prompted)
- [Babashka](https://babashka.org/) must be installed

## The Happy Path

### 1. Verify Changelog Entries

Before releasing, ensure all changes are documented in the `## [Unreleased]` section of `CHANGELOG.md`. Each entry should follow the format:

```markdown
- Fix: [Issue title](https://github.com/BetterThanTomorrow/calva/issues/XXXX)
- [Feature description](https://github.com/BetterThanTomorrow/calva/issues/XXXX)
```

Use the "Fix:" prefix only for bug fixes.

### 2. Verify Version in package.json

The version in `package.json` should already be set to the next release version (this is done automatically after each release by the CI pipeline).

### 3. Run the Publish Script

From the repository root, run:

```bash
npm run publish
```

Or directly:

```bash
./scripts/publish.clj
```

You can also add an optional commit message suffix:

```bash
./scripts/publish.clj "Co-authored-by: Someone <someone@example.com>"
```

The script will:

1. Verify you're on `dev` branch, clean, and up-to-date
2. Read the current version from `package.json`
3. Update `CHANGELOG.md` to move unreleased changes under a dated version header
4. Commit the changelog with message: `Add changelog section for vX.Y.Z [skip ci]`
5. Create a git tag: `vX.Y.Z`
6. Push the commit and tag to the remote

### 4. Monitor CI Pipeline

After pushing, open the [CircleCI dashboard](https://app.circleci.com/pipelines/github/BetterThanTomorrow/calva) to monitor progress.

The CI pipeline will:

1. Run all tests (prettier, eslint, grammar, ClojureScript lib, integration, smoke, TypeScript unit)
2. Create a GitHub Release with the changelog contents
3. For stable releases:
   - Publish to VS Code Marketplace
   - Publish to Open VSX Registry
   - Merge `dev` into `published` branch
   - Bump the version in `package.json` on `dev` for the next release

### 5. Verify the Release

After CI completes:

- Check [GitHub Releases](https://github.com/BetterThanTomorrow/calva/releases) for the new release
- For stable releases, verify the extension is available on:
  - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva)
  - [Open VSX Registry](https://open-vsx.org/extension/betterthantomorrow/calva)

## Troubleshooting

### Tests Fail After Publish Script Succeeds

If the publish script completes successfully but tests fail in CI:

1. **Revert the changelog commit:**

   ```bash
   git revert HEAD
   git push
   ```

2. **Delete the version tag locally and remotely:**

   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```

3. Fix the failing tests, then run the publish script again.

### "Merge published into dev" Step Fails

If the `calva-io-build` workflow's "Merge published into dev" step fails with:

```bash
! [rejected]            HEAD -> dev (non-fast-forward)
error: failed to push some refs to 'git@github.com:BetterThanTomorrow/calva.git'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart. Integrate the remote changes (e.g.
hint: 'git pull ...') before pushing again.
```

This happens when `dev` has new commits since the release was tagged. Resolve it manually:

```bash
git checkout dev
git pull
git merge origin/published --no-ff -m "Merge branch published into dev [skip ci]"
git push
```

### Publish Script Aborts Due to Git Status

If the publish script reports git status issues, you'll see messages like:

- `:not-on-dev` - You're not on the `dev` branch
- `:not-up-to-date` - Your local branch is behind remote
- `:branch-not-clean` - You have uncommitted changes

Resolve the specific issue and run the script again.

### Empty Unreleased Changelog

If the changelog has no unreleased changes, the script will ask if you want to release anyway. Answering `YES` will:

- Skip the changelog update
- Create a tag and push (useful for re-releasing after a failed CI run)

## CI Workflow Details

### release-publish Workflow

Triggered by version tags (`v*`). Jobs run in this order:

1. **checkout** - Clone repository
2. **build** - Build the extension
3. **Tests** (parallel): prettier-check, eslint-check, test-grammar, test-cljslib, test-integration, test-smoke, test-smoke-sub-projects, test-ts-unit
4. **github-release** - Create GitHub release with `.vsix` artifact
5. **marketplace-publish** - Publish to VS Code Marketplace (stable only)
6. **open-vsx-publish** - Publish to Open VSX (stable only)
7. **merge-dev-into-published** - Merge `dev` branch into `published` (stable only)
8. **bump-dev-version** - Increment patch version on `dev` (stable only)

### calva-io-build Workflow

Triggered by pushes to `published` branch:

1. **deploy-docs** - Deploy documentation to calva.io
2. **merge-published-into-dev** - Merge `published` back into `dev`

## Branch Strategy

- **dev**: Main development branch. All feature branches merge here.
- **published**: Reflects the lates released version. Updated automatically after a release.

Documentation PRs that only update the `docs/site/` content should target the `published` branch directly.
