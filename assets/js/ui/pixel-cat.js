// Thú cưng trang trí (mèo pixel / chó minh họa): overlay cố định, không focus, không đụng model/store (CC-10, CC-12).
// Logic chọn hành động/vị trí là hàm thuần; phần DOM chỉ ghép timer, rAF và listener.

export const CAT_CONFIG = {
  size: 48,
  bottom: 16,
  walkSpeed: 40,
  runSpeed: 85,
  jumpHeight: 18,
  idleDuration: [2000, 5000],
  walkDuration: [3000, 8000],
  runDuration: [1000, 2000],
  enabled: true,
};

// Thứ tự khung trong cat-sprites.png (hợp đồng với scripts/make-cat-sprites.mjs).
export const JUMP_DURATION = [300, 500];
export const ACTION_WEIGHTS = [
  ['walk', 50],
  ['idle', 25],
  ['run', 15],
  ['jump', 10],
];
// Tốc độ thực = tốc độ cấu hình × hệ số ngẫu nhiên (25–50 px/s đi, 70–100 px/s chạy ở mặc định).
export const SPEED_JITTER = { walk: [25 / 40, 50 / 40], run: [70 / 85, 100 / 85] };
export const HOVER_PAUSE_MS = 1000;
/** Quãng đường (px) mèo đi được trong một chu kỳ bước 1-2-3-2: nhịp chân bám theo tốc độ, không trượt. */
export const WALK_STRIDE_PX = 23;
export const RUN_STRIDE_PX = 30;
export const MIN_CYCLE_MS = 280;
export const MAX_CYCLE_MS = 900;
/** Tăng/giảm tốc ở đầu/cuối mỗi đoạn đi để mèo không bật/dừng đột ngột. */
export const RAMP_MS = 220;
/** Sau khi dừng, mèo giữ dáng đứng nghiêng (khung đi giữa) rồi mới quay mặt nhìn thẳng (khung idle). */
export const STAND_MS = 450;
export const MIN_RAMP_FACTOR = 0.2;
export const TURN_MS = 180;
export const TURN_CHANCE = 0.3;
export const MAX_FRAME_DT_MS = 100;
export const MOBILE_QUERY = '(max-width: 700px)';
export const MOBILE_SIZE = 36;
export const MOBILE_SPEED_FACTOR = 0.8;
export const BUBBLE_MARGIN = 8;
export const BUBBLE_FADE_MS = 200;
export const AUTOMATION_OPT_IN = /[?&]cat=1(?:&|$)/;

export const DEFAULT_PET = 'cat';
export const PET_OFF = 'off';
const CAT_SPRITE_URL = new URL('../../images/cat/cat-sprites.png', import.meta.url).href;
const DOG_SPRITE_URL = new URL('../../images/dog/dog-sprites.png', import.meta.url).href;
/**
 * Thú cưng chọn được. `render`: 'pixelated' cho pixel art, 'smooth' cho hình minh họa.
 * `strideScale` nới quãng đường mỗi chu kỳ bước theo cỡ thân để chân không trượt.
 */
export const PETS = {
  cat: {
    spriteUrl: CAT_SPRITE_URL,
    render: 'pixelated',
    config: { size: CAT_CONFIG.size, strideScale: 1 },
  },
  dog: {
    spriteUrl: DOG_SPRITE_URL,
    render: 'smooth',
    config: {
      size: 72,
      mobileSize: 54,
      jumpHeight: 10,
      walkSpeed: 36,
      runSpeed: 80,
      strideScale: 1.6,
      frameMs: 100,
      walkFrames: 8,
      runFrames: 6,
    },
  },
};
export const PET_CHOICES = [...Object.keys(PETS), PET_OFF];

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** @param {() => number} rng @param {[number, number]} range */
export function pickInRange(rng, [min, max]) {
  return min + rng() * (max - min);
}

/** @param {() => number} rng @param {[string, number][]} [weights] */
export function pickAction(rng, weights = ACTION_WEIGHTS) {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [action, weight] of weights) {
    if (cursor < weight) return action;
    cursor -= weight;
  }
  return weights[weights.length - 1][0];
}

export function clampX(x, viewportWidth, size) {
  return Math.min(Math.max(x, 0), Math.max(0, viewportWidth - size));
}

export function clampDt(dtMs) {
  return Math.min(Math.max(dtMs, 0), MAX_FRAME_DT_MS);
}

/** Bước ngang theo dt (ms); chạm biên khi đang đi vào tường thì kẹp vị trí và đảo hướng (đứng sát tường quay ra thì không tính). */
export function stepPosition({ x, direction, speed, dt, viewportWidth, size }) {
  const max = Math.max(0, viewportWidth - size);
  const next = x + (direction * speed * dt) / 1000;
  if (direction < 0 && next <= 0) return { x: 0, direction: 1, hitEdge: true };
  if (direction > 0 && next >= max) return { x: max, direction: -1, hitEdge: true };
  return { x: next, direction, hitEdge: false };
}

/** Thời lượng một chu kỳ bước (ms) sao cho bước chân khớp tốc độ di chuyển. */
export function cycleDuration(kind, speed, strideScale = 1) {
  const stride = (kind === 'run' ? RUN_STRIDE_PX : WALK_STRIDE_PX) * strideScale;
  const ms = (stride / Math.max(1, speed)) * 1000;
  return Math.min(MAX_CYCLE_MS, Math.max(MIN_CYCLE_MS, Math.round(ms)));
}

/**
 * Nhịp khóa theo khung: mỗi khung giữ đúng `frameMs` (bội số của một nhịp quét màn hình 60/120Hz) nên bước chân
 * đều; tốc độ di chuyển suy ra từ quãng bước để chân không trượt. Trả null khi thú cưng không khai báo `frameMs`.
 */
export function lockedCadence(kind, config) {
  if (!config.frameMs) return null;
  const run = kind === 'run';
  const cycleMs = config.frameMs * (run ? config.runFrames : config.walkFrames);
  const stride = (run ? RUN_STRIDE_PX : WALK_STRIDE_PX) * config.strideScale;
  return { cycleMs, speed: (stride / cycleMs) * 1000 };
}

/** Hệ số tốc độ 0.2–1 theo thời gian đã đi và còn lại của đoạn: tăng tốc rồi giảm tốc êm. */
export function rampFactor(elapsed, remaining) {
  const edge = Math.min(Math.max(0, elapsed), Math.max(0, remaining));
  return Math.min(1, Math.max(MIN_RAMP_FACTOR, edge / RAMP_MS));
}

/** Độ dịch ngang (px) của bong bóng để nó nằm trọn trong viewport khi thú đứng sát mép. */
export function bubbleShift(x, size, width, viewportWidth, margin = BUBBLE_MARGIN) {
  const left = x + size / 2 - width / 2;
  const max = Math.max(margin, viewportWidth - margin - width);
  return Math.min(Math.max(left, margin), max) - left;
}

/** Làm tròn vị trí theo pixel thiết bị để nét pixel art không bị nhòe khi dịch chuyển. */
export function snapToDevice(x, dpr = 1) {
  const ratio = dpr > 0 ? dpr : 1;
  return Math.round(x * ratio) / ratio;
}

function pickDirection({ direction, x, viewportWidth, size }, rng) {
  if (x <= 0) return 1;
  if (x >= viewportWidth - size) return -1;
  return rng() < TURN_CHANCE ? -direction : direction;
}

/**
 * Kế hoạch hành vi kế tiếp: { kind, direction, duration, speed } (speed chỉ có khi đi/chạy).
 * `forceKind` bỏ qua xác suất — dùng khi mèo cần rời chỗ (sau khi bị rê chuột/click) để không nằm
 * đè lên nút bên dưới.
 */
export function planNext(state, rng, config = CAT_CONFIG, forceKind) {
  const kind = forceKind ?? pickAction(rng);
  if (kind === 'idle')
    return { kind, direction: state.direction, duration: pickInRange(rng, config.idleDuration) };
  if (kind === 'jump')
    return { kind, direction: state.direction, duration: pickInRange(rng, JUMP_DURATION) };
  const base = kind === 'walk' ? config.walkSpeed : config.runSpeed;
  const duration = pickInRange(rng, kind === 'walk' ? config.walkDuration : config.runDuration);
  return {
    kind,
    direction: pickDirection(state, rng),
    duration,
    speed: base * pickInRange(rng, SPEED_JITTER[kind]),
  };
}

export function isCatActive(config, { webdriver = false, search = '' } = {}) {
  if (!config.enabled) return false;
  return !webdriver || AUTOMATION_OPT_IN.test(search);
}

/** Giá trị lạ/thiếu (ví dụ tham số URL ?pet=) quay về mặc định. */
export function resolvePet(value, fallback = DEFAULT_PET) {
  return PET_CHOICES.includes(value) ? value : fallback;
}

/** Gom các hàm dọn dẹp để destroy() chạy đúng một lần theo thứ tự ngược. */
export function createDisposer() {
  const tasks = [];
  return {
    add(task) {
      tasks.push(task);
    },
    run() {
      while (tasks.length) tasks.pop()();
    },
  };
}

function element(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

/**
 * @param {{ pet?: string, onClick?: () => void, root?: HTMLElement, config?: Partial<typeof CAT_CONFIG>, spriteUrl?: string | URL, random?: () => number, startX?: number }} [options]
 * @returns {{ destroy(): void, position(): number | null, speak(text: string, durationMs: number, pause?: boolean): boolean }} position(): vị trí ngang hiện tại (null khi chưa dựng); speak(): hiện bong bóng, false nếu thú chưa dựng/đang nhảy/đứng yên.
 */
export function startPixelCat(options = {}) {
  const pet = resolvePet(options.pet);
  const config = { ...CAT_CONFIG, ...PETS[pet].config, ...options.config };
  const automated = globalThis.navigator?.webdriver === true;
  const search = globalThis.location?.search ?? '';
  if (typeof document === 'undefined' || !isCatActive(config, { webdriver: automated, search })) {
    return { destroy() {}, position: () => null, speak: () => false };
  }
  const { root = document.body, random = Math.random, spriteUrl = PETS[pet].spriteUrl } = options;
  const disposer = createDisposer();
  let destroyed = false;
  let mounted = false;
  let currentX = () => 0;
  let speakNow = () => false;
  // Ảnh lỗi: không gắn handler, mèo đơn giản không xuất hiện (không ném lỗi).
  const probe = new Image();
  probe.onload = () => {
    if (!destroyed && probe.naturalHeight > 0) mount(probe);
  };
  probe.src = String(spriteUrl);
  disposer.add(() => {
    probe.onload = null;
  });

  function mount(sheet) {
    const frames = Math.max(1, Math.round(sheet.naturalWidth / sheet.naturalHeight));
    const layer = element('pixel-cat-layer');
    const cat = element('pixel-cat');
    const body = element('pixel-cat-body');
    const sprite = element('pixel-cat-sprite');
    cat.dataset.pet = pet;
    sprite.dataset.render = PETS[pet].render;
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--cat-sprite', `url("${sheet.src}")`);
    layer.style.setProperty('--cat-frames', String(frames));
    layer.style.setProperty('--cat-bottom', config.bottom + 'px');
    layer.style.setProperty('--cat-jump', config.jumpHeight + 'px');
    body.append(sprite);
    cat.append(body);
    layer.append(cat);
    root.append(layer);
    disposer.add(() => layer.remove());

    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    let size = config.size;
    let x = 0;
    currentX = () => x;
    mounted = true;
    let direction = 1;
    let jumping = false;
    let stateTimer = 0;
    let hoverTimer = 0;
    let standTimer = 0;
    let rafId = 0;
    let lastTimestamp = null;
    let segment = null;

    const viewportWidth = () => document.documentElement.clientWidth || window.innerWidth;
    const frozen = () => destroyed || motionQuery.matches || document.hidden;
    const setPose = (pose) => {
      if (sprite.dataset.pose !== pose) sprite.dataset.pose = pose;
    };
    const setDirection = (value) => {
      direction = value;
      sprite.dataset.dir = value < 0 ? 'left' : 'right';
    };
    let bubble = null;
    let bubbleWidth = 0;
    let bubbleTimer = 0;
    const placeBubble = () => {
      const shift = bubbleShift(x, size, bubbleWidth, viewportWidth());
      bubble.style.setProperty('--bubble-shift', shift + 'px');
    };
    const render = () => {
      cat.style.transform = `translate3d(${snapToDevice(x, window.devicePixelRatio || 1)}px, 0, 0)`;
      if (bubble) placeBubble();
    };

    function applyLayout() {
      size = mobileQuery.matches ? (config.mobileSize ?? MOBILE_SIZE) : config.size;
      layer.style.setProperty('--cat-size', size + 'px');
      x = clampX(x, viewportWidth(), size);
      render();
    }

    function halt() {
      clearTimeout(stateTimer);
      clearTimeout(hoverTimer);
      clearTimeout(standTimer);
      stateTimer = hoverTimer = standTimer = 0;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      jumping = false;
      segment = null;
      body.classList.remove('is-jumping');
      setPose('idle');
    }

    function begin(forceKind) {
      if (frozen()) return;
      const plan = planNext(
        { direction, x, viewportWidth: viewportWidth(), size },
        random,
        config,
        forceKind,
      );
      if (plan.direction === direction) return perform(plan);
      setDirection(plan.direction);
      setPose('turn');
      stateTimer = setTimeout(() => perform(plan), TURN_MS);
    }

    function perform(plan) {
      if (plan.kind === 'idle') {
        // Dừng ở dáng nghiêng như lúc đi để hình không bật đột ngột sang chính diện.
        setPose('stand');
        standTimer = setTimeout(() => setPose('idle'), Math.min(STAND_MS, plan.duration));
        stateTimer = setTimeout(begin, plan.duration);
      } else if (plan.kind === 'jump') {
        jump(plan.duration);
      } else {
        const locked = lockedCadence(plan.kind, config);
        const factor = mobileQuery.matches ? MOBILE_SPEED_FACTOR : 1;
        const speed = locked ? locked.speed : plan.speed * factor;
        const cycleMs = locked
          ? locked.cycleMs
          : cycleDuration(plan.kind, speed, config.strideScale);
        sprite.style.setProperty('--cat-cycle-ms', cycleMs + 'ms');
        setPose(plan.kind);
        segment = { remaining: plan.duration, elapsed: 0, speed };
        lastTimestamp = null;
        rafId = requestAnimationFrame(tick);
      }
    }

    function tick(timestamp) {
      const dt = lastTimestamp === null ? 0 : clampDt(timestamp - lastTimestamp);
      lastTimestamp = timestamp;
      const step = stepPosition({
        x,
        direction,
        speed: segment.speed * rampFactor(segment.elapsed, segment.remaining),
        dt,
        viewportWidth: viewportWidth(),
        size,
      });
      x = step.x;
      render();
      segment.elapsed += dt;
      segment.remaining -= dt;
      if (step.hitEdge) {
        rafId = 0;
        setDirection(step.direction);
        setPose('turn');
        stateTimer = setTimeout(begin, TURN_MS);
      } else if (segment.remaining <= 0) {
        rafId = 0;
        begin();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    function jump(duration, leaveAfter = false) {
      jumping = true;
      setPose('jump');
      body.style.setProperty('--cat-jump-ms', Math.round(duration) + 'ms');
      body.classList.add('is-jumping');
      stateTimer = setTimeout(() => {
        body.classList.remove('is-jumping');
        jumping = false;
        setPose('idle');
        begin(leaveAfter ? 'walk' : undefined);
      }, duration);
    }

    function closeBubble() {
      clearTimeout(bubbleTimer);
      bubbleTimer = 0;
      if (!bubble) return;
      const node = bubble;
      bubble = null;
      node.classList.remove('is-open');
      setTimeout(() => node.remove(), BUBBLE_FADE_MS);
    }

    // pause: thú dừng lại nhìn người dùng suốt lúc nói rồi mới đi tiếp; không pause thì bong bóng đi theo thú.
    function speak(text, duration, pause = false) {
      if (!text || frozen() || jumping) return false;
      closeBubble();
      bubble = element('pixel-cat-bubble');
      bubble.textContent = text;
      cat.append(bubble);
      bubbleWidth = bubble.offsetWidth;
      placeBubble();
      bubble.classList.add('is-open');
      bubbleTimer = setTimeout(closeBubble, duration);
      if (pause) {
        halt();
        stateTimer = setTimeout(begin, duration);
      }
      return true;
    }
    speakNow = speak;
    disposer.add(() => clearTimeout(bubbleTimer));

    function restart() {
      halt();
      begin();
    }

    function listen(target, type, handler) {
      target.addEventListener(type, handler);
      disposer.add(() => target.removeEventListener(type, handler));
    }

    listen(cat, 'pointerenter', () => {
      if (frozen() || jumping) return;
      halt();
      // Dừng có hạn: tránh chặn vĩnh viễn nút phía dưới khi con trỏ đứng yên trên mèo.
      hoverTimer = setTimeout(() => {
        hoverTimer = 0;
        begin('walk');
      }, HOVER_PAUSE_MS);
    });
    listen(cat, 'pointerleave', () => {
      if (hoverTimer) restart();
    });
    listen(cat, 'click', () => {
      if (frozen() || jumping) return;
      options.onClick?.();
      halt();
      jump(pickInRange(random, JUMP_DURATION), true);
    });
    listen(document, 'visibilitychange', () => (document.hidden ? halt() : restart()));
    listen(window, 'resize', applyLayout);
    listen(mobileQuery, 'change', applyLayout);
    listen(motionQuery, 'change', () => {
      layer.classList.toggle('is-still', motionQuery.matches);
      motionQuery.matches ? halt() : restart();
    });
    disposer.add(halt);

    x = options.startX ?? random() * Math.max(0, viewportWidth() - config.size);
    setDirection(1);
    setPose('idle');
    applyLayout();
    layer.classList.toggle('is-still', motionQuery.matches);
    if (!frozen())
      perform({ kind: 'idle', direction, duration: pickInRange(random, config.idleDuration) });
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      disposer.run();
    },
    position: () => (mounted ? currentX() : null),
    speak: (text, duration, pause) => speakNow(text, duration, pause),
  };
}

/**
 * Giữ đúng một thú tại một thời điểm; đổi thú giữ vị trí ngang gần đúng. Lựa chọn chỉ nằm trong bộ nhớ.
 * @param {{ initial?: string, start?: typeof startPixelCat } & Parameters<typeof startPixelCat>[0]} [options]
 */
export function createPetController({ initial, start = startPixelCat, ...petOptions } = {}) {
  let current = resolvePet(initial);
  let handle = null;
  const mountCurrent = (startX) => {
    handle = current === PET_OFF ? null : start({ ...petOptions, pet: current, startX });
  };
  mountCurrent();
  return {
    get: () => current,
    set(id) {
      const next = resolvePet(id, current);
      if (next === current) return;
      const x = handle?.position() ?? undefined;
      handle?.destroy();
      current = next;
      mountCurrent(x);
    },
    speak: (text, duration, pause) => handle?.speak(text, duration, pause) ?? false,
    destroy() {
      handle?.destroy();
      handle = null;
    },
  };
}
