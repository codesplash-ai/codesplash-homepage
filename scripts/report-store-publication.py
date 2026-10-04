#!/usr/bin/env python3
"""Verify one source revision against the live Chrome package, then report it.

No schedule, repository scan, upload, rebuild or publication retry. The successful
GitHub deployment is the event consumed by the existing Marketing webhook.
"""
import argparse
import hashlib
import io
import json
import os
import pathlib
import re
import struct
import subprocess
import urllib.parse
import urllib.request
import zipfile

REPO = 'codesplash-ai/codesplash-homepage'
ITEM = 'bkgdbigpcjfeilehkieiocfoaebjcfdj'
STORE_URL = f'https://chromewebstore.google.com/detail/{ITEM}'
ROOT_FILES = {'manifest.json', 'background.js', 'newtab.html', 'newtab.js', 'popup.html', 'popup.js', 'storage-manager.js'}
MAX_BYTES = 64 * 1024 * 1024


def run(command, args, payload=None):
    return subprocess.check_output([command, *args], input=json.dumps(payload) if payload is not None else None, text=True, timeout=30).strip()


def source_files(sha):
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Exact source SHA required')
    names = run('git', ['ls-tree', '-r', '--name-only', sha]).splitlines()
    selected = [name for name in names if name in ROOT_FILES or name == 'theme.css' or name.startswith(('icons/', 'backgrounds/'))]
    if not ROOT_FILES.issubset(selected):
        raise ValueError('Source does not contain the complete Homepage package')
    return {name: subprocess.check_output(['git', 'show', f'{sha}:{name}'], timeout=30) for name in selected}


def verify_package(data, expected):
    if len(data) > MAX_BYTES or len(data) < 12 or data[:4] != b'Cr24':
        raise ValueError('Expected the original Chrome CRX3 package')
    version, header_size = struct.unpack('<II', data[4:12])
    if version != 3 or header_size > len(data) - 12 or data[12 + header_size:16 + header_size] != b'PK\x03\x04':
        raise ValueError('Invalid Chrome CRX3 header')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries if not entry.is_dir()]
        if len(names) != len(set(names)) or sum(entry.file_size for entry in entries) > MAX_BYTES:
            raise ValueError('Invalid or oversized Chrome package')
        packaged = {name for name in names if not name.startswith('_metadata/')}
        actual_manifest = json.loads(archive.read('manifest.json'))
        expected_manifest = json.loads(expected['manifest.json'])
        if actual_manifest.get('version') != expected_manifest.get('version'):
            return {'published': False, 'expectedVersion': expected_manifest.get('version'), 'publishedVersion': actual_manifest.get('version')}
        # Chrome injects its own update endpoint into the original manifest.
        update_url = actual_manifest.pop('update_url', None)
        if update_url not in (None, 'https://clients2.google.com/service/update2/crx'):
            raise ValueError('Unexpected Chrome package update endpoint')
        if actual_manifest != expected_manifest or packaged != set(expected):
            raise ValueError('Published package manifest/file inventory differs from the selected source')
        hashes = {}
        for name, original in expected.items():
            if name != 'manifest.json' and archive.read(name) != original:
                raise ValueError(f'Published file differs from the selected source: {name}')
            hashes[name] = hashlib.sha256(original).hexdigest()
    return {'published': True, 'version': expected_manifest['version'], 'packageSha256': hashlib.sha256(data).hexdigest(), 'sourceFiles': hashes}


def report_shipment(sha, proof, api):
    if proof.get('published') is not True:
        return {'reported': False, 'reason': 'Selected source is not the current public package'}
    base = f'repos/{REPO}/deployments'
    receipts = api(f'{base}?sha={sha}&environment=production&per_page=100')
    if not isinstance(receipts, list):
        raise ValueError('Invalid GitHub deployment lookup')
    receipt = next((item for item in receipts if item.get('sha') == sha and item.get('payload', {}).get('chromeStoreItemId') == ITEM and item.get('payload', {}).get('version') == proof['version']), None)
    if receipt:
        statuses = api(f"{base}/{receipt['id']}/statuses?per_page=1")
        if not isinstance(statuses, list):
            raise ValueError('Invalid GitHub deployment status lookup')
        if statuses and statuses[0].get('state') == 'success':
            return {'reported': True, 'alreadyReported': True, 'deploymentId': receipt['id']}
    else:
        receipt = api(base, {'ref': sha, 'environment': 'production', 'auto_merge': False, 'required_contexts': [], 'production_environment': True,
                             'description': 'Verified public Chrome package matches exact Homepage source',
                             'payload': {'chromeStoreItemId': ITEM, 'version': proof['version'], 'packageSha256': proof['packageSha256']}})
    if not isinstance(receipt.get('id'), int):
        raise ValueError('Invalid GitHub deployment identity')
    api(f"{base}/{receipt['id']}/statuses", {'state': 'success', 'environment_url': STORE_URL,
                                            'description': 'Public Chrome package verified against original source files', 'auto_inactive': True})
    return {'reported': True, 'alreadyReported': False, 'deploymentId': receipt['id']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--crx', help='Previously downloaded public package; accepted only for local validation')
    parser.add_argument('--output', default='publication-proof.json')
    args = parser.parse_args()
    if args.crx and not args.validate_only:
        parser.error('--crx is local validation only; shipment reporting always fetches the current public package')
    expected = source_files(args.source_sha)
    if args.crx:
        data = pathlib.Path(args.crx).read_bytes()
    else:
        query = urllib.parse.urlencode({'response': 'redirect', 'prodversion': '144.0.0.0', 'acceptformat': 'crx3', 'x': f'id={ITEM}&installsource=ondemand&uc'})
        with urllib.request.urlopen(f'https://clients2.google.com/service/update2/crx?{query}', timeout=45) as response:
            data = response.read(MAX_BYTES + 1)
    proof = {'product': 'homepage', 'sourceSha': args.source_sha, 'storeUrl': STORE_URL, **verify_package(data, expected)}
    pathlib.Path(args.output).write_text(json.dumps(proof, indent=2) + '\n')
    if not args.validate_only:
        def api(path, payload=None):
            return json.loads(run('gh', ['api', path, *(['--method', 'POST', '--input', '-'] if payload is not None else [])], payload))
        proof.update(report_shipment(args.source_sha, proof, api))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f"published={str(proof['published']).lower()}\n")
    print(json.dumps({key: value for key, value in proof.items() if key != 'sourceFiles'}))


if __name__ == '__main__':
    main()
