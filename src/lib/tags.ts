const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

/**
 * Validate that a ref looks like a semver release tag (e.g. v1.2.3).
 */
export function isValidTag(tag: string): boolean {
  return TAG_PATTERN.test(tag);
}
