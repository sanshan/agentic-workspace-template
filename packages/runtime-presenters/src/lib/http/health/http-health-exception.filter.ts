import { Catch, Injectable, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

@Catch()
@Injectable()
export class HttpHealthExceptionFilter extends BaseExceptionFilter {
    public constructor(adapterHost: HttpAdapterHost) {
        super(adapterHost.httpAdapter);
    }

    public override catch(exception: unknown, host: ArgumentsHost): void {
        super.catch(exception, host);
    }
}
