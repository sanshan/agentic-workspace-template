import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

import type { RuntimeLoggerServiceIdentity } from './runtime-pino-options.js';

const DEFAULT_METRICS_EXPORT_INTERVAL_MS = 60_000;

export interface RuntimeTelemetryOptions {
    readonly traceUrl?: string;
    readonly metricsUrl?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly metricsExportIntervalMs?: number;
}

export class RuntimeTelemetry {
    public constructor(private readonly sdk: NodeSDK) {}

    public start(): void {
        this.sdk.start();
    }

    public async shutdown(): Promise<void> {
        await this.sdk.shutdown();
    }
}

export function createRuntimeTelemetry(
    service: RuntimeLoggerServiceIdentity,
    options: RuntimeTelemetryOptions = {},
): RuntimeTelemetry {
    const traceExporter = new OTLPTraceExporter({
        ...(options.traceUrl ? { url: options.traceUrl } : {}),
        ...(options.headers ? { headers: { ...options.headers } } : {}),
    });
    const metricExporter = new OTLPMetricExporter({
        ...(options.metricsUrl ? { url: options.metricsUrl } : {}),
        ...(options.headers ? { headers: { ...options.headers } } : {}),
    });
    const serviceResource = resourceFromAttributes({
        'service.name': service.name,
        ...(service.version ? { 'service.version': service.version } : {}),
        ...(service.environment
            ? { 'deployment.environment.name': service.environment }
            : {}),
    });

    const sdk = new NodeSDK({
        resource: defaultResource().merge(serviceResource),
        spanProcessors: [new BatchSpanProcessor(traceExporter)],
        metricReader: new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis:
                options.metricsExportIntervalMs ?? DEFAULT_METRICS_EXPORT_INTERVAL_MS,
        }),
    });

    return new RuntimeTelemetry(sdk);
}
