// Skyline Ridge Run — hand-in program (Node 22, standard library only).
// Copies this repository's game/ and screenshots/ into the output directory
// and writes /output/dossier.json with the vendored make.fun library, so the
// judge reads exactly the game that ships. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program is deterministic: it copies files in a fixed order and the
// dossier is a pure function of those files, so running it twice writes
// byte-identical output.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output directory so stale files can never leak into
// the entry: a previous run's screenshots or game files must not survive.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps, mirrored here so the program refuses to hand in an
// entry the gate would refuse: at most 4 screenshots, each at most 256 KiB;
// game/ at most 993 files and 48 MiB in all, no path over 1000 bytes; the
// dossier text capped at 160 KiB. These are the same limits the gate reads
// from its own reference, so a local run that passes them is shippable.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
