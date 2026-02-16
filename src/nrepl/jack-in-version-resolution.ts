import * as semver from 'semver';

export type JackInLatestVersionInfo = {
  stable?: string;
  prerelease?: string;
};

const SEMVER_OPTIONS: semver.Options = { loose: true };
const PRERELEASE_TOKEN_REGEX =
  /(?:^|[-.])(alpha|beta|rc|snapshot|preview|pre|m\d*|ea|cr)(?:[-.\d]|$)/i;

function parseVersion(version: string): semver.SemVer | null {
  return semver.parse(version, SEMVER_OPTIONS);
}

function isSemverPrerelease(version: string): boolean | undefined {
  const parsed = parseVersion(version);
  if (!parsed) {
    return undefined;
  }
  return parsed.prerelease.length > 0;
}

export function isPrereleaseVersion(version: string): boolean {
  const semverPrerelease = isSemverPrerelease(version);
  if (typeof semverPrerelease === 'boolean') {
    return semverPrerelease;
  }
  return PRERELEASE_TOKEN_REGEX.test(version);
}

function compareVersionsDescending(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (parsedA && parsedB) {
    return -semver.compare(parsedA, parsedB);
  }
  if (parsedA) {
    return -1;
  }
  if (parsedB) {
    return 1;
  }

  return b.localeCompare(a);
}

export function selectLatestStableAndPrerelease(versions: string[]): JackInLatestVersionInfo {
  const candidates = Array.from(
    new Set(versions.map((value) => value.trim()).filter((value) => value.length > 0))
  ).sort(compareVersionsDescending);

  const stable = candidates.find((version) => !isPrereleaseVersion(version));
  const prerelease = candidates.find((version) => isPrereleaseVersion(version));

  return { stable, prerelease };
}
