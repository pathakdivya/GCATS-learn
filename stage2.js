import { getStickPreference, addStage2Attempt, hasPassedStage2, STAGE2_PASS_THRESHOLD } from "./storage.js"

class RDMStaircaseTrainer {
  DOT_COUNT = 140
  DOT_SPEED = 0.0032
  DOT_RADIUS = 2.2
  DOT_MAX_LIFE = 24

  TRIALS_PER_BLOCK = 40
  TOTAL_BLOCKS = 2
  COHERENCE_START = 0.5
  COHERENCE_STEP = 0.05
  COHERENCE_MIN = 0.03
  COHERENCE_MAX = 0.95

  RESPONSE_THRESHOLD = 0.5
  RECENTER_THRESHOLD = 0.2

  phase = "idle"
  currentDirection = "up"
  currentBlock = 1
  currentTrial = 0
  results = []
  gamepadConnected = false
  keyboardAxis = { x: 0, y: 0 }
  animationFrame = 0
  feedbackTimeout = undefined
  dots = []
  attemptStartTime = 0

  constructor() {
    this.coherence = this.COHERENCE_START
    this.stick = getStickPreference()

    this.canvas = document.getElementById("rdm-canvas")
    this.ctx = this.canvas.getContext("2d")
    this.startBtn = document.getElementById("rdm-start-btn")
    this.statusText = document.getElementById("rdm-status-text")
    this.blockValue = document.getElementById("rdm-block-value")
    this.trialValue = document.getElementById("rdm-trial-value")
    this.coherenceValue = document.getElementById("rdm-coherence-value")
    this.progressFill = document.getElementById("rdm-progress-fill")
    this.feedbackBadge = document.getElementById("rdm-feedback-badge")
    this.completeScreen = document.getElementById("rdm-complete-screen")
    this.finalCoherenceEl = document.getElementById("rdm-final-coherence")
    this.finalAccuracyEl = document.getElementById("rdm-final-accuracy")
    this.resultHeading = document.getElementById("rdm-result-heading")
    this.resultMessage = document.getElementById("rdm-result-message")
    this.redoBtn = document.getElementById("rdm-redo-btn")
    this.continueBtn = document.getElementById("rdm-continue-btn")
    this.attemptNote = document.getElementById("rdm-attempt-note")
    this.noStickNotice = document.getElementById("no-stick-notice")
    this.taskLayout = document.getElementById("rdm-task-layout")
    this.arrowEls = {
      up: document.getElementById("rdm-arrow-up"),
      down: document.getElementById("rdm-arrow-down"),
      left: document.getElementById("rdm-arrow-left"),
      right: document.getElementById("rdm-arrow-right")
    }
    this.miniStickDot = document.querySelector("#rdm-active-stick .stick-dot")
    this.miniStickLine = document.querySelector("#rdm-active-stick .stick-line")
    this.miniStickLabel = document.getElementById("rdm-active-stick-label")
    this.instructionsEl = document.getElementById("rdm-instructions")

    if (!this.stick) {
      this.noStickNotice.classList.remove("rdm-hidden")
      this.taskLayout.classList.add("rdm-hidden")
      return
    }

    const label = this.stick === "left" ? "Left Stick" : "Right Stick"
    this.miniStickLabel.textContent = label
    this.instructionsEl.innerHTML = `<b>How to respond:</b> a field of dots appears; some move together in one
      direction (up, down, left, or right) while the rest drift randomly. As soon as
      you can tell the direction, tilt the <b>${label.toLowerCase()}</b> that way. After you
      respond, re-center the stick to neutral before the next trial starts. If no
      gamepad is detected you can use the <b>arrow keys</b> instead.`

    this.continueBtn.disabled = !hasPassedStage2()
    this.updateAttemptNote()

    this.init()
  }

  init() {
    this.setupEventListeners()
    this.seedDotField()
    this.renderLoop()
  }

  setupEventListeners() {
    window.addEventListener("gamepadconnected", () => {
      this.gamepadConnected = true
      this.updateIdleStatus()
    })
    window.addEventListener("gamepaddisconnected", () => {
      this.gamepadConnected = false
      this.updateIdleStatus()
    })
    window.addEventListener("keydown", (e) => this.handleKey(e, true))
    window.addEventListener("keyup", (e) => this.handleKey(e, false))

    this.startBtn.addEventListener("click", () => this.startCalibration())
    this.redoBtn.addEventListener("click", () => this.startCalibration())
    this.continueBtn.addEventListener("click", () => {
      if (!this.continueBtn.disabled) window.location.href = "stage3.html"
    })
    this.updateIdleStatus()
  }

  updateAttemptNote() {
    const passed = hasPassedStage2()
    this.attemptNote.textContent = passed
      ? `You've already met the ${STAGE2_PASS_THRESHOLD}% accuracy criterion on a previous attempt.`
      : ""
  }

  handleKey(e, isDown) {
    const v = isDown ? 1 : 0
    switch (e.key) {
      case "ArrowLeft": this.keyboardAxis.x = -v; break
      case "ArrowRight": this.keyboardAxis.x = v; break
      case "ArrowUp": this.keyboardAxis.y = -v; break
      case "ArrowDown": this.keyboardAxis.y = v; break
    }
  }

  updateIdleStatus() {
    if (this.phase !== "idle") return
    this.statusText.innerHTML = this.gamepadConnected
      ? "Gamepad detected. Press <b>Begin</b> to start the task."
      : "No gamepad detected &mdash; press <b>Begin</b> to start using arrow keys, or connect a gamepad first."
  }

  // ---------------------------------------------------------------
  // Trial flow
  // ---------------------------------------------------------------

  startCalibration() {
    this.currentBlock = 1
    this.currentTrial = 0
    this.coherence = this.COHERENCE_START
    this.results = []
    this.attemptStartTime = performance.now()
    this.completeScreen.classList.add("rdm-hidden")

    this.startBtn.disabled = true
    this.startBtn.textContent = "Task in progress\u2026"
    this.startNextTrial()
  }

  startNextTrial() {
    if (this.currentTrial >= this.TRIALS_PER_BLOCK) {
      if (this.currentBlock < this.TOTAL_BLOCKS) {
        this.currentBlock++
        this.currentTrial = 0
      } else {
        this.finishAttempt()
        return
      }
    }
    this.currentTrial++
    this.currentDirection = this.pickRandomDirection()
    this.seedDotField()
    this.phase = "stimulus"
    this.clearArrowHighlights()
    this.statusText.textContent = "Which way are most of the dots moving?"
    this.updateStatsDisplay()
  }

  pickRandomDirection() {
    const dirs = ["up", "down", "left", "right"]
    return dirs[Math.floor(Math.random() * dirs.length)]
  }

  registerResponse(response) {
    const correct = response === this.currentDirection

    this.results.push({
      block: this.currentBlock,
      trial: this.currentTrial,
      direction: this.currentDirection,
      coherence: this.coherence,
      correct
    })

    this.coherence = correct
      ? Math.max(this.COHERENCE_MIN, this.coherence - this.COHERENCE_STEP)
      : Math.min(this.COHERENCE_MAX, this.coherence + this.COHERENCE_STEP)

    this.showFeedback(response, correct)
    this.phase = "feedback"

    window.clearTimeout(this.feedbackTimeout)
    this.feedbackTimeout = window.setTimeout(() => {
      this.feedbackBadge.classList.remove("show")
      this.phase = "awaiting-recenter"
      this.statusText.innerHTML = "Re-center the stick to <b>neutral</b> to continue."
    }, 650)
  }

  showFeedback(response, correct) {
    this.arrowEls[response].classList.add("active")
    this.feedbackBadge.textContent = correct ? "Correct" : "Try again"
    this.feedbackBadge.className = `rdm-feedback-badge show ${correct ? "correct" : "incorrect"}`
  }

  clearArrowHighlights() {
    Object.keys(this.arrowEls).forEach(dir => {
      this.arrowEls[dir].classList.remove("active")
    })
  }

  finishAttempt() {
    this.phase = "complete"
    this.startBtn.disabled = false
    this.startBtn.textContent = "Begin Task"
    this.startBtn.classList.add("rdm-hidden")

    const recent = this.results.slice(-10)
    const avgCoherence = recent.length
      ? recent.reduce((sum, r) => sum + r.coherence, 0) / recent.length
      : this.coherence

    const numCorrect = this.results.filter(r => r.correct).length
    const accuracy = this.results.length ? (numCorrect / this.results.length) * 100 : 0
    const finalCoherence = avgCoherence * 100
    const passed = accuracy >= STAGE2_PASS_THRESHOLD
    const completionTimeMs = Math.round(performance.now() - this.attemptStartTime)

    addStage2Attempt({
      timestamp: new Date().toISOString(),
      accuracy,
      finalCoherence,
      passed,
      completionTimeMs,
      trials: this.results.map(r => ({
        block: r.block,
        trial: r.trial,
        direction: r.direction,
        coherence: r.coherence,
        correct: r.correct
      }))
    })

    this.finalCoherenceEl.textContent = `${Math.round(finalCoherence)}%`
    this.finalAccuracyEl.textContent = `${Math.round(accuracy)}%`

    if (passed) {
      this.resultHeading.textContent = "Task Complete"
      this.resultMessage.textContent = `You met the ${STAGE2_PASS_THRESHOLD}% accuracy criterion. You may continue to the questionnaire, or repeat the task if you'd like to try to improve your score.`
      this.statusText.textContent = "You can continue to the questionnaire."
    } else {
      this.resultHeading.textContent = "Almost there"
      this.resultMessage.textContent = `Your accuracy score is below the required criterion of ${STAGE2_PASS_THRESHOLD}%. Please repeat Stage 2 before proceeding.`
      this.statusText.textContent = `Below ${STAGE2_PASS_THRESHOLD}% — please repeat the task.`
    }

    this.continueBtn.disabled = !hasPassedStage2()
    this.updateAttemptNote()
    this.completeScreen.classList.remove("rdm-hidden")
    this.updateStatsDisplay()
  }

  updateStatsDisplay() {
    this.blockValue.textContent = `${Math.min(this.currentBlock, this.TOTAL_BLOCKS)} / ${this.TOTAL_BLOCKS}`
    this.trialValue.textContent = `${Math.min(this.currentTrial, this.TRIALS_PER_BLOCK)} / ${this.TRIALS_PER_BLOCK}`
    this.coherenceValue.textContent = `${Math.round(this.coherence * 100)}%`

    const totalTrials = this.TRIALS_PER_BLOCK * this.TOTAL_BLOCKS
    const completedTrials = (this.currentBlock - 1) * this.TRIALS_PER_BLOCK + this.currentTrial
    const pct = this.phase === "complete" ? 100 : (completedTrials / totalTrials) * 100
    this.progressFill.style.width = `${pct}%`
  }

  // ---------------------------------------------------------------
  // Input polling
  // ---------------------------------------------------------------

  readStick() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    const gp = gamepads[0]
    let x = this.keyboardAxis.x
    let y = this.keyboardAxis.y
    if (gp) {
      const axisOffset = this.stick === "right" ? 2 : 0
      const gx = gp.axes[axisOffset] || 0
      const gy = gp.axes[axisOffset + 1] || 0
      if (Math.hypot(gx, gy) > Math.hypot(x, y)) {
        x = gx
        y = gy
      }
    }
    return { x, y }
  }

  updateMiniStick(stick) {
    if (!this.miniStickDot) return
    const maxOffset = 32
    const offsetX = stick.x * maxOffset
    const offsetY = stick.y * maxOffset
    this.miniStickDot.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`
    if (this.miniStickLine) {
      const dist = Math.hypot(offsetX, offsetY)
      const angle = Math.atan2(offsetY, offsetX) * (180 / Math.PI)
      this.miniStickLine.style.width = `${dist}px`
      this.miniStickLine.style.transform = `rotate(${angle}deg)`
      this.miniStickLine.style.display = dist > 1 ? "block" : "none"
      this.miniStickLine.style.background = "var(--text-secondary)"
    }
  }

  directionFromStick(stick) {
    return Math.abs(stick.x) > Math.abs(stick.y)
      ? (stick.x < 0 ? "left" : "right")
      : (stick.y < 0 ? "up" : "down")
  }

  // ---------------------------------------------------------------
  // Dot field simulation
  // ---------------------------------------------------------------

  seedDotField() {
    this.dots = []
    for (let i = 0; i < this.DOT_COUNT; i++) {
      this.dots.push(this.spawnDot())
    }
  }

  spawnDot() {
    return {
      x: Math.random(),
      y: Math.random(),
      coherent: Math.random() < this.coherence,
      life: Math.floor(Math.random() * this.DOT_MAX_LIFE)
    }
  }

  directionAngle(dir) {
    switch (dir) {
      case "up": return -Math.PI / 2
      case "down": return Math.PI / 2
      case "left": return Math.PI
      case "right": return 0
    }
  }

  stepDotField() {
    const isActive = this.phase === "stimulus"
    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i]

      if (isActive) {
        const angle = dot.coherent
          ? this.directionAngle(this.currentDirection)
          : Math.random() * Math.PI * 2
        dot.x += Math.cos(angle) * this.DOT_SPEED
        dot.y += Math.sin(angle) * this.DOT_SPEED
        dot.life--
      }

      if (dot.life <= 0 || dot.x < 0 || dot.x > 1 || dot.y < 0 || dot.y > 1) {
        this.dots[i] = this.spawnDot()
      }
    }
  }

  drawDotField() {
    const { width, height } = this.canvas
    this.ctx.clearRect(0, 0, width, height)
    this.ctx.fillStyle = "#e8e8e8"
    for (const dot of this.dots) {
      this.ctx.beginPath()
      this.ctx.arc(dot.x * width, dot.y * height, this.DOT_RADIUS, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.strokeStyle = "rgba(255,255,255,0.08)"
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.moveTo(width / 2, 0)
    this.ctx.lineTo(width / 2, height)
    this.ctx.moveTo(0, height / 2)
    this.ctx.lineTo(width, height / 2)
    this.ctx.stroke()
  }

  // ---------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------

  renderLoop() {
    const loop = () => {
      const stick = this.readStick()
      this.updateMiniStick(stick)

      if (this.phase === "stimulus" || this.phase === "feedback" || this.phase === "idle") {
        this.stepDotField()
      }
      this.drawDotField()

      if (this.phase === "stimulus") {
        const magnitude = Math.hypot(stick.x, stick.y)
        if (magnitude > this.RESPONSE_THRESHOLD) {
          this.registerResponse(this.directionFromStick(stick))
        }
      } else if (this.phase === "awaiting-recenter") {
        const magnitude = Math.hypot(stick.x, stick.y)
        if (magnitude < this.RECENTER_THRESHOLD) {
          this.phase = "idle"
          window.setTimeout(() => this.startNextTrial(), 250)
        }
      }

      this.animationFrame = requestAnimationFrame(loop)
    }
    loop()
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new RDMStaircaseTrainer()
})
