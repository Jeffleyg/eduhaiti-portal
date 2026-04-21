import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface TrustTokenPayload {
  deviceId: string;
  studentEnrollmentNumber: string;
  issuedAt: number;
  expiresAt: number;
  keyRef: string;
}

@Injectable()
export class DidAuthService {
  private readonly encryptionKey: Buffer;
  private readonly signingKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const rawEnc = this.config.get<string>('DID_KEY_ENCRYPTION_KEY');
    const rawSign = this.config.get<string>('DID_TRUST_SIGNING_KEY');

    this.encryptionKey = this.materializeKey(rawEnc, 'did-encryption-fallback');
    this.signingKey = this.materializeKey(rawSign, 'did-signing-fallback');
  }

  async issueTrustToken(
    deviceId: string,
    studentEnrollmentNumber: string,
  ): Promise<{ trustToken: string; expiresAt: number }> {
    const student = await this.prisma.user.findFirst({
      where: { enrollmentNumber: studentEnrollmentNumber },
      select: { id: true, enrollmentNumber: true },
    });

    if (!student?.enrollmentNumber) {
      throw new UnauthorizedException('Unknown student enrollment');
    }

    const keyRef = randomBytes(8).toString('hex');
    const encryptedKeyBlob = this.encryptKeyMaterial(randomBytes(32));

    await this.prisma.auditLog.create({
      data: {
        entityType: 'DID_KEY',
        entityId: student.id,
        action: 'STORE',
        changes: JSON.stringify({ deviceId, keyRef, encryptedKeyBlob }),
      },
    });

    const issuedAt = Date.now();
    const expiresAt = issuedAt + 1000 * 60 * 60 * 24 * 30;
    const payload: TrustTokenPayload = {
      deviceId,
      studentEnrollmentNumber,
      issuedAt,
      expiresAt,
      keyRef,
    };

    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);

    return {
      trustToken: `${encodedPayload}.${signature}`,
      expiresAt,
    };
  }

  verifyTrustTokenOffline(token: string): TrustTokenPayload {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid trust token format');
    }

    const expected = this.sign(encodedPayload);
    const given = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      given.length !== expectedBuffer.length ||
      !timingSafeEqual(given, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid trust token signature');
    }

    const payload = JSON.parse(
      this.base64UrlDecode(encodedPayload),
    ) as TrustTokenPayload;

    if (payload.expiresAt < Date.now()) {
      throw new UnauthorizedException('Trust token expired');
    }

    return payload;
  }

  private materializeKey(
    rawKey: string | undefined,
    fallbackSeed: string,
  ): Buffer {
    if (!rawKey) {
      return createHmac('sha256', fallbackSeed).update('eduhaiti').digest();
    }

    if (/^[A-Fa-f0-9]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }

    const asBase64 = Buffer.from(rawKey, 'base64');

    if (asBase64.length >= 32) {
      return asBase64.subarray(0, 32);
    }

    return createHmac('sha256', fallbackSeed).update(rawKey).digest();
  }

  private encryptKeyMaterial(keyMaterial: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(keyMaterial),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.signingKey)
      .update(encodedPayload)
      .digest('base64url');
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private base64UrlDecode(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  // Helper used for future key recovery tests.
  private decryptKeyMaterial(blob: string): Buffer {
    const packed = Buffer.from(blob, 'base64');
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
