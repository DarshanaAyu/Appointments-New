import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar, Phone, User, Plus, Check, ChevronLeft, ChevronRight,
  Search, Bell, MessageCircle, Users, LayoutDashboard, ArrowLeft, X
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import logoMark from "./assets/darshana-mark.png";

/* ---------------------------------- palette ---------------------------------- */
const C = {
  forest: "#1B3A2B",
  forestDeep: "#122A1E",
  forestLight: "#24492F",
  sage: "#8AA888",
  sageLight: "#DCE6D2",
  turmeric: "#C99A3B",
  turmericDark: "#A87E2E",
  ivory: "#F7F4EA",
  ink: "#1E2A20",
  inkMuted: "#5C6B5D",
  line: "#C7D3BC",
  page: "#EEF1E6",
  danger: "#B3413A",
  dangerBg: "#F7E6E4",
};

const SERVICE_NAME = "Doctor Consultation";
const SLIDER_MIN = 15;
const SLIDER_MAX = 120;
const SLIDER_STEP = 15;
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 18 * 60;
const STEP = 15;
const ROW_H = 34;

/* ---------------------------------- helpers ---------------------------------- */
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minutesToLabel = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${ampm}`;
};
const dayChip = (d) => ({ weekday: d.toLocaleDateString(undefined, { weekday: "short" }), day: d.getDate() });
const fullDateLabel = (key) => new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const shortDateLabel = (key) => new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fmtLKR = (n) => `LKR ${Number(n || 0).toLocaleString()}`;
const formatDuration = (m) => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
};
const startOfWeek = (d) => {
  const x = new Date(d); const day = x.getDay(); const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff); x.setHours(0, 0, 0, 0); return x;
};
const toIntlPhone = (raw) => {
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = "94" + digits.slice(1);
  else if (!digits.startsWith("94")) digits = "94" + digits;
  return digits;
};
const reminderMessage = (a) =>
  `Hi ${a.clientName} 👋\n\nJust a friendly reminder from Darshana Ayurveda about your appointment on ${fullDateLabel(a.dateKey)} at ${minutesToLabel(a.startMin)}.\n\nWe look forward to seeing you! 🌿`;

function playChime(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = kind === "checkout" ? [523.25, 659.25, 783.99] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 900);
  } catch (e) { console.error("chime error", e); }
}
function buildTimeline(dayAppts) {
  const sorted = [...dayAppts].sort((a, b) => a.startMin - b.startMin);
  const items = [];
  let cursor = OPEN_MIN;
  for (const appt of sorted) {
    for (let m = cursor; m < appt.startMin; m += STEP) items.push({ type: "empty", start: m });
    items.push({ type: "appt", appt });
    cursor = Math.max(cursor, appt.startMin + appt.duration);
  }
  for (let m = cursor; m < CLOSE_MIN; m += STEP) items.push({ type: "empty", start: m });
  return items;
}

/* ---------------------------------- storage hook ---------------------------------- */
/* Uses the browser's localStorage, so data lives on the device/browser it was
   entered on. To share data across devices (e.g. phone + desktop), swap this
   out for a real backend (Supabase, Firebase, a small API, etc). */
function usePersisted(key, fallback) {
  const storageKey = `darshana:${key}`;
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setValue(raw ? JSON.parse(raw) : fallback);
    } catch (e) {
      setValue(fallback);
    } finally {
      setReady(true);
    }
  }, [key]);
  const persist = async (next) => {
    setValue(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch (e) { console.error("storage set failed", key, e); }
  };
  return [value, persist, ready];
}

/* ---------------------------------- small UI atoms ---------------------------------- */
function LeafMark({ size = 26, color = C.ivory }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 4C11 8 6 16 6 24c0 6 4.5 10.5 11 10.5S28 30 28 24" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M20 4c9 4 14 12 14 20 0 6-4.5 10.5-11 10.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M20 4v30.5" stroke={color} strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}
function BotanicalDivider() {
  return (
    <svg width="100%" height="14" viewBox="0 0 300 14" preserveAspectRatio="none">
      <path d="M0 7 Q 20 0, 40 7 T 80 7 T 120 7 T 160 7 T 200 7 T 240 7 T 280 7 T 320 7" stroke={C.sage} strokeWidth="1.4" fill="none" opacity="0.6" />
    </svg>
  );
}
function Pill({ children, tone = "sage" }) {
  const bg = tone === "sage" ? C.sageLight : tone === "turmeric" ? "#F1E3C4" : "#DCEBD8";
  const fg = tone === "sage" ? C.forest : tone === "turmeric" ? C.turmericDark : C.forest;
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit" style={{ backgroundColor: bg, color: fg }}>{children}</span>;
}
function PrimaryButton({ children, onClick, disabled, full }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${full ? "w-full" : ""} rounded-xl px-4 py-3 font-medium text-sm transition-opacity`}
      style={{ backgroundColor: disabled ? C.line : C.turmeric, color: disabled ? C.inkMuted : C.forestDeep, opacity: disabled ? 0.7 : 1 }}>
      {children}
    </button>
  );
}
function StatCard({ label, value, sub }) {
  const isLongText = typeof value === "string" && value.length > 10;
  return (
    <div className="rounded-2xl p-3 border min-w-0" style={{ borderColor: C.line, backgroundColor: "white" }}>
      <div className="text-[11px] truncate" style={{ color: C.inkMuted }}>{label}</div>
      <div className={`serif mt-0.5 break-words ${isLongText ? "text-base" : "text-2xl"}`} style={{ color: C.forest, lineHeight: 1.25 }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5 truncate" style={{ color: C.inkMuted }}>{sub}</div>}
    </div>
  );
}
function Field({ icon, placeholder, value, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border" style={{ borderColor: C.line }}>
      <span style={{ color: C.inkMuted }}>{icon}</span>
      <input className="flex-1 outline-none text-sm bg-transparent min-w-0" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function PatientField({ clients, name, onChangeName, onSelectClient, onAddNew }) {
  const [open, setOpen] = useState(false);
  const query = name.trim().toLowerCase();
  const matches = query
    ? clients.filter((c) => c.name.toLowerCase().includes(query) || c.phone.includes(query)).slice(0, 5)
    : [];
  const exactMatch = matches.some((c) => c.name.trim().toLowerCase() === query);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border" style={{ borderColor: C.line }}>
        <User size={15} style={{ color: C.inkMuted, flexShrink: 0 }} />
        <input
          className="flex-1 outline-none text-sm bg-transparent min-w-0"
          placeholder="Patient name"
          value={name}
          onChange={(e) => { onChangeName(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && query && (matches.length > 0 || !exactMatch) && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border overflow-hidden shadow-lg" style={{ borderColor: C.line, backgroundColor: "white" }}>
          {matches.map((c) => (
            <button key={c.id} type="button"
              onClick={() => { onSelectClient(c); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm border-b flex justify-between items-center gap-2"
              style={{ borderColor: C.line }}>
              <span className="truncate" style={{ color: C.ink }}>{c.name}</span>
              <span className="text-xs flex-shrink-0" style={{ color: C.inkMuted }}>{c.phone}</span>
            </button>
          ))}
          {!exactMatch && (
            <button type="button" onClick={() => { onAddNew(name.trim()); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-1.5"
              style={{ color: C.forest, backgroundColor: C.sageLight }}>
              <Plus size={13} /> Add "{name.trim()}" as new patient
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="flex-shrink-0" style={{ color: C.inkMuted }}>{label}</span>
      <span className="font-medium text-right break-words" style={{ color: C.ink, maxWidth: "65%" }}>{value}</span>
    </div>
  );
}
function BackRow({ label, onBack }) {
  return <button onClick={onBack} className="flex items-center gap-1.5 text-xs" style={{ color: C.inkMuted }}><ArrowLeft size={13} /> {label}</button>;
}
function DurationSlider({ value, max, onChange }) {
  const percent = ((value - SLIDER_MIN) / (max - SLIDER_MIN)) * 100;
  return (
    <div>
      <div className="serif text-2xl text-center" style={{ color: C.turmericDark }}>{formatDuration(value)}</div>
      <input
        type="range" min={SLIDER_MIN} max={max} step={SLIDER_STEP} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="duration-slider w-full mt-2"
        style={{ background: `linear-gradient(to right, ${C.forest} 0%, ${C.forest} ${percent}%, ${C.line} ${percent}%, ${C.line} 100%)` }}
      />
      <div className="flex justify-between text-[10px] mt-1" style={{ color: C.inkMuted }}>
        <span>15 min</span>
        <span>{formatDuration(max)}</span>
      </div>
    </div>
  );
}

/* ---------------------------------- App ---------------------------------- */
export default function App() {
  const [appointments, setAppointments, apptsReady] = usePersisted("appointments", []);
  const [clients, setClients, clientsReady] = usePersisted("clients", []);
  const [tab, setTab] = useState("schedule");
  const ready = apptsReady && clientsReady;

  return (
    <div className="min-h-screen flex items-start justify-center py-6 px-3" style={{ backgroundColor: C.page, fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Work+Sans:wght@400;500;600&display=swap');
        .serif { font-family: 'Cormorant Garamond', serif; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        input.duration-slider { -webkit-appearance: none; height: 6px; border-radius: 999px; outline: none; }
        input.duration-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: ${C.turmeric}; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.35); cursor: pointer; }
        input.duration-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: ${C.turmeric}; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.35); cursor: pointer; }
        input.duration-slider::-moz-range-track { height: 6px; border-radius: 999px; background: transparent; }
      `}</style>

      <div className="w-full max-w-sm rounded-3xl shadow-xl flex flex-col" style={{ backgroundColor: C.ivory, height: "min(800px, 92vh)", overflow: "hidden" }}>
        <div style={{ backgroundColor: C.forest, flexShrink: 0 }} className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.ivory, width: 42, height: 42, padding: 4 }}>
              <img src={logoMark} alt="Darshana Ayurveda" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
            </div>
            <div>
              <div className="serif italic text-lg leading-none" style={{ color: C.ivory }}>Darshana Ayurveda</div>
              <div className="text-[10px] tracking-wide mt-1" style={{ color: C.sage }}>DR. DARSHANA DISSANAYAKA</div>
            </div>
          </div>
          <div className="mt-4"><BotanicalDivider /></div>
        </div>

        {!ready ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.inkMuted }}>Loading…</div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex border-b overflow-x-auto flex-shrink-0" style={{ borderColor: C.line }}>
              <StudioTab icon={<Calendar size={14} />} label="Schedule" active={tab === "schedule"} onClick={() => setTab("schedule")} />
              <StudioTab icon={<LayoutDashboard size={14} />} label="Dashboard" active={tab === "dash"} onClick={() => setTab("dash")} />
              <StudioTab icon={<Users size={14} />} label="Clients" active={tab === "clients"} onClick={() => setTab("clients")} />
              <StudioTab icon={<Bell size={14} />} label="Reminders" active={tab === "reminders"} onClick={() => setTab("reminders")} />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {tab === "schedule" && (
                <ScheduleView appointments={appointments} setAppointments={setAppointments} clients={clients} setClients={setClients} />
              )}
              {tab === "dash" && <Dashboard appointments={appointments} clients={clients} />}
              {tab === "clients" && <ClientDirectory clients={clients} appointments={appointments} />}
              {tab === "reminders" && <ReminderQueue appointments={appointments} setAppointments={setAppointments} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudioTab({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2"
      style={{ color: active ? C.forest : C.inkMuted, borderColor: active ? C.turmeric : "transparent" }}>
      {icon}{label}
    </button>
  );
}

/* ==================================================================== */
/* SCHEDULE — tap an open slot to book it                                */
/* ==================================================================== */
function ScheduleView({ appointments, setAppointments, clients, setClients }) {
  const [dateKey, setDateKey] = useState(toKey(new Date()));
  const [quickAddStart, setQuickAddStart] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const dayAppts = appointments.filter((a) => a.dateKey === dateKey);
  const timeline = useMemo(() => buildTimeline(dayAppts), [dayAppts]);

  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() + i); arr.push(d); }
    return arr;
  }, []);

  const shiftDay = (delta) => { const d = new Date(dateKey + "T00:00:00"); d.setDate(d.getDate() + delta); setDateKey(toKey(d)); };

  async function handleSave({ duration, name, phone, notes, wantsWhatsapp, wantsSms, visitType }) {
    playChime("booked");
    const appt = {
      id: uid(), serviceName: SERVICE_NAME, duration, dateKey, startMin: quickAddStart,
      clientName: name.trim(), clientPhone: phone.trim(), notes: notes.trim(),
      visitType: visitType || "walkin",
      reminders: { whatsapp: wantsWhatsapp, sms: wantsSms, sent: false },
      status: "booked", price: null, createdAt: Date.now(),
    };
    await setAppointments([...appointments, appt]);
    const existing = clients.find((c) => c.phone === appt.clientPhone);
    const nextClients = existing
      ? clients.map((c) => c.phone === appt.clientPhone ? { ...c, visits: (c.visits || 0) + 1, lastVisit: appt.dateKey, name: appt.clientName } : c)
      : [...clients, { id: uid(), name: appt.clientName, phone: appt.clientPhone, visits: 1, lastVisit: appt.dateKey }];
    await setClients(nextClients);
    setQuickAddStart(null);
  }

  async function handleDelete(id) {
    await setAppointments(appointments.filter((a) => a.id !== id));
    setViewingId(null);
  }

  async function handleUpdate(id, patch) {
    await setAppointments(appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function handleCheckout(id, price) {
    playChime("checkout");
    await setAppointments(appointments.map((a) => a.id === id ? { ...a, status: "completed", price: Number(price), checkedOutAt: Date.now() } : a));
  }

  async function handleMarkSent(id) {
    await setAppointments(appointments.map((a) => a.id === id ? { ...a, reminders: { ...a.reminders, sent: true } } : a));
  }

  if (quickAddStart != null) {
    return <QuickAddPanel dateKey={dateKey} startMin={quickAddStart} dayAppts={dayAppts} clients={clients} onCancel={() => setQuickAddStart(null)} onSave={handleSave} />;
  }

  if (viewingId) {
    const appt = appointments.find((a) => a.id === viewingId);
    if (appt) return <ApptDetailPanel appt={appt} allAppointments={appointments} onBack={() => setViewingId(null)} onDelete={() => handleDelete(appt.id)} onCheckout={(price) => handleCheckout(appt.id, price)} onMarkSent={() => handleMarkSent(appt.id)} onUpdate={(patch) => handleUpdate(appt.id, patch)} />;
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDay(-1)} className="p-1"><ChevronLeft size={18} color={C.forest} /></button>
        <div className="text-sm font-medium" style={{ color: C.forest }}>{fullDateLabel(dateKey)}</div>
        <button onClick={() => shiftDay(1)} className="p-1"><ChevronRight size={18} color={C.forest} /></button>
      </div>

      <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
        {days.map((d) => {
          const key = toKey(d); const chip = dayChip(d); const active = key === dateKey;
          return (
            <button key={key} onClick={() => setDateKey(key)} className="flex-shrink-0 rounded-xl px-3 py-2 text-center"
              style={{ backgroundColor: active ? C.forest : "white", border: `1px solid ${active ? C.forest : C.line}` }}>
              <div className="text-[10px]" style={{ color: active ? C.sage : C.inkMuted }}>{chip.weekday}</div>
              <div className="text-sm font-medium" style={{ color: active ? "white" : C.ink }}>{chip.day}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: C.line }}>
        {timeline.map((item) =>
          item.type === "empty"
            ? <EmptySlotRow key={item.start} start={item.start} onClick={() => setQuickAddStart(item.start)} />
            : <ApptBlock key={item.appt.id} appt={item.appt} onClick={() => setViewingId(item.appt.id)} />
        )}
      </div>
    </div>
  );
}

function EmptySlotRow({ start, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-3 border-b last:border-b-0"
      style={{ borderColor: C.line, height: ROW_H, backgroundColor: "white" }}>
      <span className="text-xs" style={{ color: C.inkMuted }}>{minutesToLabel(start)}</span>
      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: C.sage }}><Plus size={13} /> Add</span>
    </button>
  );
}

function ApptBlock({ appt, onClick }) {
  const height = ROW_H * (appt.duration / STEP);
  const done = appt.status === "completed";
  return (
    <button onClick={onClick} className="w-full flex items-start gap-3 px-3 py-2 border-b last:border-b-0 text-left"
      style={{ borderColor: C.line, minHeight: height, backgroundColor: done ? "#DCEBD8" : C.sageLight }}>
      <div className="text-xs font-medium flex-shrink-0 pt-0.5" style={{ color: C.forest, width: "44px" }}>{minutesToLabel(appt.startMin)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium break-words" style={{ color: C.ink }}>{appt.clientName}</div>
        <div className="text-xs mt-0.5 break-words" style={{ color: C.inkMuted }}>{formatDuration(appt.duration)} · {appt.visitType === "scheduled" ? "Scheduled" : "Walk-in"}{done ? ` · ${fmtLKR(appt.price)}` : ""}</div>
      </div>
      {done && <Check size={14} color={C.forest} style={{ flexShrink: 0, marginTop: 2 }} />}
      <ChevronRight size={15} color={C.inkMuted} style={{ flexShrink: 0, marginTop: 2 }} />
    </button>
  );
}

function QuickAddPanel({ dateKey, startMin, dayAppts, clients, onCancel, onSave }) {
  const nextApptStart = useMemo(() => {
    const upcoming = dayAppts.filter((a) => a.startMin > startMin).sort((a, b) => a.startMin - b.startMin);
    return upcoming.length ? upcoming[0].startMin : CLOSE_MIN;
  }, [dayAppts, startMin]);
  const sliderMax = Math.max(0, Math.min(SLIDER_MAX, Math.floor((nextApptStart - startMin) / SLIDER_STEP) * SLIDER_STEP));

  const [duration, setDuration] = useState(Math.min(30, sliderMax) || sliderMax);
  const [visitType, setVisitType] = useState("walkin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [wantsWhatsapp, setWantsWhatsapp] = useState(true);
  const [wantsSms, setWantsSms] = useState(false);

  const canSave = sliderMax >= SLIDER_MIN && name.trim() && /^[0-9+\-\s]{7,15}$/.test(phone.trim());

  return (
    <div className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <BackRow label="Cancel" onBack={onCancel} />
          <div className="serif text-xl mt-2" style={{ color: C.forest }}>New appointment</div>
          <div className="text-xs mt-0.5" style={{ color: C.inkMuted }}>{SERVICE_NAME} · {fullDateLabel(dateKey)} · {minutesToLabel(startMin)}</div>
        </div>
        <button onClick={onCancel}><X size={18} color={C.inkMuted} /></button>
      </div>

      {sliderMax < SLIDER_MIN ? (
        <div className="mt-4 text-xs" style={{ color: C.danger }}>Not enough time before the next appointment — try an earlier slot.</div>
      ) : (
        <div className="mt-5">
          <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Duration</div>
          <DurationSlider value={duration} max={sliderMax} onChange={setDuration} />
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Visit type</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setVisitType("walkin")} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
            style={{ borderColor: visitType === "walkin" ? C.forest : C.line, backgroundColor: visitType === "walkin" ? C.sageLight : "white", color: C.ink }}>
            Walk-in
          </button>
          <button type="button" onClick={() => setVisitType("scheduled")} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
            style={{ borderColor: visitType === "scheduled" ? C.forest : C.line, backgroundColor: visitType === "scheduled" ? C.sageLight : "white", color: C.ink }}>
            Scheduled
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <PatientField
          clients={clients}
          name={name}
          onChangeName={setName}
          onSelectClient={(c) => { setName(c.name); setPhone(c.phone); }}
          onAddNew={(typedName) => setName(typedName)}
        />
        <Field icon={<Phone size={15} />} placeholder="Phone number" value={phone} onChange={setPhone} />
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-xl p-3 text-sm outline-none border resize-none" style={{ borderColor: C.line }} />
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Reminders</div>
        <div className="flex gap-2">
          <button onClick={() => setWantsWhatsapp((v) => !v)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
            style={{ borderColor: wantsWhatsapp ? C.forest : C.line, backgroundColor: wantsWhatsapp ? C.sageLight : "white", color: C.ink }}>
            <MessageCircle size={13} /> WhatsApp
          </button>
          <button onClick={() => setWantsSms((v) => !v)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
            style={{ borderColor: wantsSms ? C.forest : C.line, backgroundColor: wantsSms ? C.sageLight : "white", color: C.ink }}>
            <Bell size={13} /> Text
          </button>
        </div>
      </div>

      <div className="mt-6">
        <PrimaryButton full disabled={!canSave} onClick={() => onSave({ duration, name, phone, notes, wantsWhatsapp, wantsSms, visitType })}>Save appointment</PrimaryButton>
      </div>
    </div>
  );
}

function ApptDetailPanel({ appt, allAppointments, onBack, onDelete, onCheckout, onMarkSent, onUpdate }) {
  const [confirming, setConfirming] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState(null); // 'date' | 'time' | 'duration' | null
  const [pendingDate, setPendingDate] = useState(appt.dateKey);
  const [pendingDuration, setPendingDuration] = useState(appt.duration);
  const [dateNeedsTime, setDateNeedsTime] = useState(false);
  const done = appt.status === "completed";

  function othersOnDate(dk) {
    return allAppointments.filter((a) => a.id !== appt.id && a.dateKey === dk);
  }
  function timeSlots(dk, duration) {
    const others = othersOnDate(dk);
    const slots = [];
    for (let m = OPEN_MIN; m + duration <= CLOSE_MIN; m += STEP) {
      const overlaps = others.some((o) => m < o.startMin + o.duration && m + duration > o.startMin);
      if (!overlaps) slots.push(m);
    }
    return slots;
  }
  function durationMax(dk, startMin) {
    const others = othersOnDate(dk);
    const upcoming = others.filter((a) => a.startMin > startMin).sort((a, b) => a.startMin - b.startMin);
    const nextStart = upcoming.length ? upcoming[0].startMin : CLOSE_MIN;
    return Math.max(0, Math.min(SLIDER_MAX, Math.floor((nextStart - startMin) / SLIDER_STEP) * SLIDER_STEP));
  }
  const durMax = durationMax(appt.dateKey, appt.startMin);

  function openDateEdit() { setPendingDate(appt.dateKey); setDateNeedsTime(false); setEditing("date"); }
  function openTimeEdit() { setPendingDate(appt.dateKey); setEditing("time"); }
  function openDurationEdit() { setPendingDuration(Math.min(appt.duration, durMax) || durMax); setEditing("duration"); }

  function confirmDate() {
    if (timeSlots(pendingDate, appt.duration).includes(appt.startMin)) {
      onUpdate({ dateKey: pendingDate });
      setEditing(null);
    } else {
      setDateNeedsTime(true);
    }
  }
  function pickTime(dk, startMin) {
    onUpdate(dk === appt.dateKey ? { startMin } : { dateKey: dk, startMin });
    setEditing(null);
    setDateNeedsTime(false);
  }
  function confirmDuration() {
    onUpdate({ duration: pendingDuration });
    setEditing(null);
  }

  function sendVia(method) {
    const phone = toIntlPhone(appt.clientPhone);
    const message = reminderMessage(appt);
    const url = method === "whatsapp"
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `sms:+${phone}?body=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    onMarkSent();
  }

  return (
    <div className="p-5">
      <BackRow label="Back to schedule" onBack={onBack} />
      <div className="serif text-xl mt-3" style={{ color: C.forest }}>{appt.serviceName}</div>

      {!done ? (
        <div className="text-sm mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <button onClick={openDateEdit} className="underline decoration-dotted underline-offset-2" style={{ color: C.forest }}>{fullDateLabel(appt.dateKey)}</button>
          <span style={{ color: C.inkMuted }}>·</span>
          <button onClick={openTimeEdit} className="underline decoration-dotted underline-offset-2" style={{ color: C.forest }}>{minutesToLabel(appt.startMin)}</button>
          <span style={{ color: C.inkMuted }}>·</span>
          <button onClick={openDurationEdit} className="underline decoration-dotted underline-offset-2" style={{ color: C.forest }}>{formatDuration(appt.duration)}</button>
        </div>
      ) : (
        <div className="text-sm mt-1" style={{ color: C.inkMuted }}>{fullDateLabel(appt.dateKey)} · {minutesToLabel(appt.startMin)} · {formatDuration(appt.duration)}</div>
      )}

      {editing === "date" && (
        <div className="rounded-2xl p-3 mt-2" style={{ backgroundColor: C.sageLight }}>
          <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Change date</div>
          <input
            type="date" value={pendingDate}
            onChange={(e) => { setPendingDate(e.target.value); setDateNeedsTime(false); }}
            className="w-full rounded-lg p-2.5 text-sm outline-none border mb-2" style={{ borderColor: C.line, backgroundColor: "white" }}
          />
          {dateNeedsTime ? (
            <>
              <div className="text-xs mb-2" style={{ color: C.danger }}>{minutesToLabel(appt.startMin)} isn't free on {shortDateLabel(pendingDate)} — pick a new time:</div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                {timeSlots(pendingDate, appt.duration).map((m) => (
                  <button key={m} onClick={() => pickTime(pendingDate, m)}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: C.line, backgroundColor: "white", color: C.ink }}>
                    {minutesToLabel(m)}
                  </button>
                ))}
                {timeSlots(pendingDate, appt.duration).length === 0 && (
                  <div className="text-xs" style={{ color: C.inkMuted }}>No free slots long enough on this date.</div>
                )}
              </div>
              <button onClick={() => setEditing(null)} className="mt-2 text-xs" style={{ color: C.inkMuted }}>Cancel</button>
            </>
          ) : (
            <div className="flex gap-2">
              <PrimaryButton full onClick={confirmDate}>Save date</PrimaryButton>
              <button onClick={() => setEditing(null)} className="px-3 text-sm" style={{ color: C.inkMuted }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {editing === "time" && (
        <div className="rounded-2xl p-3 mt-2" style={{ backgroundColor: C.sageLight }}>
          <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Change time</div>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
            {timeSlots(appt.dateKey, appt.duration).map((m) => (
              <button key={m} onClick={() => pickTime(appt.dateKey, m)}
                className="w-full text-left px-3 py-1.5 rounded-lg text-sm border"
                style={{ borderColor: m === appt.startMin ? C.forest : C.line, backgroundColor: "white", color: C.ink, fontWeight: m === appt.startMin ? 600 : 400 }}>
                {minutesToLabel(m)}{m === appt.startMin ? " · current" : ""}
              </button>
            ))}
            {timeSlots(appt.dateKey, appt.duration).length === 0 && (
              <div className="text-xs" style={{ color: C.inkMuted }}>No other free slots this long today.</div>
            )}
          </div>
          <button onClick={() => setEditing(null)} className="mt-2 text-xs" style={{ color: C.inkMuted }}>Cancel</button>
        </div>
      )}

      {editing === "duration" && (
        <div className="rounded-2xl p-3 mt-2" style={{ backgroundColor: C.sageLight }}>
          <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Change duration</div>
          {durMax >= SLIDER_MIN ? (
            <>
              <DurationSlider value={pendingDuration} max={durMax} onChange={setPendingDuration} />
              <div className="flex gap-2 mt-3">
                <PrimaryButton full onClick={confirmDuration}>Save duration</PrimaryButton>
                <button onClick={() => setEditing(null)} className="px-3 text-sm" style={{ color: C.inkMuted }}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs" style={{ color: C.danger }}>The next appointment leaves no room to extend this one.</div>
              <button onClick={() => setEditing(null)} className="mt-2 text-xs" style={{ color: C.inkMuted }}>Cancel</button>
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl p-4 mt-4 space-y-2 text-sm border" style={{ borderColor: C.line, backgroundColor: "white" }}>
        <Row label="Client" value={appt.clientName} />
        <Row label="Phone" value={appt.clientPhone} />
        {done && <Row label="Price paid" value={fmtLKR(appt.price)} />}
        {appt.notes && <Row label="Notes" value={appt.notes} />}
      </div>

      <div className="flex gap-1.5 mt-3 flex-wrap">
        <Pill tone={appt.visitType === "scheduled" ? "turmeric" : "sage"}>{appt.visitType === "scheduled" ? "Scheduled" : "Walk-in"}</Pill>
        {appt.reminders.whatsapp && <Pill>WhatsApp</Pill>}
        {appt.reminders.sms && <Pill>Text</Pill>}
        {appt.reminders.sent && <Pill tone="turmeric">Sent</Pill>}
        {done && <Pill tone="done"><Check size={11} /> Checked out</Pill>}
      </div>

      {!done && (appt.reminders.whatsapp || appt.reminders.sms) && (
        <div className="flex gap-2 mt-3">
          {appt.reminders.whatsapp && (
            <button onClick={() => sendVia("whatsapp")} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: C.sageLight, color: C.forest }}>
              <MessageCircle size={13} /> Send WhatsApp
            </button>
          )}
          {appt.reminders.sms && (
            <button onClick={() => sendVia("sms")} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: "#F1E3C4", color: C.turmericDark }}>
              <Bell size={13} /> Send Text
            </button>
          )}
        </div>
      )}

      {!done && (
        <div className="mt-5">
          {!checkingOut ? (
            <PrimaryButton full onClick={() => setCheckingOut(true)}>Checkout &amp; add price</PrimaryButton>
          ) : (
            <div className="rounded-2xl p-3" style={{ backgroundColor: C.sageLight }}>
              <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Amount charged (LKR)</div>
              <input type="number" placeholder="e.g. 3500" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg p-2.5 text-sm outline-none border mb-2" style={{ borderColor: C.line }} />
              <div className="flex gap-2">
                <PrimaryButton full disabled={!price} onClick={() => onCheckout(price)}>Confirm checkout</PrimaryButton>
                <button onClick={() => setCheckingOut(false)} className="px-3 text-sm" style={{ color: C.inkMuted }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!done && !checkingOut && (
        <div className="mt-4">
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="text-sm font-medium" style={{ color: C.danger }}>Cancel this appointment</button>
          ) : (
            <div className="rounded-xl p-3" style={{ backgroundColor: C.dangerBg }}>
              <div className="text-sm mb-2" style={{ color: C.ink }}>Cancel this appointment for {appt.clientName}?</div>
              <div className="flex gap-2">
                <button onClick={onDelete} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ backgroundColor: C.danger }}>Yes, cancel</button>
                <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg py-2 text-sm font-medium border" style={{ borderColor: C.line, color: C.ink }}>Keep it</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== */
/* DASHBOARD                                                             */
/* ==================================================================== */
function Dashboard({ appointments, clients }) {
  const todayKey = toKey(new Date());
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const weekStart = startOfWeek(new Date());
  const weekKeys = useMemo(() => { const arr = []; for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); arr.push(toKey(d)); } return arr; }, []);

  const todayCount = appointments.filter((a) => a.dateKey === todayKey).length;
  const completed = (a) => a.status === "completed";
  const weekRevenue = appointments.filter((a) => weekKeys.includes(a.dateKey) && completed(a)).reduce((sum, a) => sum + (a.price || 0), 0);
  const totalRevenue = appointments.filter(completed).reduce((sum, a) => sum + (a.price || 0), 0);
  const pendingCheckout = appointments.filter((a) => a.status !== "completed" && (a.dateKey < todayKey || (a.dateKey === todayKey && a.startMin + a.duration <= nowMin))).length;

  const weekChartData = weekKeys.map((key) => ({
    day: new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }),
    count: appointments.filter((a) => a.dateKey === key).length,
  }));
  const revenueChartData = weekKeys.map((key) => ({
    day: new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }),
    revenue: appointments.filter((a) => a.dateKey === key && completed(a)).reduce((sum, a) => sum + (a.price || 0), 0),
  }));

  return (
    <div className="p-5">
      <div className="serif text-xl" style={{ color: C.forest }}>Dashboard</div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <StatCard label="Today's appointments" value={todayCount} />
        <StatCard label="This week's revenue" value={fmtLKR(weekRevenue)} />
        <StatCard label="Total clients" value={clients.length} />
        <StatCard label="Pending checkout" value={pendingCheckout} sub={pendingCheckout ? "Past visits not billed yet" : null} />
      </div>

      <div className="mt-5">
        <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>This week at a glance</div>
        <div className="rounded-2xl border p-3" style={{ borderColor: C.line, backgroundColor: "white" }}>
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <BarChart data={weekChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.inkMuted }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.inkMuted }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: C.line }} />
                <Bar dataKey="count" fill={C.forest} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>Revenue this week</div>
        <div className="rounded-2xl border p-3" style={{ borderColor: C.line, backgroundColor: "white" }}>
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.inkMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.inkMuted }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v) => fmtLKR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: C.line }} />
                <Bar dataKey="revenue" fill={C.turmeric} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="text-right text-xs mt-2" style={{ color: C.inkMuted }}>All-time revenue: {fmtLKR(totalRevenue)}</div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* CLIENTS                                                               */
/* ==================================================================== */
function ClientDirectory({ clients, appointments }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query))
    .sort((a, b) => (b.lastVisit || "").localeCompare(a.lastVisit || ""));

  return (
    <div className="p-5">
      <div className="serif text-xl" style={{ color: C.forest }}>Clients</div>
      <div className="mt-3"><Field icon={<Search size={15} />} placeholder="Search name or phone" value={query} onChange={setQuery} /></div>
      <div className="mt-3 space-y-2">
        {filtered.length === 0 && <div className="text-sm text-center py-8" style={{ color: C.inkMuted }}>No clients yet.</div>}
        {filtered.map((c) => {
          const history = appointments.filter((a) => a.clientPhone === c.phone).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
          const open = openId === c.id;
          return (
            <div key={c.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: C.line, backgroundColor: "white" }}>
              <button className="w-full text-left p-3 flex items-center justify-between gap-2" onClick={() => setOpenId(open ? null : c.id)}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: C.ink }}>{c.name}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: C.inkMuted }}>{c.phone} · {c.visits} visit{c.visits > 1 ? "s" : ""}</div>
                </div>
                <ChevronRight size={16} color={C.inkMuted} style={{ transform: open ? "rotate(90deg)" : "none", flexShrink: 0 }} />
              </button>
              {open && (
                <div className="px-3 pb-3 space-y-1.5">
                  {history.map((a) => (
                    <div key={a.id} className="text-xs flex justify-between gap-2" style={{ color: C.inkMuted }}>
                      <span className="truncate min-w-0">{formatDuration(a.duration)}{a.status === "completed" ? ` · ${fmtLKR(a.price)}` : " · unbilled"}</span>
                      <span className="flex-shrink-0">{shortDateLabel(a.dateKey)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==================================================================== */
/* REMINDERS                                                             */
/* ==================================================================== */
function ReminderQueue({ appointments, setAppointments }) {
  const now = new Date();
  const todayKey = toKey(now);
  const tomorrowKey = toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const upcoming = appointments.filter((a) => {
    if (a.reminders.sent || (!a.reminders.whatsapp && !a.reminders.sms)) return false;
    const apptDate = new Date(a.dateKey + "T00:00:00"); apptDate.setMinutes(a.startMin);
    const hoursAway = (apptDate - now) / (1000 * 60 * 60);
    return hoursAway > -1 && hoursAway < 48;
  }).sort((a, b) => (a.dateKey + a.startMin).localeCompare(b.dateKey + b.startMin));

  const groups = [
    { label: "Today", items: upcoming.filter((a) => a.dateKey === todayKey) },
    { label: "Tomorrow", items: upcoming.filter((a) => a.dateKey === tomorrowKey) },
    { label: "Later", items: upcoming.filter((a) => a.dateKey !== todayKey && a.dateKey !== tomorrowKey) },
  ].filter((g) => g.items.length > 0);

  async function markSent(id) { await setAppointments(appointments.map((a) => (a.id === id ? { ...a, reminders: { ...a.reminders, sent: true } } : a))); }

  function sendVia(method, a) {
    const phone = toIntlPhone(a.clientPhone);
    const message = reminderMessage(a);
    const url = method === "whatsapp"
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `sms:+${phone}?body=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    markSent(a.id);
  }

  return (
    <div className="p-5">
      <div className="serif text-xl" style={{ color: C.forest }}>Reminders due</div>
      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: C.inkMuted }}>
        Tap a button below to open WhatsApp or Messages with the reminder already written — just hit send.
        For fully automatic sending, a messaging provider like Twilio or the WhatsApp Business API would need
        to be connected on a backend.
      </p>
      <div className="mt-4 space-y-4">
        {groups.length === 0 && <div className="text-sm text-center py-8" style={{ color: C.inkMuted }}>Nothing due in the next 48 hours.</div>}
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-xs font-medium mb-2" style={{ color: C.forest }}>{g.label}</div>
            <div className="space-y-2">
              {g.items.map((a) => (
                <div key={a.id} className="rounded-2xl p-3 border" style={{ borderColor: C.line, backgroundColor: "white" }}>
                  <div className="text-sm font-medium" style={{ color: C.ink }}>{a.clientName}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.inkMuted }}>{minutesToLabel(a.startMin)} · {formatDuration(a.duration)}</div>
                  <div className="text-xs italic break-words mt-1.5" style={{ color: C.inkMuted }}>"{reminderMessage(a)}"</div>
                  <div className="flex gap-2 mt-2">
                    {a.reminders.whatsapp && (
                      <button onClick={() => sendVia("whatsapp", a)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ backgroundColor: C.sageLight, color: C.forest }}>
                        <MessageCircle size={13} /> Send WhatsApp
                      </button>
                    )}
                    {a.reminders.sms && (
                      <button onClick={() => sendVia("sms", a)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ backgroundColor: "#F1E3C4", color: C.turmericDark }}>
                        <Bell size={13} /> Send Text
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
