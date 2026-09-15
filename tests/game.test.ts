import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  SHOP_ITEMS,
  TOOL_ORDER,
  buyDecor,
  chooseTool,
  getLevel,
  initialProfile,
  interact,
  isLeaving,
  newGame,
  requiredTool,
  reward,
  spawn,
  tick,
  work,
  workSpot,
} from '../src/game.ts';
import { createStore, validSave } from '../server/store.ts';

test('tool order puts frequent tools first for Ctrl cycling', () => {
  assert.deepEqual(TOOL_ORDER, ['cut', 'dry', 'color', 'perm', 'straight', 'braid', 'makeup', 'bridal']);
});

test('manual complete service shows the after look before the customer exits', () => {
  const p = initialProfile();
  const g = newGame(1);
  g.status = 'playing';
  spawn(g, p);
  interact(g, 1);
  const c = g.customers[0];
  const patience = c.patience;

  chooseTool(g, 'dry');
  assert.equal(c.tool, null);
  assert.equal(c.patience, patience - 4);

  g.player = workSpot(c, g);
  chooseTool(g, c.order);
  for (let i = 0; i < 5; i++) work(g, p);
  assert.equal(requiredTool(c), 'wash');

  g.player = workSpot(c, g);
  chooseTool(g, 'cut');
  assert.equal(c.tool, null);
  for (let i = 0; i < 5; i++) work(g, p);

  assert.equal(g.served, 1);
  assert.equal(g.customers.length, 1);
  assert.equal(isLeaving(g.customers[0]), true);
  assert.equal(g.customers[0].order, 'cut');

  let after = g;
  for (let i = 0; i < 23; i++) after = tick(after, p, 0.1);
  assert.equal(after.customers.some((customer) => customer.id === c.id), false);
  assert.ok(g.revenue >= 160);
});

test('customer moves to the shampoo zone after the first service', () => {
  const p = initialProfile();
  const g = newGame(1);
  g.status = 'playing';
  spawn(g, p);
  interact(g, 1);
  const c = g.customers[0];
  g.player = workSpot(c, g);
  chooseTool(g, requiredTool(c));
  for (let i = 0; i < 5; i++) work(g, p);
  assert.equal(requiredTool(c), 'wash');
  assert.ok(workSpot(c, g).y > 80);
});

test('service tools and work only respond inside the customer work box', () => {
  const p = initialProfile();
  const g = newGame(1);
  g.status = 'playing';
  spawn(g, p);
  interact(g, 1);
  const c = g.customers[0];
  g.player = { x: 5, y: 90 };
  chooseTool(g, requiredTool(c));
  assert.equal(c.tool, null);
  assert.match(g.message, /네모칸/);
  g.player = { x: 22, y: 53 };
  chooseTool(g, requiredTool(c));
  assert.equal(c.tool, requiredTool(c));
  g.player = { x: 95, y: 90 };
  work(g, p);
  assert.equal(c.progress, 0);
  assert.equal(c.tool, null);
  assert.match(g.message, /너무 멀리/);
});

test('all ten stages are winnable with free employees and upgrades, within configured time', () => {
  let p = initialProfile();
  p.staff = [true, true, true];
  p.upgrades = [true, true, true];
  for (const l of LEVELS) {
    let g = newGame(l.id);
    g.status = 'playing';
    for (let i = 0; i < l.duration * 10 + 1 && g.status === 'playing'; i++) g = tick(g, p, 0.1);
    assert.equal(g.status, 'won', `stage ${l.id} served ${g.served}/${l.target}`);
    assert.ok(g.time > 0);
    p = reward(g, p);
    assert.ok(p.stars[l.id]);
  }
  assert.equal(p.unlocked, 11);
  assert.equal(Object.keys(p.stars).length, 10);
});

test('coffee staff extends waiting patience', () => {
  const p = initialProfile();
  p.staff = [false, false, true];
  let g = newGame(1);
  g.status = 'playing';
  spawn(g, p);
  const before = g.customers[0].maxPatience;
  for (let i = 0; i < 17; i++) g = tick(g, p, 0.25);
  assert.ok(g.customers[0].maxPatience > before);
  assert.match(g.message, /커피/);
});

test('all ten stages can be played manually without employees', () => {
  const p = initialProfile();
  for (const l of LEVELS) {
    let g = newGame(l.id);
    g.status = 'playing';
    for (let i = 0; i < l.duration * 10 && g.status === 'playing'; i++) {
      g = tick(g, p, 0.1);
      const c = g.customers.find((customer) => !isLeaving(customer));
      if (c) {
        interact(g, c.id);
        g.player = workSpot(c, g);
        if (requiredTool(c) !== 'wash') chooseTool(g, requiredTool(c));
        work(g, p);
      }
    }
    assert.equal(g.status, 'won', `manual stage ${l.id}`);
  }
});

test('pause freezes time and customers, expiry loses, patience abandonment counted', () => {
  const p = initialProfile();
  let g = newGame(1);
  g.status = 'paused';
  assert.deepEqual(tick(g, p, 0.1), g);
  g.status = 'playing';
  g.time = 0.1;
  g = tick(g, p, 0.2);
  assert.equal(g.status, 'lost');
  g = newGame(1);
  g.status = 'playing';
  spawn(g, p);
  g.customers[0].patience = 0.01;
  g = tick(g, p, 0.1);
  assert.equal(g.lost, 1);
});


test('later stages unlock all styling services and endless rounds continue after stage ten', () => {
  assert.equal(LEVELS[0].services.length, 1);
  assert.equal(LEVELS[9].services.length, TOOL_ORDER.length);
  assert.deepEqual(LEVELS[9].services, TOOL_ORDER);
  const endless = getLevel(14);
  assert.equal(endless.endless, true);
  assert.deepEqual(endless.services, TOOL_ORDER);
  assert.ok(endless.target > LEVELS[9].target);
});

test('shop decor spends earned coins and keeps purchased items', () => {
  const p = initialProfile();
  p.coins = SHOP_ITEMS[0].cost + 50;
  const next = buyDecor(p, 0);
  assert.equal(next.decor[0], true);
  assert.equal(next.coins, 50);
  assert.equal(buyDecor(next, 0), next);
  assert.equal(buyDecor(next, 1), next);
});

test('SQLite saves and retrieves exact profile and in-progress game; invalid saves rejected', () => {
  const store = createStore(':memory:');
  const p = initialProfile();
  const g = newGame(2);
  g.status = 'playing';
  spawn(g, p);
  const save = { profile: p, game: g };
  assert.equal(validSave(save), true);
  store.write(save);
  assert.deepEqual(store.read(), save);
  assert.equal(validSave({ ...save, game: { ...g, level: 1000 } }), false);
  assert.equal(validSave({ ...save, profile: { ...p, staff: [true] } }), false);
  assert.equal(validSave({ ...save, game: { ...g, customers: [{ ...g.customers[0], steps: ['cut', 'wash', 'dry'] }] } }), false);
  store.close();
});

test('SQLite keeps separate nickname saves, reset slots, and ranks players', () => {
  const store = createStore(':memory:');
  const p1 = initialProfile();
  p1.coins = 500;
  p1.unlocked = 4;
  p1.stars = { 1: 3, 2: 2, 3: 1 };
  const p2 = initialProfile();
  p2.coins = 900;
  p2.unlocked = 3;
  p2.stars = { 1: 3 };
  const g = newGame(1);
  const alpha = { profile: p1, game: g };
  const beta = { profile: p2, game: null };
  store.write('루나', alpha);
  store.write('레오', beta);
  assert.deepEqual(store.read('루나'), alpha);
  assert.deepEqual(store.read('레오'), beta);
  assert.deepEqual(store.players().sort(), ['레오', '루나']);
  const ranks = store.rankings();
  assert.equal(ranks[0].player, '레오');
  assert.equal(ranks[1].player, '루나');
  assert.equal(ranks[1].totalStars, 6);
  store.reset('레오');
  assert.equal(store.read('레오').profile.coins, 0);
  assert.equal(store.rankings()[0].player, '루나');
  store.close();
});

test('employees take and finish chair and shampoo work without player input', () => {
  const p = initialProfile();
  p.staff = [true, true, false];
  let g = newGame(1);
  g.status = 'playing';
  spawn(g, p);

  for (let i = 0; i < 2; i++) g = tick(g, p, 0.25);
  let c = g.customers[0];
  assert.equal(c.seat >= 0, true);
  assert.equal(c.staff, 0);

  for (let i = 0; i < 25; i++) g = tick(g, p, 0.25);
  c = g.customers.find((customer) => customer.id === 1)!;
  assert.equal(g.served, 1);

  assert.equal(isLeaving(g.customers.find((customer) => customer.id === 1)!), true);
});






