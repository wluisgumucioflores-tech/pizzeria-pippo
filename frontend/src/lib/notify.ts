let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function playBeep(frequency: number, duration: number, delay = 0): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // A suspended context has a FROZEN currentTime, so scheduling against it put
  // every oscillator at a timestamp already in the past. Nothing played at the
  // time, and the whole backlog fired at once the next time the context woke
  // up — which is any user gesture, e.g. the cashier tapping a product. Resume
  // first and only schedule once the clock is actually running.
  if (ctx.state === "suspended") {
    void ctx.resume().then(
      () => scheduleBeep(ctx, frequency, duration, delay),
      // No user gesture yet, so the browser refuses: drop this beep rather
      // than queue it for a surprise replay later.
      () => undefined,
    );
    return;
  }
  scheduleBeep(ctx, frequency, duration, delay);
}

function scheduleBeep(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  delay: number,
): void {
  const startAt = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration / 1000);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration / 1000);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

// Sube-baja grave, repetido — llegó un pedido nuevo (cocina). Dura ~3.2s
// para que se note incluso si nadie está mirando la pantalla en ese momento.
export function notifyNewOrder(): void {
  const REPEATS = 5;
  const GAP = 0.7;
  for (let i = 0; i < REPEATS; i++) {
    const base = i * GAP;
    playBeep(660, 150, base);
    playBeep(880, 200, base + 0.18);
  }
  vibrate(Array(REPEATS).fill([200, 150]).flat());
}

// Tono agudo, repetido — un pedido quedó listo (cajero/mesero). Dura ~3.2s.
export function notifyOrderReady(): void {
  const REPEATS = 6;
  const GAP = 0.6;
  for (let i = 0; i < REPEATS; i++) {
    playBeep(1046, 220, i * GAP);
  }
  vibrate(Array(REPEATS).fill([300, 150]).flat());
}

// Los navegadores bloquean Web Audio hasta el primer gesto del usuario en la
// página. Se llama una vez al montar cada pantalla (cocina/POS/mesero) para
// que el contexto quede "desbloqueado" apenas el operador toca la pantalla,
// en vez de fallar en silencio la primera vez que suena una alerta real.
// Los navegadores bloquean Web Audio hasta el primer gesto del usuario, y
// vuelven a suspender el contexto cuando la pestaña queda en segundo plano
// (los navegadores móviles, muy agresivamente). Por eso los listeners quedan
// puestos de forma permanente en vez de { once: true }: con "once" el contexto
// se desbloqueaba una sola vez y, tras la siguiente suspensión, no se
// recuperaba nunca más y las alertas reales fallaban en silencio.
let audioUnlockBound = false;

export function unlockAudioOnFirstInteraction(): void {
  if (typeof window === "undefined" || audioUnlockBound) return;
  audioUnlockBound = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") void ctx.resume();
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  // Coming back to the tab is the other moment the context needs waking.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlock();
  });
}
