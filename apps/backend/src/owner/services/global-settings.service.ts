import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { AuditService } from './audit.service'
import * as crypto from 'crypto'

/**
 * GlobalSettingsService - Manages system-wide configuration
 * Handles encryption for sensitive keys (payment gateway credentials)
 */
@Injectable()
export class GlobalSettingsService {
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-insecure-key-change-in-production'
  private readonly encryptionAlgorithm = 'aes-256-cbc'

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  /**
   * Encrypt sensitive string
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, Buffer.from(this.encryptionKey, 'utf8').slice(0, 32), iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
  }

  /**
   * Decrypt sensitive string
   */
  private decrypt(text: string): string {
    const parts = text.split(':')
    const ivHex = parts.shift()
    if (!ivHex) throw new BadRequestException('Invalid encrypted payload')
    const iv = Buffer.from(ivHex, 'hex')
    const encryptedText = Buffer.from(parts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, Buffer.from(this.encryptionKey, 'utf8').slice(0, 32), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  }

  /**
   * Set a global setting
   */
  async setSetting(
    settingKey: string,
    settingValue: string | object,
    isEncrypted: boolean = false,
    userId?: string,
    description?: string
  ) {
    if (!settingKey) {
      throw new BadRequestException('settingKey is required')
    }

    const valueStr = typeof settingValue === 'string' ? settingValue : JSON.stringify(settingValue)
    const encryptedValue = isEncrypted ? this.encrypt(valueStr) : valueStr

    // Try to find existing
    const existing = await this.prisma.globalSetting.findUnique({
      where: { key: settingKey },
    })

    const oldValue = existing?.value

    const result = existing
      ? await this.prisma.globalSetting.update({
          where: { key: settingKey },
          data: {
            value: encryptedValue,
            isEncrypted,
            description,
          },
        })
      : await this.prisma.globalSetting.create({
          data: {
            key: settingKey,
            value: encryptedValue,
            isEncrypted,
            description,
          },
        })

    if (userId && isEncrypted) {
      // Don't log encrypted values
      await this.auditService.log({
        userId,
        action: 'SETTING_UPDATED',
        resource: 'GlobalSettings',
        resourceId: settingKey,
        description: `Updated setting: ${settingKey}`,
        oldValues: { isEncrypted: true },
        newValues: { isEncrypted: true },
      })
    }

    return result
  }

  /**
   * Get a setting (auto-decrypts if needed)
   */
  async getSetting(settingKey: string) {
    const setting = await this.prisma.globalSetting.findUnique({
      where: { key: settingKey },
    })

    if (!setting) {
      return null
    }

    const value = setting.isEncrypted ? this.decrypt(setting.value) : setting.value

    return {
      ...setting,
      value: value,
    }
  }

  /**
   * Get raw encrypted value (for storage operations)
   */
  async getRawSetting(settingKey: string) {
    return this.prisma.globalSetting.findUnique({
      where: { key: settingKey },
    })
  }

  /**
   * List all settings (hides encrypted values)
   */
  async listSettings(skip: number = 0, take: number = 50) {
    const [settings, total] = await Promise.all([
      this.prisma.globalSetting.findMany({
        skip,
        take,
        orderBy: { key: 'asc' },
      }),
      this.prisma.globalSetting.count(),
    ])

    return {
      data: settings.map(s => ({
        ...s,
        value: s.isEncrypted ? '[ENCRYPTED]' : s.value,
      })),
      total,
      skip,
      take,
    }
  }

  /**
   * Configure payment gateway (with encryption)
   */
  async setPaymentGatewayConfig(
    provider: 'STRIPE' | 'ASAAS' | 'EFI' | 'MONCASH',
    apiKey: string,
    apiSecret?: string,
    userId?: string
  ) {
    if (!provider || !apiKey) {
      throw new BadRequestException('provider and apiKey are required')
    }

    const key = `GATEWAY_${provider.toUpperCase()}_KEY`
    const secretKey = `GATEWAY_${provider.toUpperCase()}_SECRET`

    await this.setSetting(key, apiKey, true, userId, `${provider} API Key`)

    if (apiSecret) {
      await this.setSetting(secretKey, apiSecret, true, userId, `${provider} API Secret`)
    }

    return {
      success: true,
      message: `${provider} configuration saved`,
      provider,
    }
  }

  /**
   * Get payment gateway config (decrypted)
   */
  async getPaymentGatewayConfig(provider: 'STRIPE' | 'ASAAS' | 'EFI' | 'MONCASH') {
    const key = `GATEWAY_${provider.toUpperCase()}_KEY`
    const secretKey = `GATEWAY_${provider.toUpperCase()}_SECRET`

    const apiKeySetting = await this.getSetting(key)
    const apiSecretSetting = await this.getSetting(secretKey)

    return {
      provider,
      apiKey: apiKeySetting?.value,
      apiSecret: apiSecretSetting?.value,
      configured: !!apiKeySetting,
    }
  }

  /**
   * Initialize default settings
   */
  async initializeDefaults() {
    const defaults = {
      SYSTEM_NAME: { value: 'EduHaiti', encrypted: false, description: 'System display name' },
      SYSTEM_LANGUAGE: { value: 'pt-BR', encrypted: false, description: 'Default system language' },
      DEFAULT_PASSING_GRADE: { value: '60', encrypted: false, description: 'Minimum passing grade' },
      ACADEMIC_YEAR_START: { value: '01-09', encrypted: false, description: 'Academic year start month-day' },
      ACADEMIC_YEAR_END: { value: '30-06', encrypted: false, description: 'Academic year end month-day' },
      MAX_FILE_UPLOAD_SIZE_MB: { value: '50', encrypted: false, description: 'Maximum upload file size' },
      SYSTEM_MAINTENANCE_MODE: { value: 'false', encrypted: false, description: 'Enable maintenance mode' },
      SUPPORTED_LANGUAGES: { value: 'pt-BR,en,fr', encrypted: false, description: 'Comma-separated list of supported languages' },
      EMAIL_FROM_ADDRESS: { value: 'noreply@eduhaiti.edu.ht', encrypted: false, description: 'Default email sender' },
      ENABLE_STUDENT_REGISTRATION: { value: 'true', encrypted: false, description: 'Allow student registration' },
      ENABLE_PARENT_ACCESS: { value: 'true', encrypted: false, description: 'Allow parent access' },
      SECURITY_SESSION_TIMEOUT_MINUTES: { value: '30', encrypted: false, description: 'Session timeout duration' },
      SECURITY_PASSWORD_MIN_LENGTH: { value: '8', encrypted: false, description: 'Minimum password length' },
      SECURITY_PASSWORD_REQUIRE_SPECIAL_CHAR: { value: 'true', encrypted: false, description: 'Require special characters in password' },
      DATA_RETENTION_DAYS: { value: '365', encrypted: false, description: 'Days to retain audit logs' },
    }

    const created: any[] = []

    for (const [key, config] of Object.entries(defaults)) {
      const existing = await this.getRawSetting(key)
      if (!existing) {
        const setting = await this.setSetting(
          key,
          config.value,
          config.encrypted,
          undefined,
          config.description
        )
        created.push(setting)
      }
    }

    return {
      created: created.length,
      settings: created,
    }
  }

  /**
   * Update bulk settings
   */
  async updateBulkSettings(
    settings: Array<{ key: string; value: string | object; encrypted?: boolean }>,
    userId?: string
  ) {
    const updated: any[] = []

    for (const setting of settings) {
      const result = await this.setSetting(
        setting.key,
        setting.value,
        setting.encrypted || false,
        userId
      )
      updated.push(result)
    }

    return {
      updated: updated.length,
      settings: updated,
    }
  }

  /**
   * Get system configuration (public settings only)
   */
  async getSystemConfig() {
    const settings = await this.prisma.globalSetting.findMany()

    const config = {}

    for (const setting of settings) {
      if (!setting.isEncrypted) {
        try {
          config[setting.key] = JSON.parse(setting.value)
        } catch {
          config[setting.key] = setting.value
        }
      }
    }

    return config
  }

  /**
   * Validate gateway configuration before save
   */
  async validateGatewayConfig(provider: 'STRIPE' | 'ASAAS' | 'EFI' | 'MONCASH', apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      throw new BadRequestException(`Invalid API key for ${provider}`)
    }

    // Provider-specific validation
    switch (provider) {
      case 'STRIPE':
        if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
          throw new BadRequestException('Invalid Stripe API key format')
        }
        break

      case 'ASAAS':
        if (apiKey.length < 20) {
          throw new BadRequestException('Invalid Asaas API key length')
        }
        break

      case 'EFI':
        if (!apiKey.includes(':')) {
          throw new BadRequestException('Efí API key must contain credentials separator')
        }
        break

      case 'MONCASH':
        if (!apiKey.startsWith('c_')) {
          throw new BadRequestException('Invalid MonCash API key format')
        }
        break
    }

    return { valid: true, provider }
  }
}
