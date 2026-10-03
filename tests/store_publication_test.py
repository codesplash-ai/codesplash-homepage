import importlib.util
import io
import json
import pathlib
import struct
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('publication', pathlib.Path(__file__).parents[1] / 'scripts/report-store-publication.py')
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


def crx(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return b'Cr24' + struct.pack('<II', 3, 0) + output.getvalue()


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {'manifest_version': 3, 'version': '1.0.1', 'name': 'Homepage'}
        self.source = {'manifest.json': json.dumps(self.manifest).encode(), 'newtab.js': b'actual source'}
        self.shipped = {**self.source, 'manifest.json': json.dumps({**self.manifest, 'update_url': 'https://clients2.google.com/service/update2/crx'}).encode(), '_metadata/verified_contents.json': b'{}'}

    def test_public_package_matches_source_with_store_injected_metadata(self):
        proof = publication.verify_package(crx(self.shipped), self.source)
        self.assertTrue(proof['published'])
        self.assertEqual(set(proof['sourceFiles']), set(self.source))

    def test_same_version_with_wrong_bytes_cannot_emit_success(self):
        with self.assertRaisesRegex(ValueError, 'differs'):
            publication.verify_package(crx({**self.shipped, 'newtab.js': b'old source'}), self.source)

    def test_same_version_missing_or_additional_application_files_are_rejected(self):
        for files in [{**self.shipped, 'unexpected.js': b'extra'}, {name: data for name, data in self.shipped.items() if name != 'newtab.js'}]:
            with self.assertRaisesRegex(ValueError, 'inventory'):
                publication.verify_package(crx(files), self.source)

    def test_old_public_version_is_pending_and_does_not_report(self):
        files = {**self.shipped, 'manifest.json': json.dumps({**self.manifest, 'version': '1.0.0'}).encode()}
        proof = publication.verify_package(crx(files), self.source)
        self.assertFalse(proof['published'])
        self.assertEqual(proof['publishedVersion'], '1.0.0')
        self.assertFalse(publication.report_shipment('a' * 40, proof, lambda *_: self.fail('Pending publication called GitHub'))['reported'])

    def test_manifest_changes_are_not_hidden_by_a_matching_version(self):
        files = {**self.shipped, 'manifest.json': json.dumps({**self.manifest, 'permissions': ['tabs']}).encode()}
        with self.assertRaisesRegex(ValueError, 'manifest'):
            publication.verify_package(crx(files), self.source)

    def test_non_crx_or_invalid_header_is_rejected(self):
        for data in [b'not a chrome package', b'Cr24' + struct.pack('<II', 3, 999) + b'PK\x03\x04']:
            with self.assertRaises(ValueError):
                publication.verify_package(data, self.source)

    def test_successful_receipt_is_reused_without_another_webhook(self):
        calls = []
        sha = 'a' * 40
        def api(path, payload=None):
            calls.append((path, payload))
            if path.endswith('statuses?per_page=1'):
                return [{'state': 'success'}]
            return [{'id': 12, 'sha': sha, 'payload': {'chromeStoreItemId': publication.ITEM, 'version': '1.0.1'}}]
        result = publication.report_shipment(sha, {'published': True, 'version': '1.0.1', 'packageSha256': 'b' * 64}, api)
        self.assertTrue(result['alreadyReported'])
        self.assertTrue(all(payload is None for _, payload in calls))

    def test_failed_status_write_can_recover_without_a_second_deployment(self):
        calls = []
        sha = 'a' * 40
        def api(path, payload=None):
            calls.append((path, payload))
            if path.endswith('statuses?per_page=1'):
                return [{'state': 'pending'}]
            if payload:
                return {'id': 1}
            return [{'id': 12, 'sha': sha, 'payload': {'chromeStoreItemId': publication.ITEM, 'version': '1.0.1'}}]
        result = publication.report_shipment(sha, {'published': True, 'version': '1.0.1', 'packageSha256': 'b' * 64}, api)
        self.assertFalse(result['alreadyReported'])
        writes = [(path, payload) for path, payload in calls if payload]
        self.assertEqual(len(writes), 1)
        self.assertTrue(writes[0][0].endswith('/12/statuses'))
        self.assertEqual(writes[0][1]['state'], 'success')


if __name__ == '__main__':
    unittest.main()
