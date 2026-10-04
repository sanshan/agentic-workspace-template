import type { ExecutionLogStore as EdpExecutionLogStore } from '@event-driven-platform/execution-log-store';

export abstract class ExecutionLogStore implements EdpExecutionLogStore {
    public abstract claim: EdpExecutionLogStore['claim'];
    public abstract complete: EdpExecutionLogStore['complete'];
    public abstract fail: EdpExecutionLogStore['fail'];
    public abstract findByIntentId: EdpExecutionLogStore['findByIntentId'];
}
