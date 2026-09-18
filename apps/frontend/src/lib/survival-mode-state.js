/**
 * Global Survival Mode State Manager
 * Allows non-React modules (like api.js) to access survival mode state
 */

class SurvivalModeStateManager {
  constructor() {
    this.isSurvivalMode = false
    this.listeners = []
  }

  setSurvivalMode(enabled) {
    if (this.isSurvivalMode !== enabled) {
      this.isSurvivalMode = enabled
      this.notifyListeners()
    }
  }

  getSurvivalMode() {
    return this.isSurvivalMode
  }

  subscribe(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  notifyListeners() {
    this.listeners.forEach((listener) => listener(this.isSurvivalMode))
  }
}

export const survivalModeStateManager = new SurvivalModeStateManager()
