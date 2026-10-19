// Where a new one of a role comes in for a seat: one `actors` entry per role and slot, holding the
// role (`farmer`, `cow` or `chicken`) in `role`, the slot in `slot` and the point in `pos`. A seat that
// finds every one of its role played by people has a new one made at its slot's start for its role
// (`plugins/roles`).
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}
