// Picks the release a run of .github/workflows/release.yml publishes.
// A push to main ships the next beta; a pushed stable tag ships that tag.
// Run directly, it prints GitHub step outputs: tag, version, prerelease, notes_start.

const RELEASE_TAG = /^v\d+\.\d+\.\d+(-beta\.\d+)?$/;
const STABLE_TAG = /^v\d+\.\d+\.\d+$/;

export type Release = {
  tag: string;
  version: string;
  prerelease: boolean;
  // The tag GitHub's generated notes start from, or null for the first release.
  notesStart: string | null;
};

const byVersion = (a: string, b: string) => Bun.semver.order(a.slice(1), b.slice(1));

export function resolveRelease(input: {
  ref: string;
  packageVersion: string;
  tags: readonly string[];
  runNumber: number;
}): Release {
  const releases = input.tags.filter((tag) => RELEASE_TAG.test(tag)).sort(byVersion);
  const stables = releases.filter((tag) => STABLE_TAG.test(tag));
  const tag = input.ref.startsWith("refs/tags/")
    ? input.ref.slice("refs/tags/".length)
    : `v${nextCore(input.packageVersion, stables.at(-1))}-beta.${input.runNumber}`;
  if (!RELEASE_TAG.test(tag)) throw new Error(`${tag} is not vX.Y.Z or vX.Y.Z-beta.N`);

  const prerelease = tag.includes("-");
  // Beta notes list what changed since the previous build; stable notes, since the previous stable.
  const earlier = (prerelease ? releases : stables).filter((other) => byVersion(other, tag) < 0);
  return { tag, version: tag.slice(1), prerelease, notesStart: earlier.at(-1) ?? null };
}

// The package version, or the patch after the latest stable once that version has shipped.
function nextCore(packageVersion: string, latestStable: string | undefined): string {
  const core = packageVersion.split("-")[0] ?? packageVersion;
  if (!latestStable || Bun.semver.order(core, latestStable.slice(1)) > 0) return core;
  const [major, minor, patch] = latestStable.slice(1).split(".").map(Number);
  return `${major}.${minor}.${(patch ?? 0) + 1}`;
}

if (import.meta.main) {
  // Only tags this commit contains count, so rerunning an older commit's build keeps its version.
  const tags = (await Bun.$`git tag --list ${"v*"} --merged HEAD`.text()).split("\n").filter(Boolean);
  const { version } = (await Bun.file(new URL("../apps/desktop/package.json", import.meta.url)).json()) as {
    version: string;
  };
  const release = resolveRelease({
    ref: Bun.env.GITHUB_REF ?? "",
    packageVersion: version,
    tags,
    runNumber: Number(Bun.env.GITHUB_RUN_NUMBER),
  });
  console.log(
    [
      `tag=${release.tag}`,
      `version=${release.version}`,
      `prerelease=${release.prerelease}`,
      `notes_start=${release.notesStart ?? ""}`,
    ].join("\n"),
  );
}
