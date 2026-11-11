import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';

const fsMock = {
  stat: jest.fn<(...a: any[]) => Promise<any>>(),
  readFile: jest.fn<(...a: any[]) => Promise<any>>(),
  writeFile: jest.fn<(...a: any[]) => Promise<any>>(),
  rename: jest.fn<(...a: any[]) => Promise<any>>(),
};
jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: (...a: any[]) => fsMock.stat(...a),
      readFile: (...a: any[]) => fsMock.readFile(...a),
      writeFile: (...a: any[]) => fsMock.writeFile(...a),
      rename: (...a: any[]) => fsMock.rename(...a),
    },
  };
});

const sharpCalls: any[] = [];
jest.mock('sharp', () => ({
  __esModule: true,
  default: (input: string) => {
    const chain: any = {
      rotate: () => chain,
      resize: (o: unknown) => {
        sharpCalls.push({ input, resize: o });
        return chain;
      },
      jpeg: (o: unknown) => {
        sharpCalls.push({ jpeg: o });
        return chain;
      },
      toFile: async (out: string) => {
        sharpCalls.push({ out });
      },
    };
    return chain;
  },
}));

let pdfMode: 'ok' | 'import-fail' | 'load-fail' | 'default-export' | 'default-nested' = 'ok';
const fakePdf = {
  load: async () => {
    if (pdfMode === 'load-fail') throw new Error('corrupt');
    return { save: async () => new Uint8Array([1, 2, 3]) };
  },
};
jest.mock('pdf-lib', () => ({
  __esModule: true,
  get PDFDocument() {
    if (pdfMode === 'import-fail') throw new Error('native binding');
    if (pdfMode === 'default-export' || pdfMode === 'default-nested') return undefined;
    return fakePdf;
  },
  get default() {
    if (pdfMode === 'default-nested') return { PDFDocument: fakePdf };
    return fakePdf;
  },
}));

import { ManifestService } from './manifest.service';
import { AssetOptimizationService } from './asset-optimization.service';

beforeEach(() => {
  for (const fn of Object.values(fsMock)) fn.mockReset();
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('ManifestService', () => {
  let prisma: PrismaMock;
  let svc: ManifestService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new ManifestService(prisma as any);
  });

  describe('buildLessonAudioSummary', () => {
    it('handles students without class or resources', async () => {
      prisma.class.findFirst.mockResolvedValueOnce(null);
      expect(await svc.buildLessonAudioSummary('s')).toMatchObject({ classId: null, resource: null });
      prisma.class.findFirst.mockResolvedValueOnce({ id: 'c', name: '3e' });
      prisma.resource.findFirst.mockResolvedValueOnce(null);
      expect(await svc.buildLessonAudioSummary('s')).toMatchObject({
        classId: 'c',
        resource: null,
        speechText: 'Pa gen nouvo materyèl pou klas 3e.',
      });
    });

    it('describes the latest resource with size and audio hint', async () => {
      const updatedAt = new Date('2026-01-01T00:00:00Z');
      prisma.class.findFirst.mockResolvedValue({ id: 'c', name: '3e' });
      prisma.resource.findFirst.mockResolvedValueOnce({
        id: 'r',
        title: 'L1',
        description: ' Intro ',
        fileType: 'MP3',
        filePath: 'a.mp3',
        updatedAt,
      });
      fsMock.stat.mockResolvedValueOnce({ size: 42 });
      const r = await svc.buildLessonAudioSummary('s');
      expect(r.resource).toMatchObject({ sizeBytes: 42, updatedAt: updatedAt.toISOString() });
      expect(r.speechText).toBe('Klas 3e. Leson: L1. Rezime: Intro');
      expect(r.lowBandwidthHints.hasAudioFile).toBe(true);

      prisma.resource.findFirst.mockResolvedValueOnce({
        id: 'r',
        title: 'L1',
        description: null,
        fileType: 'pdf',
        filePath: 'a.pdf',
        updatedAt,
      });
      fsMock.stat.mockRejectedValueOnce(new Error('missing'));
      const r2 = await svc.buildLessonAudioSummary('s');
      expect(r2.resource?.sizeBytes).toBeNull();
      expect(r2.speechText).toContain('Pa gen rezime disponib.');
      expect(r2.lowBandwidthHints.hasAudioFile).toBe(false);
    });
  });

  describe('buildDeltaManifest', () => {
    const resource = {
      id: 'r1',
      classId: 'c1',
      title: 't',
      description: null,
      filePath: 'f',
      fileType: 'pdf',
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    const log = (changes: unknown, entityId: string | null = 'eid') => ({
      changes,
      entityId,
      createdAt: new Date('2026-01-03T00:00:00Z'),
    });

    it('returns everything without since', async () => {
      prisma.resource.findMany.mockResolvedValue([resource]);
      prisma.auditLog.findMany.mockResolvedValue([]);
      fsMock.stat.mockResolvedValue({ size: 7 });
      const r = await svc.buildDeltaManifest({});
      expect(r.since).toBeNull();
      expect(r.changed[0]).toMatchObject({ id: 'r1', sizeBytes: 7 });
      expect(prisma.resource.findMany.mock.calls[0][0].where).toEqual({});

      await svc.buildDeltaManifest({ classIds: ['c1', 'c2'] });
      expect(prisma.resource.findMany.mock.calls[1][0].where).toEqual({ classId: { in: ['c1', 'c2'] } });
    });

    it('ignores invalid since values', async () => {
      prisma.resource.findMany.mockResolvedValue([]);
      prisma.auditLog.findMany.mockResolvedValue([]);
      expect((await svc.buildDeltaManifest({ since: 'garbage' })).since).toBeNull();
    });

    it('filters deletions by since and class', async () => {
      prisma.resource.findMany.mockResolvedValue([]);
      prisma.auditLog.findMany.mockResolvedValue([
        log({ id: 'd1', classId: 'c1' }),
        log({ id: 'd2', classId: 'other' }),
        log('{"id":"d3"}'),
        log({ classId: 5 }, 'fallback-id'),
        log(null, null),
      ]);
      const r = await svc.buildDeltaManifest({ since: '2026-01-01T00:00:00Z', classIds: ['c1'] });
      expect(r.since).toBe('2026-01-01T00:00:00.000Z');
      // Deletions of unknown or other classes stay hidden from scoped callers.
      expect(r.deleted.map((d) => d.id)).toEqual(['d1']);
      expect(prisma.resource.findMany.mock.calls[0][0].where.updatedAt).toEqual({
        gt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where.createdAt).toBeDefined();

      const all = await svc.buildDeltaManifest({});
      expect(all.deleted.map((d) => d.id)).toEqual(['d1', 'd2', 'd3', 'fallback-id']);
    });
  });
});

describe('AssetOptimizationService', () => {
  const config = (env: Record<string, string | undefined> = {}) =>
    ({ get: (k: string) => env[k] }) as any;

  beforeEach(() => {
    sharpCalls.length = 0;
    pdfMode = 'ok';
    fsMock.readFile.mockResolvedValue(Buffer.from('content'));
    fsMock.writeFile.mockResolvedValue(undefined);
    fsMock.rename.mockResolvedValue(undefined);
  });

  it('passes through unknown file types', async () => {
    const svc = new AssetOptimizationService(config());
    expect(await svc.optimizeUploadedAsset('uploads/a.docx')).toMatchObject({
      optimizedPath: 'uploads/a.docx',
      fileType: 'docx',
      sizeBytes: 7,
    });
    expect((await svc.optimizeUploadedAsset('uploads/noext')).fileType).toBe('bin');
  });

  it('recompresses images with configured limits', async () => {
    const svc = new AssetOptimizationService(
      config({ ASSET_IMAGE_MAX_WIDTH: '800', ASSET_IMAGE_QUALITY: 'bad' }),
    );
    const r = await svc.optimizeUploadedAsset('uploads/photo.PNG');
    expect(r).toMatchObject({ optimizedPath: 'uploads/photo.PNG', fileType: 'jpg' });
    expect(sharpCalls[0].resize).toEqual({ width: 800, withoutEnlargement: true });
    expect(sharpCalls[1].jpeg).toEqual({ quality: 68, mozjpeg: true });
    expect(String(fsMock.rename.mock.calls[0][0]).replace(/\\/g, '/')).toBe('uploads/photo.optimized.jpg');

    sharpCalls.length = 0;
    await new AssetOptimizationService(config()).optimizeUploadedAsset('uploads/p.jpeg');
    expect(sharpCalls[0].resize).toEqual({ width: 1280, withoutEnlargement: true });
  });

  it('rewrites PDFs with each pdf-lib export shape', async () => {
    const svc = new AssetOptimizationService(config());
    for (const mode of ['ok', 'default-export', 'default-nested'] as const) {
      pdfMode = mode;
      const r = await svc.optimizeUploadedAsset('uploads/doc.pdf');
      expect(r.fileType).toBe('pdf');
    }
    expect(fsMock.writeFile).toHaveBeenCalledTimes(3);
  });

  it('falls back to the original PDF when pdf-lib is unavailable or fails', async () => {
    const svc = new AssetOptimizationService(config());
    pdfMode = 'import-fail';
    expect((await svc.optimizeUploadedAsset('uploads/doc.pdf')).sizeBytes).toBe(7);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('pdf-lib import failed'));

    pdfMode = 'load-fail';
    expect((await svc.optimizeUploadedAsset('uploads/doc.pdf')).fileType).toBe('pdf');
    expect(Logger.prototype.warn).toHaveBeenLastCalledWith(expect.stringContaining('ASSET_OPTIMIZE_FALLBACK'));
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('describes non-Error failures', async () => {
    const svc = new AssetOptimizationService(config());
    fsMock.writeFile.mockRejectedValueOnce('disk full');
    await svc.optimizeUploadedAsset('uploads/doc.pdf');
    expect(Logger.prototype.warn).toHaveBeenLastCalledWith(expect.stringContaining('"error":"unknown"'));
  });
});
