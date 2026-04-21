/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { basename, dirname, extname, join } from 'path';
import sharp from 'sharp';

interface OptimizationResult {
  optimizedPath: string;
  fileType: string;
  contentHash: string;
  sizeBytes: number;
}

@Injectable()
export class AssetOptimizationService {
  private readonly logger = new Logger(AssetOptimizationService.name);

  constructor(private readonly config: ConfigService) {}

  async optimizeUploadedAsset(filePath: string): Promise<OptimizationResult> {
    const extension = extname(filePath).toLowerCase();

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
      return this.optimizeImage(filePath);
    }

    if (extension === '.pdf') {
      return this.optimizePdf(filePath);
    }

    const file = await fs.readFile(filePath);
    return {
      optimizedPath: filePath,
      fileType: extension.replace('.', '') || 'bin',
      contentHash: this.hashBuffer(file),
      sizeBytes: file.byteLength,
    };
  }

  private async optimizeImage(filePath: string): Promise<OptimizationResult> {
    const maxWidth = this.getNumber('ASSET_IMAGE_MAX_WIDTH', 1280);
    const quality = this.getNumber('ASSET_IMAGE_QUALITY', 68);
    const outputPath = this.buildOptimizedPath(filePath, '.jpg');

    await sharp(filePath)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toFile(outputPath);

    await this.safeReplace(filePath, outputPath);

    const finalBuffer = await fs.readFile(filePath);
    this.logger.log(
      JSON.stringify({
        event: 'ASSET_OPTIMIZED',
        type: 'image',
        filePath,
        sizeBytes: finalBuffer.byteLength,
      }),
    );

    return {
      optimizedPath: filePath,
      fileType: 'jpg',
      contentHash: this.hashBuffer(finalBuffer),
      sizeBytes: finalBuffer.byteLength,
    };
  }

  private async optimizePdf(filePath: string): Promise<OptimizationResult> {
    try {
      const input = await fs.readFile(filePath);
      const pdf = await PDFDocument.load(input, { ignoreEncryption: true });

      const output = await pdf.save({
        useObjectStreams: true,
        updateFieldAppearances: false,
      });

      const outputPath = this.buildOptimizedPath(filePath, '.pdf');
      await fs.writeFile(outputPath, output);
      await this.safeReplace(filePath, outputPath);

      const finalBuffer = await fs.readFile(filePath);
      this.logger.log(
        JSON.stringify({
          event: 'ASSET_OPTIMIZED',
          type: 'pdf',
          filePath,
          sizeBytes: finalBuffer.byteLength,
        }),
      );

      return {
        optimizedPath: filePath,
        fileType: 'pdf',
        contentHash: this.hashBuffer(finalBuffer),
        sizeBytes: finalBuffer.byteLength,
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'ASSET_OPTIMIZE_FALLBACK',
          type: 'pdf',
          filePath,
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );

      const original = await fs.readFile(filePath);
      return {
        optimizedPath: filePath,
        fileType: 'pdf',
        contentHash: this.hashBuffer(original),
        sizeBytes: original.byteLength,
      };
    }
  }

  private async safeReplace(
    originalPath: string,
    tempPath: string,
  ): Promise<void> {
    await fs.rename(tempPath, originalPath);
  }

  private buildOptimizedPath(filePath: string, extension: string): string {
    const file = basename(filePath, extname(filePath));
    return join(dirname(filePath), `${file}.optimized${extension}`);
  }

  private getNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private hashBuffer(buffer: Buffer | Uint8Array): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
