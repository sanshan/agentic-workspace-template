import type { UseCaseExecutor as EdpUseCaseExecutor } from '@event-driven-platform/use-case-executor';

export abstract class UseCaseExecutor implements EdpUseCaseExecutor {
    public abstract execute: EdpUseCaseExecutor['execute'];
}
