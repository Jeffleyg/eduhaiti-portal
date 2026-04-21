import { Injectable } from "@nestjs/common"

interface UssdStepResult {
  text: string
  endSession: boolean
}

@Injectable()
export class UssdMenuService {
  handle(text: string): UssdStepResult {
    const path = text.trim() ? text.trim().split("*") : []

    if (path.length === 0) {
      return {
        text: "Menu EduHaiti\n1.Notas\n2.Calendario\n3.Avisos",
        endSession: false,
      }
    }

    if (path[0] === "1") {
      if (path.length === 1) {
        return {
          text: "Digite: 1*ID_ALUNO\nEx: 1*12345",
          endSession: false,
        }
      }

      return {
        text: `Consulta de notas enviada para ${path[1]}.`,
        endSession: true,
      }
    }

    if (path[0] === "2") {
      return {
        text: "Calendario: Prova 12/04. Reuniao 18/04.",
        endSession: true,
      }
    }

    if (path[0] === "3") {
      return {
        text: "Avisos: Aula normal amanha. Traga caderno.",
        endSession: true,
      }
    }

    return {
      text: "Opcao invalida. Digite 1, 2 ou 3.",
      endSession: true,
    }
  }
}
