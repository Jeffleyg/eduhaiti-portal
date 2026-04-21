import { useContext } from "react"
import { SurvivalModeContext } from "./SurvivalModeStore.js"

export function useSurvivalMode() {
  const context = useContext(SurvivalModeContext)
  if (!context) {
    throw new Error("useSurvivalMode must be used within SurvivalModeProvider")
  }
  return context
}
