const STICK_KEY = "controllercheck_stick_preference"
const STAGE1_KEY = "controllercheck_stage1_progress"
const STAGE2_ATTEMPTS_KEY = "controllercheck_stage2_attempts"
const SESSIONS_KEY = "controllercheck_sessions_v1"

export const STAGE2_PASS_THRESHOLD = 75

// ---------------------------------------------------------------
// Thumbstick preference (set on the About page, read by Stage 1 & 2)
// ---------------------------------------------------------------

export function setStickPreference(stick) {
  localStorage.setItem(STICK_KEY, stick)
}

export function getStickPreference() {
  const v = localStorage.getItem(STICK_KEY)
  return v === "left" || v === "right" ? v : null
}

// ---------------------------------------------------------------
// Stage 1: Controller Familiarisation checklist
// ---------------------------------------------------------------

export function saveStage1Progress(progress) {
  localStorage.setItem(STAGE1_KEY, JSON.stringify(progress))
}

export function getStage1Progress() {
  try {
    const raw = localStorage.getItem(STAGE1_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error("Could not read Stage 1 progress", e)
    return null
  }
}

// ---------------------------------------------------------------
// Stage 2: Random Dot Motion task 
// // ---------------------------------------------------------------

export function getStage2Attempts() {
  try {
    const raw = localStorage.getItem(STAGE2_ATTEMPTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error("Could not read Stage 2 attempts", e)
    return []
  }
}

export function addStage2Attempt(attempt) {
  const all = getStage2Attempts()
  const withNumber = { ...attempt, attemptNumber: all.length + 1 }
  all.push(withNumber)
  localStorage.setItem(STAGE2_ATTEMPTS_KEY, JSON.stringify(all))
  return withNumber
}

export function hasPassedStage2() {
  return getStage2Attempts().some(a => a.passed)
}

// ---------------------------------------------------------------
// Hardware Comfort & Familiarity Questionnaire
// ---------------------------------------------------------------

// Items 8 and 9 (1-indexed; index 7 and 8, 0-indexed) are negatively worded
// and get reverse-scored, matching how the System Usability Scale mixes
// positive/negative items to control for acquiescence bias.
const NEGATIVE_ITEM_INDEXES = [7, 8]

export function computeHardwareComfortScore(ratings) {
  let total = 0
  ratings.forEach((value, i) => {
    const isNegative = NEGATIVE_ITEM_INDEXES.includes(i)
    total += isNegative ? (5 - value) : (value - 1)
  })
  return (total / (ratings.length * 4)) * 100
}

// ---------------------------------------------------------------
// Final combined session record
// ---------------------------------------------------------------

export function getAllSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error("Could not read saved sessions", e)
    return []
  }
}

export function saveSession(session) {
  const all = getAllSessions()
  all.push(session)
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all))
    return true
  } catch (e) {
    console.error("Could not save session", e)
    return false
  }
}

// ---------------------------------------------------------------
// CSV export — one row per Stage 2 trial, across every attempt,
// with participant/session-level columns repeated (tidy format).
// ---------------------------------------------------------------

function csvEscape(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function sessionToCSV(session) {
  const q = session.questionnaire
  const comfortCols = q.comfortRatings.map((_, i) => `comfort_q${i + 1}`)

  const header = [
    "participant_id", "stick_preference",
    "stage1_all_complete", "stage1_completed_at",
    "attempt_number", "attempt_timestamp", "accuracy_pct", "final_coherence_pct",
    "passed", "completion_time_ms",
    "block", "trial", "direction", "coherence", "correct",
    "hardware_comfort_score", ...comfortCols,
    "used_controller_before", "usage_frequency", "controller_types",
    "experienced_discomfort", "discomfort_details",
    "difficult_input", "improvement_suggestions",
    "submitted_at"
  ]

  const rows = []
  const attempts = session.stage2Attempts.length ? session.stage2Attempts : [null]

  for (const attempt of attempts) {
    const trials = attempt && attempt.trials.length ? attempt.trials : [null]
    for (const t of trials) {
      rows.push([
        session.participantId,
        session.stick,
        session.stage1 ? String(session.stage1.allComplete) : "",
        session.stage1?.completedAt ?? "",
        attempt ? String(attempt.attemptNumber) : "",
        attempt ? attempt.timestamp : "",
        attempt ? attempt.accuracy.toFixed(1) : "",
        attempt ? attempt.finalCoherence.toFixed(1) : "",
        attempt ? String(attempt.passed) : "",
        attempt ? String(attempt.completionTimeMs) : "",
        t ? String(t.block) : "",
        t ? String(t.trial) : "",
        t ? t.direction : "",
        t ? t.coherence.toFixed(4) : "",
        t ? (t.correct ? "1" : "0") : "",
        session.hardwareComfortScore.toFixed(1),
        ...q.comfortRatings.map(String),
        q.hasUsedControllerBefore,
        q.usageFrequency,
        q.controllerTypes.join("; "),
        q.experiencedDiscomfort,
        q.discomfortDetails,
        q.difficultInput,
        q.improvementSuggestions,
        session.submittedAt
      ].map(v => csvEscape(String(v))).join(","))
    }
  }

  return [header.join(","), ...rows].join("\n")
}

export function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadSessionCSV(session) {
  const safeId = session.participantId.replace(/[^a-z0-9_-]/gi, "_") || "participant"
  const datePart = session.submittedAt.slice(0, 10)
  downloadTextFile(`controllercheck_${safeId}_${datePart}.csv`, sessionToCSV(session), "text/csv")
}
