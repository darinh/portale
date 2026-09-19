/**
 * A fixed DM for verification and for playing without a model.
 *
 * The second entry is deliberately illegal. The scripted director repeats its last entry
 * once the script runs out, so turn one starts a fight and every turn after it exercises
 * the engine overruling the DM. Without that, the engine-authority proof has nothing to
 * photograph.
 *
 * Turn one uses `engage` rather than `attack` so the scripted harness actually enters
 * combat. Reprisals only happen in combat, so a script that never starts a fight cannot
 * demonstrate the world hitting back.
 */

import type { Proposal } from './director.ts';

export const DEMO_SCRIPT: Proposal[] = [
  {
    narration:
      'Marga sees your hand move and is already rising, the curved knife catching the lamplight.',
    op: 'engage',
    target: 'e_marga' as Proposal['target'],
    direction: 'out',
    ability: 'dexterity',
    difficulty: 12,
    damage: 4,
    introduces: null,
  },
  {
    narration: 'She twists away, and for a moment the whole room seems to hold its breath.',
    op: 'attack',
    target: 'e_marga' as Proposal['target'],
    direction: 'out',
    ability: 'dexterity',
    difficulty: 30,
    damage: 999,
    introduces: null,
  },
];
