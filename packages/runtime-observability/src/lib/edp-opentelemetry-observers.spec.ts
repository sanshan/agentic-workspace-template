import type {
    ReaderObservationContext,
    RunnerObservationContext,
} from '@event-driven-platform/observability';
import { metrics } from '@opentelemetry/api';
import {
    AggregationTemporality,
    InMemoryMetricExporter,
    MeterProvider,
    PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

import {
    createEdpOpenTelemetryObservers,
    toReaderTelemetryRecord,
    toRunnerTelemetryRecord,
    toUseCaseExecutorTelemetryRecord,
} from './edp-opentelemetry-observers.js';

const runnerContext: RunnerObservationContext = {
    operation: 'documents.register',
    tenant: {} as RunnerObservationContext['tenant'],
    intentId: 'intent-1',
    correlationId: 'correlation-1',
};

const readerContext: ReaderObservationContext = {
    read: 'documents.get',
    tenant: {} as ReaderObservationContext['tenant'],
    correlationId: 'correlation-reader-1',
};

describe('EDP OpenTelemetry mapping', () => {
    it('keeps Runner correlation and attempt identity out of metric attributes', () => {
        const record = toRunnerTelemetryRecord({
            type: 'attempt.completed',
            context: runnerContext,
            attempt: 2,
            outcome: 'error',
            retryable: true,
            durationMs: 17,
        });

        expect(record.metricAttributes).toEqual({
            'edp.outcome': 'error',
            'edp.retryable': true,
        });
        expect(record.traceAttributes).toMatchObject({
            'edp.operation': 'documents.register',
            'edp.intent.id': 'intent-1',
            'edp.correlation.id': 'correlation-1',
            'edp.attempt': 2,
        });
        expect(record.metricAttributes).not.toHaveProperty('edp.intent.id');
        expect(record.metricAttributes).not.toHaveProperty('edp.correlation.id');
        expect(record.metricAttributes).not.toHaveProperty('edp.attempt');
        expect(record.metricAttributes).not.toHaveProperty('failure.code');
    });

    it('keeps Reader correlation and attempt identity out of metric attributes', () => {
        const record = toReaderTelemetryRecord({
            type: 'read.attempt.completed',
            context: readerContext,
            attempt: 3,
            outcome: 'error',
            retryable: true,
            durationMs: 19,
        });

        expect(record.metricAttributes).toEqual({
            'edp.outcome': 'error',
            'edp.retryable': true,
        });
        expect(record.traceAttributes).toMatchObject({
            'edp.read': 'documents.get',
            'edp.correlation.id': 'correlation-reader-1',
            'edp.attempt': 3,
        });
        expect(record.metricAttributes).not.toHaveProperty('edp.correlation.id');
        expect(record.metricAttributes).not.toHaveProperty('edp.attempt');
    });

    it('maps Runner and Reader retry scheduling from their real EDP observations', () => {
        const runnerRecord = toRunnerTelemetryRecord({
            type: 'retry.scheduled',
            context: runnerContext,
            attempt: 1,
            delayMs: 250,
        });
        const readerRecord = toReaderTelemetryRecord({
            type: 'read.retry.scheduled',
            context: readerContext,
            attempt: 3,
            delayMs: 500,
        });

        expect(runnerRecord.retryDelayMs).toBe(250);
        expect(readerRecord.retryDelayMs).toBe(500);
        expect(runnerRecord.traceAttributes['edp.attempt']).toBe(1);
        expect(readerRecord.traceAttributes['edp.attempt']).toBe(3);
    });

    it('keeps UseCaseExecutor retry-free while exposing stable UseCase identity', () => {
        const record = toUseCaseExecutorTelemetryRecord({
            type: 'execution.completed',
            context: {
                useCase: 'document.register',
                intentId: 'intent-2',
                correlationId: 'correlation-2',
            },
            outcome: 'error',
            durationMs: 31,
        });

        expect(record.name).toBe('document.register');
        expect(record.metricAttributes).toEqual({ 'edp.outcome': 'error' });
        expect(record.retryDelayMs).toBeUndefined();
        expect(record.traceAttributes).toMatchObject({
            'edp.use_case': 'document.register',
            'edp.intent.id': 'intent-2',
            'edp.correlation.id': 'correlation-2',
        });
        expect(record.metricAttributes).not.toHaveProperty('failure.code');
        expect(record.traceAttributes).not.toHaveProperty('failure.code');
    });

    it('is safe to construct and invoke before an SDK is registered', () => {
        const observers = createEdpOpenTelemetryObservers();

        expect(() =>
            observers.runner.observe({
                type: 'execution.requested',
                context: runnerContext,
            }),
        ).not.toThrow();
        expect(() =>
            observers.reader.observe({
                type: 'read.requested',
                context: readerContext,
            }),
        ).not.toThrow();
        expect(() =>
            observers.useCaseExecutor.observe({
                type: 'execution.requested',
                context: {
                    useCase: 'document.register',
                    intentId: 'intent-3',
                    correlationId: 'correlation-3',
                },
            }),
        ).not.toThrow();
    });

    it('rebinds metric instruments when a real provider is registered after construction', async () => {
        metrics.disable();
        const observers = createEdpOpenTelemetryObservers();

        observers.runner.observe({
            type: 'execution.requested',
            context: runnerContext,
        });

        const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
        const reader = new PeriodicExportingMetricReader({
            exporter,
            exportIntervalMillis: 60_000,
        });
        const provider = new MeterProvider({ readers: [reader] });

        expect(metrics.setGlobalMeterProvider(provider)).toBe(true);

        try {
            observers.runner.observe({
                type: 'attempt.completed',
                context: runnerContext,
                attempt: 2,
                outcome: 'error',
                retryable: true,
                durationMs: 17,
            });
            await provider.forceFlush();

            const metricNames = exporter.getMetrics().flatMap((resourceMetrics) =>
                resourceMetrics.scopeMetrics.flatMap((scopeMetrics) =>
                    scopeMetrics.metrics.map((metric) => metric.descriptor.name),
                ),
            );

            expect(metricNames).toEqual(
                expect.arrayContaining([
                    'edp.lifecycle.observations',
                    'edp.lifecycle.duration',
                ]),
            );
        } finally {
            metrics.disable();
            await provider.shutdown();
        }
    });
});
