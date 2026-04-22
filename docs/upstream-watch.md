# Upstream Watch

This repository is a customized fork of `glink25/Cent`. The upstream watch
workflow detects activity in the original repository and opens or updates a
GitHub issue in this fork instead of merging automatically.

## What It Watches

- New commits on `glink25/Cent` `main`.
- Recently updated upstream issues.
- Recently updated upstream pull requests.
- Recently published upstream releases.

The report issue is labeled `upstream-update`. It includes commit summaries,
changed files, diff stats, compare links, and recent upstream issue/PR/release
activity.

## Why It Does Not Auto-Merge

This fork has custom behavior, including AA settlement changes. Upstream updates
may conflict with those changes or change product behavior in a way we do not
want. The workflow therefore creates a discussion checkpoint. After it reports an
update, ask Codex to review the issue and decide whether to merge, cherry-pick,
or ignore the upstream changes.

## Manual Check

Run this locally whenever needed:

```bash
pnpm upstream:check
```

The local command prints the same report. In GitHub Actions, the script uses
`GITHUB_TOKEN` to create or update the report issue automatically.

## Configuration

The workflow lives at `.github/workflows/upstream-watch.yml`.

- `UPSTREAM_REPOSITORY`: original repository, currently `glink25/Cent`.
- `UPSTREAM_BRANCH`: original branch, currently `main`.
- `TARGET_BRANCH`: fork branch to compare from, currently `main`.
- `REPORT_ISSUE_LABEL`: issue label for generated reports.
- `UPSTREAM_ACTIVITY_LOOKBACK_DAYS`: issue/PR/release lookback window for the
  first report or after a report issue was closed.
