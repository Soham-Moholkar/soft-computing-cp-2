import assert from 'node:assert/strict';
import test from 'node:test';
import { extractRequirements } from '../lib/policy/extract-requirements.js';

test('extracts evidence verbatim with cross-line context and original locators', () => {
  const input = [
    'Eligibility:',
    'Applicants must be aged 18 or older AND',
    'reside in Maharashtra.',
    'Exclusions:',
    '- Current recipients are ineligible unless',
    '  they apply under the renewal route.',
    'Documents required:',
    '- Submit proof of age OR a birth certificate.',
    'How to apply:',
    'Apply through the district office.',
    'Benefits',
    'The programme pays ₹500.',
  ].join('\r\n');
  const findings = extractRequirements(input);

  assert.deepEqual(
    findings.map((item) => item.group),
    [
      'eligibility',
      'eligibility',
      'exclusions',
      'exclusions',
      'documents',
      'steps',
    ],
  );
  assert.equal(findings[0].passage, 'Applicants must be aged 18 or older AND');
  assert.match(findings[0].sourceContext ?? '', /AND\nreside in Maharashtra/);
  assert.equal(findings[2].locator, 'Exclusions · Line 5');
  assert.equal(findings[3].passage, '  they apply under the renewal route.');
  assert.match(findings[2].sourceContext ?? '', /unless\n  they apply/);
  assert.match(findings[4].passage, /OR a birth certificate/);
  assert.ok(findings.every((item) => item.line < 11));
});

test('handles unheaded text, empty input, and bounds', () => {
  assert.deepEqual(extractRequirements('Overview\nThere is a programme.'), []);
  assert.deepEqual(extractRequirements('    '), []);
  const [item] = extractRequirements(
    'Applicants must be enrolled at a college.\nAsk the district office for details.',
  );
  assert.equal(item.locator, 'Line 1');
  assert.match(item.sourceContext ?? '', /Ask the district office/);
  assert.throws(() => extractRequirements('x'.repeat(60_001)), /60,000/);
  assert.throws(
    () => extractRequirements('Eligibility:\n' + '- Resident\n'.repeat(201)),
    /200 possible/,
  );
});
