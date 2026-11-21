#!/usr/bin/env bash
set -euo pipefail

# Prints the Docker tags to publish for a release tag, one per line (exact tag first).
# Prereleases only get their exact tag; 0.x releases omit the major tag because SemVer
# 0.x allows breaking changes in minor bumps.

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "Usage: $0 <release-tag>" >&2
  exit 1
fi

tag="$1"
semver_re='^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'

if [[ "$tag" == *$'\n'* ]] || [[ ! "$tag" =~ $semver_re ]]; then
  echo "Invalid release tag: $tag" >&2
  exit 1
fi

major="${BASH_REMATCH[1]}"
minor="${BASH_REMATCH[2]}"
patch="${BASH_REMATCH[3]}"
prerelease="${BASH_REMATCH[4]:-}"
version="${major}.${minor}.${patch}${prerelease}"

printf '%s\n' "$version"

if [ -n "$prerelease" ]; then
  exit 0
fi

printf '%s.%s\n' "$major" "$minor"

if [ "$major" != "0" ]; then
  printf '%s\n' "$major"
fi

printf '%s\n' "latest"
