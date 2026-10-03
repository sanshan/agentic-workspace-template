import type { UseCaseExecutionStore as EdpUseCaseExecutionStore } from '@event-driven-platform/use-case-execution-store';

export abstract class UseCaseExecutionStore implements EdpUseCaseExecutionStore {
    public abstract claim: EdpUseCaseExecutionStore['claim'];
    public abstract complete: EdpUseCaseExecutionStore['complete'];
    public abstract release: EdpUseCaseExecutionStore['release'];
}
