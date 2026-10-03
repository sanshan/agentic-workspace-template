import type { LevelWithSilent, LoggerOptions } from 'pino';

import {
    serializeHttpRequestForLog,
    serializeHttpResponseForLog,
} from './http-log.serializer.js';
import { serializeRuntimeError } from './runtime-error.serializer.js';
import { getActiveTraceLogFields } from './trace-context.js';

export const RUNTIME_LOG_REDACTION_PATHS = Object.freeze([
    'password',
    '*.password',
    'token',
    '*.token',
    'accessToken',
    '*.accessToken',
    'refreshToken',
    '*.refreshToken',
    'secret',
    '*.secret',
    'apiKey',
    '*.apiKey',
    'authorization',
    '*.authorization',
    'cookie',
    '*.cookie',
    'headers',
    '*.headers',
    'body',
    '*.body',
    'file',
    '*.file',
    'files',
    '*.files',
    'buffer',
    '*.buffer',
]);

export interface RuntimeLoggerServiceIdentity {
    readonly name: string;
    readonly version?: string;
    readonly environment?: string;
}

export interface RuntimeLoggerOptions {
    readonly service: RuntimeLoggerServiceIdentity;
    readonly level?: LevelWithSilent;
}

export function createRuntimePinoOptions(options: RuntimeLoggerOptions): LoggerOptions {
    return {
        level: options.level ?? 'info',
        base: {
            service: options.service.name,
            ...(options.service.version
                ? { serviceVersion: options.service.version }
                : {}),
            ...(options.service.environment
                ? { environment: options.service.environment }
                : {}),
        },
        redact: {
            paths: [...RUNTIME_LOG_REDACTION_PATHS],
            censor: '[Redacted]',
        },
        serializers: {
            err: serializeRuntimeError,
            req: serializeHttpRequestForLog,
            res: serializeHttpResponseForLog,
        },
        mixin: () => getActiveTraceLogFields() ?? {},
    };
}
