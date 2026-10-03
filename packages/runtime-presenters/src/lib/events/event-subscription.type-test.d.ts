import type { UseCase, UseCaseContext } from '@event-driven-platform/use-case';

import type { EventSubscriptionContext } from './event-subscription-context.js';
import type {
    CreateSubscriptionArgument,
    EventContractLike,
    ParsedEvent,
} from './event-subscription.js';

interface FixtureEvent {
    readonly name: 'fixture.event';
    readonly schemaVersion: 1;
    readonly payload: {
        readonly value: number;
    };
}

interface FixtureContract extends EventContractLike<FixtureEvent> {
    readonly name: 'fixture.event';
    readonly schemaVersion: 1;
}

interface FixtureInput {
    readonly value: number;
}

interface FixtureResult {
    readonly status: 'ok';
}

interface UnsupportedContext extends EventSubscriptionContext {
    readonly locale: string;
}

type IsAssignable<TSource, TTarget> = TSource extends TTarget ? true : false;
type IsEqual<TLeft, TRight> =
    (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2)
        ? true
        : false;
type Expect<TValue extends true> = TValue;
type ExpectFalse<TValue extends false> = TValue;

type SupportedArgument = CreateSubscriptionArgument<FixtureEvent, FixtureInput, FixtureResult>;

type SupportedCandidate = {
    readonly contract: FixtureContract;
    readonly useCase: UseCase<FixtureInput, FixtureResult, EventSubscriptionContext>;
    readonly intentSlot: string;
    readonly mapInput: (event: FixtureEvent) => FixtureInput;
};

type BaseContextCandidate = Omit<SupportedCandidate, 'useCase'> & {
    readonly useCase: UseCase<FixtureInput, FixtureResult, UseCaseContext>;
};

type WrongInputCandidate = Omit<SupportedCandidate, 'mapInput'> & {
    readonly mapInput: (event: FixtureEvent) => { readonly wrong: string };
};

type UnsupportedContextCandidate = Omit<SupportedCandidate, 'useCase'> & {
    readonly useCase: UseCase<FixtureInput, FixtureResult, UnsupportedContext>;
};

type _ContractEventInference = Expect<IsEqual<ParsedEvent<FixtureContract>, FixtureEvent>>;
type _SupportedInput = Expect<IsAssignable<SupportedCandidate, SupportedArgument>>;
type _SupportedBaseContext = Expect<IsAssignable<BaseContextCandidate, SupportedArgument>>;
type _RejectWrongInput = ExpectFalse<IsAssignable<WrongInputCandidate, SupportedArgument>>;
type _RejectUnsupportedContext = ExpectFalse<
    IsAssignable<UnsupportedContextCandidate, SupportedArgument>
>;
