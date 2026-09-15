export type Service = 'cut' | 'dry' | 'color' | 'perm' | 'straight' | 'braid' | 'makeup' | 'bridal' | 'wash';
export const SERVICES: Record<Service, { name: string; icon: string; price: number }> = {
  cut: { name: '커트', icon: '✂', price: 100 },
  dry: { name: '드라이', icon: '♨', price: 90 },
  color: { name: '염색', icon: '◒', price: 160 },
  perm: { name: '파마', icon: '♧', price: 180 },
  straight: { name: '스트레이트', icon: '≋', price: 160 },
  braid: { name: '헤어변형', icon: '⌁', price: 210 },
  makeup: { name: '메이크업', icon: '✦', price: 200 },
  bridal: { name: '왕실 업스타일', icon: '♛', price: 240 },
  wash: { name: '샴푸', icon: '◉', price: 40 },
};
export const TOOL_ORDER: Service[] = ['cut', 'dry', 'color', 'perm', 'straight', 'braid', 'makeup', 'bridal'];
const MAIN_SERVICES: Service[] = ['cut', 'dry', 'color', 'perm', 'straight', 'braid', 'makeup', 'bridal'];
const TARGETS = [3, 4, 5, 7, 8, 10, 11, 13, 15, 17];
const SERVICE_COUNTS = [1, 2, 3, 4, 4, 5, 6, 7, 8, 8];
export const WORK_BOX = { x: 9, y: 12 };
export const SEATS = [{ x: 22, y: 43 }, { x: 46, y: 43 }, { x: 70, y: 43 }, { x: 22, y: 70 }, { x: 46, y: 70 }, { x: 70, y: 70 }];
export const SHAMPOO_SPOTS = [{ x: 34, y: 86 }, { x: 57, y: 86 }];
export const SHOP_ITEMS = [
  { name: '로열 벽지', description: '살롱 벽을 더 화사한 궁전 분위기로 바꿔요.', cost: 500, className: 'decor-wall' },
  { name: 'OLED 샹들리에', description: '매장 중앙에 반짝이는 조명을 달아요.', cost: 900, className: 'decor-light' },
  { name: '황금 거울', description: '시술대 거울을 고급스럽게 꾸며요.', cost: 1300, className: 'decor-mirror' },
  { name: '왕실 화분', description: '리셉션 옆에 생기 있는 장식을 놓아요.', cost: 1700, className: 'decor-plant' },
] as const;
export type Level = { id: number; name: string; target: number; duration: number; spawn: number; patience: number; services: Service[]; endless?: boolean };
export const LEVELS: Level[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: ['첫 출근', '소문난 살롱', '컬러의 발견', '곱슬곱슬한 하루', '왕자의 단골집', '화사한 변신', '왕실 초대장', 'OLED 페스티벌', '로열 VIP 데이', '빛나는 그랜드 오픈'][i],
  target: TARGETS[i],
  duration: 110 + i * 9,
  spawn: Math.max(4.5, 11 - i * 0.72),
  patience: Math.max(34, 68 - i * 3.2),
  services: MAIN_SERVICES.slice(0, SERVICE_COUNTS[i]),
}));
export function getLevel(level: number): Level {
  if (level <= 10) return LEVELS[level - 1];
  const extra = level - 10;
  return {
    id: level,
    name: `로열 라운드 ${extra}`,
    target: Math.min(28, 17 + Math.floor(extra * 1.6)),
    duration: Math.min(240, 190 + extra * 5),
    spawn: Math.max(3.2, 5.1 - extra * 0.08),
    patience: Math.max(28, 39 - extra * 0.45),
    services: [...MAIN_SERVICES],
    endless: true,
  };
}
export type Customer = { id: number; kind: number; name: string; order: Service; steps: Service[]; step: number; seat: number; patience: number; maxPatience: number; progress: number; required: number; tool: Service | null; staff: number | null; leaving?: number };
export type Profile = { unlocked: number; stars: Record<string, number>; coins: number; staff: boolean[]; upgrades: boolean[]; decor: boolean[] };
export const initialProfile = (): Profile => ({ unlocked: 1, stars: {}, coins: 0, staff: [false, false, false], upgrades: [false, false, false], decor: [false, false, false, false] });
export type Game = { level: number; status: 'ready' | 'playing' | 'paused' | 'won' | 'lost'; time: number; spawnIn: number; customers: Customer[]; nextId: number; served: number; lost: number; revenue: number; combo: number; bestCombo: number; player: { x: number; y: number }; target: number | null; selected: number | null; message: string; staffTimers: number[]; seed: number };
export function newGame(level: number): Game { const round = getLevel(level); return { level, status: 'ready', time: round.duration, spawnIn: 0, customers: [], nextId: 1, served: 0, lost: 0, revenue: 0, combo: 0, bestCombo: 0, player: { x: 47, y: 85 }, target: null, selected: null, message: level > 10 ? '무한 라운드가 시작돼요. 다양한 스타일 손님이 찾아옵니다!' : '오늘도 반짝이는 하루를 열어볼까요?', staffTimers: [0, 0, 0], seed: (level * 719) >>> 0 }; }
export function isLeaving(c: Customer) { return (c.leaving ?? 0) > 0; }
export function isComplete(c: Customer) { return c.step >= c.steps.length; }
export function position(c: Customer, g: Game) { if (isLeaving(c)) return { x: 80, y: 78 }; if (c.seat < 0) return { x: 88, y: 42 + g.customers.filter(v => v.seat < 0 && v.id < c.id && !isLeaving(v)).length * 15 }; if (requiredTool(c) === 'wash') return SHAMPOO_SPOTS[c.seat % SHAMPOO_SPOTS.length]; return SEATS[c.seat]; }
export function workSpot(c: Customer, g: Game) { const pos = position(c, g); return { x: pos.x, y: Math.min(92, pos.y + 10) }; }
export function canServe(g: Game, c: Customer) { if (c.seat < 0 || isComplete(c)) return false; const spot = workSpot(c, g); return Math.abs(g.player.x - spot.x) <= WORK_BOX.x && Math.abs(g.player.y - spot.y) <= WORK_BOX.y; }
export function requiredTool(c: Customer) { return c.steps[Math.min(c.step, c.steps.length - 1)]; }
function random(g: Game) { g.seed = (g.seed * 1664525 + 1013904223) >>> 0; return g.seed / 4294967296; }
function randomOrder(g: Game) { const services = getLevel(g.level).services; return services[Math.floor(random(g) * services.length)]; }
export function spawn(g: Game, p: Profile) { if (g.customers.filter(c => !isLeaving(c)).length >= 8 || g.customers.filter(c => c.seat < 0 && !isLeaving(c)).length >= 4) return; const l = getLevel(g.level); const order = randomOrder(g); const patience = l.patience + (p.upgrades[1] ? 25 : 0); g.customers.push({ id: g.nextId++, kind: Math.floor(random(g) * 6), name: ['루나', '레오', '로제', '노아', '아리아', '유진', '세라', '하린', '이안', '미카'][Math.floor(random(g) * 10)], order, steps: [order, 'wash'], step: 0, seat: -1, patience, maxPatience: patience, progress: 0, required: p.upgrades[0] ? 3 : 5, tool: null, staff: null, leaving: 0 }); }
export function interact(g: Game, id: number) { if (g.status !== 'playing') return; const c = g.customers.find(c => c.id === id); if (!c || isLeaving(c)) return; if (c.seat < 0) { const seat = SEATS.findIndex((_, i) => !g.customers.some(c => c.seat === i && !isLeaving(c))); if (seat < 0) { g.message = '모든 의자가 사용 중이에요. 시술을 먼저 마쳐주세요.'; return; } c.seat = seat; g.player = { x: SEATS[seat].x, y: SEATS[seat].y + 12 }; g.message = `${c.name} 님의 ${SERVICES[c.order].name} 예약이에요.`; } g.selected = id; g.target = null; }
export function chooseTool(g: Game, tool: Service) { if (g.status !== 'playing') return; const c = g.customers.find(c => c.id === g.selected); if (!c || c.seat < 0 || c.staff !== null || isComplete(c)) return; if (requiredTool(c) === 'wash') { g.message = '샴푸존에서는 도구 없이 Space만 눌러주세요.'; return; } if (!canServe(g, c)) { c.tool = null; g.message = '손님 앞 네모칸 안으로 이동해야 시술할 수 있어요.'; return; } if (tool !== requiredTool(c)) { c.patience = Math.max(1, c.patience - 4); g.combo = 0; g.message = `지금은 ${SERVICES[requiredTool(c)].name} 도구가 필요해요.`; return; } c.tool = tool; g.message = `Space를 ${c.required - c.progress}번 눌러 ${SERVICES[tool].name} 시술을 마쳐주세요!`; }
export function completeStep(g: Game, c: Customer, p: Profile) { const finishedTool = requiredTool(c); g.revenue += SERVICES[finishedTool].price; c.step++; c.progress = 0; c.tool = null; c.staff = null; c.patience = Math.min(c.maxPatience, c.patience + 12); if (c.step === c.steps.length) { g.combo++; g.bestCombo = Math.max(g.combo, g.bestCombo); const tip = Math.round(Math.max(0, c.patience / c.maxPatience) * 30) * (p.upgrades[2] ? 2 : 1); g.revenue += tip; g.served++; c.leaving = 2.2; c.seat = -2; if (g.selected === c.id) g.selected = null; if (g.target === c.id) g.target = null; g.message = `${c.name} 님 완성! ${SERVICES[c.order].name} 스타일 확인 후 퇴장해요. 팁 +${tip} · ${g.combo} 콤보`; } else g.message = `다음은 ${SERVICES[requiredTool(c)].name}예요. 샴푸존으로 이동해서 Space만 눌러주세요.`; }
export function work(g: Game, p: Profile) { if (g.status !== 'playing') return; const c = g.customers.find(c => c.id === g.selected); if (!c || c.staff !== null || isComplete(c)) return; const need = requiredTool(c); if (need !== 'wash' && !c.tool) return; if (!canServe(g, c)) { c.tool = null; c.progress = 0; g.message = '너무 멀리 떨어졌어요. 손님 앞 네모칸 안에서 다시 시작해주세요.'; return; } c.progress++; if (need === 'wash') g.message = `거품 샴푸 중이에요. Space ${c.required - c.progress}번 남았어요.`; if (c.progress >= c.required) completeStep(g, c, p); }
export function tick(input: Game, p: Profile, dt: number, keys: Set<string> = new Set()): Game { if (input.status !== 'playing') return input; const g = structuredClone(input); const delta = Math.min(0.25, Math.max(0, dt)); const l = getLevel(g.level); g.time = Math.max(0, g.time - delta); let dx = 0, dy = 0; if (keys.has('ArrowLeft') || keys.has('a')) dx--; if (keys.has('ArrowRight') || keys.has('d')) dx++; if (keys.has('ArrowUp') || keys.has('w')) dy--; if (keys.has('ArrowDown') || keys.has('s')) dy++; const active = g.customers.find(c => c.id === g.selected); if (active?.tool) { dx = 0; dy = 0; } if (dx || dy) { g.target = null; g.player.x = Math.max(7, Math.min(95, g.player.x + dx * delta * 35)); g.player.y = Math.max(31, Math.min(93, g.player.y + dy * delta * 35)); }
  if (g.target !== null) { const c = g.customers.find(c => c.id === g.target); if (c && !isLeaving(c)) { const spot = workSpot(c, g); const distance = Math.hypot(spot.x - g.player.x, spot.y - g.player.y); if (distance < 2) interact(g, c.id); else { g.player.x += (spot.x - g.player.x) / distance * delta * 42; g.player.y += (spot.y - g.player.y) / distance * delta * 42; } } else g.target = null; }
  g.spawnIn -= delta; if (g.spawnIn <= 0) { spawn(g, p); g.spawnIn = l.spawn; }
  for (const c of [...g.customers]) { if (isComplete(c)) continue; const busy = c.tool !== null || c.staff !== null; c.patience -= delta * (busy ? 0.2 : 1); if (c.patience <= 0) { g.customers = g.customers.filter(v => v.id !== c.id); g.lost++; g.combo = 0; if (g.selected === c.id) g.selected = null; g.message = `${c.name} 님이 기다리다 돌아갔어요.`; } }
  p.staff.forEach((enabled, i) => { if (!enabled) return; g.staffTimers[i] += delta; if (i === 2) { if (g.staffTimers[i] >= 4) { const c = g.customers.find(c => c.seat < 0 && !isLeaving(c) && c.patience < c.maxPatience + 18); if (c) { c.maxPatience += 4; c.patience = Math.min(c.maxPatience, c.patience + 14); g.message = `${c.name} 님이 커피를 받고 조금 더 기다려요.`; } g.staffTimers[i] = 0; } return; }
    const workTime = p.upgrades[0] ? 3 : 5; let c = g.customers.find(c => c.staff === i && !isComplete(c)); if (!c) { c = g.customers.find(c => c.seat >= 0 && c.staff === null && !c.tool && !isComplete(c) && (i === 1 ? requiredTool(c) === 'wash' : requiredTool(c) !== 'wash')); if (!c && i === 0) { c = g.customers.find(c => c.seat < 0 && !isLeaving(c)); if (c) { const seat = SEATS.findIndex((_, j) => !g.customers.some(v => v.seat === j && !isLeaving(v))); if (seat >= 0) { c.seat = seat; g.message = `시술 보조 직원이 ${c.name} 님을 의자로 안내했어요.`; } else c = undefined; } } if (c) { c.staff = i; if (g.staffTimers[i] >= workTime) g.staffTimers[i] = Math.max(0, workTime - 1); g.message = i === 1 ? `샴푸 직원이 ${c.name} 님을 맡았어요.` : `시술 보조 직원이 ${c.name} 님을 맡았어요.`; } }
    if (c && g.staffTimers[i] >= workTime) { completeStep(g, c, p); g.staffTimers[i] = 0; } });
  for (const c of g.customers.filter(c => isLeaving(c))) c.leaving = Math.max(0, (c.leaving ?? 0) - delta); const removed = g.customers.some(c => isComplete(c) && !isLeaving(c)); if (removed) g.customers = g.customers.filter(c => !isComplete(c) || isLeaving(c)); if (removed && g.served >= l.target && g.status === 'playing') { g.status = 'won'; g.message = '오늘의 목표 달성! 다음 라운드도 열렸어요.'; }
  if (g.time <= 0 && g.status === 'playing') { g.status = g.served >= l.target ? 'won' : 'lost'; g.message = '오늘 영업이 끝났어요.'; } return g; }
export function nearest(g: Game) { return [...g.customers].filter(c => !isLeaving(c) && Math.hypot(position(c, g).x - g.player.x, position(c, g).y - g.player.y) < 20).sort((a, b) => Math.hypot(position(a, g).x - g.player.x, position(a, g).y - g.player.y) - Math.hypot(position(b, g).x - g.player.x, position(b, g).y - g.player.y))[0]; }
export function reward(g: Game, p: Profile): Profile { if (g.status !== 'won') return p; const stars = g.lost === 0 ? 3 : g.lost < 3 ? 2 : 1; const next = g.level + 1; return { ...p, unlocked: Math.max(p.unlocked, next), coins: p.coins + g.revenue, stars: { ...p.stars, [g.level]: Math.max(p.stars[g.level] || 0, stars) } }; }
export function buyDecor(p: Profile, index: number): Profile { const item = SHOP_ITEMS[index]; if (!item || p.decor[index] || p.coins < item.cost) return p; const decor = p.decor.map((value, i) => i === index ? true : value); return { ...p, coins: p.coins - item.cost, decor }; }
