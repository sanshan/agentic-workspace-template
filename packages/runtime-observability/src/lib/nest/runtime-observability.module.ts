import {
    Injectable,
    Module,
    type DynamicModule,
    type OnApplicationBootstrap,
    type OnApplicationShutdown,
} from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Options as PinoHttpOptions } from 'pino-http';

import {
    createRuntimePinoOptions,
    type RuntimeLoggerOptions,
} from '../runtime-pino-options.js';
import {
    createRuntimeTelemetry,
    RuntimeTelemetry,
    type RuntimeTelemetryOptions,
} from '../runtime-telemetry.js';

export interface RuntimeObservabilityModuleOptions extends RuntimeLoggerOptions {
    readonly telemetry?: RuntimeTelemetryOptions;
}

@Injectable()
class RuntimeTelemetryLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
    public constructor(private readonly telemetry: RuntimeTelemetry) {}

    public onApplicationBootstrap(): void {
        this.telemetry.start();
    }

    public async onApplicationShutdown(): Promise<void> {
        await this.telemetry.shutdown();
    }
}

@Module({})
export class RuntimeObservabilityModule {
    static register(options: RuntimeObservabilityModuleOptions): DynamicModule {
        const pinoHttp: PinoHttpOptions = {
            ...createRuntimePinoOptions(options),
            autoLogging: false,
        };
        const telemetry = options.telemetry
            ? createRuntimeTelemetry(options.service, options.telemetry)
            : undefined;

        return {
            module: RuntimeObservabilityModule,
            imports: [LoggerModule.forRoot({ pinoHttp })],
            providers: telemetry
                ? [
                      { provide: RuntimeTelemetry, useValue: telemetry },
                      RuntimeTelemetryLifecycle,
                  ]
                : [],
            exports: telemetry ? [LoggerModule, RuntimeTelemetry] : [LoggerModule],
        };
    }
}
