// Lightweight sanitization for user-provided text displayed in the UI.
// Protects against accidental HTML tags, control characters and trims/normalizes input.
export function sanitizeText(input, options = {}) {
  if (input === null || input === undefined) return ""
  let s = String(input)
  // Normalize and trim
  try {
    s = s.normalize("NFC")
  } catch (e) {
    // ignore if normalize not supported
  }
  s = s.trim()
  // Remove C0/C1 control characters
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
  // Strip any HTML tags to be extra-safe (React normally escapes, but some code uses innerHTML)
  s = s.replace(/<[^>]*>/g, "")
  // Collapse multiple whitespace to single space
  s = s.replace(/\s+/g, " ")
  const max = typeof options.max === "number" ? options.max : 200
  if (s.length > max) s = s.slice(0, max - 1) + "…"
  return s
}

export default sanitizeText

// Replace real person names with generic role labels to avoid exposing raw DB names
export function maskName(value, roleOrLabel) {
  // If no value provided, keep the empty/placeholder behavior
  if (value === null || value === undefined || String(value).trim() === "") return "-"

  const role = typeof roleOrLabel === "string" ? roleOrLabel.toLowerCase() : undefined

  const map = {
    student: "Aluno",
    teacher: "Professor",
    guardian: "Responsável",
    parent: "Responsável",
    user: "Usuário",
    default: "Usuário",
  }

  if (role && map[role]) return map[role]
  // allow passing a custom label (not a known role)
  if (roleOrLabel && typeof roleOrLabel === "string" && !map[role]) return roleOrLabel

  return map.default
}
