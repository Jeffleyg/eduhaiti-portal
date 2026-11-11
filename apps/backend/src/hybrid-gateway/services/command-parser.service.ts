import { Injectable } from '@nestjs/common';

export type SmsCommandType = 'NOTA' | 'FREQ' | 'AVISO' | 'AJUDA';

export interface ParsedSmsCommand {
  type: SmsCommandType;
  studentId?: string;
  responsibleDocumentId?: string;
  otpCode?: string;
}

@Injectable()
export class CommandParserService {
  parse(rawText: string): ParsedSmsCommand {
    const sanitized = rawText.trim().replace(/\s+/g, ' ').toUpperCase();

    if (!sanitized) {
      return { type: 'AJUDA' };
    }

    const parts = sanitized.split(' ');
    // Kreyol/French aliases are accepted alongside the original command words
    const aliases: Record<string, SmsCommandType> = {
      NOT: 'NOTA',
      NOTE: 'NOTA',
      NOTES: 'NOTA',
      PREZANS: 'FREQ',
      ABSANS: 'FREQ',
      PRESENCE: 'FREQ',
      AVI: 'AVISO',
      AVIS: 'AVISO',
      ED: 'AJUDA',
      EDE: 'AJUDA',
      AIDE: 'AJUDA',
    };
    const command = aliases[parts[0]] ?? parts[0];

    if (command === 'NOTA' || command === 'FREQ') {
      return {
        type: command,
        studentId: parts[1],
        responsibleDocumentId: parts[2],
        otpCode: parts[3],
      };
    }

    if (command === 'AVISO') {
      return {
        type: 'AVISO',
        studentId: parts[1],
        responsibleDocumentId: parts[2],
        otpCode: parts[3],
      };
    }

    return { type: 'AJUDA' };
  }
}
