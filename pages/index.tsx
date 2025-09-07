// pages/index.tsx
import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
 
/** ---------- Types ---------- */
type Game = {
  id: number;
  Date: string;
  Time: string;
  Day: string;
  Opponent: string;
  Tier: string;
  Price: number;
  picked_by?: string | null;
};

/** ---------- Constants ---------- */
const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIERS = ["Platinum", "Gold", "Green", "White", "Gray"];
const SEASONS = ["2025-26"];

/** ---------- Styles ---------- */
const S = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 16,
    color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#0b1020",
    minHeight: "100vh",
  } as React.CSSProperties,
  card: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
  } as React.CSSProperties,
  row: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  } as React.CSSProperties,
  input: {
    padding: 8,
    borderRadius: 10,
    border: "1px solid #374151",
    background: "#0b1226",
    color: "#e5e7eb",
  } as React.CSSProperties,
  btn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#e5e7eb",
    cursor: "pointer",
  } as React.CSSProperties,
  btnP: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #10b981",
    background: "#10b981",
    color: "#0b1020",
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,
  pill: (active = false) =>
    ({
      padding: "6px 10px",
      borderRadius: 12,
      background: active ? "#059669" : "#1f2937",
      fontWeight: 700,
    } as React.CSSProperties),
  th: {
    position: "sticky" as const,
    top: 0,
    background: "#0b1226",
    textAlign: "left" as const,
    padding: 8,
    borderBottom: "1px solid #1f2937",
  },
  td: { padding: 8, borderBottom: "1px solid #1f2937" },
};

/** ---------- Component ---------- */
function Home() {
  /** Identity / room */
  const [roomCode, setRoomCode] = useState<string>("");
  const [myName, setMyName] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("room");
    const fromLS = localStorage.getItem("room_code") || "";
    const player = localStorage.getItem("player_name") || "";
    const code = (fromQuery || fromLS || "").toUpperCase();

    if (!code || !player) {
      window.location.href = "/join";
      return;
    }
    setRoomCode(code);
    setMyName(player);
  }, []);

  /** Core state */
  const [season, setSeason] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("season") || SEASONS[0] : SEASONS[0]
  );
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, Game[]>>({});
  const [turn, setTurn] = useState(0);
  const [snake, setSnake] = useState(true);


  /** Draft order persisted on server as array of player names (text[]) */
  const [orderNames, setOrderNames] = useState<string[]>([]);
  const [showAdjuster, setShowAdjuster] = useState(false);

  
  /** Filters (collapsed by default) */
  const [filter, setFilter] = useState({ q: "", tier: "", dow: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);

  /** Add-game form (collapsed by default) */
  const [newGame, setNewGame] = useState({
    Date: "",
    Time: "",
    Day: "",
    Opponent: "",
    Tier: "",
    Price: "",
  });
  const [addOpen, setAddOpen] = useState(false);

  /** season local remember */
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("season", season);
  }, [season]);

  /** Load & subscribe */
  useEffect(() => {
    if (!roomCode) return;

    async function load() {
      // room
      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();

      if (room) {
        setSnake(!!room.snake);
        setTurn(Number(room.turn || 0));
        if (Array.isArray(room.draft_order) && room.draft_order.length) {
          setOrderNames(room.draft_order as string[]);
        }
      }

      // players
      const { data: playersRows = [] } = await supabase
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .order("created_at");

      const names = playersRows.map((p: any) => p.name as string);
      setPlayers(names);

      // initialize draft order if empty
      if (!room || !Array.isArray(room.draft_order) || room.draft_order.length === 0) {
        if (names.length >= 2) {
          await supabase.from("rooms").update({ draft_order: names }).eq("code", roomCode);
          setOrderNames(names);
        }
      }

      // games
      const { data: gamesRows = [] } = await supabase
        .from("games")
        .select("*")
        .eq("room_code", roomCode)
        .order("id");

      const mapped: Game[] = gamesRows.map((r: any) => ({
        id: r.id,
        Date: r.date,
        Time: r.time,
        Day: r.day,
        Opponent: r.opponent,
        Tier: r.tier,
        Price: Number(r.price),
        picked_by: r.picked_by,
      }));

      // Build picks by player from picked_by
      const byPlayer: Record<string, Game[]> = Object.fromEntries(names.map((n) => [n, []]));
      for (const g of mapped) {
        if (g.picked_by && byPlayer[g.picked_by]) byPlayer[g.picked_by].push(g);
      }

      setPicks(byPlayer);
      setGames(mapped);
    }

    load();

    // realtime
    const ch = supabase
      .channel(`room:${roomCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` }, () =>
        load()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_code=eq.${roomCode}` }, () =>
        load()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `room_code=eq.${roomCode}` }, () =>
        load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomCode]);

  /** Helpers: derive current player from order + snake + turn */
  function currentIndex(turnNum: number, n: number) {
    if (n === 0) return 0;
    const round = Math.floor(turnNum / n);
    const pos = turnNum % n;
    if (!snake || round % 2 === 0) return pos;
    return n - 1 - pos;
  }

  const currentPlayerName = (() => {
    const n = orderNames.length;
    if (n === 0) return "";
    const idx = currentIndex(turn, n);
    return orderNames[idx] || "";
  })();

  const isMyTurn = myName && currentPlayerName && myName === currentPlayerName;

  /** Filtering */
  const available = useMemo(() => {
    const takenIds = new Set(games.filter((g) => !!g.picked_by).map((g) => g.id));
    return games
      .filter((g) => !takenIds.has(g.id))
      .filter((g) => (filter.tier ? g.Tier === filter.tier : true))
      .filter((g) => (filter.dow ? g.Day === filter.dow : true))
      .filter((g) => (filter.q ? g.Opponent.toLowerCase().includes(filter.q.toLowerCase()) : true))

  }, [games, filter]);

  /** ---------- Server-persisted state changes ---------- */
  async function toggleSnake(v: boolean) {
    setSnake(v);
    await supabase.from("rooms").update({ snake: v }).eq("code", roomCode);
  }

  async function persistOrder(newOrderNames: string[]) {
    setOrderNames(newOrderNames);
    await supabase.from("rooms").update({ draft_order: newOrderNames }).eq("code", roomCode);
  }

  function moveName(idx: number, dir: -1 | 1) {
    setOrderNames((prev) => {
      const arr = [...prev];
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      persistOrder(arr);
      return arr;
    });
  }
  function setNameAsFirst(idx: number) {
    setOrderNames((prev) => {
      const arr = [...prev];
      const [m] = arr.splice(idx, 1);
      arr.unshift(m);
      persistOrder(arr);
      return arr;
    });
  }
  function resetAlphabetical() {
    const sorted = [...orderNames].sort((a, b) => a.localeCompare(b));
    persistOrder(sorted);
  }
  function shuffleOrder() {
    const arr = [...orderNames];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    persistOrder(arr);
  }

  /** ---------- Draft op with guard ---------- */
async function draft(game: Game) {
  // confirm
  const ok = window.confirm(
    `Draft this game?\n\n${game.Date} • ${game.Opponent} • $${game.Price.toFixed(2)}`
  );
  if (!ok) return;

  // guard: only current player can draft
  if (!isMyTurn) {
    alert(`Not your turn. Current: ${currentPlayerName || "?"}`);
    return;
  }

  // try to claim the game atomically: only if not picked yet
  const { data, error } = await supabase
    .from("games")
    .update({ picked_by: myName })
    .eq("room_code", roomCode)
    .eq("id", game.id)
    .is("picked_by", null) // prevents stealing already-picked rows
    .select("id");

  if (error) {
    console.error(error);
    alert("Could not draft this game. Try again.");
    return;
  }
  if (!data || data.length === 0) {
    alert("This game was just taken.");
    return;
  }

  // advance turn on server
  const nextTurn = turn + 1;
  setTurn(nextTurn); // optimistic
  await supabase.from("rooms").update({ turn: nextTurn }).eq("code", roomCode);
}


  /** ---------- Add / Remove ---------- */
  async function addGame() {
    const { Date, Time, Day, Opponent, Tier, Price } = newGame;
    if (!Date || !Time || !Day || !Opponent || !Tier || !Price) return;

    await supabase.from("games").insert({
      room_code: roomCode,
      date: Date,
      time: Time,
      day: Day,
      opponent: Opponent,
      tier: Tier,
      price: Number(Price),
    });

    setNewGame({ Date: "", Time: "", Day: "", Opponent: "", Tier: "", Price: "" });
  }

async function removeGame(id: number) {
  const g = games.find((x) => x.id === id);
  const label = g ? `${g.Date} • ${g.Opponent} • $${g.Price.toFixed(2)}` : `Game #${id}`;

  const ok = window.confirm(`Remove this game?\n\n${label}`);
  if (!ok) return;

  await supabase.from("games").delete().eq("room_code", roomCode).eq("id", id);
}

  /** ---------- Export ---------- */
  function exportCSV() {
    const rows = [["Player", "Date", "Time", "Day", "Opponent", "Tier", "Price"]];
    games
      .filter((g) => !!g.picked_by)
      .forEach((g) => {
        rows.push([g.picked_by as string, g.Date, g.Time, g.Day, g.Opponent, g.Tier, String(g.Price)]);
      });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll(`"`, `""`)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `celtics_${season}_draft.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportXLS() {
    const headers = [
      "Game",
      "Day",
      "Date",
      "Time",
      "Opponent",
      "Tier",
      "Price Each",
      "Drafted",
      "Starting Retail Value",
      "Selling",
      "Sold Price",
      "Fee Each",
      "Profit",
    ];

    const rows = games.map((g, i) => [
      i + 1,
      g.Day,
      g.Date,
      g.Time,
      g.Opponent,
      g.Tier,
      g.Price,
      g.picked_by || "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 4 },
      { wch: 10 },
      { wch: 9 },
      { wch: 24 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
    ];

    const startRow = 2;
    const endRow = rows.length + 1;
    for (let r = startRow; r <= endRow; r++) {
      const ref = XLSX.utils.encode_cell({ r: r - 1, c: 6 }); // G
      const cell = ws[ref];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = "$#,##0.00";
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Draft");
    XLSX.writeFile(wb, `celtics_${season}_draft.xlsx`);
  }

  /** ---------- Render ---------- */
  return (
    <>
      <div className="container" style={S.page}>
        {/* top bar */}
        <div className="toolbar" style={{ ...S.row, marginBottom: 12 }}>
         <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
  <img 
    src="/joe.png" 
    alt="Joe Mazzulla" 
    style={{ width: 80, height: 80, borderRadius: "50%" }} 
  />
  Celtics Ticket Draft
</h1>

          <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select className="input" style={S.input as React.CSSProperties} value={season} onChange={(e) => setSeason(e.target.value)}>
              {SEASONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Room: <b>{roomCode || "…"}</b> • You: <b>{myName || "…"}</b>
              </div>
            </div>

            <button className="btnPrimary" style={S.btnP} onClick={exportCSV}>
              Export CSV
            </button>
            <button className="btnPrimary" style={S.btnP} onClick={exportXLS}>
              Export XLS
            </button>

            {/* Collapsible toggles */}
            <button className="btn" style={S.btn} aria-expanded={addOpen} aria-controls="add-section" onClick={() => setAddOpen((v) => !v)}>
              {addOpen ? "Hide Add Game" : "Show Add Game"}
            </button>
          </div>
        </div>

        {/* draft order (filters moved lower) */}
        <div className="card" style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Draft order:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {orderNames.map((name, i) => {
                const n = orderNames.length;
                const curIdx = currentIndex(turn, n);
                return (
                  <div key={name} style={S.pill(i === curIdx)}>
                    {i + 1}. {name}
                  </div>
                );
              })}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={snake} onChange={(e) => toggleSnake(e.target.checked)} /> Snake
            </label>
            <button style={S.btn} onClick={shuffleOrder}>
              Shuffle
            </button>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Turn: <b>{turn + 1}</b> • Current: <b>{currentPlayerName || "…"}</b> {isMyTurn ? " (your turn)" : ""}
            </div>
          </div>
        </div>

{/* Draft order adjuster (collapsible) */}
<div className="card" style={{ ...S.card, marginBottom: 12 }}>
  <button
    className="btn"
    style={{ ...S.btn, width: "100%", textAlign: "left" }}
    onClick={() => setShowAdjuster((v) => !v)}
  >
    {showAdjuster ? "Hide Draft Order Adjuster" : "Show Draft Order Adjuster"}
  </button>
  {showAdjuster && (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...S.row, marginBottom: 8 }}>
        <div style={{ fontWeight: 800 }}>Edit draft order</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={S.btn} onClick={resetAlphabetical}>
            Reset A→Z
          </button>
          <button className="btn" style={S.btn} onClick={shuffleOrder}>
            Shuffle
          </button>
        </div>
      </div>
      <ol style={{ display: "grid", gap: 8, margin: 0, paddingLeft: 16 }}>
        {orderNames.map((name, i) => (
          <li
            key={name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#1f2937",
              borderRadius: 10,
              padding: 8,
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 10,
                  background: "#334155",
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontWeight: 700 }}>{name}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={S.btn} onClick={() => setNameAsFirst(i)}>
                First
              </button>
              <button
                className="btn"
                style={S.btn}
                onClick={() => moveName(i, -1)}
                disabled={i === 0}
              >
                ↑
              </button>
              <button
                className="btn"
                style={S.btn}
                onClick={() => moveName(i, +1)}
                disabled={i === orderNames.length - 1}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )}
</div>
        
        {/* Add game (collapsible) */}
        <div className="card" style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Add Game</div>
            <button className="btn" style={S.btn} aria-expanded={addOpen} aria-controls="add-section" onClick={() => setAddOpen((v) => !v)}>
              {addOpen ? "Hide" : "Show"}
            </button>
          </div>

          <section id="add-section" className={`collapsible ${addOpen ? "open" : "closed"}`} aria-hidden={!addOpen}>
            <div className="addGameGrid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 8 }}>
              <input className="input" style={S.input} placeholder="Date (MM/DD/YYYY)" value={newGame.Date} onChange={(e) => setNewGame({ ...newGame, Date: e.target.value })} />
              <input className="input" style={S.input} placeholder="Time (e.g. 7:30 PM)" value={newGame.Time} onChange={(e) => setNewGame({ ...newGame, Time: e.target.value })} />
              <select className="input" style={S.input as React.CSSProperties} value={newGame.Day} onChange={(e) => setNewGame({ ...newGame, Day: e.target.value })}>
                <option value="">Day</option>
                {DOW.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input className="input" style={S.input} placeholder="Opponent" value={newGame.Opponent} onChange={(e) => setNewGame({ ...newGame, Opponent: e.target.value })} />
              <select className="input" style={S.input as React.CSSProperties} value={newGame.Tier} onChange={(e) => setNewGame({ ...newGame, Tier: e.target.value })}>
                <option value="">Tier</option>
                {TIERS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input className="input" style={S.input} placeholder="Price" value={newGame.Price} onChange={(e) => setNewGame({ ...newGame, Price: e.target.value })} />
              <button className="btnPrimary" style={S.btnP} onClick={addGame}>
                Add
              </button>
            </div>
          </section>
        </div>

        {/* Main grid */}
        <div className="mainGrid" style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12 }}>
          {/* LEFT: filters + games table */}
          <div className="card" style={S.card}>
            {/* Filters moved here, right above table */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Filters</div>
              <button className="btn" style={S.btn} aria-expanded={filtersOpen} aria-controls="filters-section" onClick={() => setFiltersOpen((v) => !v)}>
                {filtersOpen ? "Hide" : "Show"}
              </button>
            </div>

<section
  id="filters-section"
  className={`filtersWrap ${filtersOpen ? "open" : "closed"}`}
  aria-hidden={!filtersOpen}
  style={{ width: "100%", minWidth: 0 }}
>
  <div className="filtersGrid" style={{ width: "100%", minWidth: 0, marginBottom: 8 }}>
    <input
      className="input"
      style={{ ...S.input, width: "100%" }}
      placeholder="Search opponent..."
      value={filter.q}
      onChange={(e) => setFilter({ ...filter, q: e.target.value })}
    />
    <select
      className="input"
      style={{ ...S.input, width: "100%" } as React.CSSProperties}
      value={filter.tier}
      onChange={(e) => setFilter({ ...filter, tier: e.target.value })}
    >
      <option value="">All tiers</option>
      {TIERS.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
    <select
      className="input"
      style={{ ...S.input, width: "100%" } as React.CSSProperties}
      value={filter.dow}
      onChange={(e) => setFilter({ ...filter, dow: e.target.value })}
    >
      <option value="">Any day</option>
      {DOW.map((d) => (
        <option key={d}>{d}</option>
      ))}
    </select>
    <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.85 }}>
      Current: <b>{currentPlayerName || "…"}</b>
    </div>
  </div>
</section>


            <div className="tableWrap" style={{ overflow: "auto", maxHeight: "60vh", border: "1px solid #1f2937", borderRadius: 12 }}>
              <table className="gamesTable" style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Pick</th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Time</th>
                    <th style={S.th}>Day</th>
                    <th style={S.th}>Opponent</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Price</th>
                    <th style={S.th}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((g, idx) => (
                    <tr key={g.id} style={{ background: idx % 2 ? "rgba(30,41,59,0.5)" : "rgba(2,6,23,0.2)" }}>
                      <td style={S.td}>
                        <button className="btnPrimary" style={S.btnP} onClick={() => draft(g)}>
                          Draft
                        </button>
                      </td>
                      <td style={S.td}>{g.Date}</td>
                      <td style={S.td}>{g.Time}</td>
                      <td style={S.td}>{g.Day}</td>
                      <td style={S.td}>{g.Opponent}</td>
                      <td style={S.td}>{g.Tier}</td>
                      <td style={S.td}>${g.Price.toFixed(2)}</td>
                      <td style={S.td}>
                        <button className="btn" style={S.btn} onClick={() => removeGame(g.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: picks by player (show Date • Opponent • Tier) */}
          <div className="picksCol" style={{ display: "grid", gap: 12 }}>
            {players.map((name) => (
              <div key={name} className="card" style={S.card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{name}</div>
                <ul style={{ display: "grid", gap: 8, margin: 0, paddingLeft: 16 }}>
                  {(picks[name] || []).map((p, i) => (
                    <li key={i} style={{ background: "#1f2937", borderRadius: 10, padding: 8, fontSize: 12 }}>
                      {p.Date} • {p.Opponent} • {p.Tier}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive + collapsible CSS */}
      <style jsx global>{`
        .tableWrap {
          overflow-x: auto;
        }

        .filtersGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
        }
        .filtersWrap.closed,
        .collapsible.closed {
          display: none;
        }

        @media (max-width: 900px) {
          .mainGrid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .picksCol {
            margin-top: 12px;
          }
          .toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px !important;
          }
          .toolbar .input,
          .toolbar select,
          .toolbar button {
            width: 100% !important;
          }
          .card {
            padding: 12px !important;
          }
          .addGameGrid {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .tableWrap {
            max-height: 52vh !important;
          }
          .filtersGrid {
            grid-template-columns: 1fr 1fr !important; /* 2 cols on tablets */
          }
        }

        @media (max-width: 520px) {
          .addGameGrid {
            grid-template-columns: 1fr !important;
          }
          .gamesTable {
            font-size: 12px !important;
          }
          .gamesTable th,
          .gamesTable td {
            padding: 6px 8px !important;
          }
          .filtersGrid {
            grid-template-columns: 1fr !important; /* 1 col on phones */
          }
        }
      `}</style>
    </>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
