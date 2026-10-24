# Lapan release policy

The owner requires a higher visible website version for every new production release.

- `package.json` is the single source of the application version. The build replaces `{{APP_VERSION}}` in the HTML using this value.
- After completing changes and before packaging a new production release, run `npm run release` exactly once. It increments the patch version and builds the release (for example, 1.0.9 → 1.0.10).
- A normal build, QA build, archive rebuild, or retry of the same release must use `npm run build`; do not increment again for a failed or retried deployment.
- Commit/push the incremented package version with the changes. Deploy the matching built archive and update the public GitHub source.
- Report the application version to the owner when announcing a release. Sites' internal saved-version sequence is separate from the application's version.

## Public changelog

- Before each new release, add a newest-first entry in `web/changelog.json` for the next patch version. Use the Malaysia release date and describe actual user-facing changes, fixes and material limitations. The release script checks that notes match the new version.
- Link historical entries only to verified public GitHub commits. Do not invent older release numbers; group unversioned history as early development.
- Changelog entries must never contain API keys, tokens, passwords, credential values, runtime environment dumps, private account details, personal routes, raw diffs or private deployment metadata. Use curated feature summaries and public commit references only.
- Keep `/changelog` accessible through What’s new, the version badge and About & privacy. Do not add runtime secret access to the changelog renderer.
