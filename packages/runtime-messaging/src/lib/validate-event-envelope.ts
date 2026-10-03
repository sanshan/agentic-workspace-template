import type { AnyEventEnvelope } from '@event-driven-platform/event';

import type { EventValidationIssue, EventValidationResult } from './event-validation.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(
    issues: EventValidationIssue[],
    path: readonly string[],
    message: string,
): void {
    issues.push({ path, message });
}

function expectRecord(
    value: unknown,
    path: readonly string[],
    issues: EventValidationIssue[],
): UnknownRecord | undefined {
    if (!isRecord(value)) {
        addIssue(issues, path, 'Expected an object.');
        return undefined;
    }

    return value;
}

function expectString(
    record: UnknownRecord,
    key: string,
    path: readonly string[],
    issues: EventValidationIssue[],
): void {
    if (typeof record[key] !== 'string') {
        addIssue(issues, [...path, key], 'Expected a string.');
    }
}

function expectNumber(
    record: UnknownRecord,
    key: string,
    path: readonly string[],
    issues: EventValidationIssue[],
): void {
    if (typeof record[key] !== 'number') {
        addIssue(issues, [...path, key], 'Expected a number.');
    }
}

function expectNullableString(
    record: UnknownRecord,
    key: string,
    path: readonly string[],
    issues: EventValidationIssue[],
): void {
    const value = record[key];

    if (value !== null && typeof value !== 'string') {
        addIssue(issues, [...path, key], 'Expected a string or null.');
    }
}

function expectNullableNumber(
    record: UnknownRecord,
    key: string,
    path: readonly string[],
    issues: EventValidationIssue[],
): void {
    const value = record[key];

    if (value !== null && typeof value !== 'number') {
        addIssue(issues, [...path, key], 'Expected a number or null.');
    }
}

function validateReference(
    value: unknown,
    path: readonly string[],
    issues: EventValidationIssue[],
): void {
    const reference = expectRecord(value, path, issues);

    if (reference === undefined) {
        return;
    }

    expectString(reference, 'type', path, issues);
    expectString(reference, 'id', path, issues);
}

function validateActor(value: unknown, issues: EventValidationIssue[]): void {
    const actorPath = ['actor'] as const;
    const actor = expectRecord(value, actorPath, issues);

    if (actor === undefined) {
        return;
    }

    expectString(actor, 'type', actorPath, issues);
    expectString(actor, 'id', actorPath, issues);

    const originPath = ['actor', 'origin'] as const;
    const origin = expectRecord(actor['origin'], originPath, issues);

    if (origin === undefined) {
        return;
    }

    for (const key of [
        'ipAddress',
        'countryCode',
        'region',
        'city',
        'timezone',
        'environment',
        'host',
        'instance',
    ] as const) {
        expectNullableString(origin, key, originPath, issues);
    }

    expectNullableNumber(origin, 'latitude', originPath, issues);
    expectNullableNumber(origin, 'longitude', originPath, issues);
}

export function validateEventEnvelope(input: unknown): EventValidationResult<AnyEventEnvelope> {
    const issues: EventValidationIssue[] = [];
    const envelope = expectRecord(input, [], issues);

    if (envelope === undefined) {
        return {
            status: 'invalid',
            failure: {
                kind: 'event-validation',
                issues,
            },
        };
    }

    for (const key of [
        'eventId',
        'eventName',
        'occurredAt',
        'intentId',
        'correlationId',
        'operationName',
    ] as const) {
        expectString(envelope, key, [], issues);
    }

    expectNumber(envelope, 'schemaVersion', [], issues);
    validateReference(envelope['tenant'], ['tenant'], issues);
    validateActor(envelope['actor'], issues);
    validateReference(envelope['subject'], ['subject'], issues);
    validateReference(envelope['aggregate'], ['aggregate'], issues);

    if (!('payload' in envelope)) {
        addIssue(issues, ['payload'], 'Expected the payload field to be present.');
    }

    if (issues.length > 0) {
        return {
            status: 'invalid',
            failure: {
                kind: 'event-validation',
                issues,
            },
        };
    }

    return {
        status: 'valid',
        value: input as AnyEventEnvelope,
    };
}
