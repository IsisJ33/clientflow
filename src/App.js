import { useState, useEffect, useRef } from "react";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://vhtbofqkusndoyutbyjl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hU6o0A5-cDtzBbmsNp6ADA_pefBG5pi";

async function sb(table, method, data, match) {
  const base = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Prefer": method === "POST" ? "return=representation" : "return=representation"
  };
  let url = base;
  if (match) url += `?${Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&")}`;
  const res = await fetch(url, { method, headers, body: data ? JSON.stringify(data) : undefined });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const db = {
  getAll: (table) => sb(table, "GET"),
  insert: (table, data) => sb(table, "POST", data),
  update: (table, data, match) => sb(table, "PATCH", data, match),
  delete: (table, match) => sb(table, "DELETE", undefined, match),
};

// ─── AI ──────────────────────────────────────────────────────────────────────
async function callClaude(system, user, maxTokens = 800) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const GRADES = ["A+", "A", "B", "C", "D", "F"];
const GRADE_COLOR = { "A+": "#1db954", "A": "#4eca8b", "B": "#f5a623", "C": "#5b9cf6", "D": "#8888a0", "F": "#e05555" };
const GRADE_LABEL = { "A+": "MUST CALL NOW", "A": "HOT", "B": "WARM", "C": "NURTURE", "D": "COLD", "F": "INACTIVE" };
const LEAD_TYPES = ["Buyer", "Seller", "Buyer + Seller", "Investor", "Past Client"];
const ACTIVITY_TYPES = ["Call", "Text", "Email", "Meeting", "System"];
const VENDOR_TYPES = ["General Contractor", "Painter", "Plumber", "Electrician", "Inspector", "Stager", "Photographer", "Lender", "Other"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const now = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const today = () => new Date().toISOString().split("T")[0];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function CFLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs><linearGradient id="cfg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#1db954"/><stop offset="100%" stopColor="#17a349"/></linearGradient></defs>
      <path d="M46 15C46 15 30 10 20 22C11 33 15 49 30 51C40 53 48 47 48 47" stroke="url(#cfg)" strokeWidth="3.8" strokeLinecap="round" fill="none"/>
      <circle cx="46" cy="15" r="3" fill="#1db954"/><circle cx="48" cy="47" r="3" fill="#17a349"/>
      <line x1="22" y1="24" x2="22" y2="42" stroke="#1db954" strokeWidth="2.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="22" y1="24" x2="33" y2="24" stroke="#1db954" strokeWidth="2.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="22" y1="33" x2="30" y2="33" stroke="#1db954" strokeWidth="2.2" strokeLinecap="round" opacity="0.38"/>
    </svg>
  );
}

function GradeBadge({ grade, size = "md" }) {
  const c = GRADE_COLOR[grade] || "#55556a";
  const fs = size === "lg" ? 20 : size === "sm" ? 11 : 14;
  const pad = size === "lg" ? "8px 14px" : size === "sm" ? "2px 7px" : "4px 10px";
  return <span style={{ background: c + "22", color: c, border: `1.5px solid ${c}55`, borderRadius: 8, padding: pad, fontSize: fs, fontWeight: 900, letterSpacing: 0.5 }}>{grade}</span>;
}

function Avatar({ name, size = 36 }) {
  const init = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},38%,22%)`, border: `2px solid hsl(${hue},40%,35%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 900, color: `hsl(${hue},65%,72%)`, flexShrink: 0 }}>{init}</div>;
}

function Label({ children }) { return <div style={{ fontSize: 11, color: "#55556a", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>{children}</div>; }
function Empty({ icon, msg }) { return <div style={{ textAlign: "center", padding: "50px 20px", color: "#55556a" }}><div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div><div style={{ fontWeight: 700 }}>{msg}</div></div>; }

const iS = { width: "100%", background: "#16161f", border: "1px solid #22222e", borderRadius: 8, padding: "9px 11px", color: "#f0eee8", fontFamily: "inherit", fontSize: 13, boxSizing: "border-box", outline: "none" };
const btn = (bg, color, extra = {}) => ({ background: bg, color, border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", ...extra });

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,6,10,0.95)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#111118", border: "1px solid #1e1e28", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: wide ? 700 : 540, maxHeight: "93vh", overflowY: "auto", padding: "22px 20px 36px", borderBottom: "none" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "#1e1e28", border: "none", color: "#8888a0", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddressBlock({ data, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
      <div style={{ gridColumn: "1 / -1" }}><Label>Street Address</Label><input value={data.address || ""} onChange={e => onChange("address", e.target.value)} style={iS} /></div>
      <div><Label>City</Label><input value={data.city || ""} onChange={e => onChange("city", e.target.value)} style={iS} /></div>
      <div><Label>State</Label><select value={data.state || "MI"} onChange={e => onChange("state", e.target.value)} style={iS}>{US_STATES.map(s => <option key={s}>{s}</option>)}</select></div>
      <div><Label>ZIP</Label><input value={data.zip || ""} onChange={e => onChange("zip", e.target.value)} style={iS} /></div>
      <div><Label>Neighborhood</Label><input value={data.neighborhood || ""} onChange={e => onChange("neighborhood", e.target.value)} placeholder="e.g. Midtown, Corktown" style={iS} /></div>
    </div>
  );
}

function ActivityFeed({ activities, onAdd, personId, personTable }) {
  const [type, setType] = useState("Call");
  const [content, setContent] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const entry = { person_id: personId, person_table: personTable, type, content, outcome, next_step: nextStep, timestamp: now(), created_at: new Date().toISOString() };
    try { await db.insert("activities", entry); } catch (e) { console.log(e); }
    onAdd({ ...entry, id: Date.now() });
    setContent(""); setOutcome(""); setNextStep(""); setSaving(false);
  };

  return (
    <div>
      <div style={{ background: "#0d0d14", borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid #1e1e28" }}>
        <Label>Log Activity</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {ACTIVITY_TYPES.map(t => <button key={t} onClick={() => setType(t)} style={{ background: type === t ? "#1db954" : "#1e1e28", color: type === t ? "#09090e" : "#8888a0", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>)}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What happened?" rows={2} style={{ ...iS, resize: "vertical", marginBottom: 8 }} />
        <input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="Outcome (optional)" style={{ ...iS, marginBottom: 8 }} />
        <input value={nextStep} onChange={e => setNextStep(e.target.value)} placeholder="Next step (optional)" style={{ ...iS, marginBottom: 10 }} />
        <button onClick={add} disabled={saving || !content.trim()} style={{ ...btn("#1db954", "#09090e"), width: "100%", opacity: content.trim() ? 1 : 0.5 }}>{saving ? "Saving..." : "Log Activity"}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(activities || []).length === 0 && <div style={{ color: "#55556a", fontSize: 13, textAlign: "center", padding: 16 }}>No activity yet</div>}
        {(activities || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((a, i) => (
          <div key={i} style={{ background: "#0d0d14", borderRadius: 10, padding: "11px 13px", border: "1px solid #1e1e28" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ background: a.type === "Call" ? "#1db95422" : a.type === "Text" ? "#5b9cf622" : a.type === "Email" ? "#f5a62322" : "#c8a96e22", color: a.type === "Call" ? "#1db954" : a.type === "Text" ? "#5b9cf6" : a.type === "Email" ? "#f5a623" : "#c8a96e", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{a.type}</span>
              <span style={{ fontSize: 11, color: "#55556a" }}>{a.timestamp}</span>
            </div>
            <div style={{ fontSize: 13, color: "#f0eee8", lineHeight: 1.55 }}>{a.content}</div>
            {a.outcome && <div style={{ fontSize: 12, color: "#8888a0", marginTop: 4 }}>Outcome: {a.outcome}</div>}
            {a.next_step && <div style={{ fontSize: 12, color: "#1db954", marginTop: 3 }}>Next: {a.next_step}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function ClientFlowCRM() {
  const [people, setPeople] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [office, setOffice] = useState("");
  const [editingOffice, setEditingOffice] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterCity, setFilterCity] = useState("All");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [gradingId, setGradingId] = useState(null);
  const [actionPlan, setActionPlan] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: "", phone: "", email: "", type: "Buyer", grade: "C", address: "", city: "", state: "MI", zip: "", neighborhood: "", birthday: "", date_added: today(), next_action: "", next_action_due: "", relationship: { motivation: "", pain_points: "", goals: "", must_haves: "", deal_breakers: "", budget: "", timeline: "", referral_grade: "C", life_events: "", anniversary: "" } });
  const [newVendor, setNewVendor] = useState({ name: "", phone: "", email: "", vendor_type: "General Contractor", grade: "B", address: "", city: "", state: "MI", zip: "", notes: "" });
  const [newOpp, setNewOpp] = useState({ title: "", type: "Investment Property", grade: "B", address: "", city: "", state: "MI", zip: "", neighborhood: "", price: "", notes: "", next_action: "", next_action_due: "" });

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [p, v, o, a] = await Promise.all([db.getAll("people"), db.getAll("vendors"), db.getAll("opportunities"), db.getAll("activities")]);
        setPeople(p || []); setVendors(v || []); setOpportunities(o || []); setActivities(a || []);
      } catch (e) { console.log("DB not connected — running offline"); }
      setLoading(false);
    };
    load();
  }, []);

  const getActivities = (id) => activities.filter(a => a.person_id === id || a.opp_id === id);

  const addActivity = (entry) => setActivities(p => [entry, ...p]);

  const gradePerson = async (person) => {
    setGradingId(person.id);
    try {
      const acts = getActivities(person.id);
      const lastAct = acts[0];
      const text = await callClaude(
        "You are a real estate AI. Grade this lead A+, A, B, C, D, or F based on urgency and intent. Return ONLY valid JSON: {\"grade\":\"A+|A|B|C|D|F\",\"reason\":\"1 sentence\"}",
        `Name:${person.name}, Type:${person.type}, Current grade:${person.grade}, Next action:${person.next_action}, Due:${person.next_action_due}, Last activity:${lastAct ? `${lastAct.type} - ${lastAct.content}` : "none"}, Relationship:${JSON.stringify(person.relationship)}`
      );
      const p = JSON.parse(text.replace(/```json|```/g, "").trim());
      const updated = { ...person, grade: p.grade, grade_reason: p.reason };
      await db.update("people", { grade: p.grade, grade_reason: p.reason }, { id: person.id });
      setPeople(prev => prev.map(x => x.id === person.id ? updated : x));
      if (selected?.id === person.id) setSelected(updated);
      showToast(`Graded ${p.grade} ✓`);
    } catch { showToast("Grade failed", "error"); }
    setGradingId(null);
  };

  const gradeAll = async () => {
    for (const p of people) await gradePerson(p);
    showToast("All graded ✓");
  };

  const buildActionPlan = async () => {
    setActionLoading(true); setActionPlan(null);
    try {
      const aPlus = people.filter(p => p.grade === "A+").map(p => p.name).join(", ");
      const hot = people.filter(p => p.grade === "A").map(p => p.name).join(", ");
      const text = await callClaude(
        "You are an AI executive advisor for a real estate agent. Return ONLY valid JSON: {\"callNow\":[{\"name\":\"string\",\"action\":\"string\",\"why\":\"string\"}],\"todayGoal\":\"string\",\"moneyInsight\":\"string\",\"motivationalNote\":\"string\"}. Max 5 callNow items.",
        `Today: ${today()}. A+ leads: ${aPlus || "none"}. A leads: ${hot || "none"}. Total people: ${people.length}. Vendors: ${vendors.length}. Opportunities: ${opportunities.length}.`, 1200
      );
      setActionPlan(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch { showToast("Plan failed", "error"); }
    setActionLoading(false);
  };

  const addPerson = async () => {
    if (!newPerson.name || !newPerson.phone) return;
    const person = { ...newPerson, created_at: new Date().toISOString() };
    try {
      const saved = await db.insert("people", person);
      setPeople(p => [saved[0] || { ...person, id: Date.now() }, ...p]);
      showToast("Contact saved ✓");
    } catch { setPeople(p => [{ ...person, id: Date.now() }, ...p]); showToast("Added offline"); }
    setShowAdd(false);
    setNewPerson({ name: "", phone: "", email: "", type: "Buyer", grade: "C", address: "", city: "", state: "MI", zip: "", neighborhood: "", birthday: "", date_added: today(), next_action: "", next_action_due: "", relationship: { motivation: "", pain_points: "", goals: "", must_haves: "", deal_breakers: "", budget: "", timeline: "", referral_grade: "C", life_events: "", anniversary: "" } });
  };

  const savePerson = async (updated) => {
    try { await db.update("people", updated, { id: updated.id }); } catch { }
    setPeople(p => p.map(x => x.id === updated.id ? updated : x));
    setSelected(null); showToast("Saved ✓");
  };

  const addVendor = async () => {
    if (!newVendor.name) return;
    const vendor = { ...newVendor, created_at: new Date().toISOString() };
    try { const saved = await db.insert("vendors", vendor); setVendors(p => [saved[0] || { ...vendor, id: Date.now() }, ...p]); showToast("Vendor saved ✓"); }
    catch { setVendors(p => [{ ...vendor, id: Date.now() }, ...p]); showToast("Added offline"); }
    setShowAddVendor(false);
    setNewVendor({ name: "", phone: "", email: "", vendor_type: "General Contractor", grade: "B", address: "", city: "", state: "MI", zip: "", notes: "" });
  };

  const addOpp = async () => {
    if (!newOpp.title) return;
    const opp = { ...newOpp, created_at: new Date().toISOString() };
    try { const saved = await db.insert("opportunities", opp); setOpportunities(p => [saved[0] || { ...opp, id: Date.now() }, ...p]); showToast("Opportunity saved ✓"); }
    catch { setOpportunities(p => [{ ...opp, id: Date.now() }, ...p]); showToast("Added offline"); }
    setShowAddOpp(false);
    setNewOpp({ title: "", type: "Investment Property", grade: "B", address: "", city: "", state: "MI", zip: "", neighborhood: "", price: "", notes: "", next_action: "", next_action_due: "" });
  };

  const filteredPeople = people.filter(p => {
    if (filterGrade !== "All" && p.grade !== filterGrade) return false;
    if (filterType !== "All" && p.type !== filterType) return false;
    if (filterCity !== "All" && p.city !== filterCity) return false;
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) && !p.phone?.includes(search) && !p.city?.toLowerCase().includes(search.toLowerCase()) && !p.zip?.includes(search)) return false;
    return true;
  }).sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade));

  const allCities = ["All", ...new Set(people.map(p => p.city).filter(Boolean).sort())];
  const aPlus = people.filter(p => p.grade === "A+");
  const hotLeads = people.filter(p => ["A+", "A"].includes(p.grade));

  // GEO grades
  const geoData = people.reduce((acc, p) => {
    if (!p.city) return acc;
    if (!acc[p.city]) acc[p.city] = { zip: {}, people: [] };
    acc[p.city].people.push(p);
    const z = p.zip || "No ZIP";
    if (!acc[p.city].zip[z]) acc[p.city].zip[z] = [];
    acc[p.city].zip[z].push(p);
    return acc;
  }, {});

  const getZoneGrade = (group) => {
    const aPlusCount = group.filter(p => p.grade === "A+").length;
    const aCount = group.filter(p => p.grade === "A").length;
    const total = group.length;
    if (aPlusCount / total > 0.3) return "A+";
    if ((aPlusCount + aCount) / total > 0.4) return "A";
    if ((aPlusCount + aCount) / total > 0.2) return "B";
    if (total >= 3) return "C";
    if (total >= 1) return "D";
    return "F";
  };

  const TABS = [
    { id: "dashboard", label: "🧠 Dashboard" },
    { id: "people", label: "People", badge: people.length },
    { id: "geo", label: "Geo Intel" },
    { id: "vendors", label: "Vendors", badge: vendors.length },
    { id: "opportunities", label: "Opportunities", badge: opportunities.length },
  ];

  if (loading) return (
    <div style={{ background: "#09090e", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
      <CFLogo size={52} />
      <div style={{ color: "#1db954", fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700 }}>Loading ClientFlow...</div>
    </div>
  );

  return (
    <div style={{ background: "#09090e", minHeight: "100vh", color: "#f0eee8", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", fontSize: 14 }}>

      {/* HEADER */}
      <div style={{ background: "#0d0d14", borderBottom: "1px solid #1a1a24", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "#040d07", border: "1px solid #1db95428", display: "flex", alignItems: "center", justifyContent: "center" }}><CFLogo size={22} /></div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: -0.5 }}><span style={{ color: "#f0eee8" }}>Client</span><span style={{ color: "#1db954" }}>Flow</span></div>
                {editingOffice
                  ? <input autoFocus value={office} onChange={e => setOffice(e.target.value)} onBlur={() => setEditingOffice(false)} onKeyDown={e => e.key === "Enter" && setEditingOffice(false)} placeholder="Your office/brokerage" style={{ fontSize: 10, background: "transparent", border: "none", borderBottom: "1px solid #1db95460", color: "#1db954", outline: "none", width: 180, padding: "1px 0", fontFamily: "inherit" }} />
                  : <div onClick={() => setEditingOffice(true)} style={{ fontSize: 10, color: office ? "#1db95480" : "#33333f", letterSpacing: 0.8, cursor: "pointer", textTransform: "uppercase" }}>{office || "+ Add your office"}</div>
                }
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={gradeAll} style={{ background: "#1db95415", border: "1px solid #1db95435", color: "#1db954", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✨ Grade All</button>
              <button onClick={() => setShowAdd(true)} style={{ ...btn("#1db954", "#09090e") }}>+ Add Contact</button>
            </div>
          </div>
          <div style={{ display: "flex", overflowX: "auto", gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #1db954" : "2px solid transparent", color: tab === t.id ? "#1db954" : "#8888a0", padding: "8px 14px", cursor: "pointer", fontWeight: tab === t.id ? 700 : 400, fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                {t.label}
                {t.badge > 0 && <span style={{ background: "#1db954", color: "#09090e", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 900 }}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {toast && <div style={{ position: "fixed", top: 65, right: 14, background: toast.type === "success" ? "#4eca8b" : "#e05555", color: "#fff", padding: "9px 16px", borderRadius: 10, fontWeight: 700, zIndex: 999, fontSize: 13 }}>{toast.msg}</div>}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 14px" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>What Should I Do Right Now?</div>
              <div style={{ color: "#8888a0", fontSize: 13, marginTop: 2 }}>Your real estate money engine</div>
            </div>
            <button onClick={buildActionPlan} style={{ ...btn("linear-gradient(135deg,#1db954,#17a349)", "#fff") }}>{actionLoading ? "Thinking..." : "⚡ Generate Plan"}</button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 10, marginBottom: 20 }}>
            {GRADES.map(g => {
              const count = people.filter(p => p.grade === g).length;
              return <div key={g} style={{ background: "#111118", borderRadius: 12, border: `1px solid ${GRADE_COLOR[g]}25`, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: GRADE_COLOR[g] }}>{count}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: GRADE_COLOR[g] }}>{g}</div>
                <div style={{ fontSize: 10, color: "#55556a" }}>{GRADE_LABEL[g]}</div>
              </div>;
            })}
          </div>

          {/* CALL NOW — A+ only */}
          {aPlus.length > 0 && <div style={{ background: "#1db95412", border: "1px solid #1db95430", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#1db954", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>🔥 CALL NOW — A+ CONTACTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aPlus.map(p => (
                <div key={p.id} style={{ background: "#0d0d14", borderRadius: 10, padding: "11px 13px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={p.name} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#8888a0" }}>{p.type} · {p.city}{p.state ? `, ${p.state}` : ""}</div>
                    {p.next_action && <div style={{ fontSize: 12, color: "#1db954", marginTop: 2 }}>→ {p.next_action}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <a href={`tel:${p.phone}`} style={{ background: "#1db954", color: "#09090e", borderRadius: 8, padding: "7px 13px", fontWeight: 800, textDecoration: "none", fontSize: 12 }}>📞 Call</a>
                    <a href={`sms:${p.phone}`} style={{ background: "#5b9cf622", color: "#5b9cf6", border: "1px solid #5b9cf640", borderRadius: 8, padding: "7px 13px", fontWeight: 800, textDecoration: "none", fontSize: 12 }}>💬 Text</a>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* AI Action Plan */}
          {!actionPlan && !actionLoading && <div style={{ textAlign: "center", padding: "40px 20px", background: "#111118", borderRadius: 16, border: "1px dashed #2e2e3e" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧠</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Your AI advisor is ready</div>
            <div style={{ color: "#8888a0", fontSize: 13 }}>Tap Generate Plan for your personalized daily action list.</div>
          </div>}
          {actionLoading && <div style={{ textAlign: "center", padding: 40, color: "#8888a0" }}>⚡ Analyzing your pipeline...</div>}
          {actionPlan && <div>
            {actionPlan.motivationalNote && <div style={{ background: "#1db95415", border: "1px solid #1db95430", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 14, color: "#1db954", fontStyle: "italic" }}>"{actionPlan.motivationalNote}"</div>}
            {actionPlan.moneyInsight && <div style={{ background: "#c8a96e18", border: "1px solid #c8a96e30", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}><div style={{ fontSize: 11, color: "#c8a96e", fontWeight: 700, marginBottom: 4 }}>💰 MONEY INSIGHT</div><div style={{ fontSize: 14 }}>{actionPlan.moneyInsight}</div></div>}
            {actionPlan.todayGoal && <div style={{ background: "#111118", borderRadius: 12, padding: "12px 16px", marginBottom: 14, border: "1px solid #1e1e28" }}><div style={{ fontSize: 11, color: "#1db954", fontWeight: 700, marginBottom: 4 }}>TODAY'S GOAL</div><div style={{ fontSize: 14, fontWeight: 700 }}>{actionPlan.todayGoal}</div></div>}
            {actionPlan.callNow?.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {actionPlan.callNow.map((a, i) => (
                <div key={i} style={{ background: "#111118", borderRadius: 12, border: "1px solid #1e1e28", padding: "13px 15px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: i === 0 ? "#1db954" : "#1e1e28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: i === 0 ? "#09090e" : "#8888a0", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{a.action}</div>{a.name && <div style={{ fontSize: 12, color: "#1db954" }}>→ {a.name}</div>}<div style={{ fontSize: 12, color: "#8888a0", marginTop: 2 }}>{a.why}</div></div>
                </div>
              ))}
            </div>}
          </div>}
        </div>}

        {/* ── PEOPLE ── */}
        {tab === "people" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>People</div>
            <button onClick={() => setShowAdd(true)} style={{ ...btn("#1db954", "#09090e") }}>+ Add Contact</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, city, ZIP…" style={{ flex: 1, minWidth: 160, background: "#111118", border: "1px solid #1e1e28", borderRadius: 8, padding: "8px 12px", color: "#f0eee8", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
            {["All", ...GRADES].map(g => <button key={g} onClick={() => setFilterGrade(g)} style={{ background: filterGrade === g ? (GRADE_COLOR[g] || "#1db954") + "22" : "#111118", color: filterGrade === g ? (GRADE_COLOR[g] || "#1db954") : "#8888a0", border: `1px solid ${filterGrade === g ? (GRADE_COLOR[g] || "#1db954") + "55" : "#1e1e28"}`, borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>{g}</button>)}
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ background: "#111118", border: "1px solid #1e1e28", borderRadius: 8, padding: "7px 10px", color: "#f0eee8", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
              <option value="All">All Types</option>
              {LEAD_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ background: "#111118", border: "1px solid #1e1e28", borderRadius: 8, padding: "7px 10px", color: "#f0eee8", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
              {allCities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ color: "#55556a", fontSize: 12, marginBottom: 9 }}>{filteredPeople.length} contacts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredPeople.length === 0 && <Empty icon="👥" msg="No contacts yet. Tap + Add Contact." />}
            {filteredPeople.map(p => (
              <div key={p.id} onClick={() => setSelected(p)} style={{ background: "#111118", borderRadius: 13, border: `1px solid ${GRADE_COLOR[p.grade] || "#1e1e28"}22`, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <GradeBadge grade={p.grade} size="lg" />
                <Avatar name={p.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#8888a0", marginTop: 1 }}>{p.type} · {p.city}{p.state ? `, ${p.state}` : ""}{p.zip ? ` ${p.zip}` : ""}</div>
                  {p.next_action && <div style={{ fontSize: 12, color: "#1db954", marginTop: 2 }}>→ {p.next_action}{p.next_action_due ? ` · ${p.next_action_due}` : ""}</div>}
                  {p.grade_reason && <div style={{ fontSize: 11, color: "#55556a", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.grade_reason}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => gradePerson(p)} style={{ background: "#1db95415", border: "1px solid #1db95430", color: "#1db954", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{gradingId === p.id ? "…" : "✨ Grade"}</button>
                  <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()} style={{ background: "#4eca8b22", color: "#4eca8b", border: "1px solid #4eca8b40", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none", display: "block" }}>📞</a>
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* ── GEO INTEL ── */}
        {tab === "geo" && <div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Geo Intelligence</div>
          <div style={{ color: "#8888a0", fontSize: 13, marginBottom: 18 }}>Grade-based activity map · City → ZIP → Neighborhood</div>
          {Object.keys(geoData).length === 0 && <Empty icon="📍" msg="Add contacts with city and ZIP to see geo intel" />}

          {/* Geo insights */}
          {Object.keys(geoData).length > 0 && (() => {
            const zoneGrades = Object.entries(geoData).flatMap(([city, data]) =>
              Object.entries(data.zip).map(([zip, group]) => ({ city, zip, grade: getZoneGrade(group), count: group.length }))
            );
            const topZones = zoneGrades.filter(z => ["A+", "A"].includes(z.grade));
            const weakZones = zoneGrades.filter(z => ["D", "F"].includes(z.grade));
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginBottom: 20 }}>
                {topZones.length > 0 && <div style={{ background: "#1db95415", border: "1px solid #1db95430", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#1db954", fontWeight: 700, marginBottom: 8 }}>🔥 YOUR HOTTEST ZONES</div>
                  {topZones.map((z, i) => <div key={i} style={{ fontSize: 13, color: "#f0eee8", marginBottom: 3 }}><GradeBadge grade={z.grade} size="sm" /> {z.city} · {z.zip} <span style={{ color: "#55556a" }}>({z.count} contacts)</span></div>)}
                </div>}
                {weakZones.length > 0 && <div style={{ background: "#e0555515", border: "1px solid #e0555530", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#e05555", fontWeight: 700, marginBottom: 8 }}>⚠ UNDERPERFORMING ZONES</div>
                  {weakZones.map((z, i) => <div key={i} style={{ fontSize: 13, color: "#f0eee8", marginBottom: 3 }}><GradeBadge grade={z.grade} size="sm" /> {z.city} · {z.zip} <span style={{ color: "#55556a" }}>({z.count} contacts)</span></div>)}
                </div>}
              </div>
            );
          })()}

          {Object.entries(geoData).sort(([a], [b]) => a.localeCompare(b)).map(([city, data]) => {
            const zoneGrade = getZoneGrade(data.people);
            return (
              <div key={city} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #1a1a24" }}>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>{city}</div>
                  <GradeBadge grade={zoneGrade} size="sm" />
                  <div style={{ fontSize: 12, color: "#55556a" }}>{data.people.length} contacts</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                  {Object.entries(data.zip).sort(([a], [b]) => a.localeCompare(b)).map(([zip, group]) => {
                    const zg = getZoneGrade(group);
                    const c = GRADE_COLOR[zg];
                    return (
                      <div key={zip} style={{ background: "#111118", borderRadius: 12, border: `1px solid ${c}30`, padding: "12px 13px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{zip}</div>
                          <GradeBadge grade={zg} size="sm" />
                        </div>
                        <div style={{ fontSize: 11, color: "#55556a", marginBottom: 4 }}>{group.length} contacts</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {GRADES.filter(g => group.some(p => p.grade === g)).map(g => (
                            <span key={g} style={{ background: GRADE_COLOR[g] + "20", color: GRADE_COLOR[g], borderRadius: 20, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{group.filter(p => p.grade === g).length} {g}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>}

        {/* ── VENDORS ── */}
        {tab === "vendors" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div><div style={{ fontSize: 20, fontWeight: 900 }}>Vendors</div><div style={{ color: "#8888a0", fontSize: 13, marginTop: 2 }}>Your trusted service providers</div></div>
            <button onClick={() => setShowAddVendor(true)} style={{ ...btn("#c8a96e", "#09090e") }}>+ Add Vendor</button>
          </div>
          {vendors.length === 0 && <Empty icon="🔧" msg="No vendors yet. Tap + Add Vendor." />}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vendors.map(v => (
              <div key={v.id} onClick={() => setSelectedVendor(v)} style={{ background: "#111118", borderRadius: 13, border: `1px solid ${GRADE_COLOR[v.grade] || "#1e1e28"}22`, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <GradeBadge grade={v.grade} size="lg" />
                <Avatar name={v.name} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: "#8888a0" }}>{v.vendor_type} · {v.city}{v.state ? `, ${v.state}` : ""}</div>
                  {v.phone && <div style={{ fontSize: 12, color: "#55556a" }}>{v.phone}</div>}
                </div>
                <a href={`tel:${v.phone}`} onClick={e => e.stopPropagation()} style={{ background: "#4eca8b22", color: "#4eca8b", border: "1px solid #4eca8b40", borderRadius: 8, padding: "7px 13px", fontWeight: 800, textDecoration: "none", fontSize: 13 }}>📞</a>
              </div>
            ))}
          </div>
        </div>}

        {/* ── OPPORTUNITIES ── */}
        {tab === "opportunities" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div><div style={{ fontSize: 20, fontWeight: 900 }}>Opportunities</div><div style={{ color: "#8888a0", fontSize: 13, marginTop: 2 }}>Deals, properties & investment plays</div></div>
            <button onClick={() => setShowAddOpp(true)} style={{ ...btn("#f5a623", "#09090e") }}>+ Add Opportunity</button>
          </div>
          {opportunities.length === 0 && <Empty icon="💡" msg="No opportunities yet. Tap + Add Opportunity." />}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opportunities.sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade)).map(o => (
              <div key={o.id} onClick={() => setSelectedOpp(o)} style={{ background: "#111118", borderRadius: 13, border: `1px solid ${GRADE_COLOR[o.grade] || "#1e1e28"}22`, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <GradeBadge grade={o.grade} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: "#8888a0" }}>{o.type} · {o.city}{o.state ? `, ${o.state}` : ""}{o.zip ? ` ${o.zip}` : ""}</div>
                  {o.price && <div style={{ fontSize: 13, color: "#c8a96e", fontWeight: 700 }}>{o.price}</div>}
                  {o.next_action && <div style={{ fontSize: 12, color: "#1db954", marginTop: 2 }}>→ {o.next_action}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>}

      </div>

      {/* ── PERSON DETAIL MODAL ── */}
      {selected && <PersonDetail person={selected} activities={getActivities(selected.id)} onClose={() => setSelected(null)} onSave={savePerson} onGrade={() => gradePerson(selected)} onAddActivity={addActivity} grading={gradingId === selected.id} />}

      {/* ── VENDOR DETAIL ── */}
      {selectedVendor && <Modal title={selectedVendor.name} onClose={() => setSelectedVendor(null)} wide>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "#0d0d14", borderRadius: 12, padding: "12px 13px" }}>
          <Avatar name={selectedVendor.name} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedVendor.name}</div>
            <div style={{ fontSize: 13, color: "#8888a0" }}>{selectedVendor.vendor_type}</div>
            <div style={{ fontSize: 12, color: "#55556a" }}>{selectedVendor.city}{selectedVendor.state ? `, ${selectedVendor.state}` : ""} · {selectedVendor.phone}</div>
          </div>
          <GradeBadge grade={selectedVendor.grade} size="lg" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Label>Grade</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GRADES.map(g => <button key={g} onClick={() => setSelectedVendor(p => ({ ...p, grade: g }))} style={{ background: selectedVendor.grade === g ? GRADE_COLOR[g] + "30" : "#16161f", color: selectedVendor.grade === g ? GRADE_COLOR[g] : "#8888a0", border: `1px solid ${selectedVendor.grade === g ? GRADE_COLOR[g] + "60" : "#22222e"}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>{g}</button>)}
          </div>
        </div>
        <ActivityFeed activities={getActivities(selectedVendor.id)} onAdd={addActivity} personId={selectedVendor.id} personTable="vendors" />
        <button onClick={async () => { try { await db.update("vendors", { grade: selectedVendor.grade }, { id: selectedVendor.id }); } catch { } setVendors(p => p.map(x => x.id === selectedVendor.id ? selectedVendor : x)); setSelectedVendor(null); showToast("Saved ✓"); }} style={{ ...btn("#1db954", "#09090e"), width: "100%", marginTop: 14 }}>Save ✓</button>
      </Modal>}

      {/* ── OPPORTUNITY DETAIL ── */}
      {selectedOpp && <Modal title={selectedOpp.title} onClose={() => setSelectedOpp(null)} wide>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "#0d0d14", borderRadius: 12, padding: "12px 13px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e1e28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>💡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{selectedOpp.title}</div>
            <div style={{ fontSize: 12, color: "#8888a0" }}>{selectedOpp.type} · {selectedOpp.city}{selectedOpp.state ? `, ${selectedOpp.state}` : ""} {selectedOpp.zip}</div>
            {selectedOpp.price && <div style={{ fontSize: 14, color: "#c8a96e", fontWeight: 700 }}>{selectedOpp.price}</div>}
          </div>
          <GradeBadge grade={selectedOpp.grade} size="lg" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Label>Grade</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GRADES.map(g => <button key={g} onClick={() => setSelectedOpp(p => ({ ...p, grade: g }))} style={{ background: selectedOpp.grade === g ? GRADE_COLOR[g] + "30" : "#16161f", color: selectedOpp.grade === g ? GRADE_COLOR[g] : "#8888a0", border: `1px solid ${selectedOpp.grade === g ? GRADE_COLOR[g] + "60" : "#22222e"}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>{g}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}><Label>Next Action</Label><input value={selectedOpp.next_action || ""} onChange={e => setSelectedOpp(p => ({ ...p, next_action: e.target.value }))} style={iS} /></div>
        <div style={{ marginBottom: 14 }}><Label>Due Date</Label><input type="date" value={selectedOpp.next_action_due || ""} onChange={e => setSelectedOpp(p => ({ ...p, next_action_due: e.target.value }))} style={iS} /></div>
        <ActivityFeed activities={getActivities(selectedOpp.id)} onAdd={addActivity} personId={selectedOpp.id} personTable="opportunities" />
        <button onClick={async () => { try { await db.update("opportunities", { grade: selectedOpp.grade, next_action: selectedOpp.next_action, next_action_due: selectedOpp.next_action_due }, { id: selectedOpp.id }); } catch { } setOpportunities(p => p.map(x => x.id === selectedOpp.id ? selectedOpp : x)); setSelectedOpp(null); showToast("Saved ✓"); }} style={{ ...btn("#f5a623", "#09090e"), width: "100%", marginTop: 14 }}>Save ✓</button>
      </Modal>}

      {/* ── ADD CONTACT ── */}
      {showAdd && <Modal title="Add Contact" onClose={() => setShowAdd(false)} wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><Label>Full Name *</Label><input value={newPerson.name} onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))} style={iS} /></div>
          <div><Label>Phone *</Label><input value={newPerson.phone} onChange={e => setNewPerson(p => ({ ...p, phone: e.target.value }))} style={iS} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Label>Email</Label><input value={newPerson.email} onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))} style={iS} /></div>
          <div><Label>Type</Label><select value={newPerson.type} onChange={e => setNewPerson(p => ({ ...p, type: e.target.value }))} style={iS}>{LEAD_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><Label>Initial Grade</Label><select value={newPerson.grade} onChange={e => setNewPerson(p => ({ ...p, grade: e.target.value }))} style={iS}>{GRADES.map(g => <option key={g}>{g}</option>)}</select></div>
          <div style={{ gridColumn: "1 / -1" }}>
            <AddressBlock data={newPerson} onChange={(k, v) => setNewPerson(p => ({ ...p, [k]: v }))} />
          </div>
          <div><Label>Birthday 🎂</Label><input type="date" value={newPerson.birthday} onChange={e => setNewPerson(p => ({ ...p, birthday: e.target.value }))} style={iS} /></div>
          <div><Label>Date Added</Label><input type="date" value={newPerson.date_added} onChange={e => setNewPerson(p => ({ ...p, date_added: e.target.value }))} style={iS} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Label>Next Action</Label><input value={newPerson.next_action} onChange={e => setNewPerson(p => ({ ...p, next_action: e.target.value }))} placeholder="What needs to happen next?" style={iS} /></div>
          <div><Label>Action Due Date</Label><input type="date" value={newPerson.next_action_due} onChange={e => setNewPerson(p => ({ ...p, next_action_due: e.target.value }))} style={iS} /></div>
        </div>
        <button onClick={addPerson} disabled={!newPerson.name || !newPerson.phone} style={{ ...btn(newPerson.name && newPerson.phone ? "#1db954" : "#22222e", newPerson.name && newPerson.phone ? "#09090e" : "#55556a"), width: "100%", marginTop: 16, opacity: newPerson.name && newPerson.phone ? 1 : 0.6 }}>Add Contact</button>
      </Modal>}

      {/* ── ADD VENDOR ── */}
      {showAddVendor && <Modal title="Add Vendor" onClose={() => setShowAddVendor(false)} wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><Label>Name *</Label><input value={newVendor.name} onChange={e => setNewVendor(p => ({ ...p, name: e.target.value }))} style={iS} /></div>
          <div><Label>Phone</Label><input value={newVendor.phone} onChange={e => setNewVendor(p => ({ ...p, phone: e.target.value }))} style={iS} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Label>Email</Label><input value={newVendor.email} onChange={e => setNewVendor(p => ({ ...p, email: e.target.value }))} style={iS} /></div>
          <div><Label>Type</Label><select value={newVendor.vendor_type} onChange={e => setNewVendor(p => ({ ...p, vendor_type: e.target.value }))} style={iS}>{VENDOR_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><Label>Grade</Label><select value={newVendor.grade} onChange={e => setNewVendor(p => ({ ...p, grade: e.target.value }))} style={iS}>{GRADES.map(g => <option key={g}>{g}</option>)}</select></div>
          <div style={{ gridColumn: "1 / -1" }}>
            <AddressBlock data={newVendor} onChange={(k, v) => setNewVendor(p => ({ ...p, [k]: v }))} />
          </div>
        </div>
        <button onClick={addVendor} disabled={!newVendor.name} style={{ ...btn(newVendor.name ? "#c8a96e" : "#22222e", newVendor.name ? "#09090e" : "#55556a"), width: "100%", marginTop: 16 }}>Add Vendor</button>
      </Modal>}

      {/* ── ADD OPPORTUNITY ── */}
      {showAddOpp && <Modal title="Add Opportunity" onClose={() => setShowAddOpp(false)} wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><Label>Title *</Label><input value={newOpp.title} onChange={e => setNewOpp(p => ({ ...p, title: e.target.value }))} placeholder="e.g. 2-unit Multifamily on Livernois" style={iS} /></div>
          <div><Label>Type</Label><select value={newOpp.type} onChange={e => setNewOpp(p => ({ ...p, type: e.target.value }))} style={iS}>{["Investment Property", "New Build", "Apartment", "Rental", "Flip", "Other"].map(t => <option key={t}>{t}</option>)}</select></div>
          <div><Label>Grade</Label><select value={newOpp.grade} onChange={e => setNewOpp(p => ({ ...p, grade: e.target.value }))} style={iS}>{GRADES.map(g => <option key={g}>{g}</option>)}</select></div>
          <div><Label>Price</Label><input value={newOpp.price} onChange={e => setNewOpp(p => ({ ...p, price: e.target.value }))} placeholder="$000,000" style={iS} /></div>
          <div style={{ gridColumn: "1 / -1" }}>
            <AddressBlock data={newOpp} onChange={(k, v) => setNewOpp(p => ({ ...p, [k]: v }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}><Label>Next Action</Label><input value={newOpp.next_action} onChange={e => setNewOpp(p => ({ ...p, next_action: e.target.value }))} style={iS} /></div>
          <div><Label>Action Due Date</Label><input type="date" value={newOpp.next_action_due} onChange={e => setNewOpp(p => ({ ...p, next_action_due: e.target.value }))} style={iS} /></div>
        </div>
        <button onClick={addOpp} disabled={!newOpp.title} style={{ ...btn(newOpp.title ? "#f5a623" : "#22222e", newOpp.title ? "#09090e" : "#55556a"), width: "100%", marginTop: 16 }}>Add Opportunity</button>
      </Modal>}

    </div>
  );
}

// ─── PERSON DETAIL ────────────────────────────────────────────────────────────
function PersonDetail({ person, activities, onClose, onSave, onGrade, onAddActivity, grading }) {
  const [p, setP] = useState(person);
  const [detailTab, setDetailTab] = useState("info");
  const rel = p.relationship || {};
  const setRel = (k, v) => setP(x => ({ ...x, relationship: { ...x.relationship, [k]: v } }));

  const TEXT_TEMPLATES = {
    checkin: `Hey ${p.name.split(" ")[0]}! Just wanted to check in and see how everything's going. No agenda — just thinking about you 😊`,
    market: `Hey ${p.name.split(" ")[0]}, the market has been moving fast lately. Some areas are seeing multiple offers. Happy to chat if you want the full picture!`,
    reengage: `Hey ${p.name.split(" ")[0]}, I know life gets busy. Just wanted to reach out one more time — no pressure. I'm here whenever the timing is right 🙌`,
    birthday: `Happy Birthday ${p.name.split(" ")[0]}!! 🎉 Hope your day is absolutely amazing!`,
  };

  return (
    <Modal title={p.name} onClose={onClose} wide>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, background: "#0d0d14", borderRadius: 12, padding: "12px 13px" }}>
        <Avatar name={p.name} size={50} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
          <div style={{ fontSize: 13, color: "#8888a0" }}>{p.phone}{p.email ? ` · ${p.email}` : ""}</div>
          <div style={{ fontSize: 12, color: "#55556a" }}>{p.address ? `${p.address}, ` : ""}{p.city}{p.state ? `, ${p.state}` : ""} {p.zip}</div>
          {p.birthday && <div style={{ fontSize: 12, color: "#e05555" }}>🎂 {p.birthday}</div>}
          {p.date_added && <div style={{ fontSize: 11, color: "#55556a" }}>Added: {p.date_added}</div>}
        </div>
        <GradeBadge grade={p.grade} size="lg" />
      </div>

      {/* Grade reason */}
      {p.grade_reason && <div style={{ background: "#0d0d14", borderRadius: 10, padding: "9px 12px", marginBottom: 12, border: `1px solid ${GRADE_COLOR[p.grade]}25`, fontSize: 13, color: "#8888a0" }}>AI: {p.grade_reason}</div>}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 14 }}>
        <a href={`tel:${p.phone}`} style={{ background: "#1db95422", color: "#1db954", border: "1px solid #1db95440", borderRadius: 9, padding: "9px 4px", fontWeight: 800, textDecoration: "none", textAlign: "center", fontSize: 13 }}>📞 Call</a>
        <a href={`sms:${p.phone}`} style={{ background: "#5b9cf622", color: "#5b9cf6", border: "1px solid #5b9cf640", borderRadius: 9, padding: "9px 4px", fontWeight: 800, textDecoration: "none", textAlign: "center", fontSize: 13 }}>💬 Text</a>
        <button onClick={onGrade} style={{ background: "#c8a96e22", color: "#c8a96e", border: "1px solid #c8a96e40", borderRadius: 9, padding: 9, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>{grading ? "…" : "✨ Grade"}</button>
        <button onClick={() => onSave(p)} style={{ background: "#1db954", color: "#09090e", border: "none", borderRadius: 9, padding: 9, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Save ✓</button>
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid #1e1e28" }}>
        {[["info", "Info"], ["intel", "Relationship Intel"], ["activity", "Activity"], ["text", "Text Templates"]].map(([id, label]) => (
          <button key={id} onClick={() => setDetailTab(id)} style={{ background: "none", border: "none", borderBottom: detailTab === id ? "2px solid #1db954" : "2px solid transparent", color: detailTab === id ? "#1db954" : "#8888a0", padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: detailTab === id ? 700 : 400, fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
        ))}
      </div>

      {/* INFO */}
      {detailTab === "info" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><Label>Type</Label><select value={p.type} onChange={e => setP(x => ({ ...x, type: e.target.value }))} style={iS}>{LEAD_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><Label>Grade</Label><select value={p.grade} onChange={e => setP(x => ({ ...x, grade: e.target.value }))} style={iS}>{GRADES.map(g => <option key={g}>{g} — {GRADE_LABEL[g]}</option>)}</select></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <AddressBlock data={p} onChange={(k, v) => setP(x => ({ ...x, [k]: v }))} />
        </div>
        <div><Label>Birthday 🎂</Label><input type="date" value={p.birthday || ""} onChange={e => setP(x => ({ ...x, birthday: e.target.value }))} style={iS} /></div>
        <div><Label>Date Added</Label><input type="date" value={p.date_added || ""} onChange={e => setP(x => ({ ...x, date_added: e.target.value }))} style={iS} /></div>
        <div style={{ gridColumn: "1 / -1" }}><Label>Next Action</Label><input value={p.next_action || ""} onChange={e => setP(x => ({ ...x, next_action: e.target.value }))} style={iS} /></div>
        <div><Label>Action Due Date</Label><input type="date" value={p.next_action_due || ""} onChange={e => setP(x => ({ ...x, next_action_due: e.target.value }))} style={iS} /></div>
      </div>}

      {/* RELATIONSHIP INTEL */}
      {detailTab === "intel" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["motivation", "Motivation (why they move)"], ["pain_points", "Pain Points"], ["goals", "Goals"], ["must_haves", "Must-Haves"], ["deal_breakers", "Deal Breakers"], ["budget", "Budget Range"], ["timeline", "Timeline"]].map(([k, lbl]) => (
          <div key={k} style={{ gridColumn: k === "motivation" || k === "goals" ? "1 / -1" : "auto" }}>
            <Label>{lbl}</Label>
            <input value={rel[k] || ""} onChange={e => setRel(k, e.target.value)} style={iS} />
          </div>
        ))}
        {p.type === "Past Client" && <>
          <div><Label>Referral Grade</Label><select value={rel.referral_grade || "C"} onChange={e => setRel("referral_grade", e.target.value)} style={iS}>{GRADES.map(g => <option key={g}>{g}</option>)}</select></div>
          <div><Label>Anniversary Date</Label><input type="date" value={rel.anniversary || ""} onChange={e => setRel("anniversary", e.target.value)} style={iS} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Label>Life Events</Label><input value={rel.life_events || ""} onChange={e => setRel("life_events", e.target.value)} placeholder="Baby, marriage, job change, divorce..." style={iS} /></div>
        </>}
      </div>}

      {/* ACTIVITY */}
      {detailTab === "activity" && <ActivityFeed activities={activities} onAdd={onAddActivity} personId={p.id} personTable="people" />}

      {/* TEXT TEMPLATES */}
      {detailTab === "text" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(TEXT_TEMPLATES).map(([key, text]) => (
          <div key={key} style={{ background: "#0d0d14", borderRadius: 10, padding: "13px 14px", border: "1px solid #1e1e28" }}>
            <div style={{ fontSize: 11, color: "#1db954", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>{key === "checkin" ? "Check-in" : key === "market" ? "Market Update" : key === "reengage" ? "Re-engage" : "Birthday 🎂"}</div>
            <div style={{ fontSize: 13, color: "#f0eee8", lineHeight: 1.6, marginBottom: 10 }}>{text}</div>
            <a href={`sms:${p.phone}?body=${encodeURIComponent(text)}`} style={{ background: "#5b9cf6", color: "#fff", borderRadius: 8, padding: "7px 14px", fontWeight: 800, textDecoration: "none", fontSize: 12, display: "inline-block" }}>Send →</a>
          </div>
        ))}
      </div>}

    </Modal>
  );
}
