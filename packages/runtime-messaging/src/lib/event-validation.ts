export interface EventValidationIssue {
    readonly path: readonly string[];

    readonly message: string;
}

export interface EventValidationFailure {
    readonly kind: 'event-validation';

    readonly issues: readonly EventValidationIssue[];
}

export type EventValidationResult<TValue> =
    | {
          readonly status: 'valid';
          readonly value: TValue;
      }
    | {
          readonly status: 'invalid';
          readonly failure: EventValidationFailure;
      };
