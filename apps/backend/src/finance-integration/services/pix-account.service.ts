import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePixAccountDto } from '../dto/create-pix-account.dto';

@Injectable()
export class PixAccountService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveSchoolId(schoolId?: string) {
    if (schoolId) {
      return schoolId;
    }

    const school = await this.prisma.school.findFirst({ select: { id: true } });
    if (!school) {
      throw new NotFoundException('School record not found');
    }

    return school.id;
  }

  /**
   * Create a new PIX account for a school
   */
  async createPixAccount(schoolId: string, dto: CreatePixAccountDto) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    // Validate PIX key format based on type
    this.validatePixKey(dto.keyType, dto.key);

    // Check if school exists
    const school = await this.prisma.school.findUnique({
      where: { id: resolvedSchoolId },
    });

    if (!school) {
      throw new NotFoundException('Escola não encontrada');
    }

    // Check for duplicate key
    const existing = await this.prisma.pixAccount.findUnique({
      where: { schoolId_key: { schoolId: resolvedSchoolId, key: dto.key } },
    });

    if (existing) {
      throw new BadRequestException('Chave PIX já cadastrada para esta escola');
    }

    // If this should be primary, unset others
    if (dto.keyType === 'RANDOM' || !dto.keyType) {
      await this.prisma.pixAccount.updateMany({
        where: { schoolId: resolvedSchoolId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const pixAccount = await this.prisma.pixAccount.create({
      data: {
        schoolId: resolvedSchoolId,
        keyType: dto.keyType,
        key: dto.key,
        accountHolderName: dto.accountHolderName,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountBranch: dto.accountBranch,
        description: dto.description,
        isPrimary: true, // First account is primary by default
      },
    });

    return {
      id: pixAccount.id,
      keyType: pixAccount.keyType,
      key: this.maskPixKey(pixAccount.key, pixAccount.keyType),
      accountHolderName: pixAccount.accountHolderName,
      description: pixAccount.description,
      isPrimary: pixAccount.isPrimary,
      isActive: pixAccount.isActive,
      createdAt: pixAccount.createdAt,
    };
  }

  /**
   * Get PIX accounts for a school
   */
  async getPixAccounts(schoolId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    const accounts = await this.prisma.pixAccount.findMany({
      where: { schoolId: resolvedSchoolId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map((acc) => ({
      id: acc.id,
      keyType: acc.keyType,
      key: this.maskPixKey(acc.key, acc.keyType),
      accountHolderName: acc.accountHolderName,
      description: acc.description,
      isPrimary: acc.isPrimary,
      isActive: acc.isActive,
      createdAt: acc.createdAt,
    }));
  }

  /**
   * Get primary PIX account for a school
   */
  async getPrimaryPixAccount(schoolId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    const account = await this.prisma.pixAccount.findFirst({
      where: { schoolId: resolvedSchoolId, isPrimary: true, isActive: true },
    });

    if (!account) {
      throw new NotFoundException('Nenhuma conta PIX primária ativa encontrada');
    }

    return {
      id: account.id,
      keyType: account.keyType,
      key: account.key,
      accountHolderName: account.accountHolderName,
      isPrimary: account.isPrimary,
      isActive: account.isActive,
    };
  }

  async getPublicPrimaryPixAccount() {
    const school = await this.prisma.school.findFirst({ select: { id: true } });

    if (!school) {
      throw new NotFoundException('School record not found');
    }

    return this.getPrimaryPixAccount(school.id);
  }

  /**
   * Set a PIX account as primary
   */
  async setPixAccountAsPrimary(schoolId: string, pixAccountId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    const account = await this.prisma.pixAccount.findUnique({
      where: { id: pixAccountId },
    });

    if (!account || account.schoolId !== resolvedSchoolId) {
      throw new NotFoundException('Conta PIX não encontrada');
    }

    // Unset other primary accounts
    await this.prisma.pixAccount.updateMany({
      where: { schoolId: resolvedSchoolId, isPrimary: true },
      data: { isPrimary: false },
    });

    // Set this as primary
    const updated = await this.prisma.pixAccount.update({
      where: { id: pixAccountId },
      data: { isPrimary: true },
    });

    return {
      id: updated.id,
      isPrimary: updated.isPrimary,
    };
  }

  /**
   * Update PIX account status
   */
  async updatePixAccountStatus(schoolId: string, pixAccountId: string, isActive: boolean) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    const account = await this.prisma.pixAccount.findUnique({
      where: { id: pixAccountId },
    });

    if (!account || account.schoolId !== resolvedSchoolId) {
      throw new NotFoundException('Conta PIX não encontrada');
    }

    const updated = await this.prisma.pixAccount.update({
      where: { id: pixAccountId },
      data: { isActive },
    });

    return {
      id: updated.id,
      isActive: updated.isActive,
    };
  }

  /**
   * Delete PIX account
   */
  async deletePixAccount(schoolId: string, pixAccountId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    const account = await this.prisma.pixAccount.findUnique({
      where: { id: pixAccountId },
    });

    if (!account || account.schoolId !== resolvedSchoolId) {
      throw new NotFoundException('Conta PIX não encontrada');
    }

    // Cannot delete if it's the only primary account
    if (account.isPrimary) {
      const otherPrimary = await this.prisma.pixAccount.findFirst({
        where: {
          schoolId: resolvedSchoolId,
          id: { not: pixAccountId },
          isPrimary: true,
        },
      });

      if (!otherPrimary) {
        throw new BadRequestException(
          'Não é possível deletar a única conta PIX primária. Configure outra como primária primeiro.',
        );
      }
    }

    await this.prisma.pixAccount.delete({
      where: { id: pixAccountId },
    });

    return { success: true };
  }

  /**
   * Validate PIX key format
   */
  private validatePixKey(keyType: string, key: string) {
    const trimmedKey = key.trim();

    switch (keyType) {
      case 'CPF':
        if (!/^\d{11}$/.test(trimmedKey)) {
          throw new BadRequestException('CPF deve conter 11 dígitos');
        }
        break;
      case 'CNPJ':
        if (!/^\d{14}$/.test(trimmedKey)) {
          throw new BadRequestException('CNPJ deve conter 14 dígitos');
        }
        break;
      case 'EMAIL':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedKey)) {
          throw new BadRequestException('Email inválido');
        }
        break;
      case 'PHONE':
        if (!/^\+?[\d\s\-()]+$/.test(trimmedKey) || trimmedKey.replace(/\D/g, '').length < 10) {
          throw new BadRequestException('Telefone inválido');
        }
        break;
      case 'RANDOM':
        if (!/^[a-f0-9-]{36}$/.test(trimmedKey)) {
          throw new BadRequestException('UUID aleatório inválido');
        }
        break;
    }
  }

  /**
   * Mask PIX key for display (shows only part of it)
   */
  private maskPixKey(key: string, keyType: string): string {
    switch (keyType) {
      case 'CPF':
        return `***.**-.${key.slice(-2)}`;
      case 'CNPJ':
        return `***.**.**-${key.slice(-2)}`;
      case 'EMAIL':
        const [local, domain] = key.split('@');
        return `${local.slice(0, 2)}****@${domain}`;
      case 'PHONE':
        const digits = key.replace(/\D/g, '');
        return `****${digits.slice(-4)}`;
      case 'RANDOM':
        return key.slice(0, 8) + '****';
      default:
        return '****';
    }
  }
}
