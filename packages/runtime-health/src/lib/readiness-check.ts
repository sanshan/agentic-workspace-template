export interface ReadinessCheck {
    readonly name: string;

    check(): Promise<void>;
}
