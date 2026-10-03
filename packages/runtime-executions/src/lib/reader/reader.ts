import type { Reader as EdpReader } from '@event-driven-platform/reader';

export abstract class Reader implements EdpReader {
    public abstract execute: EdpReader['execute'];
}
