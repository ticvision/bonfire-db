#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const tasksPath = path.join(root, "docs/loop/tasks.json");
const statusPath = path.join(root, "docs/loop/task-status.json");

function usage() {
  console.error(`usage:
  task.mjs validate
  task.mjs list
  task.mjs next
  task.mjs show BF-XX
  task.mjs contract BF-XX
  task.mjs status BF-XX pending|active|blocked|review|passed [--note NOTE] [--branch BRANCH] [--pr PR] [--greptile SCORE]
`);
  process.exit(2);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function load() {
  return {
    registry: readJson(tasksPath),
    status: readJson(statusPath),
  };
}

function findTask(registry, id) {
  const task = registry.tasks.find((item) => item.id === id);
  if (!task) {
    console.error(`task: unknown task id ${id}`);
    process.exit(1);
  }
  return task;
}

function statusById(status) {
  return new Map(status.tasks.map((item) => [item.id, item]));
}

function validate() {
  const { registry, status } = load();
  const errors = [];
  const ids = new Set();

  if (registry.version !== 1) errors.push("tasks.json version must be 1");
  if (status.version !== 1) errors.push("task-status.json version must be 1");
  if (!Array.isArray(registry.tasks)) errors.push("tasks.json tasks must be an array");
  if (!Array.isArray(status.tasks)) errors.push("task-status.json tasks must be an array");

  for (const task of registry.tasks || []) {
    if (!/^BF-\d\d$/.test(task.id || "")) errors.push(`invalid task id: ${task.id}`);
    if (ids.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    for (const key of ["title", "profile", "goal", "why"]) {
      if (!task[key]) errors.push(`${task.id} missing ${key}`);
    }
    for (const key of ["allowedPaths", "forbiddenPaths", "acceptance", "verify", "requiredAgents"]) {
      if (!Array.isArray(task[key])) errors.push(`${task.id} ${key} must be an array`);
    }
    if (task.greptileRequired !== true) errors.push(`${task.id} must require Greptile`);
  }

  const statusIds = new Set((status.tasks || []).map((item) => item.id));
  for (const id of ids) {
    if (!statusIds.has(id)) errors.push(`task-status.json missing ${id}`);
  }
  for (const id of statusIds) {
    if (!ids.has(id)) errors.push(`task-status.json has unknown id ${id}`);
  }

  if (errors.length) {
    for (const error of errors) console.error(`task: ${error}`);
    process.exit(1);
  }
  console.log(`task: registry valid (${registry.tasks.length} tasks)`);
}

function list() {
  const { registry, status } = load();
  const statuses = statusById(status);
  for (const task of registry.tasks) {
    const state = statuses.get(task.id)?.status || "missing";
    console.log(`${task.id}\t${state}\t${task.profile}\t${task.title}`);
  }
}

function next() {
  const { registry, status } = load();
  const statuses = statusById(status);
  const task = registry.tasks.find((item) => {
    const state = statuses.get(item.id)?.status || "pending";
    return !["passed", "abandoned"].includes(state);
  });
  if (!task) {
    console.log("task: all tasks passed");
    return;
  }
  console.log(`${task.id} ${task.title}`);
}

function show(id) {
  const { registry, status } = load();
  const task = findTask(registry, id);
  const state = statusById(status).get(id);
  console.log(JSON.stringify({ ...task, state }, null, 2));
}

function contract(id) {
  const { registry } = load();
  const task = findTask(registry, id);
  console.log(`ID: ${task.id}`);
  console.log(`GOAL: ${task.goal}`);
  console.log(`WHY: ${task.why}`);
  console.log(`PROFILE: ${task.profile}`);
  console.log(`ALLOWED FILES:\n${task.allowedPaths.map((item) => `- ${item}`).join("\n")}`);
  console.log(`FORBIDDEN FILES:\n${task.forbiddenPaths.map((item) => `- ${item}`).join("\n") || "- none"}`);
  console.log(`ACCEPTANCE:\n${task.acceptance.map((item) => `- ${item}`).join("\n")}`);
  console.log(`VERIFY COMMAND:\n${task.verify.map((item) => `- ${item}`).join("\n")}`);
  console.log(`REQUIRED AGENTS:\n${task.requiredAgents.map((item) => `- ${item}`).join("\n")}`);
  console.log("MAX ATTEMPTS: 4");
  console.log("MAX TURNS: 8");
  console.log("MAX BUDGET USD: 8");
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) usage();
    flags[key.slice(2)] = value;
  }
  return flags;
}

function setStatus(id, newStatus, rest) {
  const allowed = new Set(["pending", "active", "blocked", "review", "passed", "abandoned"]);
  if (!allowed.has(newStatus)) {
    console.error(`task: invalid status ${newStatus}`);
    process.exit(2);
  }
  const flags = parseFlags(rest);
  const { registry, status } = load();
  findTask(registry, id);
  const item = status.tasks.find((entry) => entry.id === id);
  if (!item) {
    console.error(`task: task-status.json missing ${id}`);
    process.exit(1);
  }
  if (newStatus === "active") item.attempts = Number(item.attempts || 0) + 1;
  item.status = newStatus;
  if (flags.note !== undefined) item.notes = flags.note;
  if (flags.branch !== undefined) item.branch = flags.branch;
  if (flags.pr !== undefined) item.pr = flags.pr;
  if (flags.greptile !== undefined) item.greptile = flags.greptile;
  status.updatedAt = new Date().toISOString();
  writeJson(statusPath, status);
  console.log(`task: ${id} -> ${newStatus}`);
}

const [cmd, id, maybeStatus, ...rest] = process.argv.slice(2);
if (cmd === "validate") validate();
else if (cmd === "list") list();
else if (cmd === "next") next();
else if (cmd === "show" && id) show(id);
else if (cmd === "contract" && id) contract(id);
else if (cmd === "status" && id && maybeStatus) setStatus(id, maybeStatus, rest);
else usage();
