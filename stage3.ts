import {
    getStickPreference, getStage1Progress, getStage2Attempts, hasPassedStage2,
    computeHardwareComfortScore, saveSession, downloadSessionCSV
} from './storage.js';
import type { Stick, QuestionnaireResponses, SessionRecord } from './storage.js';

const COMFORT_ITEMS = [
    'I found the controller easy to hold.',
    'The size and shape of the controller felt comfortable in my hands.',
    'I could reach the required buttons and thumbstick comfortably.',
    'Moving the thumbstick felt natural.',
    'I was able to control the thumbstick accurately.',
    'The controller responded as I expected.',
    'I felt confident using the controller during the task.',
    'I needed considerable practice before I felt comfortable using the controller.',
    'My hands or fingers became tired while using the controller.',
    'I would feel comfortable using this controller in a longer experiment.'
];

const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

class QuestionnairePage {
    private stick: Stick | null;
    private comfortRatings: (number | null)[] = new Array(COMFORT_ITEMS.length).fill(null);
    private singleSelect: Record<string, string> = {
        hasUsedControllerBefore: '',
        usageFrequency: '',
        experiencedDiscomfort: ''
    };
    private controllerTypes: string[] = [];

    private noSessionNotice: HTMLElement;
    private surveyWrap: HTMLElement;
    private summaryStick: HTMLElement;
    private summaryAccuracy: HTMLElement;
    private summaryAttempts: HTMLElement;
    private comfortContainer: HTMLElement;
    private stickReadonlyAnswer: HTMLElement;
    private discomfortDetails: HTMLTextAreaElement;
    private difficultInput: HTMLTextAreaElement;
    private improvementSuggestions: HTMLTextAreaElement;
    private participantIdInput: HTMLInputElement;
    private reviewBtn: HTMLButtonElement;
    private form: HTMLElement;
    private reviewSection: HTMLElement;
    private reviewContent: HTMLElement;
    private editBtn: HTMLButtonElement;
    private submitBtn: HTMLButtonElement;
    private saveConfirmation: HTMLElement;

    constructor() {
        this.stick = getStickPreference();

        this.noSessionNotice = document.getElementById('no-session-notice')!;
        this.surveyWrap = document.getElementById('survey-wrap')!;
        this.summaryStick = document.getElementById('summary-stick')!;
        this.summaryAccuracy = document.getElementById('summary-accuracy')!;
        this.summaryAttempts = document.getElementById('summary-attempts')!;
        this.comfortContainer = document.getElementById('comfort-items')!;
        this.stickReadonlyAnswer = document.getElementById('stick-readonly-answer')!;
        this.discomfortDetails = document.getElementById('discomfort-details') as HTMLTextAreaElement;
        this.difficultInput = document.getElementById('difficult-input') as HTMLTextAreaElement;
        this.improvementSuggestions = document.getElementById('improvement-suggestions') as HTMLTextAreaElement;
        this.participantIdInput = document.getElementById('participant-id') as HTMLInputElement;
        this.reviewBtn = document.getElementById('review-btn') as HTMLButtonElement;
        this.form = document.getElementById('survey-form')!;
        this.reviewSection = document.getElementById('survey-review')!;
        this.reviewContent = document.getElementById('review-content')!;
        this.editBtn = document.getElementById('edit-btn') as HTMLButtonElement;
        this.submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
        this.saveConfirmation = document.getElementById('save-confirmation')!;

        if (!hasPassedStage2()) {
            this.noSessionNotice.classList.remove('rdm-hidden');
            this.surveyWrap.classList.add('rdm-hidden');
            return;
        }

        this.renderSummary();
        this.renderComfortItems();
        this.wireChoiceGroups();
        this.wireDiscomfortToggle();

        this.reviewBtn.addEventListener('click', () => this.showReview());
        this.editBtn.addEventListener('click', () => this.showForm());
        this.submitBtn.addEventListener('click', () => this.submit());
    }

    private renderSummary(): void {
        const attempts = getStage2Attempts();
        const bestAccuracy = attempts.length ? Math.max(...attempts.map(a => a.accuracy)) : 0;
        const label = this.stick === 'left' ? 'Left Thumbstick' : 'Right Thumbstick';

        this.summaryStick.textContent = label;
        this.summaryAccuracy.textContent = `${Math.round(bestAccuracy)}%`;
        this.summaryAttempts.textContent = String(attempts.length);
        this.stickReadonlyAnswer.textContent = label;
    }

    private renderComfortItems(): void {
        this.comfortContainer.innerHTML = COMFORT_ITEMS.map((statement, i) => `
            <div class="likert-row" data-index="${i}">
                <p class="likert-statement">${i + 1}. ${statement}</p>
                <div class="likert-scale">
                    ${LIKERT_LABELS.map((label, li) => `
                        <button type="button" class="likert-option" data-index="${i}" data-value="${li + 1}">
                            <span class="num">${li + 1}</span><span class="lbl">${label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        this.comfortContainer.querySelectorAll<HTMLButtonElement>('.likert-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.index);
                const value = Number(btn.dataset.value);
                this.comfortRatings[index] = value;

                this.comfortContainer.querySelectorAll(`.likert-option[data-index="${index}"]`).forEach(b => {
                    b.classList.toggle('selected', b === btn);
                });
            });
        });
    }

    private wireChoiceGroups(): void {
        this.form.querySelectorAll<HTMLElement>('.rdm-choice-row[data-field]').forEach(group => {
            const field = group.dataset.field!;
            const isMulti = group.dataset.multi === 'true';

            group.querySelectorAll<HTMLButtonElement>('.rdm-choice-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value!;

                    if (isMulti) {
                        const idx = this.controllerTypes.indexOf(value);
                        if (idx >= 0) {
                            this.controllerTypes.splice(idx, 1);
                            btn.classList.remove('selected');
                        } else {
                            this.controllerTypes.push(value);
                            btn.classList.add('selected');
                        }
                    } else {
                        this.singleSelect[field] = value;
                        group.querySelectorAll('.rdm-choice-btn').forEach(b => {
                            b.classList.toggle('selected', b === btn);
                        });
                    }
                });
            });
        });
    }

    private wireDiscomfortToggle(): void {
        const group = this.form.querySelector('[data-field="experiencedDiscomfort"]')!;
        group.querySelectorAll<HTMLButtonElement>('.rdm-choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const showTextarea = btn.dataset.value === 'yes';
                this.discomfortDetails.classList.toggle('rdm-hidden', !showTextarea);
                if (!showTextarea) this.discomfortDetails.value = '';
            });
        });
    }

    private validate(): string | null {
        if (this.comfortRatings.some(r => r === null)) {
            return 'Please rate all 10 hardware comfort statements before continuing.';
        }
        if (!this.singleSelect.hasUsedControllerBefore) {
            return 'Please answer whether you have used a game controller before.';
        }
        if (!this.singleSelect.usageFrequency) {
            return 'Please answer how often you use a game controller.';
        }
        if (!this.singleSelect.experiencedDiscomfort) {
            return 'Please answer whether you experienced any pain, strain, fatigue, or discomfort.';
        }
        return null;
    }

    private buildQuestionnaireResponses(): QuestionnaireResponses {
        return {
            comfortRatings: this.comfortRatings as number[],
            hasUsedControllerBefore: this.singleSelect.hasUsedControllerBefore as 'yes' | 'no' | '',
            usageFrequency: this.singleSelect.usageFrequency,
            controllerTypes: this.controllerTypes,
            experiencedDiscomfort: this.singleSelect.experiencedDiscomfort as 'yes' | 'no' | '',
            discomfortDetails: this.discomfortDetails.value.trim(),
            difficultInput: this.difficultInput.value.trim(),
            improvementSuggestions: this.improvementSuggestions.value.trim()
        };
    }

    private showReview(): void {
        const error = this.validate();
        if (error) {
            alert(error);
            return;
        }

        const q = this.buildQuestionnaireResponses();
        const score = computeHardwareComfortScore(q.comfortRatings);

        this.reviewContent.innerHTML = `
            <div class="review-block">
                <p><b>Participant ID:</b> ${this.participantIdInput.value.trim() || '(none provided)'}</p>
                <p><b>Thumbstick used:</b> ${this.stick === 'left' ? 'Left Thumbstick' : 'Right Thumbstick'}</p>
                <p><b>Hardware comfort score:</b> ${Math.round(score)}%</p>
            </div>
            <div class="review-block">
                <p><b>Comfort ratings:</b></p>
                <ul>${COMFORT_ITEMS.map((stmt, i) => `<li>${stmt} &mdash; <b>${q.comfortRatings[i]}/5</b></li>`).join('')}</ul>
            </div>
            <div class="review-block">
                <p><b>Used a controller before:</b> ${q.hasUsedControllerBefore}</p>
                <p><b>Usage frequency:</b> ${q.usageFrequency}</p>
                <p><b>Controller types used:</b> ${q.controllerTypes.length ? q.controllerTypes.join(', ') : '(none selected)'}</p>
                <p><b>Experienced discomfort:</b> ${q.experiencedDiscomfort}${q.discomfortDetails ? ` &mdash; ${q.discomfortDetails}` : ''}</p>
                <p><b>Difficult input:</b> ${q.difficultInput || '(none provided)'}</p>
                <p><b>Improvement suggestions:</b> ${q.improvementSuggestions || '(none provided)'}</p>
            </div>
        `;

        this.form.classList.add('rdm-hidden');
        this.reviewSection.classList.remove('rdm-hidden');
    }

    private showForm(): void {
        this.reviewSection.classList.add('rdm-hidden');
        this.form.classList.remove('rdm-hidden');
    }

    private submit(): void {
        if (!this.stick) return;

        const questionnaire = this.buildQuestionnaireResponses();
        const session: SessionRecord = {
            participantId: this.participantIdInput.value.trim() || `P-${Date.now()}`,
            stick: this.stick,
            stage1: getStage1Progress(),
            stage2Attempts: getStage2Attempts(),
            questionnaire,
            hardwareComfortScore: computeHardwareComfortScore(questionnaire.comfortRatings),
            submittedAt: new Date().toISOString()
        };

        const saved = saveSession(session);
        if (!saved) {
            alert('Something went wrong saving your data. Please try again.');
            return;
        }

        downloadSessionCSV(session);

        this.reviewSection.classList.add('rdm-hidden');
        this.saveConfirmation.classList.remove('rdm-hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuestionnairePage();
});
