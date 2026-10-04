import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';

import { EventHandlerRegistry } from '../event-handler-registry.js';

@Injectable()
export class RuntimeMessagingBootstrap implements OnApplicationBootstrap {
    public constructor(private readonly registry: EventHandlerRegistry) {}

    public onApplicationBootstrap(): void {
        this.registry.seal();
    }
}
