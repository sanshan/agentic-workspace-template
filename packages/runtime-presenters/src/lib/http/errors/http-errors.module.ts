import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { HttpProblemExceptionFilter } from './http-problem-exception.filter.js';

@Module({
    providers: [
        HttpProblemExceptionFilter,
        {
            provide: APP_FILTER,
            useExisting: HttpProblemExceptionFilter,
        },
    ],
})
export class HttpErrorsModule {}
