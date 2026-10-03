# Verify the public extension and report its shipment

Marketing listens to this repository's successful production deployments. The
`Report verified Chrome publication` workflow compares the current public Chrome
package to the exact selected source, then emits one successful GitHub deployment.
It does not scan other repositories or run on a timer.

For an existing submission, run the workflow with its full source SHA. Validation
is the default and sends no shipment event. Once the Store package is public, run
with `validate_only: false` to report it. A `v*` tag also performs verification and
reporting. If the Store still serves another version, the workflow reports pending
and does not trigger Marketing. Reuse the same source after publication; do not
upload, rebuild or bump the version to recover a reporting failure.

The package comparison checks all application file bytes and the manifest. Only
Chrome's own `_metadata/` files and canonical injected `update_url` are excluded.
A matching version alone is insufficient. Existing successful deployment receipts
are reused, and a failed status write can recover on the same deployment.

Local validation without GitHub writes:

```sh
python3 scripts/report-store-publication.py --source-sha FULL_SHA --validate-only --output /tmp/homepage-publication-proof.json
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p '*_test.py'
```

This workflow does not submit new packages to the Chrome Store or bypass review.
Automatic Store submission still requires a Chrome Web Store publishing OAuth
connection. A review that completes after the tag verification needs the explicit
reporting invocation above; no hidden Store or GitHub polling is introduced.
