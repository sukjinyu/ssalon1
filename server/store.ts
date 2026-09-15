import { DatabaseSync } from 'node:sqlite';
import { SHOP_ITEMS, getLevel, initialProfile, SERVICES, type Game, type Profile } from '../src/game.ts';

export type Save = { profile: Profile; game: Game | null };
export type Ranking = {
  player: string;
  coins: number;
  unlocked: number;
  totalStars: number;
  completedStages: number;
  updatedAt: string;
};

const DEFAULT_PLAYER = '플레이어';
const number = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min: number, max: number) =>
  number(v, min, max) && Number.isInteger(v);
const bools = (v: unknown, n: number) =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'boolean');

export function normalizePlayerName(name: unknown) {
  const text = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 18);
  return text || DEFAULT_PLAYER;
}

export function validSave(data: unknown): data is Save {
  if (!data || typeof data !== 'object') return false;
  const { profile: p, game: g } = data as Save;
  if (
    !p ||
    !integer(p.unlocked, 1, 999) ||
    !number(p.coins, 0, 1e12) ||
    !bools(p.staff, 3) ||
    !bools(p.upgrades, 3) ||
    !(p.decor === undefined || bools(p.decor, SHOP_ITEMS.length)) ||
    !p.stars ||
    typeof p.stars !== 'object' ||
    Array.isArray(p.stars) ||
    Object.entries(p.stars).some(
      ([k, v]) => !/^([1-9][0-9]{0,2})$/.test(k) || !integer(v, 1, 3),
    )
  )
    return false;
  if (g === null) return true;
  if (
    !g ||
    !integer(g.level, 1, 999) ||
    !['ready', 'playing', 'paused', 'won', 'lost'].includes(g.status) ||
    !number(g.time, 0, 260) ||
    !number(g.spawnIn, -1, 20) ||
    !integer(g.nextId, 1, 1e6) ||
    !integer(g.served, 0, 1000) ||
    !integer(g.lost, 0, 1000) ||
    !number(g.revenue, 0, 1e9) ||
    !integer(g.combo, 0, 1000) ||
    !integer(g.bestCombo, 0, 1000) ||
    !g.player ||
    !number(g.player.x, 0, 100) ||
    !number(g.player.y, 0, 100) ||
    !(g.target === null || integer(g.target, 1, 1e6)) ||
    !(g.selected === null || integer(g.selected, 1, 1e6)) ||
    typeof g.message !== 'string' ||
    g.message.length > 300 ||
    !Array.isArray(g.staffTimers) ||
    g.staffTimers.length !== 3 ||
    !g.staffTimers.every((v) => number(v, 0, 1000)) ||
    !integer(g.seed, 0, 4294967295) ||
    !Array.isArray(g.customers) ||
    g.customers.length > 8
  )
    return false;
  const ids = new Set<number>(),
    seats = new Set<number>();
  return g.customers.every((c) => {
    if (
      !c ||
      !integer(c.id, 1, g.nextId - 1) ||
      ids.has(c.id) ||
      !integer(c.kind, 0, 5) ||
      typeof c.name !== 'string' ||
      c.name.length > 30 ||
      !getLevel(g.level).services.includes(c.order) ||
      !Array.isArray(c.steps) ||
      c.steps.join(',') !== [c.order, 'wash'].join(',') ||
      !integer(c.step, 0, c.steps.length) ||
      !integer(c.seat, -2, 5) ||
      !number(c.patience, 0, 160) ||
      !number(c.maxPatience, 1, 160) ||
      !integer(c.progress, 0, 5) ||
      !integer(c.required, 3, 5) ||
      !(c.tool === null || Object.hasOwn(SERVICES, c.tool)) ||
      !(c.staff === null || integer(c.staff, 0, 2)) ||
      !(c.leaving === undefined || number(c.leaving, 0, 3)) ||
      (c.seat >= 0 && seats.has(c.seat))
    )
      return false;
    ids.add(c.id);
    if (c.seat >= 0) seats.add(c.seat);
    return true;
  });
}

function normalizeSave(save: Save): Save {
  return {
    profile: {
      ...save.profile,
      decor: Array.isArray(save.profile.decor) && save.profile.decor.length === SHOP_ITEMS.length
        ? save.profile.decor
        : SHOP_ITEMS.map(() => false),
    },
    game: save.game,
  };
}

function blankSave(): Save {
  return { profile: initialProfile(), game: null };
}

function rankFromRow(row: { player_name: string; payload: string; updated_at: string }): Ranking | null {
  try {
    const save = JSON.parse(row.payload);
    if (!validSave(save)) return null;
    const normalized = normalizeSave(save);
    const stars = Object.values(normalized.profile.stars) as number[];
    return {
      player: row.player_name,
      coins: normalized.profile.coins,
      unlocked: normalized.profile.unlocked,
      totalStars: stars.reduce((sum, value) => sum + value, 0),
      completedStages: stars.length,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export function createStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY CHECK(id=1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_saves (
      player_name TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS count FROM player_saves').get() as {
    count: number;
  };
  const legacy = db.prepare('SELECT payload, updated_at FROM saves WHERE id=1').get() as
    | { payload: string; updated_at: string }
    | undefined;
  if (count.count === 0 && legacy) {
    try {
      const save = JSON.parse(legacy.payload);
      if (validSave(save)) {
        db.prepare(
          'INSERT INTO player_saves(player_name,payload,updated_at) VALUES(?,?,?)',
        ).run(DEFAULT_PLAYER, legacy.payload, legacy.updated_at);
      }
    } catch {}
  }
  return {
    read(player = DEFAULT_PLAYER): Save {
      const name = normalizePlayerName(player);
      const row = db
        .prepare('SELECT payload FROM player_saves WHERE player_name=?')
        .get(name) as { payload: string } | undefined;
      if (row) {
        try {
          const save = JSON.parse(row.payload);
          if (validSave(save)) return normalizeSave(save);
        } catch {}
      }
      if (name === DEFAULT_PLAYER) {
        const legacy = db.prepare('SELECT payload FROM saves WHERE id=1').get() as
          | { payload: string }
          | undefined;
        if (legacy) {
          try {
            const save = JSON.parse(legacy.payload);
            if (validSave(save)) return normalizeSave(save);
          } catch {}
        }
      }
      return blankSave();
    },
    write(playerOrSave: string | Save, maybeSave?: Save) {
      const player = typeof playerOrSave === 'string' ? playerOrSave : DEFAULT_PLAYER;
      const save = typeof playerOrSave === 'string' ? maybeSave : playerOrSave;
      if (!save) throw new Error('저장 데이터가 없습니다.');
      db.prepare(
        "INSERT INTO player_saves(player_name,payload,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(player_name) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
      ).run(normalizePlayerName(player), JSON.stringify(normalizeSave(save)));
    },
    reset(player = DEFAULT_PLAYER) {
      this.write(normalizePlayerName(player), blankSave());
    },
    players() {
      const rows = db
        .prepare('SELECT player_name FROM player_saves ORDER BY updated_at DESC, player_name ASC')
        .all() as { player_name: string }[];
      const names = rows.map((row) => row.player_name);
      return names.length ? names : [DEFAULT_PLAYER];
    },
    rankings() {
      const rows = db
        .prepare('SELECT player_name, payload, updated_at FROM player_saves')
        .all() as { player_name: string; payload: string; updated_at: string }[];
      return rows
        .map(rankFromRow)
        .filter((row): row is Ranking => row !== null)
        .sort(
          (a, b) =>
            b.coins - a.coins ||
            b.totalStars - a.totalStars ||
            b.unlocked - a.unlocked ||
            a.player.localeCompare(b.player),
        )
        .slice(0, 20);
    },
    close() {
      db.close();
    },
  };
}



