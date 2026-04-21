/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, extname, join } from 'path';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

@Injectable()
export class AudioTranscodingService {
  constructor(private readonly config: ConfigService) {}

  async transcodeVideoToLowBitrateMp3(
    inputPath: string,
    targetBitrate?: string,
  ): Promise<{
    outputPath: string;
    bitrate: string;
    contentHash: string;
    sizeBytes: number;
  }> {
    const configuredBitrate =
      this.config.get<string>('AUDIO_LOW_BITRATE')?.trim() || '48k';
    const bitrate = targetBitrate?.trim() || configuredBitrate;
    const outputPath = this.buildOutputPath(inputPath, bitrate);

    await fs.mkdir(dirname(outputPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(bitrate)
        .audioChannels(1)
        .audioFrequency(22050)
        .format('mp3')
        .on('end', () => resolve())
        .on('error', (error: unknown) => {
          reject(
            error instanceof Error
              ? error
              : new Error('Audio transcoding process failed'),
          );
        })
        .save(outputPath);
    }).catch((error: unknown) => {
      throw new InternalServerErrorException(
        error instanceof Error
          ? `Audio transcoding failed: ${error.message}`
          : 'Audio transcoding failed',
      );
    });

    const output = await fs.readFile(outputPath);

    return {
      outputPath,
      bitrate,
      contentHash: createHash('sha256').update(output).digest('hex'),
      sizeBytes: output.byteLength,
    };
  }

  private buildOutputPath(inputPath: string, bitrate: string): string {
    const folder =
      this.config.get<string>('AUDIO_OUTPUT_DIR')?.trim() ||
      join(process.cwd(), 'uploads', 'audio');
    const baseName = inputPath
      .split(/[\\/]/)
      .pop()
      ?.replace(extname(inputPath), '')
      .replace(/[^a-zA-Z0-9-_]/g, '_');

    const safeName = baseName && baseName.length > 0 ? baseName : 'lesson';
    const bitrateSuffix = bitrate.replace(/[^a-zA-Z0-9]/g, '') || '48k';
    return join(folder, `${safeName}-${bitrateSuffix}-${Date.now()}.mp3`);
  }
}
