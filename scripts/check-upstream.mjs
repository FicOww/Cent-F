#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const upstreamRepository = process.env.UPSTREAM_REPOSITORY ?? "glink25/Cent";
const upstreamBranch = process.env.UPSTREAM_BRANCH ?? "main";
const targetBranch = process.env.TARGET_BRANCH ?? "main";
const reportLabel = process.env.REPORT_ISSUE_LABEL ?? "upstream-update";
const lookbackDays = Number(process.env.UPSTREAM_ACTIVITY_LOOKBACK_DAYS ?? 7);
const githubToken = process.env.GITHUB_TOKEN;
const githubApiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
const githubServerUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const now = new Date();

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
    });

    if (result.status !== 0 && !options.allowFailure) {
        const rendered = [command, ...args].join(" ");
        throw new Error(
            `Command failed: ${rendered}\n${result.stderr || result.stdout}`,
        );
    }

    return result.stdout.trim();
}

function git(args, options) {
    return run("git", args, options);
}

function parseRepositoryFromRemote(remoteUrl) {
    const normalized = remoteUrl.trim().replace(/\.git$/, "");
    const sshMatch = normalized.match(/github\.com[:/](?<repo>[^/]+\/[^/]+)$/);
    const httpsMatch = normalized.match(/github\.com\/(?<repo>[^/]+\/[^/]+)$/);
    return sshMatch?.groups?.repo ?? httpsMatch?.groups?.repo;
}

function getCurrentRepository() {
    if (process.env.GITHUB_REPOSITORY) {
        return process.env.GITHUB_REPOSITORY;
    }

    const originUrl = git(["remote", "get-url", "origin"]);
    const repository = parseRepositoryFromRemote(originUrl);
    if (!repository) {
        throw new Error(
            "Cannot determine current GitHub repository from origin.",
        );
    }

    return repository;
}

function ensureUpstreamRemote() {
    const expectedUrl = `${githubServerUrl}/${upstreamRepository}.git`;
    const existing = git(["remote", "get-url", "upstream"], {
        allowFailure: true,
    });

    if (!existing) {
        git(["remote", "add", "upstream", expectedUrl]);
        return;
    }

    if (existing !== expectedUrl) {
        console.warn(
            `Using existing upstream remote ${existing}; expected ${expectedUrl}.`,
        );
    }
}

function getTargetRef() {
    git(
        [
            "fetch",
            "--no-tags",
            "--prune",
            "origin",
            `+refs/heads/${targetBranch}:refs/remotes/origin/${targetBranch}`,
        ],
        { allowFailure: true },
    );

    const remoteTargetRef = `refs/remotes/origin/${targetBranch}`;
    const verified = git(["rev-parse", "--verify", remoteTargetRef], {
        allowFailure: true,
    });

    return verified ? remoteTargetRef : "HEAD";
}

function safeCount(range) {
    const output = git(["rev-list", "--count", range], { allowFailure: true });
    return Number(output || 0);
}

function commandLines(command, args, limit) {
    const output = run(command, args, { allowFailure: true });
    if (!output) {
        return [];
    }

    return output.split(/\r?\n/).slice(0, limit);
}

function getLatestReportMetadata(issue) {
    if (!issue?.body) {
        return {};
    }

    const latestSha = issue.body.match(
        /<!-- upstream-watch:latest-sha=([a-f0-9]+) -->/i,
    )?.[1];
    const lastActivityCheck = issue.body.match(
        /<!-- upstream-watch:last-activity-check=([^ ]+) -->/i,
    )?.[1];

    return {
        latestSha,
        lastActivityCheck,
    };
}

function isAncestor(ancestor, descendant) {
    const result = spawnSync(
        "git",
        ["merge-base", "--is-ancestor", ancestor, descendant],
        {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    return result.status === 0;
}

function getReportBase({ latestReportSha, mergeBase, upstreamRef }) {
    if (latestReportSha && isAncestor(latestReportSha, upstreamRef)) {
        return {
            base: latestReportSha,
            reason: "since the last reported upstream commit",
        };
    }

    return {
        base: mergeBase,
        reason: latestReportSha
            ? "last reported commit is not an ancestor anymore; falling back to merge base"
            : "first report; using merge base",
    };
}

function formatCommitLines(baseRef, upstreamRef, limit = 40) {
    const commitLines = commandLines(
        "git",
        [
            "log",
            "--reverse",
            "--date=short",
            "--pretty=format:%h%x09%ad%x09%an%x09%s",
            `${baseRef}..${upstreamRef}`,
            `--max-count=${limit}`,
        ],
        limit,
    );

    if (commitLines.length === 0) {
        return "_No new commits in this range._";
    }

    const total = safeCount(`${baseRef}..${upstreamRef}`);
    const rendered = commitLines
        .map((line) => {
            const [hash, date, author, ...subjectParts] = line.split("\t");
            return `- \`${hash}\` ${date} ${author}: ${subjectParts.join("\t")}`;
        })
        .join("\n");

    if (total > limit) {
        return `${rendered}\n- _...and ${total - limit} more commits._`;
    }

    return rendered;
}

function formatDiffStat(baseRef, upstreamRef) {
    const stat = git(
        ["diff", "--stat", "--find-renames", `${baseRef}..${upstreamRef}`],
        { allowFailure: true },
    );
    return stat ? `\`\`\`text\n${stat}\n\`\`\`` : "_No file changes._";
}

function formatChangedFiles(baseRef, upstreamRef, limit = 80) {
    const lines = commandLines(
        "git",
        [
            "diff",
            "--name-status",
            "--find-renames",
            `${baseRef}..${upstreamRef}`,
        ],
        limit + 1,
    );

    if (lines.length === 0) {
        return "_No changed files._";
    }

    const clipped = lines.slice(0, limit).map((line) => `- \`${line}\``);
    if (lines.length > limit) {
        clipped.push(`- _...and more files._`);
    }

    return clipped.join("\n");
}

async function githubJson(path, options = {}) {
    const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers ?? {}),
    };

    if (githubToken) {
        headers.Authorization = `Bearer ${githubToken}`;
    }

    const response = await fetch(`${githubApiUrl}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 404 && options.allow404) {
        return null;
    }

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub API ${response.status} ${path}\n${body}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function ensureLabel(repository) {
    if (!githubToken) {
        return;
    }

    const encodedLabel = encodeURIComponent(reportLabel);
    const existing = await githubJson(
        `/repos/${repository}/labels/${encodedLabel}`,
        { allow404: true },
    );

    if (existing) {
        return;
    }

    await githubJson(`/repos/${repository}/labels`, {
        method: "POST",
        body: JSON.stringify({
            name: reportLabel,
            color: "0969da",
            description: "Original repository activity detected by automation",
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function listReportIssues(repository, state = "all") {
    if (!githubToken) {
        return [];
    }

    const issues = await githubJson(
        `/repos/${repository}/issues?state=${state}&labels=${encodeURIComponent(
            reportLabel,
        )}&sort=updated&direction=desc&per_page=20`,
    );

    return issues.filter(
        (issue) =>
            !issue.pull_request &&
            issue.title.toLowerCase().includes("upstream update"),
    );
}

function getSinceFromReport(latestReportIssue) {
    const metadata = getLatestReportMetadata(latestReportIssue);
    if (metadata.lastActivityCheck) {
        return new Date(metadata.lastActivityCheck);
    }

    return new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
}

async function listRecentUpstreamActivity(since) {
    const query = new URLSearchParams({
        state: "all",
        sort: "updated",
        direction: "desc",
        per_page: "20",
        since: since.toISOString(),
    });
    const issues = await githubJson(
        `/repos/${upstreamRepository}/issues?${query.toString()}`,
        { allow404: true },
    );

    if (!Array.isArray(issues)) {
        return {
            issues: [],
            pullRequests: [],
        };
    }

    return {
        issues: issues.filter((item) => !item.pull_request),
        pullRequests: issues.filter((item) => item.pull_request),
    };
}

async function listRecentReleases(since) {
    const releases = await githubJson(
        `/repos/${upstreamRepository}/releases?per_page=10`,
        { allow404: true },
    );

    if (!Array.isArray(releases)) {
        return [];
    }

    return releases.filter((release) => {
        if (!release.published_at) {
            return false;
        }
        return new Date(release.published_at) > since;
    });
}

function formatActivityItems(items, emptyText) {
    if (items.length === 0) {
        return emptyText;
    }

    return items
        .slice(0, 10)
        .map((item) => {
            const state = item.state ? ` ${item.state}` : "";
            return `- [#${item.number}](${item.html_url})${state}: ${item.title} _(updated ${item.updated_at})_`;
        })
        .join("\n");
}

function formatReleaseItems(items) {
    if (items.length === 0) {
        return "_No new releases since the last check._";
    }

    return items
        .slice(0, 10)
        .map(
            (release) =>
                `- [${release.name || release.tag_name}](${release.html_url}) _(published ${release.published_at})_`,
        )
        .join("\n");
}

function buildReport({
    repository,
    currentSha,
    upstreamSha,
    mergeBase,
    reportBase,
    reportBaseReason,
    activitySince,
    totalAheadCount,
    newCommitCount,
    recentIssues,
    recentPullRequests,
    recentReleases,
}) {
    const upstreamUrl = `${githubServerUrl}/${upstreamRepository}`;
    const repositoryUrl = `${githubServerUrl}/${repository}`;
    const totalCompareUrl = `${upstreamUrl}/compare/${mergeBase}...${upstreamSha}`;
    const newCompareUrl = `${upstreamUrl}/compare/${reportBase}...${upstreamSha}`;
    const activityWindow = getActivityWindowText(activitySince);

    return `<!-- upstream-watch:latest-sha=${upstreamSha} -->
<!-- upstream-watch:last-activity-check=${now.toISOString()} -->
<!-- upstream-watch:upstream=${upstreamRepository}/${upstreamBranch} -->

## Upstream Update Report

This issue is generated automatically. It is a discussion checkpoint, not an automatic merge request.

### Summary

- Current repository: [${repository}](${repositoryUrl})
- Upstream repository: [${upstreamRepository}](${upstreamUrl})
- Upstream branch: \`${upstreamBranch}\`
- Current fork HEAD: \`${currentSha.slice(0, 12)}\`
- Latest upstream HEAD: \`${upstreamSha.slice(0, 12)}\`
- Merge base: \`${mergeBase.slice(0, 12)}\`
- Upstream commits not in this fork: \`${totalAheadCount}\`
- New upstream commits in this report: \`${newCommitCount}\`
- Report range: \`${reportBase.slice(0, 12)}..${upstreamSha.slice(0, 12)}\` (${reportBaseReason})

### Compare Links

- [New changes in this report](${newCompareUrl})
- [All upstream changes not merged into this fork](${totalCompareUrl})

### New Commits

${formatCommitLines(reportBase, `refs/remotes/upstream/${upstreamBranch}`)}

### Diff Stat

${newCommitCount > 0 ? formatDiffStat(reportBase, `refs/remotes/upstream/${upstreamBranch}`) : "_No new commit diff in this report._"}

### Changed Files

${newCommitCount > 0 ? formatChangedFiles(reportBase, `refs/remotes/upstream/${upstreamBranch}`) : "_No new changed files in this report._"}

### Recent Upstream Issues ${activityWindow}

${formatActivityItems(recentIssues, "_No recently updated upstream issues._")}

### Recent Upstream Pull Requests ${activityWindow}

${formatActivityItems(recentPullRequests, "_No recently updated upstream pull requests._")}

### Recent Upstream Releases ${activityWindow}

${formatReleaseItems(recentReleases)}

### Suggested Next Step

Ask Codex to review this issue and summarize whether these upstream changes are worth merging into the fork. Do not merge automatically, because this fork has custom features that may conflict with upstream behavior.
`;
}

function getActivityWindowText(activitySince) {
    return `(since ${activitySince.toISOString()})`;
}

function buildComment({
    upstreamSha,
    newCommitCount,
    recentIssues,
    recentPullRequests,
    recentReleases,
}) {
    return `Upstream activity was detected.

- Latest upstream HEAD: \`${upstreamSha.slice(0, 12)}\`
- New commits in this report: \`${newCommitCount}\`
- Recently updated issues: \`${recentIssues.length}\`
- Recently updated pull requests: \`${recentPullRequests.length}\`
- Recent releases: \`${recentReleases.length}\`

The issue body has been refreshed with the latest summary.`;
}

async function createOrUpdateIssue({
    repository,
    openIssue,
    title,
    body,
    comment,
}) {
    if (!githubToken) {
        console.log(
            "GITHUB_TOKEN is not set, so the upstream report was generated locally only.",
        );
        console.log(body);
        return;
    }

    if (openIssue) {
        await githubJson(`/repos/${repository}/issues/${openIssue.number}`, {
            method: "PATCH",
            body: JSON.stringify({
                title,
                body,
                labels: [reportLabel],
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });

        await githubJson(
            `/repos/${repository}/issues/${openIssue.number}/comments`,
            {
                method: "POST",
                body: JSON.stringify({
                    body: comment,
                }),
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
        console.log(`Updated issue #${openIssue.number}: ${title}`);
        return;
    }

    const issue = await githubJson(`/repos/${repository}/issues`, {
        method: "POST",
        body: JSON.stringify({
            title,
            body,
            labels: [reportLabel],
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });
    console.log(`Created issue #${issue.number}: ${title}`);
}

async function main() {
    const repository = getCurrentRepository();

    ensureUpstreamRemote();
    git([
        "fetch",
        "--no-tags",
        "--prune",
        "upstream",
        `+refs/heads/${upstreamBranch}:refs/remotes/upstream/${upstreamBranch}`,
    ]);

    const targetRef = getTargetRef();
    const currentSha = git(["rev-parse", targetRef]);
    const upstreamRef = `refs/remotes/upstream/${upstreamBranch}`;
    const upstreamSha = git(["rev-parse", upstreamRef]);
    const mergeBase = git(["merge-base", targetRef, upstreamRef]);
    const totalAheadCount = safeCount(`${targetRef}..${upstreamRef}`);

    await ensureLabel(repository);
    const reportIssues = await listReportIssues(repository, "all");
    const openIssue = reportIssues.find((issue) => issue.state === "open");
    const latestReportIssue = reportIssues[0];
    const latestMetadata = getLatestReportMetadata(latestReportIssue);
    const activitySince = getSinceFromReport(latestReportIssue);
    const { issues: recentIssues, pullRequests: recentPullRequests } =
        await listRecentUpstreamActivity(activitySince);
    const recentReleases = await listRecentReleases(activitySince);
    const { base: reportBase, reason: reportBaseReason } = getReportBase({
        latestReportSha: latestMetadata.latestSha,
        mergeBase,
        upstreamRef,
    });
    const newCommitCount = safeCount(`${reportBase}..${upstreamRef}`);
    const latestShaChanged = latestMetadata.latestSha !== upstreamSha;
    const hasRecentActivity =
        recentIssues.length > 0 ||
        recentPullRequests.length > 0 ||
        recentReleases.length > 0;
    const shouldReport =
        totalAheadCount > 0
            ? latestShaChanged || hasRecentActivity || !openIssue
            : hasRecentActivity;

    if (!shouldReport) {
        console.log("No new upstream activity since the last report.");
        return;
    }

    const title = `upstream update: ${upstreamRepository}@${upstreamSha.slice(
        0,
        12,
    )}`;
    const body = buildReport({
        repository,
        currentSha,
        upstreamSha,
        mergeBase,
        reportBase,
        reportBaseReason,
        activitySince,
        totalAheadCount,
        newCommitCount,
        recentIssues,
        recentPullRequests,
        recentReleases,
    });
    const comment = buildComment({
        upstreamSha,
        newCommitCount,
        recentIssues,
        recentPullRequests,
        recentReleases,
    });

    await createOrUpdateIssue({
        repository,
        openIssue,
        title,
        body,
        comment,
    });

    if (totalAheadCount > 0 || hasRecentActivity) {
        process.exitCode = 0;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
