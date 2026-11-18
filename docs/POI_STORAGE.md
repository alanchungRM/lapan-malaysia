# Host your own POI search files

The public source does not include the maintainer's Cloudflare account, hosting origin, deployment configuration, or generated POI snapshot. Use your own account and public-data snapshot. The main app's existing hosting and domain do not need to move.

## Prepare the directory

Use Node.js 22 or newer and Python 3. In a separate data-tools environment install `pyarrow` and `shapely`. Obtain an Overture Maps Places GeoParquet snapshot from https://docs.overturemaps.org/guides/places/ and review https://docs.overturemaps.org/attribution/ and the snapshot's source licences.

```sh
python scripts/prepare-malaysia-pois.py places.parquet places-my.json.gz YYYY-MM-DD.RELEASE
python scripts/prepare-poi-index.py places-my.json.gz worker/poi-data.json
node scripts/package-poi-pages.mjs /absolute/path/to/poi-pages-upload
```

Replace the release label with the actual Overture snapshot release. The preparation script keeps Malaysian country-coded places within its documented bounds and applies its source-licence allowlist. Coverage and map points may be incomplete or outdated. Review the generated attribution notice for your own snapshot; retain the required source and licence notices.

The packager writes a local `data/poi-pages-manifest.json`. It also creates `index.html`, `_headers`, attribution, and a versioned directory containing index and record files. Keep their relative paths unchanged. The runtime checks each fetched file against its 2 MB safety bound; the packager rejects larger search-data files.

## Upload to Cloudflare Pages

1. Sign in to your own Cloudflare account.
2. Open Workers & Pages, then Create application and Continue to Pages where shown.
3. Choose the direct asset-upload option. Upload the generated folder, or a ZIP containing its contents at the archive root.
4. Deploy and copy your project's HTTPS `pages.dev` origin. Open the versioned manifest and a data file to confirm that JSON is served correctly.

A dashboard drag-and-drop upload is currently limited to 1,000 files and 25 MiB per file. Check Cloudflare's current limits at https://developers.cloudflare.com/pages/get-started/direct-upload/ before using a larger dataset. Free hosting availability and account usage limits depend on Cloudflare's current terms.

## Configure the app build

Copy `data/poi-pages-origin.example.json` to the ignored local file `data/poi-pages-origin.json` and replace the example origin with your own. Alternatively, set the build-time environment variable:

```sh
LAPAN_POI_PAGES_ORIGIN=https://your-poi-project.pages.dev npm run build
```

Keep the generated manifest available locally during the build. An external build can use that manifest without the raw POI index or record archive. The build validates the origin and manifest; it does not silently fall back to another owner's host. Rebuild and redeploy the app after changing the origin or snapshot. Runtime environment changes alone do not rewrite the compiled POI origin.

Without an external origin, the build uses a locally prepared bundled index if present. Without either configuration or a local index, the optional additional POI directory is empty; the normal Photon search remains available.

## Maintain and verify

Upload the full new versioned snapshot first, then build the app with its matching manifest. Retain older snapshot directories while older app deployments may still reference them. Test several place names and towns, cancellation of the loading dialog, repeated searches, and hosting failures before promoting a deployment.

Only immutable file identifiers are sent to the POI host. Search text and GPS are not included in those file requests. Readers can inspect the app's fetched public data; a public Pages origin is not a credential or access-control boundary. Keep actual account details, credentials, generated hosting configuration and built bundles out of public Git history.

The production homepage and changelog should remain indexable on the canonical app domain. Retain the hostname-based SEO checks and verify `/robots.txt`, `/sitemap.xml`, canonical URLs and response headers after publishing. Private reports, APIs and staging should remain excluded from indexing.
