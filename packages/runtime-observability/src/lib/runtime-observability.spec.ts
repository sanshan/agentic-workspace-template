import { Writable } from 'node:stream';

import { ExecutionFailureError } from '@event-driven-platform/execution';
import pino, { type Logger } from 'pino';

import { serializeRuntimeError } from './runtime-error.serializer.js';
import { createRuntimePinoOptions } from './runtime-pino-options.js';

function captureSingleLog(writeLog: (logger: Logger) => void) {
    let output = '';
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
        },
    });
    const logger = pino(
        createRuntimePinoOptions({
            service: {
                name: 'test-service',
                version: '1.2.3',
                environment: 'test',
            },
        }),
        stream,
    );

    writeLog(logger);

    return JSON.parse(output.trim()) as Record<string, unknown>;
}

describe('runtime observability logging', () => {
    it('serializes classified EDP failures with diagnostics and cause', () => {
        const cause = new Error('database connection failed');
        const error = new ExecutionFailureError(
            {
                code: 'persistence-transient-error',
                message: 'Transient persistence failure.',
                retryable: true,
            },
            { cause },
        );

        const serialized = serializeRuntimeError(error);

        expect(serialized.type).toBe('ExecutionFailureError');
        expect(serialized.message).toBe('Transient persistence failure.');
        expect(serialized.stack).toContain('ExecutionFailureError');
        expect(serialized.executionFailure).toEqual({
            code: 'persistence-transient-error',
            retryable: true,
        });
        expect(serialized.cause).toMatchObject({
            type: 'Error',
            message: 'database connection failed',
        });
    });

    it('keeps unknown errors diagnostic without inventing failure classification', () => {
        const serialized = serializeRuntimeError(new TypeError('unexpected value'));

        expect(serialized).toMatchObject({
            type: 'TypeError',
            message: 'unexpected value',
        });
        expect(serialized.stack).toContain('TypeError');
        expect(serialized).not.toHaveProperty('executionFailure');
    });

    it('does not serialize arbitrary non-Error cause objects', () => {
        const error = new Error('outer failure', {
            cause: {
                token: 'must-not-appear',
                payload: 'must-not-appear',
            },
        });

        const serialized = serializeRuntimeError(error);

        expect(serialized.cause).toEqual({
            type: 'NonErrorCause',
            message: 'Non-Error cause omitted from structured diagnostics.',
        });
        expect(JSON.stringify(serialized)).not.toContain('must-not-appear');
    });

    it('applies service metadata, redaction and bounded HTTP serialization', () => {
        const record = captureSingleLog((logger) => {
            logger.info({
                password: 'password-value',
                nested: {
                    token: 'token-value',
                },
                body: {
                    value: 'body-value',
                },
                req: {
                    method: 'POST',
                    url: '/documents',
                    id: 'request-1',
                    headers: {
                        authorization: 'Bearer secret',
                        'x-agentic-workspace-actor-id': 'actor-secret',
                        'x-agentic-workspace-tenant-id': 'tenant-secret',
                    },
                    body: {
                        file: Buffer.from('file-bytes'),
                    },
                },
            });
        });

        expect(record.service).toBe('test-service');
        expect(record.serviceVersion).toBe('1.2.3');
        expect(record.environment).toBe('test');
        expect(record.password).toBe('[Redacted]');
        expect(record.nested).toEqual({ token: '[Redacted]' });
        expect(record.body).toBe('[Redacted]');
        expect(record.req).toEqual({
            method: 'POST',
            url: '/documents',
            id: 'request-1',
        });
        expect(JSON.stringify(record)).not.toContain('Bearer secret');
        expect(JSON.stringify(record)).not.toContain('actor-secret');
        expect(JSON.stringify(record)).not.toContain('tenant-secret');
        expect(JSON.stringify(record)).not.toContain('file-bytes');
    });
});
