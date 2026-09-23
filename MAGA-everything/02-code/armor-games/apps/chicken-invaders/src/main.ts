import { PACKS, bootShmup } from '@maga/shmup-core';

/**
 * Chicken Invaders (CI2-era formula replica) — build-order slot #4.
 * Shared shmup skeleton + `replica` content pack; all mechanics live in
 * @maga/shmup-core (ported from prototypes/chicken-invaders.html).
 * INTERNAL-NO-PUBLIC: InterAction studios / Prouskas clearance required to ship.
 */
void (async () => {
  await bootShmup(PACKS.replica, 'chicken-invaders');
})();
