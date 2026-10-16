#!/usr/bin/env node
/**
 * Seeds the CC0 music library from a folder of audio files.
 *
 *   node scripts/import-sounds.js ./cc0-tracks --category Afrobeats [--artist "Name"] [--dry-run]
 *
 * File names are read as "Artist - Title.mp3"; a name without " - " becomes
 * the title and the --artist flag (if any) the artist. Each file is uploaded
 * to Cloudinary and recorded as a LIBRARY / CC0 sound. Re-running skips files
 * whose title+artist already exist, so it is safe to add tracks to the folder
 * and run again. Needs DATABASE_URL and the CLOUDINARY_* variables (.env).
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../config/db.js";
import { SOUND_CATEGORIES, createSoundFromFile } from "../services/soundService.js";

const AUDIO_EXT = new Set([".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"]);

function parseArgs(argv) {
  const out = { dir: null, category: null, artist: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--category") out.category = argv[++i];
    else if (a === "--artist") out.artist = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (!out.dir) out.dir = a;
  }
  return out;
}

const { dir, category, artist: defaultArtist, dryRun } = parseArgs(process.argv.slice(2));
if (!dir) {
  console.error("Usage: node scripts/import-sounds.js <folder> [--category <name>] [--artist <name>] [--dry-run]");
  process.exit(1);
}
if (category && !SOUND_CATEGORIES.includes(category)) {
  console.error(`Unknown category "${category}". Known: ${SOUND_CATEGORIES.join(", ")}`);
  process.exit(1);
}

const entries = (await fs.readdir(dir)).filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase())).sort();
if (entries.length === 0) {
  console.error(`No audio files in ${dir}`);
  process.exit(1);
}

let added = 0;
let skipped = 0;
for (const file of entries) {
  const base = path.parse(file).name;
  const dash = base.indexOf(" - ");
  const artist = dash > 0 ? base.slice(0, dash).trim() : defaultArtist;
  const title = (dash > 0 ? base.slice(dash + 3) : base).trim();

  const exists = await prisma.sound.findFirst({
    where: { source: "LIBRARY", title: { equals: title, mode: "insensitive" }, artist: artist ? { equals: artist, mode: "insensitive" } : null },
    select: { id: true },
  });
  if (exists) {
    skipped += 1;
    console.log(`skip   ${file} (already imported)`);
    continue;
  }
  if (dryRun) {
    console.log(`would  ${file} → "${title}"${artist ? ` by ${artist}` : ""}${category ? ` [${category}]` : ""}`);
    continue;
  }
  const sound = await createSoundFromFile({
    filePath: path.join(dir, file),
    title,
    artist,
    category,
    source: "LIBRARY",
    license: "CC0",
  });
  added += 1;
  console.log(`added  ${file} → ${sound.id} (${Math.round(sound.durationMs / 1000)}s)`);
}

console.log(`\n${added} added, ${skipped} skipped${dryRun ? " (dry run)" : ""}`);
await prisma.$disconnect();
