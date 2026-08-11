import { setStickPreference } from './storage.js';
import type { Stick } from './storage.js';

interface StickInput {
    x: number;
    y: number;
}

class AboutPage {
    private choiceButtons: NodeListOf<HTMLButtonElement>;
    private hint: HTMLElement;
    private continueBtn: HTMLAnchorElement;

    private stickLeftDot: HTMLElement;
    private stickLeftCircle: HTMLElement;
    private stickRightDot: HTMLElement;
    private stickRightCircle: HTMLElement;
    private buttonEls: Record<number, HTMLElement>;
    private animationFrame = 0;
    private keyboardAxis: StickInput = { x: 0, y: 0 };

    constructor() {
        this.choiceButtons = document.querySelectorAll('#stick-choice .rdm-choice-btn');
        this.hint = document.getElementById('stick-setup-hint')!;
        this.continueBtn = document.getElementById('about-continue-btn') as HTMLAnchorElement;

        this.choiceButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectStick(btn.dataset.stick as Stick));
        });

        this.stickLeftDot = document.getElementById('visual-stick-left')!;
        this.stickLeftCircle = document.getElementById('visual-stick-left-circle')!;
        this.stickRightDot = document.getElementById('visual-stick-right')!;
        this.stickRightCircle = document.getElementById('visual-stick-right-circle')!;

        // Standard Gamepad API button indices.
        this.buttonEls = {
            0: document.getElementById('cross')!,
            1: document.getElementById('circle')!,
            2: document.getElementById('square')!,
            3: document.getElementById('triangle')!,
            4: document.getElementById('l1')!,
            5: document.getElementById('r1')!,
            6: document.getElementById('l2')!,
            7: document.getElementById('r2')!,
            8: document.getElementById('share')!,
            9: document.getElementById('options')!,
            12: document.getElementById('dpad-up')!,
            13: document.getElementById('dpad-down')!,
            14: document.getElementById('dpad-left')!,
            15: document.getElementById('dpad-right')!,
            16: document.getElementById('ps')!
        };

        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
        this.renderLoop();
    }

    private selectStick(stick: Stick): void {
        setStickPreference(stick);

        this.choiceButtons.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.stick === stick);
        });

        const label = stick === 'left' ? 'Left Thumbstick' : 'Right Thumbstick';
        this.hint.textContent = `You'll use your ${label} for the remaining stages.`;
        this.hint.classList.add('confirmed');

        this.continueBtn.style.pointerEvents = 'auto';
        this.continueBtn.style.opacity = '1';
    }

    private handleKey(e: KeyboardEvent, isDown: boolean): void {
        const v = isDown ? 1 : 0;
        switch (e.key) {
            case 'ArrowLeft': this.keyboardAxis.x = -v; break;
            case 'ArrowRight': this.keyboardAxis.x = v; break;
            case 'ArrowUp': this.keyboardAxis.y = -v; break;
            case 'ArrowDown': this.keyboardAxis.y = v; break;
        }
    }

    private updateStickVisual(dot: HTMLElement, circle: HTMLElement, x: number, y: number): void {
        const maxOffset = 14;
        dot.style.transform = `translate(calc(-50% + ${x * maxOffset}px), calc(-50% + ${y * maxOffset}px))`;
        circle.classList.toggle('active', Math.hypot(x, y) > 0.15);
    }

    private renderLoop(): void {
        const loop = () => {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = gamepads[0];

            let leftX = this.keyboardAxis.x;
            let leftY = this.keyboardAxis.y;
            let rightX = 0;
            let rightY = 0;

            if (gp) {
                leftX = gp.axes[0] || 0;
                leftY = gp.axes[1] || 0;
                rightX = gp.axes[2] || 0;
                rightY = gp.axes[3] || 0;

                Object.entries(this.buttonEls).forEach(([indexStr, el]) => {
                    const index = Number(indexStr);
                    const button = gp.buttons[index];
                    const pressed = !!(button && (button.pressed || button.value > 0.5));
                    el.classList.toggle('active', pressed);
                });
            }

            this.updateStickVisual(this.stickLeftDot, this.stickLeftCircle, leftX, leftY);
            this.updateStickVisual(this.stickRightDot, this.stickRightCircle, rightX, rightY);

            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AboutPage();
});
