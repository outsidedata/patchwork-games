// The course: the scene's one `course` row, at its `pos` [x, y, z] facing its `yaw`, whose definition
// names its level, the loader `json` entry `level` (`assets/course.json`). The game's floors plugin
// (`plugins/floors`) is what its shapes are to the bodies that walk it, and `course.client.ts` is how
// they look. It has no rule.
import type { Kind } from '#engine/engine.ts'

export const course: Kind = {}
