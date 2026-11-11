import { Injectable } from '@nestjs/common';

interface UssdStepResult {
  text: string;
  endSession: boolean;
}

@Injectable()
export class UssdMenuService {
  handle(text: string): UssdStepResult {
    const path = text.trim() ? text.trim().split('*') : [];

    if (path.length === 0) {
      return {
        text: 'Meni EduHaiti\n1.Nòt\n2.Kalandriye\n3.Avi\n4.Rezime odyo',
        endSession: false,
      };
    }

    if (path[0] === '1') {
      if (path.length === 1) {
        return {
          text: 'Tape: 1*ID_ELEV*TOKEN*OTP',
          endSession: false,
        };
      }

      return {
        text: `Demann nòt pou ${path[1]} voye.`,
        endSession: true,
      };
    }

    if (path[0] === '2') {
      return {
        text: 'Kalandriye a disponib sou portal EduHaiti a oswa nan lekòl la.',
        endSession: true,
      };
    }

    if (path[0] === '3') {
      return {
        text: 'Pou wè dènye avi yo, voye SMS: AVI ID_ELEV TOKEN OTP',
        endSession: true,
      };
    }

    if (path[0] === '4') {
      if (path.length === 1) {
        return {
          text: 'Tape: 4*ID_ELEV pou resevwa rezime odyo (IVR).',
          endSession: false,
        };
      }

      return {
        text: `Rezime odyo mande pou ${path[1]}. N ap rele w otomatikman.`,
        endSession: true,
      };
    }

    return {
      text: 'Opsyon pa valid. Tape 1, 2, 3 oswa 4.',
      endSession: true,
    };
  }
}
