// The step-by-step guide: an animated 3D cube and one move at a time.
import { CONFIG } from '../config';
import { describeMove, formatMove } from '../cube/moves';
import type { Facelets, Move } from '../cube/types';
import { Cube3D } from './cube3d';
import { button, el } from './dom';
import { SolveController } from './solveController';
import { COMMAND_WORDS, speechForStep } from './voiceCommands';
import { browserRecognition, createListener, type ListenerState } from './voiceListener';
import { createSpeaker } from './voiceSpeaker';

const READ_ALOUD_KEY = 'cubeSolver.readAloud';

/** Remembered between visits: only the on/off choice for reading aloud. */
function readAloudChoice(): boolean {
  try {
    return window.localStorage.getItem(READ_ALOUD_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberReadAloud(on: boolean): void {
  try {
    window.localStorage.setItem(READ_ALOUD_KEY, on ? '1' : '0');
  } catch {
    // Private browsing or storage switched off: the choice just is not remembered.
  }
}

const LISTENER_TEXT: Record<ListenerState, string> = {
  off: '',
  listening: `Listening. Say ${COMMAND_WORDS}.`,
  downloading: 'Getting your browser\'s speech pack. This happens once and can take a minute…',
  unsupported: 'This browser cannot do voice commands. The buttons and keys still work.',
  unavailable:
    'Voice commands are off: this browser cannot recognise speech on this computer, and the app will not send your voice to an online service. The buttons and keys still work.',
  blocked: 'The microphone is blocked. Allow it from the icon in the address bar, then switch voice commands on again.',
};

export function mountSolveScreen(
  root: HTMLElement,
  o: { facelets: Facelets; moves: Move[]; onRescan(): void },
): () => void {
  const controller = new SolveController(o.facelets, o.moves);
  const total = o.moves.length;

  const stage = el('div', { class: 'cube-stage' });
  const moveLetter = el('div', { class: 'move-letter' });
  const moveText = el('div', { class: 'move-text' });
  const progress = el('div', { class: 'move-progress' });
  const banner = el(
    'div',
    { class: 'solved-banner' },
    el('span', { class: 'celebrate-icon', ariaHidden: 'true' }, '🎉'),
    el(
      'div',
      { class: 'solved-text' },
      el('strong', {}, 'Solved! Well done.'),
      el('div', { class: 'hint' }, 'Scramble the cube and go again whenever you like.'),
    ),
    button('Try a new pattern ▶', () => o.onRescan(), 'btn primary'),
  );
  const speakBox = el('input', { type: 'checkbox' });
  const listenBox = el('input', { type: 'checkbox' });
  const voiceStatus = el('p', { class: 'hint voice-status' });
  const list = el('div', { class: 'move-list' });
  const chips = o.moves.map((move, i) => el('span', { class: 'chip', title: `Move ${i + 1}: ${describeMove(move)}` }, formatMove(move)));
  list.append(...chips);

  const backButton = button('◀ Back', () => void back());
  const replayButton = button('↻ Show again', () => void replay());
  const nextButton = button('Next ▶', () => void next(), 'btn primary');
  const viewButton = button('Reset view', () => cube.resetView(), 'btn subtle');
  const rescanButton = button("I'm lost — scan again", () => o.onRescan(), 'btn subtle');

  const screen = el(
    'section',
    { class: 'screen solve-screen' },
    el(
      'p',
      { class: 'hold-note' },
      'Hold the cube with the ',
      el('strong', {}, 'white centre on top'),
      ' and the ',
      el('strong', {}, 'green centre facing you'),
      '. Keep it that way round for every move. The picture shows the cube as you see it.',
    ),
    el(
      'div',
      { class: 'solve-layout' },
      el('div', { class: 'cube-column' }, stage, el('p', { class: 'hint' }, 'Drag the cube to look around it.')),
      el(
        'div',
        { class: 'guide-column' },
        progress,
        el('div', { class: 'move-card' }, moveLetter, moveText),
        banner,
        el('div', { class: 'button-row' }, backButton, replayButton, nextButton),
        el('p', { class: 'hint' }, 'Keys: → or Space for Next, ← for Back, R to show the move again.'),
        el(
          'div',
          { class: 'button-row voice-row' },
          el('label', { class: 'toggle' }, speakBox, ' Read moves aloud'),
          el('label', { class: 'toggle' }, listenBox, ' Voice commands'),
        ),
        voiceStatus,
        el('h3', {}, 'All the moves'),
        list,
        el('div', { class: 'button-row' }, viewButton, rescanButton),
      ),
    ),
  );
  root.append(screen);

  // If the browser cannot draw 3D, the written moves still work.
  let cube: Pick<Cube3D, 'setState' | 'animateMove' | 'resetView' | 'dispose'>;
  try {
    cube = new Cube3D(stage);
  } catch (err) {
    console.error('3D view unavailable', err);
    stage.classList.add('unavailable');
    stage.textContent = 'The 3D picture is not available in this browser. Follow the written moves.';
    cube = { setState() {}, animateMove: () => Promise.resolve(), resetView() {}, dispose() {} };
  }
  cube.setState(controller.state);

  function render(): void {
    const last = controller.last;
    // The celebration waits for the last move\'s animation to finish.
    banner.classList.toggle('show', total > 0 && controller.done && !controller.busy);
    if (total === 0) {
      progress.textContent = 'No moves needed';
      moveLetter.textContent = '✓';
      moveText.textContent = 'Your cube is already solved.';
    } else if (controller.undone) {
      // Back was pressed: the picture has undone a move, so the user must undo it on their cube too.
      progress.textContent = controller.index === 0 ? 'Back at the start' : `Back to move ${controller.index} of ${total}`;
      moveLetter.textContent = formatMove(controller.undone);
      moveText.textContent = `Undo the move you just made. ${describeMove(controller.undone)}`;
    } else if (!last) {
      progress.textContent = `${total} moves to go`;
      moveLetter.textContent = '';
      moveText.textContent = 'Press Next to see the first move, then do the same on your cube.';
    } else {
      progress.textContent = `Move ${controller.index} of ${total}`;
      moveLetter.textContent = formatMove(last);
      moveText.textContent = describeMove(last);
    }
    chips.forEach((chip, i) => {
      chip.classList.toggle('done', i < controller.index - 1);
      chip.classList.toggle('current', i === controller.index - 1);
    });
    backButton.disabled = controller.busy || controller.index === 0;
    replayButton.disabled = controller.busy || controller.index === 0;
    nextButton.disabled = controller.busy || controller.done;
  }

  // --- Voice: reading the moves aloud, and listening for next / repeat / back ---
  const speaker = createSpeaker();
  let speakOn = speaker.supported && readAloudChoice();
  let resumeTimer = 0;
  speakBox.checked = speakOn;
  speakBox.disabled = !speaker.supported;
  if (!speaker.supported) speakBox.title = 'This browser cannot read text aloud.';

  const listener = createListener(browserRecognition(), {
    onState(state) {
      voiceStatus.textContent = LISTENER_TEXT[state];
      if (state === 'unsupported' || state === 'unavailable' || state === 'blocked' || state === 'off') listenBox.checked = false;
    },
    onHeard(text) {
      voiceStatus.textContent = `Heard “${text}”. Say ${COMMAND_WORDS}.`;
    },
    onCommand(command) {
      voiceStatus.textContent = `Heard “${command}”.`;
      if (command === 'next') void next();
      else if (command === 'back') void back();
      else if (controller.index === 0) announce();
      else void replay();
    },
  });

  /** Read the step now on screen. The microphone is closed while the app talks, so it never hears itself. */
  function announce(): void {
    if (!speakOn) return;
    window.clearTimeout(resumeTimer);
    listener.pause();
    const text = speechForStep({ total, index: controller.index, last: controller.last, undone: controller.undone });
    speaker.say(text, () => {
      resumeTimer = window.setTimeout(() => listener.resume(), CONFIG.listenAfterSpeechMs);
    });
  }

  speakBox.addEventListener('change', () => {
    speakOn = speakBox.checked;
    rememberReadAloud(speakOn);
    if (speakOn) {
      announce();
    } else {
      speaker.hush();
      window.clearTimeout(resumeTimer);
      listener.resume();
    }
  });
  listenBox.addEventListener('change', () => {
    if (listenBox.checked) void listener.start();
    else listener.stop();
  });

  async function play(move: Move): Promise<void> {
    render();
    announce();
    await cube.animateMove(move);
    cube.setState(controller.state);
    controller.settle();
    render();
  }

  async function next(): Promise<void> {
    const move = controller.next();
    if (move) await play(move);
  }

  async function back(): Promise<void> {
    const undo = controller.back();
    if (undo) await play(undo);
  }

  async function replay(): Promise<void> {
    const again = controller.replay();
    if (!again) return;
    cube.setState(again.rewind);
    await play(again.move);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault();
      void next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      void back();
    } else if (event.key === 'r' || event.key === 'R') {
      void replay();
    }
  }
  window.addEventListener('keydown', onKey);
  render();
  announce();

  return () => {
    window.removeEventListener('keydown', onKey);
    window.clearTimeout(resumeTimer);
    speaker.hush();
    listener.stop();
    cube.dispose();
    screen.remove();
  };
}
