// A beast of the herd, drawn by crowd3d (`world.crowd3d.kinds`) from a glb whose clips puppet3d wrote
// (`plugins/puppet3d/puppet3d.clips.ts`): `pos` [x, y, z] metres where its feet stood at `since`, seconds
// on the drover's clock, `to` the end of its line, `yaw` the way it faces, `speed` metres a second along
// its line, `body` and `clip` (`walk` or `idle`). It has no rule of its own: it keeps its course, and the
// drover turns it back at the end of its line.
import type { Kind } from '#engine/engine.ts'

export const beast: Kind = {}
