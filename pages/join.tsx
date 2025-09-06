// pages/join.tsx
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Join() {
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Pre-fill room from ?room=CODE
  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("room") || "";
    if (r) setRoom(r.toUpperCase());
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const roomCode = room.trim().toUpperCase();
    const displayName = name.trim();
    const emailRaw = email.trim();               // keep original casing for display/storage
    const emailNorm = emailRaw.toLowerCase();    // use for lookups when needed

    if (!roomCode || !displayName || !emailRaw) {
      alert("Room, name, and email are required.");
      return;
    }

    // Look up existing player by case-insensitive email for this room
    const { data: existing, error: selErr } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .ilike("email", emailRaw) // safe even if casing differs
      .maybeSingle();

    if (selErr) {
      alert(selErr.message);
      return;
    }

    const prevName: string | undefined = existing?.name;

    // Upsert with conflict target on the generated column (room_code, email_ci)
    const { error: upErr } = await supabase.from("players").upsert(
      {
        room_code: roomCode,
        email: emailRaw,   // DB computes email_ci = lower(email)
        name: displayName,
      } as any,
      { onConflict: "room_code,email_ci" }
    );
    if (upErr) {
      alert(upErr.message);
      return;
    }

    // Keep rooms.draft_order in sync with the submitted name
    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("draft_order")
      .eq("code", roomCode)
      .maybeSingle();
    if (roomErr) {
      alert(roomErr.message);
      return;
    }

    let draftOrder: string[] = Array.isArray(roomRow?.draft_order)
      ? [...(roomRow!.draft_order as string[])]
      : [];

    if (prevName) {
      // If they changed their name, rename in draft_order
      if (prevName !== displayName) {
        draftOrder = draftOrder.map((n) => (n === prevName ? displayName : n));
      }
    } else {
      // New player: append once if not already present
      if (!draftOrder.includes(displayName)) draftOrder.push(displayName);
    }

    // Persist order if changed
    const orderChanged =
      JSON.stringify(draftOrder) !== JSON.stringify(roomRow?.draft_order || []);
    if (orderChanged) {
      await supabase.from("rooms").update({ draft_order: draftOrder }).eq("code", roomCode);
    }

    // Store for index.tsx
    localStorage.setItem("room_code", roomCode);
    localStorage.setItem("player_name", displayName);
    localStorage.setItem("player_email", emailNorm); // store lowercased for future lookups

    // Go to the draft
    window.location.href = `/?room=${encodeURIComponent(roomCode)}`;
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", color: "#e5e7eb", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 12 }}>Join Draft</h1>
      <form onSubmit={handleJoin} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Room code (e.g. CELTIX25)"
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase())}
          style={{ padding: 10, borderRadius: 8 }}
        />
        <input
          placeholder="Your display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, borderRadius: 8 }}
        />
        <input
          type="email"
          placeholder="Your email (used as ID)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, borderRadius: 8 }}
        />
        <button style={{ padding: 10, borderRadius: 8, fontWeight: 700 }}>
          Continue
        </button>
      </form>
      <p style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
        We don’t send emails. Your email is only used to keep your spot unique in this room.
      </p>
    </div>
  );
}
