import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('database_health_probes')
export class DatabaseHealthProbeEntity {
    @PrimaryColumn({ type: 'uuid' })
    id!: string;

    @Column({
        type: 'varchar',
        length: 128,
        nullable: false,
    })
    marker!: string;
}
