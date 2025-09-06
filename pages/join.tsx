// pages/join.tsx
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const S = {
  page: {
    maxWidth: 560,
    margin: "48px auto",
    padding: 16,
    color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "transparent",
  } as React.CSSProperties,
  card: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
  } as React.CSSProperties,
  h1: { margin: "0 0 16px 0", fontSize: 22, fontWeight: 800 } as React.CSSProperties,
  form: { display: "grid", gap: 12 } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #374151",
    background: "#0b1226",
    color: "#e5e7eb",
    outline: "none",
  } as React.CSSProperties,
  buttonPrimary: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #10b981",
    background: "#10b981",
    color: "#0b1020",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,
  helper: { marginTop: 10, opacity: 0.75, fontSize: 12 } as React.CSSProperties,
  row: { display: "grid", gap: 10 } as React.CSSProperties,
};

export default function Join() {
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill room from ?room=CODE
  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("room") || "";
    if (r) setRoom(r.toUpperCase());
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const roomCode = room.trim().toUpperCase();
    const displayName = name.trim();
    const emailRaw = email.trim();            // keep original casing for storage
    const emailNorm = emailRaw.toLowerCase(); // for localStorage lookups

    if (!roomCode || !displayName || !emailRaw) {
      alert("Room, name, and email are required.");
      return;
    }

    setSubmitting(true);

    // Find existing player by case-insensitive email
    const { data: existing, error: selErr } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .ilike("email", emailRaw)
      .maybeSingle();

    if (selErr) {
      setSubmitting(false);
      alert(selErr.message);
      return;
    }

    const prevName: string | undefined = existing?.name;

    // Upsert with conflict target on generated column (room_code, email_ci)
    const { error: upErr } = await supabase.from("players").upsert(
      {
        room_code: roomCode,
        email: emailRaw,   // DB computes email_ci = lower(email)
        name: displayName,
      } as any,
      { onConflict: "room_code,email_ci" }
    );
    if (upErr) {
      setSubmitting(false);
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
      setSubmitting(false);
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
      const { error: updErr } = await supabase
        .from("rooms")
        .update({ draft_order: draftOrder })
        .eq("code", roomCode);
      if (updErr) {
        setSubmitting(false);
        alert(updErr.message);
        return;
      }
    }

    // Store for index.tsx
    localStorage.setItem("room_code", roomCode);
    localStorage.setItem("player_name", displayName);
    localStorage.setItem("player_email", emailNorm); // store lowercased for future lookups

    // Go to the draft
    window.location.href = `/?room=${encodeURIComponent(roomCode)}`;
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.h1}>Join Draft</h1>
        <form onSubmit={handleJoin} style={S.form}>
          <div style={S.row}>
            <input
              placeholder="Room code (e.g. CELTIX25)"
              value={room}
              onChange={(e) => setRoom(e.target.value.toUpperCase())}
              style={S.input}
              autoCapitalize="characters"
            />

            <input
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={S.input}
            />

            <input
              type="email"
              placeholder="Your email (used as ID)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={S.input}
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <button type="submit" style={S.buttonPrimary} disabled={submitting}>
            {submitting ? "Continuing…" : "Continue"}
          </button>
        </form>

        <p style={S.helper}>
          We don’t send emails. Your email is only used to keep your spot unique in this room.
        </p>
      </div>
    </div>
  );
}
