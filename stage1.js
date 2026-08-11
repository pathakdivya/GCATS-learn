import { getStickPreference, saveStage1Progress } from "./storage.js"

class ChecklistController {
  currentStepIndex = 0
  dwellStart = null
  targetOffset = { x: 0, y: 0 }
  completedActions = []
  animationFrame = 0
  keyboardAxis = { x: 0, y: 0 }
  lastButtons = []

  TARGET_TRIALS_REQUIRED = 10
  targetTrialsCompleted = 0

  constructor() {
    this.stick = getStickPreference()

    this.currentText = document.getElementById("checklist-current-text")
    this.listEl = document.getElementById("checklist-list")
    this.stickDot = document.querySelector("#checklist-stick .stick-dot")
    this.stickLine = document.querySelector("#checklist-stick .stick-line")
    this.targetEl = document.getElementById("checklist-target")
    this.completeScreen = document.getElementById("checklist-complete-screen")
    this.noStickNotice = document.getElementById("no-stick-notice")
    this.checklistLayout = document.getElementById("checklist-layout")

    this.diagramButtonEls = {
      cross: document.getElementById("cross"),
      r2: document.getElementById("r2")
    }

    this.steps = this.buildSteps()
    this.startedAt = new Date().toISOString()

    if (!this.stick) {
      this.noStickNotice.classList.remove("rdm-hidden")
      this.checklistLayout.classList.add("rdm-hidden")
      return
    }

    this.visualStickDot = this.stick === "left"
      ? document.getElementById("visual-stick-left")
      : document.getElementById("visual-stick-right")
    this.visualStickCircle = this.stick === "left"
      ? document.getElementById("visual-stick-left-circle")
      : document.getElementById("visual-stick-right-circle")

    this.renderList()
    window.addEventListener("keydown", (e) => this.handleKey(e, true))
    window.addEventListener("keyup", (e) => this.handleKey(e, false))
    this.renderLoop()
  }

  buildSteps() {
    const AXIS_EDGE = 0.85
    const DIAG_EDGE = 0.6
    const CENTER_ZONE = 0.15

    return [
      {
        id: "left",
        label: "Move the thumbstick fully to the left",
        dwellMs: 200,
        check: (s) => s.x < -AXIS_EDGE
      },
      {
        id: "right",
        label: "Move the thumbstick fully to the right",
        dwellMs: 200,
        check: (s) => s.x > AXIS_EDGE
      },
      {
        id: "up",
        label: "Move the thumbstick upward",
        dwellMs: 200,
        check: (s) => s.y < -AXIS_EDGE
      },
      {
        id: "down",
        label: "Move the thumbstick downward",
        dwellMs: 200,
        check: (s) => s.y > AXIS_EDGE
      },
      {
        id: "diagonal",
        label: "Move the thumbstick diagonally (up and to the right)",
        dwellMs: 200,
        check: (s) => s.x > DIAG_EDGE && s.y < -DIAG_EDGE
      },
      {
        id: "target",
        label: "Move the on-screen marker onto the highlighted target (10 practice trials)",
        dwellMs: 250,
        check: (s) => Math.hypot(s.x - this.targetOffset.x, s.y - this.targetOffset.y) < 0.18
      },
      {
        id: "center",
        label: "Return the thumbstick to its resting position",
        dwellMs: 200,
        check: (s) => Math.hypot(s.x, s.y) < CENTER_ZONE
      },
      {
        id: "confirm",
        label: "Press the confirmation button (A button)",
        dwellMs: 0,
        check: (_s, buttons) => !!buttons[0]?.pressed
      },
      {
        id: "trigger",
        label: "Press the response button (R2 trigger)",
        dwellMs: 0,
        check: (_s, buttons) => !!(buttons[7]?.pressed || (buttons[7]?.value ?? 0) > 0.5)
      }
    ]
  }

  renderList() {
    this.listEl.innerHTML = this.steps.map((step, i) => `
      <li class="checklist-item" id="checklist-item-${step.id}" data-index="${i}">
        <span class="checklist-item-icon">${i < this.currentStepIndex ? "&#10003;" : i + 1}</span>
        <span class="checklist-item-label">${step.label}</span>
      </li>
    `).join("")
    this.updateListState()
    this.updateCurrentStepUI()
  }

  updateListState() {
    this.steps.forEach((step, i) => {
      const el = document.getElementById(`checklist-item-${step.id}`)
      const icon = el.querySelector(".checklist-item-icon")
      el.classList.remove("done", "active")
      if (i < this.currentStepIndex) {
        el.classList.add("done")
        icon.innerHTML = "&#10003;"
      } else if (i === this.currentStepIndex) {
        el.classList.add("active")
        icon.textContent = String(i + 1)
      } else {
        icon.textContent = String(i + 1)
      }
    })
  }

  updateCurrentStepUI() {
    const step = this.steps[this.currentStepIndex]
    if (!step) return

    if (step.id === "target") {
      this.targetTrialsCompleted = 0
      this.currentText.textContent = `${step.label} (0 of ${this.TARGET_TRIALS_REQUIRED} completed)`
      this.rollNewTarget()
    } else {
      this.currentText.textContent = step.label
      this.targetEl.style.display = "none"
    }

    this.clearButtonHighlights()
    if (step.id === "confirm") this.diagramButtonEls.cross.classList.add("active")
    if (step.id === "trigger") this.diagramButtonEls.r2.classList.add("active")
  }

  rollNewTarget() {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.55
    this.targetOffset = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    this.targetEl.style.display = "block"
    const maxOffset = 32
    this.targetEl.style.transform = `translate(calc(-50% + ${this.targetOffset.x * maxOffset}px), calc(-50% + ${this.targetOffset.y * maxOffset}px))`
  }

  clearButtonHighlights() {
    Object.values(this.diagramButtonEls).forEach(el => el.classList.remove("active"))
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

  readStick() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    const gp = gamepads[0]
    let x = this.keyboardAxis.x
    let y = this.keyboardAxis.y
    let buttons = []
    if (gp) {
      const axisOffset = this.stick === "right" ? 2 : 0
      const gx = gp.axes[axisOffset] || 0
      const gy = gp.axes[axisOffset + 1] || 0
      if (Math.hypot(gx, gy) > Math.hypot(x, y)) {
        x = gx
        y = gy
      }
      buttons = gp.buttons
    }
    this.lastButtons = buttons
    return { x, y }
  }

  updateDiagramStick(stick) {
    const maxOffset = 14
    this.visualStickDot.style.transform = `translate(calc(-50% + ${stick.x * maxOffset}px), calc(-50% + ${stick.y * maxOffset}px))`
    this.visualStickCircle.classList.toggle("active", Math.hypot(stick.x, stick.y) > 0.15)
  }

  updateChecklistStick(stick) {
    const maxOffset = 32
    const offsetX = stick.x * maxOffset
    const offsetY = stick.y * maxOffset
    this.stickDot.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`
    if (this.stickLine) {
      const dist = Math.hypot(offsetX, offsetY)
      const angle = Math.atan2(offsetY, offsetX) * (180 / Math.PI)
      this.stickLine.style.width = `${dist}px`
      this.stickLine.style.transform = `rotate(${angle}deg)`
      this.stickLine.style.display = dist > 1 ? "block" : "none"
      this.stickLine.style.background = "var(--text-secondary)"
    }
  }

  renderLoop() {
    const loop = () => {
      const stick = this.readStick()
      this.updateDiagramStick(stick)
      this.updateChecklistStick(stick)
      this.evaluateCurrentStep(stick)
      this.animationFrame = requestAnimationFrame(loop)
    }
    loop()
  }

  evaluateCurrentStep(stick) {
    const step = this.steps[this.currentStepIndex]
    if (!step) return

    const satisfied = step.check(stick, this.lastButtons)
    if (!satisfied) {
      this.dwellStart = null
      return
    }

    if (step.dwellMs === 0) {
      this.completeCurrentStep()
      return
    }

    if (this.dwellStart === null) {
      this.dwellStart = performance.now()
    } else if (performance.now() - this.dwellStart >= step.dwellMs) {
      this.completeCurrentStep()
    }
  }

  completeCurrentStep() {
    const step = this.steps[this.currentStepIndex]

    if (step.id === "target") {
      this.targetTrialsCompleted++
      this.dwellStart = null

      if (this.targetTrialsCompleted < this.TARGET_TRIALS_REQUIRED) {
        this.currentText.textContent = `${step.label} (${this.targetTrialsCompleted} of ${this.TARGET_TRIALS_REQUIRED} completed)`
        this.rollNewTarget()
        return
      }
    }

    this.completedActions.push(step.id)
    this.dwellStart = null
    this.currentStepIndex++
    this.updateListState()

    if (this.currentStepIndex >= this.steps.length) {
      this.finishChecklist()
    } else {
      this.updateCurrentStepUI()
    }
  }

  finishChecklist() {
    saveStage1Progress({
      completedActions: this.completedActions,
      allComplete: true,
      startedAt: this.startedAt,
      completedAt: new Date().toISOString()
    })

    document.getElementById("checklist-current-card").classList.add("rdm-hidden")
    this.completeScreen.classList.remove("rdm-hidden")
    cancelAnimationFrame(this.animationFrame)
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ChecklistController()
})
