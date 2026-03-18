import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type {
  ClawHubCatalogItem,
  ClawHubCatalogResponse,
  OpenClawSkillRecord,
  OpenClawSkillsSnapshot,
  SkillInstallResult
} from "../../../../packages/shared/src/index";

const execFileAsync = promisify(execFile);

export const listOpenClawSkills = async (): Promise<OpenClawSkillsSnapshot> => {
  const { stdout, stderr } = await execFileAsync("openclaw", ["skills", "list", "--json"]);
  const raw = parseJsonObject(`${stdout}\n${stderr}`);

  return normalizeOpenClawSkills(raw);
};

export const searchSkillCatalog = async (
  query: string,
  limit = 8
): Promise<ClawHubCatalogResponse> => {
  const skills = await listOpenClawSkills();
  const installedNames = new Set(skills.skills.map((skill) => skill.name));

  const { stdout } = await execFileAsync("clawhub", [
    "search",
    query,
    "--limit",
    String(limit)
  ]);

  const candidates = parseClawHubSearchOutput(stdout);

  const items = await Promise.all(
    candidates.map(async (candidate) => {
      const detail = await inspectClawHubSkill(candidate.slug);
      return {
        ...detail,
        score: candidate.score,
        installed: installedNames.has(candidate.slug)
      } satisfies ClawHubCatalogItem;
    })
  );

  return {
    query,
    items
  };
};

export const installSkillFromCatalog = async (
  slug: string,
  version?: string
): Promise<SkillInstallResult> => {
  const skills = await listOpenClawSkills();
  const managedSkillsDir = skills.managedSkillsDir;
  const workdir = path.dirname(managedSkillsDir);
  const dir = path.basename(managedSkillsDir);

  const args = ["--workdir", workdir, "--dir", dir, "--no-input", "install", slug];
  if (version) {
    args.push("--version", version);
  }

  await execFileAsync("clawhub", args);

  return {
    ok: true,
    slug,
    version: version ?? null,
    managedSkillsDir,
    installPath: path.join(managedSkillsDir, slug),
    message: `Installed ${slug} into ${managedSkillsDir}.`
  };
};

export const parseClawHubSearchOutput = (output: string) =>
  output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("- "))
    .map((line) => {
      const match =
        line.match(/^(?<slug>\S+)\s{2,}(?<displayName>.+?)\s{2,}\((?<score>[0-9.]+)\)$/u) ??
        line.match(/^(?<slug>\S+)\s+(?<displayName>.+?)\s+\((?<score>[0-9.]+)\)$/u);

      if (!match?.groups) {
        return null;
      }

      return {
        slug: match.groups.slug,
        displayName: match.groups.displayName,
        score: Number(match.groups.score)
      };
    })
    .filter(
      (
        item
      ): item is {
        slug: string;
        displayName: string;
        score: number;
      } => item !== null
    );

const inspectClawHubSkill = async (slug: string): Promise<ClawHubCatalogItem> => {
  const { stdout } = await execFileAsync("clawhub", ["inspect", slug, "--json"]);
  const raw = parseJsonObject(stdout);
  const skill = asRecord(raw.skill);
  const latestVersion = asRecord(raw.latestVersion);
  const owner = asRecord(raw.owner);
  const stats = asRecord(skill.stats);

  return {
    slug,
    displayName:
      typeof skill.displayName === "string"
        ? skill.displayName
        : typeof skill.slug === "string"
          ? skill.slug
          : slug,
    summary: typeof skill.summary === "string" ? skill.summary : "No summary provided.",
    latestVersion:
      typeof latestVersion.version === "string" ? latestVersion.version : null,
    ownerHandle: typeof owner.handle === "string" ? owner.handle : null,
    updatedAt:
      typeof skill.updatedAt === "number"
        ? new Date(skill.updatedAt).toISOString()
        : null,
    downloads: numberOrNull(stats.downloads),
    installsCurrent: numberOrNull(stats.installsCurrent),
    installsAllTime: numberOrNull(stats.installsAllTime),
    stars: numberOrNull(stats.stars),
    score: null,
    installed: false
  };
};

const normalizeOpenClawSkills = (
  raw: Record<string, unknown>
): OpenClawSkillsSnapshot => ({
  workspaceDir:
    typeof raw.workspaceDir === "string" ? raw.workspaceDir : path.join(process.env.HOME ?? "", ".openclaw", "workspace"),
  managedSkillsDir:
    typeof raw.managedSkillsDir === "string"
      ? raw.managedSkillsDir
      : path.join(process.env.HOME ?? "", ".openclaw", "skills"),
  skills: Array.isArray(raw.skills)
    ? raw.skills.map((skill) => normalizeOpenClawSkill(asRecord(skill)))
    : []
});

const normalizeOpenClawSkill = (
  skill: Record<string, unknown>
): OpenClawSkillRecord => ({
  name: typeof skill.name === "string" ? skill.name : "unknown",
  description: typeof skill.description === "string" ? skill.description : "",
  emoji: typeof skill.emoji === "string" ? skill.emoji : undefined,
  eligible: Boolean(skill.eligible),
  disabled: Boolean(skill.disabled),
  blockedByAllowlist: Boolean(skill.blockedByAllowlist),
  source: typeof skill.source === "string" ? skill.source : "unknown",
  bundled: Boolean(skill.bundled),
  homepage: typeof skill.homepage === "string" ? skill.homepage : undefined,
  primaryEnv: typeof skill.primaryEnv === "string" ? skill.primaryEnv : undefined,
  missing: normalizeMissing(asRecord(skill.missing))
});

const normalizeMissing = (missing: Record<string, unknown>) => ({
  bins: toStringArray(missing.bins),
  anyBins: toStringArray(missing.anyBins),
  env: toStringArray(missing.env),
  config: toStringArray(missing.config),
  os: toStringArray(missing.os)
});

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const parseJsonObject = (value: string) => {
  const trimmed = value.trim();
  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Command output did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(startIndex, endIndex + 1)) as Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);
