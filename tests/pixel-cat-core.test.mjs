import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_WEIGHTS,
  CAT_CONFIG,
  DEFAULT_PET,
  JUMP_DURATION,
  MAX_CYCLE_MS,
  MAX_FRAME_DT_MS,
  MIN_CYCLE_MS,
  MIN_RAMP_FACTOR,
  PETS,
  PET_CHOICES,
  RAMP_MS,
  RUN_STRIDE_PX,
  SPEED_JITTER,
  WALK_STRIDE_PX,
  clampDt,
  clampX,
  createDisposer,
  createPetController,
  cycleDuration,
  lockedCadence,
  isCatActive,
  pickAction,
  pickInRange,
  planNext,
  rampFactor,
  resolvePet,
  snapToDevice,
  startPixelCat,
  stepPosition,
} from '../assets/js/ui/pixel-cat.js';

const fixed = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

test('pickAction splits at 50/75/90 thresholds and weights total 100', () => {
  assert.equal(
    ACTION_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0),
    100,
  );
  const at = (r) => pickAction(() => r);
  assert.equal(at(0), 'walk');
  assert.equal(at(0.499), 'walk');
  assert.equal(at(0.5), 'idle');
  assert.equal(at(0.749), 'idle');
  assert.equal(at(0.75), 'run');
  assert.equal(at(0.899), 'run');
  assert.equal(at(0.9), 'jump');
  assert.equal(at(0.9999), 'jump');
});

test('pickAction distribution over a uniform grid matches the weights', () => {
  const counts = { walk: 0, idle: 0, run: 0, jump: 0 };
  for (let i = 0; i < 1000; i++) counts[pickAction(() => i / 1000)]++;
  assert.deepEqual(counts, { walk: 500, idle: 250, run: 150, jump: 100 });
});

test('pickInRange stays inside the range', () => {
  assert.equal(
    pickInRange(() => 0, [2000, 5000]),
    2000,
  );
  assert.equal(
    pickInRange(() => 0.5, [2000, 5000]),
    3500,
  );
  assert.ok(pickInRange(() => 0.999999, [2000, 5000]) < 5000);
});

test('planNext durations and speeds stay within the spec ranges', () => {
  for (let r = 0; r < 1; r += 0.01) {
    for (const edge of [0, 1]) {
      const plan = planNext(
        { direction: 1, x: 200, viewportWidth: 1000, size: 48 },
        fixed(r, edge, edge, edge),
      );
      const [lo, hi] =
        plan.kind === 'idle'
          ? CAT_CONFIG.idleDuration
          : plan.kind === 'jump'
            ? JUMP_DURATION
            : plan.kind === 'walk'
              ? CAT_CONFIG.walkDuration
              : CAT_CONFIG.runDuration;
      assert.ok(plan.duration >= lo && plan.duration <= hi, plan.kind);
      if (plan.kind === 'walk') assert.ok(plan.speed >= 25 - 1e-9 && plan.speed <= 50 + 1e-9);
      if (plan.kind === 'run') assert.ok(plan.speed >= 70 - 1e-9 && plan.speed <= 100 + 1e-9);
    }
  }
  assert.deepEqual(
    SPEED_JITTER.walk.map((v) => Math.round(v * 40)),
    [25, 50],
  );
});

test('planNext never walks out of the nearest wall', () => {
  const walk = fixed(0, 0.99, 0.5);
  assert.equal(planNext({ direction: -1, x: 0, viewportWidth: 800, size: 48 }, walk).direction, 1);
  assert.equal(
    planNext({ direction: 1, x: 752, viewportWidth: 800, size: 48 }, fixed(0, 0.99, 0.5)).direction,
    -1,
  );
});

test('clampX keeps the cat inside [0, viewportWidth - size]', () => {
  assert.equal(clampX(-10, 800, 48), 0);
  assert.equal(clampX(900, 800, 48), 752);
  assert.equal(clampX(100, 800, 48), 100);
  assert.equal(clampX(50, 30, 48), 0);
});

test('stepPosition advances by speed*dt and reverses at both edges', () => {
  const base = { speed: 100, dt: 100, viewportWidth: 800, size: 48 };
  assert.deepEqual(stepPosition({ ...base, x: 100, direction: 1 }), {
    x: 110,
    direction: 1,
    hitEdge: false,
  });
  assert.deepEqual(stepPosition({ ...base, x: 100, direction: -1 }), {
    x: 90,
    direction: -1,
    hitEdge: false,
  });
  assert.deepEqual(stepPosition({ ...base, x: 745, direction: 1 }), {
    x: 752,
    direction: -1,
    hitEdge: true,
  });
  assert.deepEqual(stepPosition({ ...base, x: 5, direction: -1 }), {
    x: 0,
    direction: 1,
    hitEdge: true,
  });
});

test('stepPosition does not report an edge when leaving the wall', () => {
  const base = { speed: 100, dt: 0, viewportWidth: 800, size: 48 };
  assert.equal(stepPosition({ ...base, x: 0, direction: 1 }).hitEdge, false);
  assert.equal(stepPosition({ ...base, x: 752, direction: -1 }).hitEdge, false);
});

test('a simulated minute of walking never leaves the viewport', () => {
  let x = 300;
  let direction = 1;
  for (let t = 0; t < 60000; t += 16) {
    const step = stepPosition({
      x,
      direction,
      speed: 100,
      dt: clampDt(16),
      viewportWidth: 600,
      size: 48,
    });
    ({ x, direction } = step);
    assert.ok(x >= 0 && x <= 552);
  }
});

test('clampDt limits long frame gaps', () => {
  assert.equal(clampDt(5000), MAX_FRAME_DT_MS);
  assert.equal(clampDt(-3), 0);
  assert.equal(clampDt(16), 16);
});

test('createDisposer runs every task once, newest first', () => {
  const order = [];
  const disposer = createDisposer();
  disposer.add(() => order.push('a'));
  disposer.add(() => order.push('b'));
  disposer.run();
  disposer.run();
  assert.deepEqual(order, ['b', 'a']);
});

test('isCatActive honours enabled flag and the automation opt-in', () => {
  assert.equal(isCatActive({ enabled: false }), false);
  assert.equal(isCatActive({ enabled: true }), true);
  assert.equal(isCatActive({ enabled: true }, { webdriver: true, search: '' }), false);
  assert.equal(isCatActive({ enabled: true }, { webdriver: true, search: '?x=1&cat=1' }), true);
  assert.equal(isCatActive({ enabled: true }, { webdriver: true, search: '?cat=10' }), false);
});

test('startPixelCat is a safe no-op when disabled or without a DOM', () => {
  assert.doesNotThrow(() => startPixelCat({ config: { enabled: false } }).destroy());
  assert.doesNotThrow(() => startPixelCat().destroy());
});

test('planNext honours forceKind so the cat leaves the spot regardless of the random draw', () => {
  const state = { direction: 1, x: 100, viewportWidth: 1000, size: 48 };
  for (const draw of [0, 0.3, 0.6, 0.8, 0.95]) {
    const plan = planNext(state, () => draw, CAT_CONFIG, 'walk');
    assert.equal(plan.kind, 'walk');
    assert.ok(plan.speed > 0);
  }
});

test('cycleDuration ties the step rhythm to the speed and stays within bounds', () => {
  // Same stride per cycle: doubling the speed halves the cycle until the lower bound.
  assert.equal(cycleDuration('walk', 40), Math.round((WALK_STRIDE_PX / 40) * 1000));
  assert.ok(cycleDuration('walk', 80) < cycleDuration('walk', 40));
  assert.ok(cycleDuration('run', 85) >= MIN_CYCLE_MS);
  assert.equal(cycleDuration('walk', 1000), MIN_CYCLE_MS);
  assert.equal(cycleDuration('walk', 1), MAX_CYCLE_MS);
  assert.equal(cycleDuration('walk', 0), MAX_CYCLE_MS);
  // A run covers more ground per cycle than a walk at the same speed.
  assert.ok(RUN_STRIDE_PX > WALK_STRIDE_PX);
  assert.ok(cycleDuration('run', 50) > cycleDuration('walk', 50));
});

test('rampFactor accelerates at the start, decelerates at the end and never stalls', () => {
  assert.equal(rampFactor(0, 5000), MIN_RAMP_FACTOR);
  assert.equal(rampFactor(RAMP_MS, 5000), 1);
  assert.equal(rampFactor(2000, 2000), 1);
  assert.equal(rampFactor(4000, 0), MIN_RAMP_FACTOR);
  assert.ok(rampFactor(RAMP_MS / 2, 5000) > MIN_RAMP_FACTOR);
  assert.ok(rampFactor(RAMP_MS / 2, 5000) < 1);
  // The ramp is symmetric around the middle of a segment.
  assert.equal(rampFactor(100, 3000), rampFactor(3000, 100));
  for (const e of [0, 50, 500, 5000])
    for (const r of [0, 50, 500, 5000]) {
      const f = rampFactor(e, r);
      assert.ok(f >= MIN_RAMP_FACTOR && f <= 1);
    }
});

test('snapToDevice rounds to whole device pixels', () => {
  assert.equal(snapToDevice(10.4, 1), 10);
  assert.equal(snapToDevice(10.6, 1), 11);
  assert.equal(snapToDevice(10.26, 2), 10.5);
  assert.equal(snapToDevice(10.1, 2), 10);
  assert.equal(snapToDevice(10.5, 1.5), 10.666666666666666);
  assert.equal(snapToDevice(7.3, 0), 7);
});

test('PETS registers cat and dog with sprite, render mode and per-pet config', () => {
  assert.deepEqual(PET_CHOICES, ['cat', 'dog', 'off']);
  assert.equal(DEFAULT_PET, 'cat');
  assert.match(PETS.cat.spriteUrl, /images\/cat\/cat-sprites\.png$/);
  assert.match(PETS.dog.spriteUrl, /images\/dog\/dog-sprites\.png$/);
  assert.equal(PETS.cat.render, 'pixelated');
  assert.equal(PETS.dog.render, 'smooth');
  assert.equal(PETS.cat.config.size, CAT_CONFIG.size);
  assert.ok(PETS.dog.config.size > PETS.cat.config.size);
  assert.ok(PETS.dog.config.mobileSize < PETS.dog.config.size);
  assert.ok(PETS.dog.config.walkSpeed <= CAT_CONFIG.walkSpeed);
});

test('resolvePet accepts known ids and falls back for anything else', () => {
  for (const id of PET_CHOICES) assert.equal(resolvePet(id), id);
  for (const bad of [null, undefined, '', 'bird', 'DOG', 'cat '])
    assert.equal(resolvePet(bad), 'cat');
  assert.equal(resolvePet('bird', 'dog'), 'dog');
});

test('cycleDuration scales the stride for bigger pets', () => {
  assert.equal(cycleDuration('walk', 100, 2), Math.round(((WALK_STRIDE_PX * 2) / 100) * 1000));
  assert.equal(cycleDuration('walk', 100), cycleDuration('walk', 100, 1));
});

const fakeStart = () => {
  const calls = [];
  const start = (options) => {
    const handle = {
      options,
      destroyed: 0,
      destroy() {
        this.destroyed++;
      },
      position: () => 120,
    };
    calls.push(handle);
    return handle;
  };
  return { calls, start };
};

test('createPetController starts the initial pet and keeps only one pet alive', () => {
  const { calls, start } = fakeStart();
  const controller = createPetController({ initial: 'dog', start, root: 'r' });
  assert.equal(controller.get(), 'dog');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.pet, 'dog');
  assert.equal(calls[0].options.root, 'r');
  controller.set('cat');
  assert.equal(controller.get(), 'cat');
  assert.equal(calls[0].destroyed, 1);
  assert.equal(calls[1].options.pet, 'cat');
  assert.equal(calls[1].options.startX, 120);
  assert.equal(calls.filter((c) => c.destroyed === 0).length, 1);
});

test('createPetController: same value is a no-op, unknown value ignored, off mounts nothing', () => {
  const { calls, start } = fakeStart();
  const controller = createPetController({ initial: 'bogus', start });
  assert.equal(controller.get(), 'cat');
  controller.set('cat');
  controller.set('bird');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].destroyed, 0);
  controller.set('off');
  assert.equal(controller.get(), 'off');
  assert.equal(calls[0].destroyed, 1);
  assert.equal(calls.length, 1);
  controller.set('dog');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.startX, undefined);
  controller.destroy();
  controller.destroy();
  assert.equal(calls[1].destroyed, 1);
});

test('createPetController with initial off never starts a pet', () => {
  const { calls, start } = fakeStart();
  const controller = createPetController({ initial: 'off', start });
  assert.equal(calls.length, 0);
  assert.doesNotThrow(() => controller.destroy());
});

test('startPixelCat without a DOM reports no position', () => {
  assert.equal(startPixelCat({ pet: 'dog' }).position(), null);
});

test('lockedCadence holds every frame for frameMs and derives a speed that matches the stride', () => {
  const config = PETS.dog.config;
  const walk = lockedCadence('walk', config);
  const run = lockedCadence('run', config);
  assert.equal(walk.cycleMs, config.frameMs * config.walkFrames);
  assert.equal(run.cycleMs, config.frameMs * config.runFrames);
  assert.ok(run.speed > walk.speed);
  assert.ok(walk.speed >= 25 && walk.speed <= 50);
  assert.equal(lockedCadence('walk', PETS.cat.config), null);
});
