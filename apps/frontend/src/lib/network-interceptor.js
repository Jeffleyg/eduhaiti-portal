/**
 * Network Request Classification for Survival Mode
 * Classifies API endpoints as ESSENTIAL, NON_ESSENTIAL, or ADVISORY
 */

const ESSENTIAL_PATTERNS = [
  // Auth
  /^\/auth\//,
  /^\/auth$/,
  // User profile and account
  /^\/users\/me/,
  /^\/users\/profile/,
  // Core academic data
  /^\/classes(\/|$|\?)/,
  /^\/grades(\/|$|\?)/,
  /^\/attendance(\/|$|\?)/,
  /^\/disciplines(\/|$|\?)/,
  /^\/academic-periods(\/|$|\?)/,
  /^\/resources(\/|$|\?)/,
  /^\/lessons(\/|$|\?)/,
  /^\/assignments(\/|$|\?)/,
  // Admin critical
  /^\/admin\/users(\/|$|\?)/,
  /^\/admin\/classes(\/|$|\?)/,
  /^\/admin\/grades(\/|$|\?)/,
  /^\/admin\/attendance(\/|$|\?)/,
  /^\/admin\/academic-/,
  // Sync critical
  /^\/sync\//,
  /^\/sync$/,
]

const NON_ESSENTIAL_PATTERNS = [
  // Analytics and metrics
  /^\/analytics/,
  /^\/metrics/,
  // Notifications (can be cached)
  /^\/notifications\?/,
  // Media and assets (use offline cache)
  /^\/media\//,
  /^\/assets\//,
  // Forums and social (low priority)
  /^\/forums\//,
  /^\/messages(\/|$)/,
  // Gamification (purely decorative)
  /^\/gamification/,
  /^\/leaderboards/,
  // Health checks
  /^\/health/,
  /^\/ping/,
]

const ADVISORY_PATTERNS = [
  // Can be retried later
  /^\/announcements/,
  /^\/news/,
  // User preferences
  /^\/users\/.*\/preferences/,
  /^\/settings/,
]

export function classifyRequest(path) {
  // Normalize path
  const normalizedPath = path.startsWith("/api") ? path.slice(4) : path

  // Check essential
  if (ESSENTIAL_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return "ESSENTIAL"
  }

  // Check advisory
  if (ADVISORY_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return "ADVISORY"
  }

  // Check non-essential
  if (NON_ESSENTIAL_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return "NON_ESSENTIAL"
  }

  // Default to advisory (safer to allow than block)
  return "ADVISORY"
}

export function shouldBlockRequest(path, isSurvivalMode) {
  if (!isSurvivalMode) {
    return false
  }

  const classification = classifyRequest(path)
  return classification === "NON_ESSENTIAL"
}

export class SurvivalModeNetworkError extends Error {
  constructor(path, reason = "blocked_in_survival_mode") {
    super(`Network request blocked in survival mode: ${path} (${reason})`)
    this.code = "SURVIVAL_MODE_BLOCKED"
    this.path = path
    this.reason = reason
  }
}
