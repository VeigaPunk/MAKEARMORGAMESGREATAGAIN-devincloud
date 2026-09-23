import { PACKS, bootShmup } from '@maga/shmup-core';

/**
 * Cluck Horizon — original-IP vertical shmup (build-order slot #6).
 * Same shmup skeleton as the CI replica, `cluck` content pack: original
 * names, palette, weapons, and courier-log jokes. No InterAction marks,
 * silhouettes, or audio.
 */
void (async () => {
  await bootShmup(PACKS.cluck, 'chicken-invaders-original');
})();
