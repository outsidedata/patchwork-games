// The effects editor as a person uses it: a kind's effect picked, a layer opened, a number typed, Save pressed.
import { expect, test } from 'vitest'
import { effectsEditor } from './library.effects.ts'

test('a brightness typed into a layer plays at once under the full name, and Save hands back the file by its own names', () => {
  const file = {
    flame: [{ n: [4, 6], every: 0.03, gain: 1.4 }],
    sparks: [{ n: [1, 2], every: 0.2 }, { effect: 'flame', at: [0, 0.1, 0] }],
  }
  const host = document.createElement('div')
  const written: Record<string, unknown[]>[] = []
  const saved: Record<string, unknown[]>[] = []
  effectsEditor(host, 'forge', file, e => written.push(e), f => saved.push(f))

  // the first layer's card opened, its Brightness typed
  ;(host.querySelector('.layer .title') as HTMLElement).click()
  const row = [...host.querySelectorAll('.row')].find(r => r.querySelector('.name')!.textContent!.startsWith('Brightness'))!
  const input = row.querySelector('input')!
  input.value = '12'
  input.dispatchEvent(new Event('input'))

  const playing = written.at(-1)!
  expect(playing['forge/flame']).toEqual([{ n: [4, 6], every: 0.03, gain: 12 }])
  expect(playing['forge/sparks'][1]).toEqual({ effect: 'forge/flame', at: [0, 0.1, 0] })
  expect(host.querySelector('.state')!.textContent).toBe('1 effect changed, not saved')

  ;([...host.querySelectorAll('button')].find(b => b.textContent === 'Save to forge.effects.json') as HTMLButtonElement).click()
  expect(saved).toEqual([{ ...file, flame: [{ n: [4, 6], every: 0.03, gain: 12 }] }])
  expect(host.querySelector('.state')!.textContent).toBe('Everything saved')
})
