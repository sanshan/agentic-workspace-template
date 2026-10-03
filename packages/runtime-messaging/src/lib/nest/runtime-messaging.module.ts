import { Module, type FactoryProvider, type Provider } from '@nestjs/common';

import { EventHandlerRegistry } from '../event-handler-registry.js';
import { EventIngress } from '../event-ingress.js';
import { RuntimeMessagingBootstrap } from './runtime-messaging-bootstrap.js';

const eventIngressProvider: FactoryProvider<EventIngress> = {
    provide: EventIngress,
    inject: [EventHandlerRegistry],
    useFactory: (registry: EventHandlerRegistry) => new EventIngress(registry),
};

const providers: Provider[] = [EventHandlerRegistry, eventIngressProvider, RuntimeMessagingBootstrap];

@Module({
    providers,
    exports: [EventHandlerRegistry, EventIngress],
})
export class RuntimeMessagingModule {}
