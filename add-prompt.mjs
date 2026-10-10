#!/usr/bin/env node
/**
 * add-prompt.mjs — 无限画布(infinite-canvas)提示词库管理工具
 *
 * 功能：新增 / 删除 / 列出 / 校验提示词，自动生成合规 id、补齐 13 个必需字段、
 *       写入 prompts.json、提交推送 GitHub、验证 raw URL。
 *
 * 用法：
 *   node add-prompt.mjs --title "标题" --prompt "提示词正文" [--note "备注"] [--tags "标签1,标签2"] [--mode generate|edit]
 *   node add-prompt.mjs --title "标题" --prompt-file 正文.txt [--note "备注"]
 *   node add-prompt.mjs --list                     # 列出全部提示词
 *   node add-prompt.mjs --check                    # 只校验，不修改
 *   node add-prompt.mjs --delete <id>              # 删除指定提示词
 *
 * 选项：
 *   --prompt-file <文件>   从文件读正文（长文本/多段推荐用这个，避免命令行引号问题）
 *   --tags "a,b"           标签，逗号分隔（默认：取 --mode 值）
 *   --mode generate|edit   生成模式（默认 generate）
 *   --model <名称>         建议模型（默认 gpt-image-2）
 *   --no-push              只写文件，不提交推送
 *   --no-verify            推送后不验证 raw URL
 *
 * 说明：仓库/路径在本文件顶部常量里，换仓库改那里即可。
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── 配置 ────────────────────────────────────────────────────────────────
const DIR = dirname(fileURLToPath(import.meta.url));
const FILE = join(DIR, "prompts.json");
const SOURCE_ID = "tishici";
const SOURCE_URL = "https://github.com/1552407461/TiShiCi";
const RAW_URL = "https://raw.githubusercontent.com/1552407461/TiShiCi/main/prompts.json";

const REQUIRED_KEYS = [
  "id", "sourceId", "title", "prompt", "description", "coverUrl",
  "referenceImageUrls", "tags", "author", "sourceUrl", "createdAt",
  "imageMode", "imageModel",
];

// ─── 工具函数 ────────────────────────────────────────────────────────────
const C = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
};
const say = (...a) => console.log(...a);
const die = (msg) => { say(C.bad("❌ " + msg)); process.exit(1); };

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const takesValue = ["title", "prompt", "prompt-file", "note", "tags", "mode", "model", "delete"];
      if (takesValue.includes(key)) out[key] = argv[++i] ?? "";
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

/** 读取 prompts.json，自动去掉 BOM，容错空文件 */
function loadPrompts() {
  if (!existsSync(FILE)) return [];
  let raw = readFileSync(FILE, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);   // 去 BOM
  if (raw.trim() === "") return [];
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    die(`prompts.json 不是合法 JSON：${e.message}\n   修复后再运行（可先执行 --check 看详情）`);
  }
  if (!Array.isArray(data)) die("prompts.json 顶层必须是数组");
  return data;
}

/** 写入：2 空格缩进、UTF-8 无 BOM、末尾换行（与画布消费的格式一致） */
function savePrompts(list) {
  if (existsSync(FILE)) copyFileSync(FILE, FILE + ".bak");
  writeFileSync(FILE, JSON.stringify(list, null, 2) + "\n", { encoding: "utf8" });
}

/** 生成不与现有冲突的 id：<sourceId>:<16位小写hex> */
function newId(existing) {
  const used = new Set(existing.map((p) => p.id));
  for (let i = 0; i < 50; i++) {
    const id = `${SOURCE_ID}:${randomBytes(8).toString("hex")}`;
    if (!used.has(id)) return id;
  }
  die("连续 50 次生成的 id 都冲突，异常");
}

const ID_RE = /^[a-z0-9-]+:[0-9a-f]{16}$/;
const SRC_RE = /^[a-z0-9-]+$/;

/** 逐条校验，返回问题列表 */
function validate(list) {
  const problems = [];
  const seen = new Set();
  list.forEach((r, i) => {
    const tag = `第 ${i + 1} 条「${r?.title ?? "?"}」`;
    if (!r || typeof r !== "object") { problems.push(`${tag}: 不是对象`); return; }
    const keys = Object.keys(r);
    const miss = REQUIRED_KEYS.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !REQUIRED_KEYS.includes(k));
    if (miss.length) problems.push(`${tag}: 缺少字段 ${miss.join(", ")}`);
    if (extra.length) problems.push(`${tag}: 多余字段 ${extra.join(", ")}（规范禁止未知键）`);
    if (!ID_RE.test(r.id ?? "")) problems.push(`${tag}: id 格式错（须 ${SOURCE_ID}:16位小写hex），实际 "${r.id}"`);
    if (!SRC_RE.test(r.sourceId ?? "")) problems.push(`${tag}: sourceId 只能含小写字母/数字/连字符，实际 "${r.sourceId}"`);
    if (r.sourceId !== SOURCE_ID) problems.push(`${tag}: sourceId 应为 "${SOURCE_ID}"，实际 "${r.sourceId}"`);
    if (seen.has(r.id)) problems.push(`${tag}: id 重复 "${r.id}"`);
    seen.add(r.id);
    if (!r.sourceUrl) problems.push(`${tag}: sourceUrl 不能为空（规范要求）`);
    if (!Array.isArray(r.referenceImageUrls)) problems.push(`${tag}: referenceImageUrls 必须是数组`);
    if (!Array.isArray(r.tags)) problems.push(`${tag}: tags 必须是数组`);
    if (!["generate", "edit", ""].includes(r.imageMode ?? "")) problems.push(`${tag}: imageMode 只能是 generate/edit/""，实际 "${r.imageMode}"`);
    if (!r.prompt) problems.push(`${tag}: prompt 不能为空`);
  });
  return problems;
}

/** 打印一条记录的摘要 */
function brief(r, idx) {
  const t = r.title.length > 30 ? r.title.slice(0, 30) + "…" : r.title;
  return `  ${String(idx).padStart(2)}. ${t.padEnd(32)} [${(r.imageMode || "-").padEnd(8)}] ${C.dim(r.id)}`;
}

function runGit(args) {
  const r = spawnSync("git", args, { cwd: DIR, stdio: "inherit" });
  return r.status === 0;
}

// ─── 命令实现 ────────────────────────────────────────────────────────────
function cmdList() {
  const list = loadPrompts();
  if (!list.length) return say(C.warn("（提示词库为空）"));
  say(`共 ${list.length} 条：\n`);
  list.forEach((r, i) => say(brief(r, i + 1)));
  say(`\n${C.dim("画布 URL: " + RAW_URL)}`);
}

function cmdCheck() {
  const list = loadPrompts();
  say(`文件: ${FILE}`);
  say(`记录数: ${list.length}`);
  const problems = validate(list);
  if (!problems.length) {
    say(C.ok("✅ 全部通过规范校验"));
  } else {
    say(C.bad(`❌ 发现 ${problems.length} 个问题：`));
    problems.forEach((p) => say("   • " + p));
    process.exitCode = 1;
  }
  return problems.length === 0;
}

async function cmdAdd(args) {
  const title = (args.title ?? "").trim();
  if (!title) die('缺少 --title。用法：node add-prompt.mjs --title "标题" --prompt "正文"');

  let prompt = args.prompt ?? "";
  if (args["prompt-file"]) {
    const pf = args["prompt-file"];
    if (!existsSync(pf)) die(`--prompt-file 指定的文件不存在: ${pf}`);
    prompt = readFileSync(pf, "utf8").replace(/^\uFEFF/, "");
  }
  prompt = prompt.trim();
  if (!prompt) die("提示词正文为空（用 --prompt 或 --prompt-file 提供）");

  const mode = args.mode ?? "generate";
  if (!["generate", "edit"].includes(mode)) die(`--mode 只能是 generate 或 edit，实际 "${mode}"`);

  const tags = args.tags
    ? String(args.tags).split(",").map((s) => s.trim()).filter(Boolean)
    : [mode];

  const list = loadPrompts();
  const record = {
    id: newId(list),
    sourceId: SOURCE_ID,
    title,
    prompt,
    description: (args.note ?? "").trim(),
    coverUrl: "",
    referenceImageUrls: [],
    tags,
    author: "",
    sourceUrl: SOURCE_URL,
    createdAt: new Date().toISOString().slice(0, 10),
    imageMode: mode,
    imageModel: args.model ?? "gpt-image-2",
  };

  // 先校验「加上新记录之后」的整体，避免写坏文件
  const candidate = [...list, record];
  const problems = validate(candidate);
  if (problems.length) {
    say(C.bad("❌ 新记录未通过校验，文件未改动："));
    problems.forEach((p) => say("   • " + p));
    process.exit(1);
  }

  savePrompts(candidate);
  say(C.ok("✅ 已写入 prompts.json"));
  say(`   id    : ${record.id}`);
  say(`   title : ${record.title}`);
  say(`   mode  : ${record.imageMode}    tags: ${record.tags.join(", ")}`);
  say(`   正文  : ${record.prompt.length} 字符`);
  say(`   备份  : prompts.json.bak`);
  say(`   总数  : ${candidate.length} 条`);

  if (args["no-push"]) return say(C.warn("\n（--no-push：跳过提交推送）"));

  say("\n→ git 提交推送…");
  if (!runGit(["add", "-A"])) die("git add 失败");
  const okCommit =
    runGit(["-c", "user.name=1552407461", "-c", "user.email=1552407461@users.noreply.github.com",
            "commit", "-m", `add: ${title}`]) ||
    spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: DIR }).status === 0;
  if (!okCommit) die("git commit 失败");
  if (!runGit(["push"])) die("git push 失败（检查网络或凭据）");
  say(C.ok("✅ 推送成功"));

  if (!args["no-verify"]) await cmdVerify();
}

async function cmdDelete(args) {
  const id = args.delete;
  if (!id) die("用法：node add-prompt.mjs --delete <id>");
  const list = loadPrompts();
  const hit = list.find((p) => p.id === id || p.id === `${SOURCE_ID}:${id}`);
  if (!hit) die(`没找到 id 为 "${id}" 的提示词（可先 --list 查看）`);

  const rest = list.filter((p) => p !== hit);
  savePrompts(rest);
  say(C.ok(`✅ 已删除「${hit.title}」`));
  say(`   剩余 ${rest.length} 条`);

  if (args["no-push"]) return say(C.warn("（--no-push：跳过提交推送）"));
  say("\n→ git 提交推送…");
  runGit(["add", "-A"]);
  runGit(["-c", "user.name=1552407461", "-c", "user.email=1552407461@users.noreply.github.com",
          "commit", "-m", `remove: ${hit.title}`]);
  if (!runGit(["push"])) die("git push 失败");
  say(C.ok("✅ 推送成功"));
  if (!args["no-verify"]) await cmdVerify();
}

async function cmdVerify() {
  say("\n→ 验证 raw URL（画布实际拉取的地址）…");
  try {
    const res = await fetch(RAW_URL, { headers: { "cache-control": "no-cache" } });
    if (!res.ok) return say(C.bad(`❌ HTTP ${res.status}`));
    const text = await res.text();
    const remote = JSON.parse(text);
    const local = loadPrompts();
    say(`   HTTP 200   远程 ${remote.length} 条 / 本地 ${local.length} 条`);
    let bad = 0;
    for (let i = 0; i < Math.max(remote.length, local.length); i++) {
      if (!remote[i] || !local[i] || remote[i].id !== local[i].id || remote[i].prompt !== local[i].prompt) bad++;
    }
    if (bad) say(C.bad(`   ❌ ${bad} 条不一致（GitHub 可能有 CDN 缓存，稍等再试）`));
    else say(C.ok("   ✅ 远程与本地逐条一致（id + 正文）"));
  } catch (e) {
    say(C.warn(`   ⚠️ 验证失败（不影响推送结果）: ${e.message}`));
  }
}

// ─── 入口 ────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));

say(C.dim(`提示词库: ${FILE}`));

if (args.help || args.h) {
  const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
  say(src.slice(src.indexOf(" * 用法"), src.indexOf(" */")).replace(/^ \* ?/gm, ""));
} else if (args.list) {
  cmdList();
} else if (args.check) {
  cmdCheck();
} else if (args.delete) {
  await cmdDelete(args);
} else if (args.title) {
  await cmdAdd(args);
} else {
  say("");
  say("用法：");
  say('  node add-prompt.mjs --title "标题" --prompt "正文"');
  say('  node add-prompt.mjs --title "标题" --prompt-file 正文.txt --note "备注" --tags "a,b" --mode edit');
  say("  node add-prompt.mjs --list       列出全部");
  say("  node add-prompt.mjs --check      只校验");
  say("  node add-prompt.mjs --delete <id>  删除");
  say("");
  say(C.dim("提示：长文本/多段正文建议用 --prompt-file，避免命令行引号问题"));
}
