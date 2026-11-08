// The story of a place: the place's own named numbers, its `state` (the bell rung, say), which the quests file's
// `world.<name>` reads and writes. One actors entry in a scene whose place has a quests file; its definition names
// that file's catalogue entry, `file`, and what the page draws over the game (`hud`). Its rule is the quest plugin's
// (`plugins/quest/quest.sim.ts`).
export { story } from './plugins/quest/quest.sim.ts'
