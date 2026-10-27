# Lapan release policy

Only publish a new public release log and increase the visible application version when Alan explicitly requests a version/log release. Routine improvements may be deployed with the existing visible version. Do not run `npm run release` or modify `web/changelog.json` for those changes.

Record all routine changes in `UNRELEASED.md` until the owner authorizes a release. At that time, curate those records into the public changelog, run `npm run release` exactly once, and clear only the records included in that release. Ordinary builds and deployment retries use `npm run build`.

`package.json` remains the single source of the visible application version. Sites internal deployment version numbers are separate.

## Public changelog

- Before each new release, add a newest-first entry in `web/changelog.json` for the next patch version. Use the Malaysia release date and describe actual user-facing changes, fixes and material limitations. The release script checks that notes match the new version.
- Link historical entries only to verified public GitHub commits. Do not invent older release numbers; group unversioned history as early development.
- Changelog entries must never contain API keys, tokens, passwords, credential values, runtime environment dumps, private account details, personal routes, raw diffs or private deployment metadata. Use curated feature summaries and public commit references only.
- Keep `/changelog` accessible through What’s new, the version badge and About & privacy. Do not add runtime secret access to the changelog renderer.
