/**
 * A still cut from a live HLS video, for cameras that are only published as
 * one (clarence.mjs: the council's "Other Locations" cameras are one video,
 * a grid of them).
 *
 * Reads the playlist, downloads only the start of its newest segment (a
 * segment starts with a full frame, about 60 KB of a 2 MB, 25 s segment at
 * 1080p) and has ffmpeg decode that frame and cut the camera's box out of it
 * as a JPEG, about 35 KB. Nothing else is kept: the JPEG goes back in the
 * reply as a data URL. About half a second; the video's server sees two
 * small requests per camera per cache period.
 *
 * ffmpeg is the Lambda layer's /opt/bin/ffmpeg, or FFMPEG_PATH.
 */

import { spawn } from 'node:child_process';

const FFMPEG = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
const HEAD_BYTES = 384 * 1024; // the first frame, with room for a busy (or noisy night) picture
const FFMPEG_TIMEOUT_MS = 10000;
// A box's mean brightness (0-255) under this is blank: the camera is off but
// still has its place in the grid. Live pictures, even at night, are well over.
const BLANK_BRIGHTNESS = 8;

/**
 * An HLS media playlist -> its newest segment: { url, seconds }. Only a
 * segment on the playlist's own server. Throws if there isn't one.
 */
export function newestSegment(m3u8, playlistUrl) {
  const base = new URL(playlistUrl);
  let seconds = null;
  let newest = null;
  for (const line of String(m3u8 || '').split(/\r?\n/).map((l) => l.trim())) {
    if (line.startsWith('#EXTINF:')) seconds = parseFloat(line.slice(8));
    else if (line && !line.startsWith('#')) {
      newest = { url: new URL(line, base), seconds: Number.isFinite(seconds) ? seconds : null };
      seconds = null;
    }
  }
  if (!newest || newest.url.origin !== base.origin || !newest.url.pathname.endsWith('.ts')) {
    throw new Error('No video segment in the playlist');
  }
  return { url: newest.url.href, seconds: newest.seconds };
}

/**
 * The start of an MPEG-TS segment -> its first frame's box { x, y, w, h }:
 * { jpeg, brightness }. One ffmpeg run, two outputs: the JPEG, and the box
 * shrunk to 32x18 grey for its mean brightness.
 */
export function cropFirstFrame(ts, { x, y, w, h }, { ffmpeg = FFMPEG } = {}) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-f', 'mpegts', '-i', 'pipe:0',
    '-filter_complex', `[0:v:0]crop=${w}:${h}:${x}:${y},split=2[o][s];[s]scale=32:18,format=gray[g]`,
    '-map', '[o]', '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1',
    '-map', '[g]', '-frames:v', '1', '-f', 'rawvideo', 'pipe:3',
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
    const out = { 1: [], 2: [], 3: [] };
    for (const fd of [1, 2, 3]) proc.stdio[fd].on('data', (b) => out[fd].push(b));
    const timer = setTimeout(() => proc.kill('SIGKILL'), FFMPEG_TIMEOUT_MS);
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const jpeg = Buffer.concat(out[1]);
      const grey = Buffer.concat(out[3]);
      if (code !== 0 || !jpeg.length || !grey.length) {
        const why = Buffer.concat(out[2]).toString().trim().split('\n').pop();
        return reject(new Error(`No frame from the video${why ? `: ${why}` : ''}`));
      }
      resolve({ jpeg, brightness: grey.reduce((sum, v) => sum + v, 0) / grey.length });
    });
    // ffmpeg stops reading once it has its frame; that isn't an error.
    proc.stdin.on('error', () => {});
    proc.stdin.end(ts);
  });
}

/**
 * The live video at `playlistUrl` -> the camera in `box`, now:
 * { imageUrl (a JPEG data URL), takenAt } or, if it's blank in the video,
 * { imageUrl: null, takenAt, offline: true }. `takenAt` is when the newest
 * segment started: at least its length (25 s) before now.
 */
export async function liveStill(playlistUrl, box, { fetchText, fetchBytes, now = Date.now() }, options) {
  const segment = newestSegment(await fetchText(playlistUrl), playlistUrl);
  const ts = await fetchBytes(segment.url, { headers: { range: `bytes=0-${HEAD_BYTES - 1}` } });
  const { jpeg, brightness } = await cropFirstFrame(ts, box, options);
  const takenAt = new Date(now - (segment.seconds || 0) * 1000).toISOString();
  if (brightness < BLANK_BRIGHTNESS) return { imageUrl: null, takenAt, offline: true };
  return { imageUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`, takenAt };
}
