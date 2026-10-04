import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { HttpPresenterRequest } from '../http-presenter-request.js';

export const Tenant = createParamDecorator(
    (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<HttpPresenterRequest>().tenant,
);
