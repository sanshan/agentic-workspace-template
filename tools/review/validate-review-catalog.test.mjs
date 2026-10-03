import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';

import { validateReviewCatalog } from './validate-review-catalog.mjs';

const temporaryDirectories = [];

const validRule = {
    id: 'PRR-001',
    title: 'Keep one bounded rule',
    scope: 'Code-changing pull requests.',
    applies_when: 'The changed code enters the governed boundary.',
    violation: 'The changed code crosses the declared boundary.',
    non_violation: 'Adjacent code that remains outside the boundary is allowed.',
    severity: 'blocking',
    evidence: 'Cite the changed location and the crossed boundary.',
    canonical_source: 'AGENTS.md#change-discipline',
};

const validCalibration = {
    rule_id: 'PRR-001',
    cases: [
        {
            id: 'known-violation',
            expected: 'violation',
            context: 'The governed boundary applies.',
            diff: '+crossBoundary();',
        },
        {
            id: 'known-boundary',
            expected: 'no-violation',
            context: 'The adjacent behavior remains outside the boundary.',
            diff: '+stayWithinBoundary();',
        },
    ],
};

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

async function createFixture({
    rule = validRule,
    calibration = validCalibration,
    ruleFilename = 'PRR-001.json',
    calibrationFilename = 'PRR-001.json',
    extraRules = [],
} = {}) {
    const root = await mkdtemp(resolve(tmpdir(), 'agentic-workspace-review-catalog-'));
    temporaryDirectories.push(root);

    const rulesDirectory = resolve(root, 'docs/review/rules');
    const calibrationDirectory = resolve(root, 'docs/review/calibration');
    await mkdir(rulesDirectory, { recursive: true });
    await mkdir(calibrationDirectory, { recursive: true });
    await writeFile(resolve(root, 'AGENTS.md'), '# Rules\n', 'utf8');
    await writeFile(resolve(rulesDirectory, ruleFilename), JSON.stringify(rule), 'utf8');
    await writeFile(
        resolve(calibrationDirectory, calibrationFilename),
        JSON.stringify(calibration),
        'utf8',
    );

    for (const [index, extraRule] of extraRules.entries()) {
        await writeFile(
            resolve(rulesDirectory, `PRR-${String(index + 2).padStart(3, '0')}.json`),
            JSON.stringify(extraRule),
            'utf8',
        );
    }

    return root;
}

test('accepts a valid blocking rule with violation and boundary calibration', async () => {
    const root = await createFixture();

    await assert.doesNotReject(validateReviewCatalog(root));
});

test('does not mechanically resolve canonical-source fragments', async () => {
    const root = await createFixture({
        rule: {
            ...validRule,
            canonical_source: 'AGENTS.md#section-that-does-not-exist',
        },
    });

    await assert.doesNotReject(validateReviewCatalog(root));
});

test('rejects malformed JSON', async () => {
    const root = await createFixture();
    await writeFile(resolve(root, 'docs/review/rules/PRR-001.json'), '{', 'utf8');

    await assert.rejects(validateReviewCatalog(root), /not valid JSON/);
});

test('rejects missing required fields', async () => {
    const rule = structuredClone(validRule);
    delete rule.evidence;
    const root = await createFixture({ rule });

    await assert.rejects(validateReviewCatalog(root), /missing required fields: evidence/);
});

test('rejects unexpected rule fields', async () => {
    const root = await createFixture({ rule: { ...validRule, prompt: 'hidden policy' } });

    await assert.rejects(validateReviewCatalog(root), /unexpected fields: prompt/);
});

for (const field of ['scope', 'applies_when', 'violation', 'non_violation', 'evidence']) {
    test(`rejects an empty ${field} field`, async () => {
        const root = await createFixture({ rule: { ...validRule, [field]: '   ' } });

        await assert.rejects(
            validateReviewCatalog(root),
            new RegExp(`${field} must be a non-empty string`),
        );
    });
}

test('rejects duplicate rule ids', async () => {
    const root = await createFixture({ extraRules: [structuredClone(validRule)] });

    await assert.rejects(validateReviewCatalog(root), /duplicate id: PRR-001/);
});

test('rejects a rule filename that does not match its id', async () => {
    const root = await createFixture({ ruleFilename: 'PRR-002.json' });

    await assert.rejects(validateReviewCatalog(root), /must be named PRR-001.json/);
});

test('rejects invalid severity values', async () => {
    const root = await createFixture({ rule: { ...validRule, severity: 'critical' } });

    await assert.rejects(validateReviewCatalog(root), /severity must be one of/);
});

test('rejects invalid calibration decisions', async () => {
    const calibration = structuredClone(validCalibration);
    calibration.cases[0].expected = 'pass';
    const root = await createFixture({ calibration });

    await assert.rejects(validateReviewCatalog(root), /expected must be one of/);
});

test('rejects missing canonical source files', async () => {
    const root = await createFixture({
        rule: { ...validRule, canonical_source: 'docs/missing.md#rule' },
    });

    await assert.rejects(validateReviewCatalog(root), /missing repository file/);
});

test('rejects blocking rules without boundary calibration', async () => {
    const calibration = {
        ...validCalibration,
        cases: [validCalibration.cases[0]],
    };
    const root = await createFixture({ calibration });

    await assert.rejects(validateReviewCatalog(root), /must have a no-violation or not-applicable/);
});

test('rejects blocking rules without known-violation calibration', async () => {
    const calibration = {
        ...validCalibration,
        cases: [validCalibration.cases[1]],
    };
    const root = await createFixture({ calibration });

    await assert.rejects(validateReviewCatalog(root), /must have a known violation case/);
});
