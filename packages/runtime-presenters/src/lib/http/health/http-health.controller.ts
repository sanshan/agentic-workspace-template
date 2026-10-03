import type { ReadinessCheck } from '@agentic-workspace/runtime-health';
import { Controller, Get, Inject, UseFilters } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    HealthIndicatorService,
} from '@nestjs/terminus';

import { HttpHealthExceptionFilter } from './http-health-exception.filter.js';
import { HTTP_HEALTH_READINESS_CHECKS } from './readiness-checks.token.js';

@UseFilters(HttpHealthExceptionFilter)
@Controller('health')
export class HttpHealthController {
    constructor(
        private readonly healthCheckService: HealthCheckService,
        private readonly healthIndicatorService: HealthIndicatorService,
        @Inject(HTTP_HEALTH_READINESS_CHECKS)
        private readonly readinessChecks: readonly ReadinessCheck[],
    ) {}

    @Get('live')
    @HealthCheck()
    live() {
        return this.healthCheckService.check([]);
    }

    @Get('ready')
    @HealthCheck()
    ready() {
        return this.healthCheckService.check(
            this.readinessChecks.map((readinessCheck) => () =>
                this.checkReadiness(readinessCheck),
            ),
        );
    }

    private async checkReadiness(readinessCheck: ReadinessCheck) {
        const indicator = this.healthIndicatorService.check(readinessCheck.name);

        try {
            await readinessCheck.check();

            return indicator.up();
        } catch {
            return indicator.down();
        }
    }
}
