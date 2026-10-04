import type { Runner as EdpRunner } from '@event-driven-platform/runner';

export abstract class Runner implements EdpRunner {
    public abstract execute: EdpRunner['execute'];
    public abstract executeDetailed: EdpRunner['executeDetailed'];
}
