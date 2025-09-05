import dynamic from "next/dynamic";
import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";

const supabase = getSupabase();

function Join() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function handleJoin() {
    const roomCode = code.trim().toUpperCase();
    const player = name.trim();
    if (!roomCode || !player) return;

    // 1. Create the room if it doesn’t exist (idempotent)
    await supabase.from("rooms").upsert(
      { code: roomCode, season: "2025-26" },
      { onConflict: "code", ignoreDuplicates: true }
    );

    // 2. Add the player if not already present (idempotent)
    await supabase.from("players").upsert(
      { room_code: roomCode, name: player },
      { onConflict: "room_code,name", ignoreDuplicates: true }
    );

    // 3. Save identity locally and go to the draft board
    localStorage.setItem("room_code", roomCode);
    localStorage.setItem("player_name", player);
    window.location.href = `/?room=${encodeURIComponent(roomCode)}`;
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "8rem auto",
        padding: 16,
        color: "#e5e7eb",
        fontFamily: "system-ui",
        background: "#0b1020",
        borderRadius: 12,
      }}
    >
      <h1 style={{ margin: 0, marginBottom: 12 }}>Join Draft</h1>

      <input
        style={{
          width: "100%",
          marginBottom: 8,
          padding: 10,
          borderRadius: 8,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "white",
        }}
        placeholder="Room code (e.g. CELTIX25)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <input
        style={{
          width: "100%",
          marginBottom: 12,
          padding: 10,
          borderRadius: 8,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "white",
        }}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button
        onClick={handleJoin}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #10b981",
          background: "#10b981",
          color: "#0b1020",
          fontWeight: 700,
        }}
      >
        Join
      </button>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Join), { ssr: false });
