import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { HttpPresenterRequest } from '../http-presenter-request.js';

export const Actor = createParamDecorator(
    (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<HttpPresenterRequest>().actor,
);
