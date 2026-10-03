import {
    metrics,
    SpanKind,
    trace,
    type Attributes,
    type Counter,
    type Histogram,
    type MeterProvider,
    type Tracer,
} from '@opentelemetry/api';
import type {
    ReaderObservation,
    ReaderObserver,
    RunnerObservation,
    RunnerObserver,
    UseCaseExecutorObservation,
    UseCaseExecutorObserver,
} from '@event-driven-platform/observability';

const INSTRUMENTATION_NAME = '@agentic-workspace/runtime-observability/edp';

type EdpComponent = 'runner' | 'reader' | 'use-case-executor';

interface EdpTelemetryRecord {
    readonly component: EdpComponent;
    readonly event: string;
    readonly name?: string;
    readonly traceAttributes: Attributes;
    readonly metricAttributes: Attributes;
    readonly durationMs?: number;
    readonly retryDelayMs?: number;
}

interface EdpMetricInstruments {
    readonly provider: MeterProvider;
    readonly observations: Counter;
    readonly durations: Histogram;
    readonly retries: Counter;
    readonly retryDelays: Histogram;
}

export interface EdpOpenTelemetryObservers {
    readonly runner: RunnerObserver;
    readonly reader: ReaderObserver;
    readonly useCaseExecutor: UseCaseExecutorObserver;
}

class EdpOpenTelemetryRecorder {
    private readonly tracer: Tracer;
    private metricInstruments?: EdpMetricInstruments;

    public constructor() {
        this.tracer = trace.getTracer(INSTRUMENTATION_NAME);
    }

    private getMetricInstruments(): EdpMetricInstruments {
        const provider = metrics.getMeterProvider();
        if (this.metricInstruments?.provider === provider) {
            return this.metricInstruments;
        }

        const meter = provider.getMeter(INSTRUMENTATION_NAME);
        const metricInstruments: EdpMetricInstruments = {
            provider,
            observations: meter.createCounter('edp.lifecycle.observations', {
                description: 'Count of EDP lifecycle observations.',
            }),
            durations: meter.createHistogram('edp.lifecycle.duration', {
                description: 'Duration reported by EDP lifecycle observations.',
                unit: 'ms',
            }),
            retries: meter.createCounter('edp.retry.scheduled', {
                description: 'Count of retries scheduled by EDP execution boundaries.',
            }),
            retryDelays: meter.createHistogram('edp.retry.delay', {
                description: 'Retry delay scheduled by EDP execution boundaries.',
                unit: 'ms',
            }),
        };

        this.metricInstruments = metricInstruments;
        return metricInstruments;
    }

    public record(record: EdpTelemetryRecord): void {
        const metricAttributes: Attributes = {
            'edp.component': record.component,
            'edp.event': record.event,
            ...(record.name ? { 'edp.name': record.name } : {}),
            ...record.metricAttributes,
        };
        const metricInstruments = this.getMetricInstruments();

        metricInstruments.observations.add(1, metricAttributes);

        if (record.durationMs !== undefined) {
            metricInstruments.durations.record(record.durationMs, metricAttributes);
        }

        if (record.retryDelayMs !== undefined) {
            metricInstruments.retries.add(1, metricAttributes);
            metricInstruments.retryDelays.record(record.retryDelayMs, metricAttributes);
        }

        const traceAttributes: Attributes = {
            ...metricAttributes,
            ...record.traceAttributes,
            ...(record.durationMs !== undefined
                ? { 'edp.duration.ms': record.durationMs }
                : {}),
            ...(record.retryDelayMs !== undefined
                ? { 'edp.retry.delay.ms': record.retryDelayMs }
                : {}),
        };
        const eventName = `edp.${record.component}.${record.event}`;
        const activeSpan = trace.getActiveSpan();

        if (activeSpan) {
            activeSpan.addEvent(eventName, traceAttributes);
            return;
        }

        const span = this.tracer.startSpan(eventName, {
            kind: SpanKind.INTERNAL,
            attributes: traceAttributes,
        });
        span.end();
    }
}

function boundedObservationAttributes(
    observation: RunnerObservation | ReaderObservation | UseCaseExecutorObservation,
): Attributes {
    switch (observation.type) {
        case 'execution.completed':
        case 'read.completed':
        case 'read.attempt.completed':
        case 'attempt.completed':
        case 'cache.lookup.completed':
        case 'cache.population.completed':
        case 'source.completed':
        case 'distributed-coordination.completed':
        case 'claim.completed':
        case 'completion.completed':
        case 'release.completed':
            return {
                'edp.outcome': observation.outcome,
                ...('retryable' in observation
                    ? { 'edp.retryable': observation.retryable }
                    : {}),
                ...('scope' in observation ? { 'edp.cache.scope': observation.scope } : {}),
                ...('level' in observation ? { 'edp.cache.level': observation.level } : {}),
            };
        case 'claim.rejected':
            return { 'edp.reason': observation.reason };
        default:
            return {};
    }
}

function attemptTraceAttributes(
    observation: RunnerObservation | ReaderObservation,
): Attributes {
    return 'attempt' in observation ? { 'edp.attempt': observation.attempt } : {};
}

export function toRunnerTelemetryRecord(observation: RunnerObservation): EdpTelemetryRecord {
    return {
        component: 'runner',
        event: observation.type,
        name: observation.context.operation,
        metricAttributes: boundedObservationAttributes(observation),
        traceAttributes: {
            'edp.operation': observation.context.operation,
            'edp.intent.id': observation.context.intentId,
            'edp.correlation.id': observation.context.correlationId,
            ...attemptTraceAttributes(observation),
        },
        ...('durationMs' in observation ? { durationMs: observation.durationMs } : {}),
        ...(observation.type === 'retry.scheduled'
            ? { retryDelayMs: observation.delayMs }
            : {}),
    };
}

export function toReaderTelemetryRecord(observation: ReaderObservation): EdpTelemetryRecord {
    return {
        component: 'reader',
        event: observation.type,
        name: observation.context.read,
        metricAttributes: boundedObservationAttributes(observation),
        traceAttributes: {
            'edp.read': observation.context.read,
            'edp.correlation.id': observation.context.correlationId,
            ...attemptTraceAttributes(observation),
        },
        ...('durationMs' in observation ? { durationMs: observation.durationMs } : {}),
        ...(observation.type === 'read.retry.scheduled'
            ? { retryDelayMs: observation.delayMs }
            : {}),
    };
}

export function toUseCaseExecutorTelemetryRecord(
    observation: UseCaseExecutorObservation,
): EdpTelemetryRecord {
    return {
        component: 'use-case-executor',
        event: observation.type,
        name: observation.context.useCase,
        metricAttributes: boundedObservationAttributes(observation),
        traceAttributes: {
            'edp.use_case': observation.context.useCase,
            'edp.intent.id': observation.context.intentId,
            'edp.correlation.id': observation.context.correlationId,
        },
        ...('durationMs' in observation ? { durationMs: observation.durationMs } : {}),
    };
}

export function createEdpOpenTelemetryObservers(): EdpOpenTelemetryObservers {
    const recorder = new EdpOpenTelemetryRecorder();

    return {
        runner: {
            observe: (observation) => {
                recorder.record(toRunnerTelemetryRecord(observation));
                return undefined;
            },
        },
        reader: {
            observe: (observation) => {
                recorder.record(toReaderTelemetryRecord(observation));
                return undefined;
            },
        },
        useCaseExecutor: {
            observe: (observation) => {
                recorder.record(toUseCaseExecutorTelemetryRecord(observation));
                return undefined;
            },
        },
    };
}
