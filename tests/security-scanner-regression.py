"""Verify assessed historical fingerprints do not suppress new credentials.

Run with the same pinned gitleaks 8.30.1 executable used by CI:
    python tests/security-scanner-regression.py /path/to/gitleaks
Only synthetic, nonfunctional fixture values are generated.
"""
import json
from pathlib import Path
import random
import string
import subprocess
import sys
import tempfile


scanner = Path(sys.argv[1]).resolve()
ignore = Path(__file__).resolve().parents[1] / '.gitleaksignore'
with tempfile.TemporaryDirectory(prefix='pc-scan-regression-') as directory:
    root = Path(directory)
    target = root / 'Project-Check-MVP-Master-Build' / 'platform-config.js'
    target.parent.mkdir()
    rng = random.Random(42)
    suffix = ''.join(rng.choice(string.ascii_letters + string.digits) for _ in range(48))
    # Neither value is issued by Supabase. A new publishable-key occurrence
    # must also remain flagged: the exception applies to assessed history only.
    target.write_text('const api_key = "sb_secret_' + suffix + '";\n'
                      'const another_api_key = "sb_publishable_' + suffix + '";\n')
    for args in (['init', '-q'], ['add', '.'],
                 ['-c', 'user.name=Scanner fixture', '-c',
                  'user.email=fixture@example.invalid', 'commit', '-qm',
                  'Synthetic scanner regression fixture']):
        subprocess.run(['git', '-C', directory, *args], check=True, capture_output=True)
    report = root / 'redacted-report.json'
    result = subprocess.run([str(scanner), 'detect', '--source', directory,
                             '--gitleaks-ignore-path', str(ignore), '--no-banner',
                             '--redact', '--report-format', 'json', '--report-path',
                             str(report)], capture_output=True, text=True)
    findings = json.loads(report.read_text())
    assert result.returncode == 1, 'New findings were incorrectly accepted'
    assert {finding['StartLine'] for finding in findings} == {1, 2}
    assert all(finding['RuleID'] == 'generic-api-key' for finding in findings)
    print('PASS: synthetic server secret and new browser-key occurrence remain detected')
