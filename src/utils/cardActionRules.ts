export {
  canActivateCard as canActivateSpell,
  canActivateSetCard as canManuallyActivateTrap,
  getHandCardActionAvailability,
  getPossibleFusionMonsters,
  isMaterialMatch,
} from '../effects/registry';

export type { ActivationContext } from '../effects/types';
