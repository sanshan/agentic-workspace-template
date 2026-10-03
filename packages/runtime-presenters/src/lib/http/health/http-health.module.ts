import type {
    DynamicModule,
    FactoryProvider,
    ModuleMetadata,
} from '@nestjs/common';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import type { ReadinessCheck } from '@agentic-workspace/runtime-health';

import { HttpHealthController } from './http-health.controller.js';
import { HttpHealthExceptionFilter } from './http-health-exception.filter.js';
import { HTTP_HEALTH_READINESS_CHECKS } from './readiness-checks.token.js';

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 1_000;

type ReadinessChecksFactory = Pick<
    FactoryProvider<readonly ReadinessCheck[]>,
    'inject' | 'useFactory'
>;

export interface HttpHealthModuleOptions {
    readonly imports?: ModuleMetadata['imports'];
    readonly readinessChecks: ReadinessChecksFactory;
}

@Module({})
export class HttpHealthModule {
    static register(options: HttpHealthModuleOptions): DynamicModule {
        return {
            module: HttpHealthModule,
            imports: [
                ...(options.imports ?? []),
                TerminusModule.forRoot({
                    gracefulShutdownTimeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS,
                }),
            ],
            controllers: [HttpHealthController],
            providers: [
                HttpHealthExceptionFilter,
                {
                    provide: HTTP_HEALTH_READINESS_CHECKS,
                    inject: options.readinessChecks.inject ?? [],
                    useFactory: options.readinessChecks.useFactory,
                },
            ],
        };
    }
}
