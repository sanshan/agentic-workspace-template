import { RuntimeMessagingModule } from '@agentic-workspace/runtime-messaging/nest';
import { Module } from '@nestjs/common';

import { EventSubscriptionRegistrar } from './event-subscription-registrar.js';

@Module({
    imports: [RuntimeMessagingModule],
    providers: [EventSubscriptionRegistrar],
    exports: [RuntimeMessagingModule, EventSubscriptionRegistrar],
})
export class EventSubscriptionsModule {}
