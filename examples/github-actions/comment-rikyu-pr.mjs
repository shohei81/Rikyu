#!/usr/bin/env node
/* global console, fetch, process */
import { readFile } from "node:fs/promises";

const sarifPath = process.argv[2] ?? "rikyu.sarif";
const sarif = JSON.parse(await readFile(sarifPath, "utf8"));
const results = sarif.runs?.flatMap((run) => run.results ?? []) ?? [];
const counts = results.reduce(
  (next, result) => {
    const level = result.level ?? "note";
    next[level] = (next[level] ?? 0) + 1;
    return next;
  },
  { error: 0, warning: 0, note: 0 },
);
const body = [
  "### Rikyu review",
  "",
  `- errors: ${counts.error ?? 0}`,
  `- warnings: ${counts.warning ?? 0}`,
  `- notes: ${counts.note ?? 0}`,
  "",
  results.length === 0
    ? "No findings."
    : "SARIF findings were uploaded to GitHub code scanning.",
].join("\n");

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!token || !repository || !eventPath) {
  console.log(body);
  process.exit(0);
}

const event = JSON.parse(await readFile(eventPath, "utf8"));
const issueNumber = event.pull_request?.number;
if (!issueNumber) {
  console.log(body);
  process.exit(0);
}

const response = await fetch(`https://api.github.com/repos/${repository}/issues/${issueNumber}/comments`, {
  method: "POST",
  headers: {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  },
  body: JSON.stringify({ body }),
});

if (!response.ok) {
  throw new Error(`GitHub comment failed: ${response.status} ${await response.text()}`);
}
