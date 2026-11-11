import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Handler = (...args: unknown[]) => void;
let outcome: { type: 'end' } | { type: 'error'; error: unknown } = { type: 'end' };
const saved: string[] = [];
const bitrates: string[] = [];

const ffmpegMock: any = jest.fn(() => {
  const handlers: Record<string, Handler> = {};
  const chain: any = {
    noVideo: () => chain,
    audioCodec: () => chain,
    audioBitrate: (b: string) => {
      bitrates.push(b);
      return chain;
    },
    audioChannels: () => chain,
    audioFrequency: () => chain,
    format: () => chain,
    on: (event: string, fn: Handler) => {
      handlers[event] = fn;
      return chain;
    },
    save: (path: string) => {
      saved.push(path);
      if (outcome.type === 'end') handlers.end();
      else handlers.error(outcome.error);
    },
  };
  return chain;
});
ffmpegMock.setFfmpegPath = jest.fn();

jest.mock('fluent-ffmpeg', () => ({ __esModule: true, default: ffmpegMock }));
jest.mock('ffmpeg-static', () => ({ __esModule: true, default: '/bin/ffmpeg' }));
jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn(async () => undefined),
      readFile: jest.fn(async () => Buffer.from('mp3-bytes')),
    },
  };
});

import { AudioTranscodingService } from './audio-transcoding.service';

const make = (env: Record<string, string | undefined> = {}) =>
  new AudioTranscodingService({ get: (k: string) => env[k] } as any);

describe('AudioTranscodingService', () => {
  beforeEach(() => {
    outcome = { type: 'end' };
    saved.length = 0;
    bitrates.length = 0;
  });

  it('configures the static ffmpeg binary on load', () => {
    expect(ffmpegMock.setFfmpegPath).toHaveBeenCalledWith('/bin/ffmpeg');
  });

  it('transcodes with the default bitrate and output folder', async () => {
    const result = await make().transcodeVideoToLowBitrateMp3('uploads/My Lesson.mp4');
    expect(bitrates).toEqual(['48k']);
    expect(result.bitrate).toBe('48k');
    expect(result.outputPath).toMatch(/uploads[\\/]audio[\\/]My_Lesson-48k-\d+\.mp3$/);
    expect(result.sizeBytes).toBe(9);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('honours configured and explicit bitrates and folder', async () => {
    const svc = make({ AUDIO_LOW_BITRATE: ' 32k ', AUDIO_OUTPUT_DIR: '/tmp/out' });
    const a = await svc.transcodeVideoToLowBitrateMp3('v.mp4');
    const b = await svc.transcodeVideoToLowBitrateMp3('v.mp4', ' 24k ');
    expect(a.bitrate).toBe('32k');
    expect(b.bitrate).toBe('24k');
    expect(a.outputPath.replace(/\\/g, '/')).toMatch(/^\/tmp\/out\/v-32k-/);
  });

  it('falls back to safe names and suffixes', async () => {
    const svc = make();
    const r = await svc.transcodeVideoToLowBitrateMp3('folder/', '!!');
    expect(r.outputPath).toMatch(/lesson-48k-\d+\.mp3$/);
  });

  it('wraps ffmpeg errors', async () => {
    outcome = { type: 'error', error: new Error('codec') };
    await expect(make().transcodeVideoToLowBitrateMp3('v.mp4')).rejects.toThrow(
      'Audio transcoding failed: codec',
    );
    outcome = { type: 'error', error: 'raw' };
    await expect(make().transcodeVideoToLowBitrateMp3('v.mp4')).rejects.toThrow(
      'Audio transcoding failed: Audio transcoding process failed',
    );
    await expect(make().transcodeVideoToLowBitrateMp3('v.mp4')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
