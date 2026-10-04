import type { TenantReference as EdpTenantReference } from '@event-driven-platform/tenant-reference';

import type { tenantName } from './name.js';
import type { TenantId } from './tenant-id.js';

export type TenantReference = EdpTenantReference<typeof tenantName, TenantId>;
