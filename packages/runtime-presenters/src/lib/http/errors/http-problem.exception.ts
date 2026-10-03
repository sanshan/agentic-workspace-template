import { HttpException } from '@nestjs/common';

import type {
    HttpProblemDefinition,
    ProblemDetailsOptions,
} from './problem-details.js';

export type HttpProblemExceptionOptions = Pick<ProblemDetailsOptions, 'detail'>;

export class HttpProblemException extends HttpException {
    public constructor(
        readonly definition: HttpProblemDefinition,
        readonly problemOptions: HttpProblemExceptionOptions = {},
    ) {
        super(definition.title, definition.status);
    }
}
