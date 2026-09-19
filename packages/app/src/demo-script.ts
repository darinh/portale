/**
 * A fixed DM for verification and for playing without a model.
 *
 * The second entry is deliberately illegal. The scripted director repeats its last entry
 * once the script runs out, so turn one is an ordinary roll and every turn after it
 * exercises the engine overruling the DM. Without that, the engine-authority proof has
 * nothing to photograph.
 */

import type { Proposal } from './director.ts';

export const DEMO_SCRIPT: Proposal[] = [
  {
    narration:
      'Marga sees your hand move and is already rising, the curved knife catching the lamplight.',
    op: 'attack',
    target: 'e_marga' as Proposal['target'],
    ability: 'dexterity',
    difficulty: 12,
    damage: 4,
    introduces: null,
  },
  {
    narration: 'She twists away, and for a moment the whole room seems to hold its breath.',
    op: 'attack',
    target: 'e_marga' as Proposal['target'],
    ability: 'dexterity',
    difficulty: 30,
    damage: 999,
    introduces: null,
  },
];
