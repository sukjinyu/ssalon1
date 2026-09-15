import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LEVELS,
  SERVICES,
  SHOP_ITEMS,
  SEATS,
  SHAMPOO_SPOTS,
  TOOL_ORDER,
  initialProfile,
  newGame,
  getLevel,
  tick,
  interact,
  chooseTool,
  work,
  nearest,
  position,
  workSpot,
  canServe,
  requiredTool,
  isComplete,
  isLeaving,
  reward,
  buyDecor,
  type Game,
  type Profile,
  type Service,
} from "./game";
import "./style.css";
type Tab = "salon" | "staff" | "shop" | "levels" | "ranking" | "help";
type Ranking = {
  player: string;
  coins: number;
  unlocked: number;
  totalStars: number;
  completedStages: number;
  updatedAt: string;
};
const STAFF = [
  {
    name: "민트 공주",
    role: "시술 보조",
    description: "의자에 앉은 손님의 커트·염색·드라이를 도와줘요.",
    sprite: 2,
  },
  {
    name: "라일락 왕자",
    role: "샴푸 전담",
    description: "샴푸존 손님을 빠르게 맡아줘요.",
    sprite: 3,
  },
  {
    name: "로제 공주",
    role: "커피 서비스",
    description: "대기 손님에게 커피를 줘서 기다릴 힘을 늘려요.",
    sprite: 0,
  },
];
const UPGRADES = [
  {
    name: "마법의 도구 세트",
    description: "시술 입력 5회 → 3회 · 직원 시술 5초 → 3초",
    icon: "✂",
  },
  {
    name: "편안한 로열 체어",
    description: "모든 손님의 기다림 +25초",
    icon: "♜",
  },
  {
    name: "반짝이는 OLED 거울",
    description: "만족한 손님의 팁 2배",
    icon: "✦",
  },
];
const SERVICE_IDS = TOOL_ORDER;
function styledLook(c: { order: Service; step: number; leaving?: number }) {
  return c.step > 0 || (c.leaving ?? 0) > 0 ? `style-${c.order}` : "style-fresh";
}
function needsAutomaticShampoo(c?: { steps: Service[]; step: number }) {
  return c ? c.steps[c.step] === "wash" : false;
}
function Sprite({
  kind = 0,
  className = "",
  look = "style-fresh",
}: {
  kind?: number;
  className?: string;
  look?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pixel-sprite pixel-kind-${kind} ${look} ${className}`}
    >
      <span className="pixel-hair" />
      <span className="pixel-head">
        <span className="pixel-eye left" />
        <span className="pixel-eye right" />
        <span className="pixel-mouth" />
      </span>
      <span className="pixel-style-mark" />
      <span className="pixel-body" />
      <span className="pixel-arm left" />
      <span className="pixel-arm right" />
      <span className="pixel-leg left" />
      <span className="pixel-leg right" />
    </span>
  );
}
function App() {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [game, setGame] = useState<Game>(() => newGame(1));
  const [tab, setTab] = useState<Tab>("salon");
  const savedPlayerName = localStorage.getItem("royal-salon-player") || "플레이어";
  const [playerName, setPlayerName] = useState(savedPlayerName);
  const [draftPlayerName, setDraftPlayerName] = useState(savedPlayerName);
  const [players, setPlayers] = useState<string[]>([savedPlayerName]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("저장 불러오는 중");
  const [character, setCharacter] = useState(2);
  const [sound, setSound] = useState(false);
  const keys = useRef(new Set<string>());
  const toolCursor = useRef(0);
  const gRef = useRef(game),
    pRef = useRef(profile),
    playerRef = useRef(playerName);
  gRef.current = game;
  pRef.current = profile;
  playerRef.current = playerName;
  const rewardGiven = useRef(false);
  const saveChain = useRef(Promise.resolve());
  const soundRef = useRef<AudioContext | null>(null);
  function beep() {
    if (!sound) return;
    const ctx = soundRef.current ?? (soundRef.current = new AudioContext());
    void ctx.resume();
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }
  function save(p = pRef.current, g = gRef.current) {
    const data = JSON.stringify({ player: playerRef.current, profile: p, game: g });
    setSaveStatus("저장 중…");
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(async () => {
        try {
          const res = await fetch("/api/save", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: data,
          });
          if (!res.ok) throw Error();
          setSaveStatus("진행 상황 저장됨");
          setError("");
          void refreshPlayersAndRankings();
        } catch {
          setSaveStatus("저장 실패");
          setError(
            "서버에 저장하지 못했어요. 연결을 확인하고 저장을 다시 눌러주세요.",
          );
        }
      });
    return saveChain.current;
  }
  function mutate(fn: (g: Game) => void) {
    setGame((old) => {
      const g = structuredClone(old);
      fn(g);
      return g;
    });
  }
  async function refreshPlayersAndRankings() {
    try {
      const [playerRes, rankingRes] = await Promise.all([
        fetch("/api/players"),
        fetch("/api/rankings"),
      ]);
      if (playerRes.ok) {
        const data = await playerRes.json();
        setPlayers(data.players?.length ? data.players : [playerRef.current]);
      }
      if (rankingRes.ok) {
        const data = await rankingRes.json();
        setRankings(data.rankings || []);
      }
    } catch {}
  }
  async function loadPlayer(name: string) {
    const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 18) || "플레이어";
    setLoaded(false);
    setSaveStatus("저장 불러오는 중");
    try {
      const res = await fetch("/api/save?player=" + encodeURIComponent(cleanName));
      if (!res.ok) throw Error();
      const data = await res.json();
      localStorage.setItem("royal-salon-player", data.player);
      playerRef.current = data.player;
      setPlayerName(data.player);
      setDraftPlayerName(data.player);
      const loadedProfile = { ...data.profile, decor: data.profile.decor ?? SHOP_ITEMS.map(() => false) };
      pRef.current = loadedProfile;
      setProfile(loadedProfile);
      setGame(
        data.game
          ? {
              ...data.game,
              status: data.game.status === "playing" ? "paused" : data.game.status,
            }
          : newGame(1),
      );
      rewardGiven.current = data.game?.status === "won";
      setSaveStatus(data.player + " 저장 불러옴");
      setError("");
      setLoaded(true);
      void refreshPlayersAndRankings();
    } catch {
      setError(
        "저장 서버에 연결하지 못했어요. 서버를 실행한 뒤 새로고침해주세요.",
      );
      setSaveStatus("서버 연결 실패");
    }
  }
  async function resetCurrentPlayer() {
    if (!window.confirm(playerName + " 저장을 처음부터 다시 시작할까요?")) return;
    try {
      const res = await fetch("/api/save/" + encodeURIComponent(playerName), {
        method: "DELETE",
      });
      if (!res.ok) throw Error();
      const p = initialProfile();
      const g = newGame(1);
      pRef.current = p;
      gRef.current = g;
      setProfile(p);
      setGame(g);
      setSaveStatus(playerName + " 저장 리셋 완료");
      setError("");
      void refreshPlayersAndRankings();
    } catch {
      setSaveStatus("리셋 실패");
      setError("저장을 리셋하지 못했어요. 서버 연결을 확인해주세요.");
    }
  }
  useEffect(() => {
    void loadPlayer(savedPlayerName);
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () => setGame((g) => tick(g, pRef.current, 0.1, keys.current)),
      100,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => {
      if (gRef.current.status === "playing") void save();
    }, 10000);
    return () => clearInterval(timer);
  }, [loaded]);
  useEffect(() => {
    if (game.status === "won" && !rewardGiven.current) {
      rewardGiven.current = true;
      const p = reward(game, pRef.current);
      pRef.current = p;
      setProfile(p);
      void save(p, game);
    }
  }, [game.status]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest("input,select,textarea") &&
        e.code === "Space"
      )
        return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space","ControlLeft","ControlRight"].includes(
          e.code,
        ) ||
        (e.ctrlKey && /^Digit[1-8]$/.test(e.code))
      )
        e.preventDefault();
      if (e.code === "Escape") {
        setGame((g) => ({
          ...g,
          status:
            g.status === "playing"
              ? "paused"
              : g.status === "paused"
                ? "playing"
                : g.status,
        }));
        return;
      }
      if (gRef.current.status !== "playing" || tab !== "salon") return;
      keys.current.add(e.key);
      if ((e.code === "ControlLeft" || e.code === "ControlRight") && !e.repeat) {
        mutate((g) => {
          const selected = g.customers.find((c) => c.id === g.selected);
          if (!selected) {
            g.message = "손님을 먼저 선택한 뒤 Ctrl로 도구를 바꿔주세요.";
            return;
          }
          const tool = SERVICE_IDS[toolCursor.current];
          toolCursor.current = (toolCursor.current + 1) % SERVICE_IDS.length;
          chooseTool(g, tool);
        });
        beep();
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        mutate((g) => {
          const selected = g.customers.find((c) => c.id === g.selected);
          if (selected && (selected.tool || requiredTool(selected) === "wash")) {
            work(g, pRef.current);
            return;
          }
          const c = nearest(g);
          if (c) interact(g, c.id);
          else g.message = "손님 가까이 이동한 뒤 스페이스바를 눌러주세요.";
        });
        beep();
      }
      if (/^Digit[1-8]$/.test(e.code)) {
        mutate((g) => chooseTool(g, SERVICE_IDS[Number(e.code.at(-1)) - 1]));
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const pause = () => {
      keys.current.clear();
      setGame((g) => (g.status === "playing" ? { ...g, status: "paused" } : g));
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", pause);
    const hide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [tab, sound]);
  function changeTab(t: Tab) {
    if (t !== tab) {
      keys.current.clear();
      setGame((g) => (g.status === "playing" ? { ...g, status: "paused" } : g));
      setTab(t);
    }
  }
  function start(level = game.level) {
    rewardGiven.current = false;
    const g = newGame(level);
    g.status = "playing";
    setGame(g);
    setTab("salon");
    void save(profile, g);
  }
  function toggle(kind: "staff" | "upgrades", i: number) {
    const p = {
      ...profile,
      [kind]: profile[kind].map((v, j) => (j === i ? !v : v)),
    };
    const nextProfile = { ...p, decor: p.decor ?? SHOP_ITEMS.map(() => false) };
      pRef.current = nextProfile;
      setProfile(nextProfile);
    let g = structuredClone(game);
    g.customers.forEach((c) => {
      if (kind === "staff" && c.staff === i) c.staff = null;
    });
    setGame(g);
    void save(nextProfile, g);
  }
  function purchaseDecor(i: number) {
    const p = buyDecor(profile, i);
    if (p === profile) {
      setError(profile.decor[i] ? "이미 구매한 장식이에요." : "매출이 부족해요. 영업으로 돈을 더 모아주세요.");
      return;
    }
    pRef.current = p;
    setProfile(p);
    setError("");
    void save(p, game);
  }
  const level = getLevel(game.level),
    selected = game.customers.find((c) => c.id === game.selected);
  const selectedStepKey = selected ? `${selected.id}:${selected.step}` : "none";
  const selectedInRange = selected ? canServe(game, selected) : false;
  const selectedSpot = selected && selected.seat >= 0 ? workSpot(selected, game) : null;
  const shampooStep = needsAutomaticShampoo(selected);
  useEffect(() => {
    toolCursor.current = 0;
  }, [selectedStepKey]);
  const progress = Math.min(100, (game.served / level.target) * 100);
  const won = game.status === "won";
  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeTab("salon");
          }}
        >
          <span className="brand-mark">♛</span>
          <span>
            로열 살롱<small>ROYAL SALON</small>
          </span>
        </a>
        <div className="edition">까끌래뽀끌래에서 시작된, 새로운 이야기</div>
        <div className="top-actions">
          <form
            className="player-form"
            onSubmit={(e) => {
              e.preventDefault();
              void loadPlayer(draftPlayerName);
            }}
          >
            <label htmlFor="player-name">별명</label>
            <input
              id="player-name"
              value={draftPlayerName}
              maxLength={18}
              onChange={(e) => setDraftPlayerName(e.target.value)}
            />
            <button disabled={!draftPlayerName.trim()}>불러오기</button>
          </form>
          <button aria-pressed={sound} onClick={() => setSound(!sound)}>
            {sound ? "♫ 소리 켜짐" : "♪ 소리 꺼짐"}
          </button>
          <button disabled={!loaded} onClick={() => void save()}>
            ↥ 저장
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">LG DISPLAY · ROYAL LOUNGE</div>
            <h1>오늘도, 반짝이게.</h1>
          </div>
          <div className="balance">
            <span>{playerName} 님 누적 매출</span>
            <strong>
              ✧ {profile.coins.toLocaleString()} <small>G</small>
            </strong>
            <button disabled={!loaded} onClick={() => void resetCurrentPlayer()}>
              리셋
            </button>
          </div>
        </div>
        <nav aria-label="게임 메뉴" className="tabs">
          {(
            [
              ["salon", "✂", "살롱 운영"],
              ["staff", "♧", "직원 & 업그레이드"],
              ["shop", "◆", "상점"],
              ["levels", "⚑", "스테이지"],
              ["ranking", "★", "순위"],
              ["help", "?", "플레이 가이드"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => changeTab(id)}
            >
              <span>{icon}</span>
              {label}
              {id === "staff" && <em>모두 무료</em>}
              {id === "shop" && <em>꾸미기</em>}
            </button>
          ))}
        </nav>
        {error && (
          <div role="alert" className="error">
            {error}{" "}
            {!loaded && (
              <button onClick={() => location.reload()}>다시 연결</button>
            )}
          </div>
        )}
        {tab === "salon" ? (
          <>
            <section className="game-header">
              <div className="stage-title">
                <span className="stage-number">
                  {String(game.level).padStart(2, "0")}
                </span>
                <div>
                  <small>{game.level <= 10 ? `STAGE ${game.level} / 10` : `ENDLESS ROUND ${game.level - 10}`}</small>
                  <h2>{level.name}</h2>
                </div>
              </div>
              <div className="goal">
                <div>
                  <span>오늘의 목표</span>
                  <strong>
                    {game.served} <small>/ {level.target}명</small>
                  </strong>
                </div>
                <div className="track">
                  <i style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="stat">
                <small>남은 시간</small>
                <strong className={game.time < 20 ? "urgent" : ""}>
                  {Math.floor(game.time / 60)}:
                  {String(Math.ceil(game.time % 60)).padStart(2, "0")}
                </strong>
              </div>
              <div className="stat">
                <small>오늘 매출</small>
                <strong>
                  {game.revenue.toLocaleString()} <small>G</small>
                </strong>
              </div>
              <button
                className="pause"
                aria-label={game.status === "paused" ? "게임 계속" : "일시정지"}
                disabled={!["playing", "paused"].includes(game.status)}
                onClick={() =>
                  mutate((g) => {
                    g.status = g.status === "paused" ? "playing" : "paused";
                  })
                }
              >
                {game.status === "paused" ? "▶" : "Ⅱ"}
              </button>
            </section>
            <div className="play-layout">
              <div>
                <section className={`salon ${profile.decor.map((on, i) => (on ? SHOP_ITEMS[i].className : "")).join(" ")}`} aria-label="살롱 게임 화면">
                  <div className="back-wall">
                    <div className="wall-sign">
                      <b>LG Display</b>
                      <span>ROYAL BEAUTY LOUNGE</span>
                    </div>
                    <div className="window">
                      <span>OLED</span>
                      <b>Life in full bloom.</b>
                    </div>
                  </div>
                  <div className="floor" />
                  <div className="room-label">STYLING ZONE</div>
                  <div className="waiting-label">RECEPTION</div>
                  <div className="shampoo-label">SHAMPOO ZONE</div>
                  {SEATS.map((s, i) => (
                    <div
                      className="station"
                      key={i}
                      style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    >
                      <div className="mirror">
                        <span>✧</span>
                      </div>
                      <div className="chair" />
                      <span className="seat-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                  <div className="reception-desk">
                    <span>WELCOME</span>
                  </div>
                  {SHAMPOO_SPOTS.map((s, i) => (
                    <div
                      className="shampoo-bed"
                      key={i}
                      style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    >
                      <span>◉</span>
                    </div>
                  ))}
                  <div className="floor-motto">
                    a little care, a little magic
                  </div>
                  {profile.decor[1] && <div className="shop-light" aria-hidden="true">✦</div>}
                  {profile.decor[3] && <div className="shop-plant" aria-hidden="true">♧</div>}
                  {STAFF.map((s, i) =>
                    profile.staff[i] ? (
                      <div
                        className={`floor-staff staff-${i}`}
                        key={s.name}
                        aria-label={`${s.name} 근무 중`}
                      >
                        <Sprite kind={s.sprite} className="stylist" />
                        <span>{i === 2 ? "커피" : i === 1 ? "샴푸" : "시술"}</span>
                      </div>
                    ) : null,
                  )}
                  {selectedSpot && (
                    <div
                      className={`work-zone ${selectedInRange ? "ready" : ""}`}
                      style={{
                        left: `${selectedSpot.x}%`,
                        top: `${selectedSpot.y}%`,
                      }}
                    />
                  )}
                  {game.customers.map((c) => {
                    const pos = position(c, game);
                    return (
                      <button
                        key={c.id}
                        className={`customer ${game.selected === c.id ? "selected" : ""} ${c.staff !== null ? "staff-working" : ""} ${isLeaving(c) ? "leaving" : ""}`}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          zIndex: Math.round(pos.y),
                        }}
                        onClick={() =>
                          mutate((g) => {
                            if (g.status === "playing" && !isLeaving(c)) {
                              g.target = c.id;
                              g.selected = null;
                            }
                          })
                        }
                        aria-label={`${c.name}, ${isLeaving(c) ? "완성 후 퇴장 중" : c.seat < 0 ? "대기 중" : SERVICES[requiredTool(c)].name}, 클릭해 이동`}
                      >
                        <span className="order">
                          {isLeaving(c)
                            ? `${SERVICES[c.order].name} 완성!`
                            : c.seat < 0
                              ? "안내해주세요"
                              : c.staff !== null
                                ? c.staff === 1
                                  ? "샴푸 도움 중"
                                  : "직원 진행 중"
                                : requiredTool(c) === "wash"
                                  ? "샴푸 Space"
                                  : SERVICES[requiredTool(c)].name}
                          {c.staff !== null ? " ✦" : ""}
                        </span>
                        <Sprite kind={c.kind} look={styledLook(c)} />
                        {requiredTool(c) === "wash" && !isComplete(c) && (
                          <span className="shampoo-foam" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        )}
                        {isLeaving(c) && <span className="after-badge">완성</span>}
                        <span className="patience">
                          <i
                            style={{
                              width: `${(c.patience / c.maxPatience) * 100}%`,
                              background:
                                c.patience < 15 ? "#d75454" : undefined,
                            }}
                          />
                        </span>
                      </button>
                    );
                  })}
                  <div
                    className="player"
                    style={{
                      left: `${game.player.x}%`,
                      top: `${game.player.y}%`,
                      zIndex: Math.round(game.player.y),
                    }}
                  >
                    <span className="you">나</span>
                    <Sprite kind={character} className="stylist" />
                  </div>
                  {game.status !== "playing" && (
                    <div className="overlay">
                      <div className="game-dialog">
                        <span className="dialog-crown">
                          {won ? "♛" : game.status === "lost" ? "☾" : "✧"}
                        </span>
                        <div className="eyebrow">
                          {won
                            ? "BEAUTIFULLY DONE"
                            : game.status === "lost"
                              ? "TOMORROW IS ANOTHER DAY"
                              : "WELCOME TO ROYAL SALON"}
                        </div>
                        <h2>
                          {won
                            ? game.level >= 10
                              ? "다음 로열 라운드가 열렸어요!"
                              : "오늘도 멋지게 해냈어요!"
                            : game.status === "lost"
                              ? "조금만 더 연습해볼까요?"
                              : game.status === "paused"
                                ? "잠깐, 쉬어가는 시간"
                                : "우리의 첫 번째 살롱"}
                        </h2>
                        <p>
                          {won
                            ? `${game.served}명의 손님과 함께한 하루 · 매출 ${game.revenue.toLocaleString()} G`
                            : game.status === "lost"
                              ? `목표 ${level.target}명 중 ${game.served}명 완료. 직원을 배치하면 한결 쉬워져요.`
                              : game.status === "paused"
                                ? "준비가 되면 다시 문을 열어주세요."
                                : "공주님과 왕자님에게 어울리는 스타일을 찾아주세요."}
                        </p>
                        {game.status === "ready" && (
                          <>
                            <div className="character-picker">
                              <button
                                className={character === 2 ? "chosen" : ""}
                                onClick={() => setCharacter(2)}
                              >
                                <Sprite kind={2} />
                                <span>공주님으로 시작</span>
                              </button>
                              <button
                                className={character === 3 ? "chosen" : ""}
                                onClick={() => setCharacter(3)}
                              >
                                <Sprite kind={3} />
                                <span>왕자님으로 시작</span>
                              </button>
                            </div>
                            <div className="quick-guide">
                              손님 클릭 → 도구 선택 → Space 연타
                              <br />
                              시술은 손님 앞 네모칸 안에서 Space 연타!
                            </div>
                          </>
                        )}
                        {won && (
                          <div className="stars">
                            {"★".repeat(
                              game.lost === 0 ? 3 : game.lost < 3 ? 2 : 1,
                            )}
                          </div>
                        )}
                        <button
                          className="primary"
                          disabled={!loaded}
                          onClick={() =>
                            game.status === "paused"
                              ? mutate((g) => {
                                  g.status = "playing";
                                })
                              : start(
                                  won
                                    ? game.level + 1
                                    : game.level,
                                )
                          }
                        >
                          {won
                            ? game.level >= 10
                              ? `다음 라운드 ${game.level + 1} →`
                              : "다음 스테이지 →"
                            : game.status === "paused"
                              ? "계속하기 ▶"
                              : game.status === "lost"
                                ? "다시 도전하기"
                                : "영업 시작하기 →"}
                        </button>
                        {(won || game.status === "lost") && (
                          <button
                            className="text-button"
                            onClick={() => changeTab("staff")}
                          >
                            직원 & 업그레이드 관리
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
                <div className="message-bar" role="status">
                  <span>✦</span>
                  {game.message}
                  <span className="combo">
                    {game.combo > 1 ? `${game.combo} COMBO` : "ROYAL CARE"}
                  </span>
                </div>
              </div>
              <aside className="work-panel">
                <div className="panel-heading">
                  <h3>스타일링 노트</h3>
                  <span>✎</span>
                </div>
                {selected ? (
                  <>
                    <div className="client-summary">
                      <Sprite kind={selected.kind} look={styledLook(selected)} />
                      <div>
                        <small>
                          {selected.kind === 0 ? "PRINCESS" : "PRINCE"}
                        </small>
                        <h3>{selected.name} 님</h3>
                        <span>예약 · {SERVICES[selected.order].name}</span>
                      </div>
                    </div>
                    <div className="steps">
                      {selected.steps.map((s, i) => (
                        <span
                          key={i}
                          className={
                            i === selected.step
                              ? "current"
                              : i < selected.step
                                ? "done"
                                : ""
                          }
                        >
                          {i < selected.step ? "✓" : i + 1} {SERVICES[s].name}
                        </span>
                      ))}
                    </div>
                    <h4>
                      {selected.staff !== null
                        ? "직원이 시술하고 있어요"
                        : selected.tool
                          ? selectedInRange
                            ? "Space를 빠르게 눌러주세요"
                            : "손님 앞 네모칸 안으로 이동하세요"
                          : shampooStep
                            ? selectedInRange
                              ? "샴푸존에서 Space만 눌러주세요"
                              : "샴푸존 네모칸 안으로 이동하세요"
                          : "요청에 맞는 도구를 선택하세요"}
                    </h4>
                  </>
                ) : (
                  <div className="empty-note">
                    <span>♛</span>
                    <h3>손님을 맞이해주세요</h3>
                    <p>
                      손님을 클릭하면 이동해요.
                      <br />
                      가까이에서 Space로도 안내할 수 있어요.
                    </p>
                  </div>
                )}
                <div className="tools">
                  {SERVICE_IDS.map((id, i) => {
                    const s = SERVICES[id];
                    return (
                    <button
                      key={id}
                      disabled={
                        !selected ||
                        shampooStep ||
                        game.status !== "playing" ||
                        selected.staff !== null
                      }
                      onClick={() =>
                        mutate((g) => chooseTool(g, id as Service))
                      }
                      className={selected?.tool === id ? "chosen" : ""}
                    >
                      <kbd>Ctrl {i + 1}번</kbd>
                      <span className="tool-icon">{s.icon}</span>
                      <span>{s.name}</span>
                    </button>
                    );
                  })}
                </div>
                <button
                  className="work-button"
                  disabled={
                    (!selected?.tool && !shampooStep) ||
                    !selectedInRange ||
                    selected?.staff !== null ||
                    game.status !== "playing"
                  }
                  onClick={() => {
                    mutate((g) => work(g, pRef.current));
                    beep();
                  }}
                >
                  <span>␣</span>{" "}
                  {shampooStep
                    ? "샴푸 진행"
                    : selected?.tool
                      ? `${SERVICES[selected.tool].name} 진행`
                      : "도구를 먼저 선택해주세요"}{" "}
                  {(selected?.tool || shampooStep) && (
                    <b>
                      {selected?.progress}/{selected?.required}
                    </b>
                  )}
                </button>
                <div className="staff-summary">
                  <span>함께하는 직원</span>
                  <b>{profile.staff.filter(Boolean).length} / 3</b>
                </div>
                <div className="staff-mini">
                  {STAFF.map((s, i) => (
                    <div key={s.name} className={profile.staff[i] ? "on" : ""}>
                      <Sprite kind={s.sprite} className="stylist" />
                      <small>{profile.staff[i] ? "근무 중" : "미배치"}</small>
                    </div>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() => changeTab("staff")}
                >
                  직원 배치하기 ↗
                </button>
              </aside>
            </div>
            <div className="controls-footer">
              <span>
                <kbd>↑ ↓ ← →</kbd> 이동
              </span>
              <span>
                <kbd>Space</kbd> 손님 안내
              </span>
              <span>
                <kbd>Ctrl 반복</kbd> 도구 변경
              </span>
              <span>
                <kbd>Space</kbd> 안내 · 시술
              </span>
              <span>
                <kbd>Esc</kbd> 일시정지
              </span>
              <small>마우스 · 터치도 가능해요</small>
            </div>
            <div className="touch-controls" aria-label="터치 이동">
              {[
                ["↑", "ArrowUp"],
                ["←", "ArrowLeft"],
                ["↓", "ArrowDown"],
                ["→", "ArrowRight"],
              ].map(([label, key]) => (
                <button
                  key={key}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    keys.current.add(key);
                  }}
                  onPointerUp={() => keys.current.delete(key)}
                  onPointerCancel={() => keys.current.delete(key)}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() =>
                  mutate((g) => {
                    const c = nearest(g);
                    if (c) interact(g, c.id);
                  })
                }
              >
                안내
              </button>
            </div>
          </>
        ) : tab === "shop" ? (
          <section className="management shop-panel">
            <div className="section-intro">
              <div className="eyebrow">ROYAL INTERIOR SHOP</div>
              <h2>번 돈으로 살롱을 꾸며요</h2>
              <p>스테이지를 클리어하며 번 누적 매출로 장식을 구입하세요. 구매한 장식은 살롱 화면에 바로 반영됩니다.</p>
            </div>
            <div className="shop-balance">
              <span>사용 가능 매출</span>
              <strong>{profile.coins.toLocaleString()} G</strong>
            </div>
            <div className="shop-grid">
              {SHOP_ITEMS.map((item, i) => (
                <article key={item.name} className={profile.decor[i] ? "owned" : ""}>
                  <div className={`shop-preview ${item.className}`}>
                    <span>{i === 0 ? "▧" : i === 1 ? "✦" : i === 2 ? "◇" : "♧"}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <button
                    className={profile.decor[i] ? "secondary" : "primary"}
                    disabled={!loaded || profile.decor[i] || profile.coins < item.cost}
                    onClick={() => purchaseDecor(i)}
                  >
                    {profile.decor[i] ? "구매 완료" : `${item.cost.toLocaleString()} G 구매`}
                  </button>
                </article>
              ))}
            </div>
            <button className="primary" onClick={() => changeTab("salon")}>
              꾸민 매장 보러가기 →
            </button>
          </section>
        ) : tab === "staff" ? (
          <section className="management">
            <div className="section-intro">
              <div className="eyebrow">A LITTLE HELP, A LOT OF MAGIC</div>
              <h2>함께라서 더 빛나는 살롱</h2>
              <p>
                직원 고용과 모든 업그레이드는 무료입니다. 원하는 혜택을 켜고
                플레이하세요.
              </p>
            </div>
            <div className="staff-cards">
              {STAFF.map((s, i) => (
                <article key={s.name}>
                  <div className="portrait">
                    <Sprite kind={s.sprite} className="stylist" />
                    <span>{s.role}</span>
                  </div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <button
                    disabled={!loaded}
                    className={profile.staff[i] ? "secondary" : "primary"}
                    onClick={() => toggle("staff", i)}
                  >
                    {profile.staff[i]
                      ? "✓ 근무 중 · 배치 해제"
                      : "무료로 고용하기"}
                  </button>
                </article>
              ))}
            </div>
            <h3 className="upgrade-title">
              살롱 업그레이드 <span>ALL UNLOCKED</span>
            </h3>
            <div className="upgrades">
              {UPGRADES.map((u, i) => (
                <article key={u.name}>
                  <span className="upgrade-icon">{u.icon}</span>
                  <div>
                    <h3>{u.name}</h3>
                    <p>{u.description}</p>
                  </div>
                  <button
                    disabled={!loaded}
                    aria-pressed={profile.upgrades[i]}
                    onClick={() => toggle("upgrades", i)}
                    className={`toggle ${profile.upgrades[i] ? "on" : ""}`}
                    aria-label={`${u.name} ${profile.upgrades[i] ? "해제" : "적용"}`}
                  >
                    <i />
                  </button>
                </article>
              ))}
            </div>
            <p className="muted">
              의자 업그레이드는 새로 입장하는 손님부터, 도구 입력 횟수는 새
              손님부터 적용됩니다. 고용비·인건비·현금 결제는 없어요.
            </p>
            <button className="primary" onClick={() => changeTab("salon")}>
              살롱으로 돌아가기 →
            </button>
          </section>
        ) : tab === "levels" ? (
          <section className="management">
            <div className="section-intro">
              <div className="eyebrow">YOUR ROYAL JOURNEY</div>
              <h2>열 번의 하루, 하나의 로열 살롱</h2>
              <p>
                목표 인원만큼 시술을 마치면 다음 스테이지가 열립니다. 완료한
                스테이지는 언제든 다시 즐길 수 있고, 10단계 이후에는 무한 라운드가 이어집니다.
              </p>
            </div>
            <div className="level-grid">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  disabled={!loaded || l.id > profile.unlocked}
                  onClick={() => {
                    if (
                      ["paused", "playing"].includes(game.status) &&
                      !window.confirm(
                        "진행 중인 영업을 종료하고 선택한 스테이지를 시작할까요?",
                      )
                    )
                      return;
                    start(l.id);
                  }}
                >
                  <span className="level-id">
                    {String(l.id).padStart(2, "0")}
                  </span>
                  <span className="level-stars">
                    {l.id > profile.unlocked
                      ? "잠김"
                      : profile.stars[l.id]
                        ? "★".repeat(profile.stars[l.id])
                        : "도전 가능"}
                  </span>
                  <h3>{l.name}</h3>
                  <p>
                    목표 {l.target}명 · {l.duration}초 · 시술 {l.services.length}종
                  </p>
                  <small>
                    {l.services.map((s) => SERVICES[s].name).join(" · ")}
                  </small>
                </button>
              ))}
              <button
                disabled={!loaded || profile.unlocked <= 10}
                onClick={() => start(Math.max(11, profile.unlocked))}
              >
                <span className="level-id">∞</span>
                <span className="level-stars">무한</span>
                <h3>계속되는 로열 라운드</h3>
                <p>모든 시술 8종 · 랜덤 손님 · 계속 증가하는 목표</p>
                <small>{TOOL_ORDER.map((service) => SERVICES[service].name).join(" · ")}</small>
              </button>
            </div>
          </section>
        ) : tab === "ranking" ? (
          <section className="management ranking-panel">
            <div className="section-intro">
              <div className="eyebrow">ROYAL HALL OF FAME</div>
              <h2>별명별 순위표</h2>
              <p>
                같은 컴퓨터에 저장된 별명 슬롯을 누적 매출 순으로 보여줍니다.
                새 별명은 위쪽 별명 입력칸에 적고 불러오면 바로 새 저장으로 시작해요.
              </p>
            </div>
            <div className="player-switcher">
              <div>
                <small>현재 플레이어</small>
                <strong>{playerName}</strong>
              </div>
              <button disabled={!loaded} onClick={() => void resetCurrentPlayer()}>
                현재 별명 리셋
              </button>
            </div>
            <div className="saved-players">
              {players.map((name) => (
                <button
                  key={name}
                  className={name === playerName ? "active" : ""}
                  onClick={() => void loadPlayer(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="ranking-list">
              {rankings.length ? (
                rankings.map((row, i) => (
                  <article key={row.player} className={row.player === playerName ? "mine" : ""}>
                    <span className="rank-number">{i + 1}</span>
                    <div>
                      <h3>{row.player}</h3>
                      <p>
                        {row.completedStages}개 스테이지 완료 · 별 {row.totalStars}개 · {" "}
                        최대 {row.unlocked}단계
                      </p>
                    </div>
                    <strong>{row.coins.toLocaleString()} G</strong>
                  </article>
                ))
              ) : (
                <div className="empty-ranking">아직 순위 기록이 없어요. 저장을 한 번 눌러주세요.</div>
              )}
            </div>
            <button className="primary" onClick={() => changeTab("salon")}>
              살롱으로 돌아가기 →
            </button>
          </section>
        ) : (
          <section className="management guide">
            <div className="eyebrow">HOW TO PLAY</div>
            <h2>작은 살롱의 로열 스타일리스트</h2>
            <ol>
              <li>
                <h3>손님을 의자로 안내해요</h3>
                <p>
                  오른쪽 리셉션의 손님을 클릭하세요. 캐릭터가 이동해 빈 의자로
                  안내합니다. 방향키로 이동한 후 가까이에서 Space를 눌러도
                  됩니다. 첫 시술이 끝난 손님은 샴푸존으로 이동합니다.
                </p>
              </li>
              <li>
                <h3>말풍선을 보고 도구를 골라요</h3>
                <p>
                  커트·드라이·염색처럼 자주 누르는 도구를 앞쪽에 배치했어요. 숫자 1–8로도
                  선택할 수 있고 Ctrl을 반복해서 눌러도 바뀌어요. 틀린 도구를 고르면 손님의 기다림이 4초
                  줄어듭니다.
                </p>
              </li>
              <li>
                <h3>Space로 시술을 마무리해요</h3>
                <p>
                  손님 앞 네모칸 안에서 Space를 다섯 번 눌러주세요. 화면의 시술 버튼을 여러 번 눌러도 됩니다.
                  업그레이드를 적용하면 세 번으로 줄어들어요.
                </p>
              </li>
              <li>
                <h3>샴푸존도 잊지 마세요</h3>
                <p>
                  첫 시술 → 샴푸존 순서입니다. 샴푸존에서는 별도 도구 없이
                  Space만 눌러주세요. 샴푸까지 마치면 자동 결제되고 손님 수가
                  올라갑니다.
                </p>
              </li>
              <li>
                <h3>직원과 함께 10단계에 도전해요</h3>
                <p>
                  민트 공주는 의자 시술을, 라일락 왕자는 샴푸존을, 로제 공주는
                  대기 손님 커피 서비스를 맡습니다. 번 돈은 상점에서 매장 꾸미기에 쓸 수 있습니다. 내가 선택한 손님은 직원이
                  새로 맡지 않아요. 시간 안에 목표 인원을 달성하면 성공입니다.
                </p>
              </li>
            </ol>
            <p>
              다른 메뉴나 창으로 이동하면 일시정지됩니다. 영업 중 10초마다 자동
              저장되며, 저장 버튼으로 즉시 저장할 수 있어요. 별명별로
              저장이 나뉘고, 순위 메뉴에서 누적 매출 랭킹을 확인할 수 있습니다. 10단계 이후에는
              모든 시술이 섞이는 무한 라운드를 계속 플레이할 수 있습니다.
              이어하기는 일시정지 상태에서 시작합니다.
            </p>
            <p className="muted">
              원작의 조작·미용실 경영 아이디어를 참고한 독립 재구현입니다. 원작
              실행 파일·그림·유료 서비스와 연결되지 않으며 LG디스플레이의 공식
              게임이 아닙니다.
            </p>
            <button className="primary" onClick={() => changeTab("salon")}>
              이제 영업하러 가기 →
            </button>
          </section>
        )}
        <footer>
          <span>
            ROYAL SALON <i>✦</i> LG DISPLAY FAN EDITION
          </span>
          <span>{saveStatus}</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);





