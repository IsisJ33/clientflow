import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ─── SUPABASE CONFIG — replace these two values after Supabase setup ──────────
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const daysSince = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
const today = () => new Date().toISOString().split("T")[0];
const statusColor = (s) => s === "Hot" ? "#e05555" : s === "Warm" ? "#f5a623" : "#5b9cf6";
const scoreColor = (n) => n == null ? "#55556a" : n >= 75 ? "#e05555" : n >= 50 ? "#f5a623" : n >= 25 ? "#5b9cf6" : "#55556a";
const scoreLabel = (n) => n == null ? "Unscored" : n >= 75 ? "🔥 Call Now" : n >= 50 ? "⚡ This Week" : n >= 25 ? "🧊 Nurture" : "❄ Re-engage";
const INV_PIPELINE = ["Prospect","Active","Reviewing Deals","Funding","Repeat Investor","Inactive"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

async function callClaude(system, user, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, system, messages:[{role:"user",content:user}] })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function CFLogo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs><linearGradient id="cfg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#1db954"/><stop offset="100%" stopColor="#17a349"/></linearGradient></defs>
      <path d="M46 15C46 15 30 10 20 22C11 33 15 49 30 51C40 53 48 47 48 47" stroke="url(#cfg)" strokeWidth="3.8" strokeLinecap="round" fill="none"/>
      <circle cx="46" cy="15" r="3" fill="#1db954"/>
      <circle cx="48" cy="47" r="3" fill="#17a349"/>
      <line x1="22" y1="24" x2="22" y2="42" stroke="#1db954" strokeWidth="2.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="22" y1="24" x2="33" y2="24" stroke="#1db954" strokeWidth="2.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="22" y1="33" x2="30" y2="33" stroke="#1db954" strokeWidth="2.2" strokeLinecap="round" opacity="0.38"/>
    </svg>
  );
}

function Avatar({ name, size=36 }) {
  const init = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const hue = name.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return <div style={{width:size,height:size,borderRadius:"50%",background:`hsl(${hue},38%,22%)`,border:`2px solid hsl(${hue},40%,35%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.34,fontWeight:900,color:`hsl(${hue},65%,72%)`,flexShrink:0}}>{init}</div>;
}
function Pill({label,color}) { return <span style={{background:color+"20",color,border:`1px solid ${color}40`,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{label}</span>; }
function Label({children}) { return <div style={{fontSize:11,color:"#55556a",fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",marginBottom:6}}>{children}</div>; }
function Empty({icon,msg}) { return <div style={{textAlign:"center",padding:"50px 20px",color:"#55556a"}}><div style={{fontSize:32,marginBottom:10}}>{icon}</div><div style={{fontWeight:700}}>{msg}</div></div>; }
function FPill({label,active,onClick,color}) { return <button onClick={onClick} style={{background:active?color+"18":"#111118",color:active?color:"#8888a0",border:`1px solid ${active?color+"45":"#1e1e28"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>{label}</button>; }
const iS = {width:"100%",background:"#16161f",border:"1px solid #22222e",borderRadius:8,padding:"9px 11px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,boxSizing:"border-box",outline:"none"};
const sS = {background:"#111118",border:"1px solid #1e1e28",borderRadius:8,padding:"7px 10px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,cursor:"pointer"};
const iB = (c) => ({background:c+"15",border:`1px solid ${c}28`,color:c,borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"});

// City/State/ZIP grouped input
function AddressFields({ data, onChange, prefix="" }) {
  return (
    <>
      <div style={{gridColumn:"1 / -1"}}>
        <Label>Street Address</Label>
        <input value={data[prefix+"address"]||""} onChange={e=>onChange(prefix+"address",e.target.value)} style={iS}/>
      </div>
      <div>
        <Label>City</Label>
        <input value={data[prefix+"city"]||""} onChange={e=>onChange(prefix+"city",e.target.value)} style={iS}/>
      </div>
      <div>
        <Label>State</Label>
        <select value={data[prefix+"state"]||"MI"} onChange={e=>onChange(prefix+"state",e.target.value)} style={iS}>
          {US_STATES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <Label>ZIP Code</Label>
        <input value={data[prefix+"zip"]||""} onChange={e=>onChange(prefix+"zip",e.target.value)} style={iS}/>
      </div>
    </>
  );
}

function ScoreRing({score}) {
  if(score==null) return <div style={{width:42,height:42,borderRadius:"50%",border:"2px dashed #2e2e3e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#55556a",flexShrink:0}}>?</div>;
  const c=scoreColor(score),r=17,circ=2*Math.PI*r;
  return <div style={{position:"relative",width:42,height:42,flexShrink:0}}><svg width="42" height="42" style={{transform:"rotate(-90deg)"}}><circle cx="21" cy="21" r={r} fill="none" stroke="#1e1e28" strokeWidth="3"/><circle cx="21" cy="21" r={r} fill="none" stroke={c} strokeWidth="3" strokeDasharray={circ} strokeDashoffset={circ*(1-score/100)} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:c}}>{score}</div></div>;
}

function Modal({title,onClose,children,wide}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(6,6,10,0.94)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:"#111118",border:"1px solid #1e1e28",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:wide?680:530,maxHeight:"93vh",overflowY:"auto",padding:"22px 20px 32px",borderBottom:"none"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontWeight:900,fontSize:16}}>{title}</div>
        <button onClick={onClose} style={{background:"#1e1e28",border:"none",color:"#8888a0",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

const TEXT_TEMPLATES = {
  checkin:(n)=>`Hey ${n}! Just wanted to check in and see how everything's going. No agenda at all — just thinking about you 😊`,
  market:(n)=>`Hey ${n}, the market has been moving fast lately. Some areas are seeing multiple offers again. Happy to chat if you want the full picture!`,
  reengage:(n)=>`Hey ${n}, I know life gets busy and I totally get it. Just wanted to reach out one more time — no pressure. I'm here whenever the timing is right 🙌`,
  birthday:(n)=>`Happy Birthday ${n}!! 🎉 Hope your day is absolutely amazing. Wishing you all the best!`,
  holiday:(n)=>`Hey ${n}! Wishing you and your family a wonderful holiday season. Hope it's full of good people and great moments 🙏`,
};
const VOICEMAIL_TEMPLATES = {
  firstTouch:(n)=>`Hey ${n}, just wanted to reach out real quick. I specialize in this area and I'd love to connect whenever you have a few minutes. No pressure — feel free to call or text me back at your convenience. Talk soon!`,
  followUp:(n)=>`Hey ${n}, just following up from my last message. I know you're busy — totally get it. I'm here whenever the time is right.`,
  expired:(n)=>`Hey ${n}, I noticed your listing recently came off the market and wanted to reach out personally. I've had a lot of success in your area. Give me a call back whenever — no obligation.`,
  fsbo:(n)=>`Hey ${n}, I saw you're selling your home on your own and wanted to reach out as a resource — not to pitch you, just to be helpful. Happy to answer any questions for free. Call or text anytime.`,
  reEngage:(n)=>`Hey ${n}, I know it's been a little while. Just wanted to check in and see if anything has changed. No pressure — I'm still here whenever you're ready.`,
};

// ─── BLANK LEAD TEMPLATE ─────────────────────────────────────────────────────
const blankLead = () => ({name:"",phone:"",email:"",type:"Buyer",status:"Warm",address:"",city:"",state:"MI",zip:"",source:"",birthday:"",dateAdded:today(),notes:""});
const blankInvestor = () => ({name:"",phone:"",email:"",address:"",city:"",state:"MI",zip:"",cashBuyer:false,budgetMin:"",budgetMax:"",propertyTypes:"",preferredAreas:"",riskTolerance:"Moderate",expectedROI:"",timeline:"",dealStructure:"Cash",notes:""});
const blankPastClient = () => ({name:"",phone:"",email:"",address:"",city:"",state:"MI",zip:"",birthday:"",closedDate:"",salePrice:"",propertyType:"",notes:"",referralGiven:false});

export default function ClientFlowCRM() {
  const [leads, setLeads] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [pastClients, setPastClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [office, setOffice] = useState("");
  const [editingOffice, setEditingOffice] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedPastClient, setSelectedPastClient] = useState(null);
  const [textLead, setTextLead] = useState(null);
  const [vmLead, setVmLead] = useState(null);
  const [memoryLead, setMemoryLead] = useState(null);
  const [txLead, setTxLead] = useState(null);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddInvestor, setShowAddInvestor] = useState(false);
  const [showAddPastClient, setShowAddPastClient] = useState(false);
  const [callMode, setCallMode] = useState(false);
  const [callIdx, setCallIdx] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [callOutcome, setCallOutcome] = useState("Voicemail");
  const [opener, setOpener] = useState("");
  const [loadingOpener, setLoadingOpener] = useState(false);
  const [coach, setCoach] = useState(null);
  const [advisor, setAdvisor] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [actionItems, setActionItems] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [invMatch, setInvMatch] = useState(null);
  const [invMatchLoading, setInvMatchLoading] = useState(false);
  const [roiSim, setRoiSim] = useState(null);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [fType, setFType] = useState("All");
  const [fCity, setFCity] = useState("All");
  const [toast, setToast] = useState(null);
  const [scoringId, setScoringId] = useState(null);
  const [newLead, setNewLead] = useState(blankLead());
  const [newInv, setNewInv] = useState(blankInvestor());
  const [newPC, setNewPC] = useState(blankPastClient());
  const fileRef = useRef();

  const todayStr = today();

  // ── SUPABASE LOAD ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [leadsRes, invRes, pcRes] = await Promise.all([
          supabase.from("leads").select("*").order("created_at", {ascending:false}),
          supabase.from("investors").select("*").order("created_at", {ascending:false}),
          supabase.from("past_clients").select("*").order("created_at", {ascending:false}),
        ]);
        if(leadsRes.data) setLeads(leadsRes.data);
        if(invRes.data) setInvestors(invRes.data);
        if(pcRes.data) setPastClients(pcRes.data);
      } catch(e) { console.log("DB not connected yet"); }
      setLoading(false);
    };
    load();
  }, []);

  const showToast = (msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // ── DB HELPERS ──
  const saveLead = async(lead) => {
    const {data} = await supabase.from("leads").insert([lead]).select();
    return data?.[0];
  };
  const updateLeadDB = async(id,patch) => {
    await supabase.from("leads").update(patch).eq("id",id);
    setLeads(p=>p.map(l=>l.id===id?{...l,...patch}:l));
  };
  const saveInvestor = async(inv) => {
    const {data} = await supabase.from("investors").insert([inv]).select();
    return data?.[0];
  };
  const updateInvestorDB = async(id,patch) => {
    await supabase.from("investors").update(patch).eq("id",id);
    setInvestors(p=>p.map(i=>i.id===id?{...i,...patch}:i));
  };
  const savePastClient = async(pc) => {
    const {data} = await supabase.from("past_clients").insert([pc]).select();
    return data?.[0];
  };
  const updatePastClientDB = async(id,patch) => {
    await supabase.from("past_clients").update(patch).eq("id",id);
    setPastClients(p=>p.map(c=>c.id===id?{...c,...patch}:c));
  };

  const activeLeads = leads.filter(l=>!l.dnc);
  const callList = activeLeads.filter(l=>l.next_follow_up<=todayStr).sort((a,b)=>(b.ai_score||0)-(a.ai_score||0));
  const currentCall = callList[callIdx];
  const dncLeads = leads.filter(l=>l.dnc);
  const allCities = ["All",...new Set(activeLeads.map(l=>l.city).filter(Boolean).sort())];
  const transactions = leads.filter(l=>l.transaction);
  const pipeline = {Hot:activeLeads.filter(l=>l.status==="Hot"),Warm:activeLeads.filter(l=>l.status==="Warm"),Cold:activeLeads.filter(l=>l.status==="Cold")};
  const geoData = activeLeads.reduce((acc,l)=>{if(!l.city)return acc;if(!acc[l.city])acc[l.city]={};if(!acc[l.city][l.zip||"No ZIP"])acc[l.city][l.zip||"No ZIP"]=[];acc[l.city][l.zip||"No ZIP"].push(l);return acc;},{});

  const scoreLead = async(lead)=>{
    setScoringId(lead.id);
    try {
      const text=await callClaude("You are a real estate AI scoring leads. Return ONLY valid JSON: {\"score\":0-100,\"reason\":\"1 sentence\",\"priority\":\"Call Now|This Week|Nurture|Re-engage\"}",`Name:${lead.name},Type:${lead.type},Status:${lead.status},City:${lead.city},Calls:${lead.calls||0},Days since contact:${daysSince(lead.last_contact||todayStr)},Notes:"${lead.notes}"`);
      const p=JSON.parse(text.replace(/```json|```/g,"").trim());
      await updateLeadDB(lead.id,{ai_score:p.score,ai_score_reason:p.reason});
    } catch{showToast("Score failed","error");}
    setScoringId(null);
  };
  const scoreAll = async()=>{for(const l of activeLeads.filter(x=>!x.ai_score))await scoreLead(l);showToast("All leads scored ✓");};

  const genOpener = async(lead)=>{
    setLoadingOpener(true);setOpener("");
    try {
      const text=await callClaude("You are helping a real estate agent make cold calls. Write a SHORT warm natural opening (2 sentences max). Conversational, not salesy.",`Lead:${lead.name},Type:${lead.type},Status:${lead.status},Source:${lead.source},City:${lead.city},Notes:"${lead.notes}"`);
      setOpener(text);
    } catch{setOpener(`Hey ${lead.name.split(" ")[0]}, just wanted to reach out real quick...`);}
    setLoadingOpener(false);
  };

  const handleObjection = async(objection,lead)=>{
    setCoach({objection,response:"",loading:true});
    try {
      const text=await callClaude("You are a real estate sales coach. Give a SHORT natural confident response to this objection (2-3 sentences).",`Lead:${lead.name},Type:${lead.type},City:${lead.city}. Objection:"${objection}"`);
      setCoach({objection,response:text,loading:false});
    } catch{setCoach({objection,response:"Acknowledge, empathize, ask one open question.",loading:false});}
  };

  const getAdvisor = async(lead)=>{
    setAdvisor({plan:null,loading:true});
    try {
      const text=await callClaude("You are a real estate follow-up strategist. Return ONLY valid JSON: {\"nextAction\":\"call|text|email\",\"when\":\"e.g. Tomorrow 10am\",\"message\":\"exactly what to say\",\"channel\":\"why\",\"longTerm\":\"30-day strategy\"}",`Lead:${lead.name},Type:${lead.type},Status:${lead.status},Last contact:${lead.last_contact}(${daysSince(lead.last_contact||todayStr)} days ago),Calls:${lead.calls||0},Notes:"${lead.notes}"`);
      setAdvisor({plan:JSON.parse(text.replace(/```json|```/g,"").trim()),loading:false});
    } catch{setAdvisor({plan:null,loading:false});}
  };

  const buildMemory = async(lead)=>{
    setMemoryLead({...lead,building:true});
    try {
      const text=await callClaude("Build a relationship memory profile. Return ONLY valid JSON: {\"personality\":\"string\",\"objections\":\"string\",\"goals\":\"string\",\"budget\":\"string or null\",\"timing\":\"string\",\"style\":\"string\",\"insight\":\"1 sentence\"}",`Lead:${lead.name},Type:${lead.type},Status:${lead.status},Calls:${lead.calls||0},Notes:"${lead.notes}",Source:${lead.source}`);
      const mem=JSON.parse(text.replace(/```json|```/g,"").trim());
      await updateLeadDB(lead.id,{ai_memory:mem});
      setMemoryLead({...lead,ai_memory:mem,building:false});
    } catch{setMemoryLead(l=>({...l,building:false}));}
  };

  const runRevenueEngine = async()=>{
    setRevenueLoading(true);setRevenueData(null);
    try {
      const summary=activeLeads.slice(0,15).map(l=>`${l.name}(${l.type},${l.status},score:${l.ai_score},lastContact:${daysSince(l.last_contact||todayStr)}d,calls:${l.calls||0})`).join("; ");
      const text=await callClaude("You are an autonomous revenue engine for a solo real estate agent. Return ONLY valid JSON: {\"missedMoney\":[{\"issue\":\"string\",\"fix\":\"string\",\"urgency\":\"High|Medium|Low\"}],\"hotOpportunities\":[{\"name\":\"string\",\"reason\":\"string\",\"action\":\"string\"}],\"pipelineWarnings\":[{\"warning\":\"string\",\"detail\":\"string\"}],\"topPriority\":\"1 sentence\",\"weeklyForecast\":\"1 sentence\"}",`Pipeline: ${summary}. Total:${activeLeads.length},Hot:${pipeline.Hot.length},Warm:${pipeline.Warm.length},Cold:${pipeline.Cold.length}.`,1500);
      setRevenueData(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch{showToast("Revenue scan failed","error");}
    setRevenueLoading(false);
  };

  const buildActionPlan = async()=>{
    setActionLoading(true);setActionItems(null);
    try {
      const summary=activeLeads.slice(0,12).map(l=>`${l.name}(${l.type},${l.status},score:${l.ai_score},due:${l.next_follow_up},lastContact:${daysSince(l.last_contact||todayStr)}d)`).join("; ");
      const text=await callClaude("You are an AI executive advisor for a solo real estate agent. Return ONLY valid JSON: {\"actions\":[{\"priority\":1,\"action\":\"string\",\"lead\":\"name or null\",\"why\":\"string\",\"channel\":\"call|text|email|other\",\"timeEst\":\"e.g. 5 min\"}],\"todayGoal\":\"string\",\"motivationalNote\":\"1 encouraging sentence\"}. Max 6 actions.",`Today: ${todayStr}. Due today:${callList.length}. Pipeline: ${summary}.`,1200);
      setActionItems(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch{showToast("Action plan failed","error");}
    setActionLoading(false);
  };

  const matchInvestors = async(dealDesc)=>{
    setInvMatchLoading(true);setInvMatch(null);
    try {
      const invSummary=investors.map(i=>`${i.name}(budget:$${i.budget_min}-$${i.budget_max},types:${i.property_types},areas:${i.preferred_areas},ROI:${i.expected_roi}%,cash:${i.cash_buyer})`).join("; ");
      const text=await callClaude("You are an AI investor matching engine. Return ONLY valid JSON: {\"matches\":[{\"investorName\":\"string\",\"fitScore\":0-100,\"reason\":\"string\",\"action\":\"string\",\"doNotSend\":false}],\"recommendation\":\"string\"}",`Deal: ${dealDesc}. Investors: ${invSummary}.`,1200);
      setInvMatch(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch{showToast("Match failed","error");}
    setInvMatchLoading(false);
  };

  const logCall = async()=>{
    const daysOut=callOutcome==="Callback"?1:callOutcome==="Spoke"?3:callOutcome==="Not Interested"?30:4;
    const nfu=new Date(Date.now()+daysOut*86400000).toISOString().split("T")[0];
    const patch={last_contact:todayStr,calls:(currentCall.calls||0)+1,notes:callNote?`[${todayStr}] ${callOutcome}: ${callNote}\n${currentCall.notes}`:currentCall.notes,next_follow_up:nfu,streak:callOutcome!=="Not Interested"?(currentCall.streak||0)+1:0,ai_score:null};
    await updateLeadDB(currentCall.id,patch);
    setCallNote("");setCallOutcome("Voicemail");setShowLog(false);showToast("Call logged ✓");
    if(callIdx<callList.length-1){setCallIdx(i=>i+1);genOpener(callList[callIdx+1]);setCoach(null);setAdvisor(null);}
    else{setCallMode(false);setCallIdx(0);}
  };

  const addLead = async()=>{
    const lead={...newLead,calls:0,last_contact:todayStr,next_follow_up:todayStr,dnc:false,streak:0,ai_score:null,ai_memory:null,transaction:null};
    try {
      const saved = await saveLead(lead);
      if(saved) setLeads(p=>[saved,...p]);
      else setLeads(p=>[{...lead,id:Date.now()},...p]);
      showToast("Lead saved ✓");
    } catch { setLeads(p=>[{...lead,id:Date.now()},...p]); showToast("Lead added (offline)"); }
    setShowAddLead(false);setNewLead(blankLead());
  };

  const addInvestor = async()=>{
    const inv={name:newInv.name,phone:newInv.phone,email:newInv.email,address:newInv.address,city:newInv.city,state:newInv.state,zip:newInv.zip,cash_buyer:newInv.cashBuyer,budget_min:parseInt(newInv.budgetMin)||0,budget_max:parseInt(newInv.budgetMax)||0,property_types:newInv.propertyTypes,preferred_areas:newInv.preferredAreas,risk_tolerance:newInv.riskTolerance,expected_roi:parseInt(newInv.expectedROI)||0,timeline:newInv.timeline,deal_structure:newInv.dealStructure,notes:newInv.notes,pipeline:"Prospect",last_contact:todayStr,ai_memory:""};
    try {
      const saved=await saveInvestor(inv);
      if(saved) setInvestors(p=>[saved,...p]);
      else setInvestors(p=>[{...inv,id:Date.now()},...p]);
      showToast("Investor saved ✓");
    } catch { setInvestors(p=>[{...inv,id:Date.now()},...p]); showToast("Investor added (offline)"); }
    setShowAddInvestor(false);setNewInv(blankInvestor());
  };

  const addPastClient = async()=>{
    const pc={...newPC};
    try {
      const saved=await savePastClient(pc);
      if(saved) setPastClients(p=>[saved,...p]);
      else setPastClients(p=>[{...pc,id:Date.now()},...p]);
      showToast("Past client saved ✓");
    } catch { setPastClients(p=>[{...pc,id:Date.now()},...p]); showToast("Past client added (offline)"); }
    setShowAddPastClient(false);setNewPC(blankPastClient());
  };

  const filteredLeads = leads.filter(l=>{
    if(tab==="dnc")return l.dnc;if(l.dnc)return false;
    if(fStatus!=="All"&&l.status!==fStatus)return false;if(fType!=="All"&&l.type!==fType)return false;
    if(fCity!=="All"&&l.city!==fCity)return false;
    if(search&&!l.name.toLowerCase().includes(search.toLowerCase())&&!l.phone?.includes(search)&&!l.zip?.includes(search)&&!l.city?.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>(b.ai_score||0)-(a.ai_score||0));

  const TABS=[
    {id:"dashboard",label:"🧠 Dashboard"},
    {id:"today",label:"Today",badge:callList.length,bc:"#e05555"},
    {id:"all",label:"All Leads"},
    {id:"pipeline",label:"Pipeline"},
    {id:"geo",label:"Geo"},
    {id:"transactions",label:"Transactions",badge:transactions.length,bc:"#4eca8b"},
    {id:"investors",label:"💼 Investors",badge:investors.length,bc:"#1db954"},
    {id:"pastclients",label:"⭐ Past Clients",badge:pastClients.length,bc:"#c8a96e"},
    {id:"revenue",label:"💰 Revenue"},
    {id:"dnc",label:"DNC",badge:dncLeads.length,bc:"#55556a"},
  ];

  if(loading) return <div style={{background:"#09090e",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><CFLogo size={48}/><div style={{color:"#1db954",fontFamily:"inherit",fontSize:16,fontWeight:700}}>Loading ClientFlow...</div></div>;

  return (
    <div style={{background:"#09090e",minHeight:"100vh",color:"#f0eee8",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",fontSize:14}}>
      {/* HEADER */}
      <div style={{background:"#0d0d14",borderBottom:"1px solid #1a1a24",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1120,margin:"0 auto",padding:"0 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:9,background:"#040d07",border:"1px solid #1db95428",display:"flex",alignItems:"center",justifyContent:"center"}}><CFLogo size={22}/></div>
              <div>
                <div style={{fontWeight:900,fontSize:15,letterSpacing:-0.5}}><span style={{color:"#f0eee8"}}>Client</span><span style={{color:"#1db954"}}>Flow</span></div>
                {editingOffice
                  ? <input autoFocus value={office} onChange={e=>setOffice(e.target.value)} onBlur={()=>setEditingOffice(false)} onKeyDown={e=>e.key==="Enter"&&setEditingOffice(false)} placeholder="Enter your office/brokerage" style={{fontSize:10,background:"transparent",border:"none",borderBottom:"1px solid #1db95460",color:"#1db954",outline:"none",width:180,padding:"1px 0",fontFamily:"inherit"}}/>
                  : <div onClick={()=>setEditingOffice(true)} style={{fontSize:10,color:office?"#1db95480":"#33333f",letterSpacing:0.8,cursor:"pointer",textTransform:"uppercase"}}>{office||"+ Add your office"}</div>
                }
              </div>
            </div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={scoreAll} style={{background:"#1db95415",border:"1px solid #1db95435",color:"#1db954",borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✨ Score All</button>
              <button onClick={()=>setShowAddLead(true)} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:8,padding:"7px 13px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Add Lead</button>
            </div>
          </div>
          <div style={{display:"flex",overflowX:"auto",gap:0}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:tab===t.id?"2px solid #1db954":"2px solid transparent",color:tab===t.id?"#1db954":"#8888a0",padding:"8px 14px",cursor:"pointer",fontWeight:tab===t.id?700:400,fontSize:13,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
                {t.label}
                {t.badge>0&&<span style={{background:t.bc,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:900}}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {toast&&<div style={{position:"fixed",top:65,right:14,background:toast.type==="success"?"#4eca8b":"#e05555",color:"#fff",padding:"9px 16px",borderRadius:10,fontWeight:700,zIndex:999,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>{toast.msg}</div>}

      <div style={{maxWidth:1120,margin:"0 auto",padding:"18px 14px"}}>

        {/* DASHBOARD */}
        {tab==="dashboard"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div><div style={{fontSize:22,fontWeight:900}}>What Should I Do Right Now?</div><div style={{color:"#8888a0",fontSize:13,marginTop:2}}>AI-powered action plan for today</div></div>
            <button onClick={buildActionPlan} style={{background:"linear-gradient(135deg,#1db954,#17a349)",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{actionLoading?"Thinking...":"⚡ Generate Plan"}</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:20}}>
            {[["Leads",activeLeads.length,"#1db954"],["Due Today",callList.length,"#e05555"],["Hot",pipeline.Hot.length,"#e05555"],["Warm",pipeline.Warm.length,"#f5a623"],["Cold",pipeline.Cold.length,"#5b9cf6"],["Investors",investors.length,"#1db954"],["Past Clients",pastClients.length,"#c8a96e"],["Transactions",transactions.length,"#4eca8b"]].map(([label,val,color])=>(
              <div key={label} style={{background:"#111118",borderRadius:12,border:`1px solid ${color}25`,padding:"12px 10px"}}>
                <div style={{fontSize:24,fontWeight:900,color}}>{val}</div>
                <div style={{fontSize:10,color:"#55556a",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
          {!actionItems&&!actionLoading&&<div style={{textAlign:"center",padding:"50px 20px",background:"#111118",borderRadius:16,border:"1px dashed #2e2e3e"}}><div style={{fontSize:36,marginBottom:12}}>🧠</div><div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Your AI executive advisor is ready</div><div style={{color:"#8888a0",fontSize:14,maxWidth:360,margin:"0 auto"}}>Tap Generate Plan to get your personalized action list.</div></div>}
          {actionLoading&&<div style={{textAlign:"center",padding:50,color:"#8888a0"}}><div style={{fontSize:28,marginBottom:10}}>⚡</div><div>Analyzing your pipeline...</div></div>}
          {actionItems&&<div>
            {actionItems.motivationalNote&&<div style={{background:"#1db95415",border:"1px solid #1db95430",borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:14,color:"#1db954",fontStyle:"italic"}}>"{actionItems.motivationalNote}"</div>}
            {actionItems.todayGoal&&<div style={{background:"#111118",borderRadius:12,padding:"12px 16px",marginBottom:16,border:"1px solid #1e1e28"}}><div style={{fontSize:11,color:"#1db954",fontWeight:700,letterSpacing:0.8,marginBottom:4}}>TODAY'S GOAL</div><div style={{fontSize:14,fontWeight:700}}>{actionItems.todayGoal}</div></div>}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {actionItems.actions?.map((a,i)=>(
                <div key={i} style={{background:"#111118",borderRadius:13,border:"1px solid #1e1e28",padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{width:32,height:32,borderRadius:8,background:i===0?"#e05555":i===1?"#f5a623":"#1e1e28",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:i<=1?"#fff":"#8888a0",flexShrink:0}}>{a.priority}</div>
                  <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,marginBottom:3}}>{a.action}</div>{a.lead&&<div style={{fontSize:12,color:"#1db954",marginBottom:3}}>→ {a.lead}</div>}<div style={{fontSize:12,color:"#8888a0"}}>{a.why}</div></div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}><Pill label={a.channel} color={a.channel==="call"?"#4eca8b":a.channel==="text"?"#5b9cf6":"#f5a623"}/><div style={{fontSize:11,color:"#55556a"}}>{a.timeEst}</div></div>
                </div>
              ))}
            </div>
          </div>}
        </div>}

        {/* TODAY */}
        {tab==="today"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div><div style={{fontSize:20,fontWeight:900}}>Today's Call List</div><div style={{color:"#8888a0",fontSize:13,marginTop:2}}>{callList.length} due · ranked by AI score</div></div>
            {callList.length>0&&<button onClick={()=>{setCallMode(true);setCallIdx(0);genOpener(callList[0]);setCoach(null);setAdvisor(null);}} style={{background:"linear-gradient(135deg,#1db954,#17a349)",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>▶ Call Mode</button>}
          </div>
          {callList.length===0?<Empty icon="✓" msg="All caught up for today!"/>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{callList.map((l,i)=><LeadRow key={l.id} lead={l} rank={i+1} onSelect={()=>setSelectedLead(l)} onText={()=>setTextLead(l)} onVM={()=>setVmLead(l)} onDNC={()=>{updateLeadDB(l.id,{dnc:true});showToast("Added to DNC");}} onScore={()=>scoreLead(l)} scoring={scoringId===l.id}/>)}</div>}
        </div>}

        {/* ALL LEADS */}
        {tab==="all"&&<div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, city, ZIP…" style={{flex:1,minWidth:170,background:"#111118",border:"1px solid #1e1e28",borderRadius:8,padding:"8px 12px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
            {["All","Hot","Warm","Cold"].map(s=><FPill key={s} label={s} active={fStatus===s} onClick={()=>setFStatus(s)} color={s==="Hot"?"#e05555":s==="Warm"?"#f5a623":s==="Cold"?"#5b9cf6":"#1db954"}/>)}
            {["All","Buyer","Seller"].map(s=><FPill key={s} label={s} active={fType===s} onClick={()=>setFType(s)} color="#5b9cf6"/>)}
            <select value={fCity} onChange={e=>setFCity(e.target.value)} style={sS}>{allCities.map(c=><option key={c}>{c}</option>)}</select>
          </div>
          <div style={{color:"#55556a",fontSize:12,marginBottom:9}}>{filteredLeads.length} leads</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{filteredLeads.map(l=><LeadRow key={l.id} lead={l} onSelect={()=>setSelectedLead(l)} onText={()=>setTextLead(l)} onVM={()=>setVmLead(l)} onDNC={()=>{updateLeadDB(l.id,{dnc:!l.dnc});showToast(l.dnc?"Removed from DNC":"Added to DNC");}} onScore={()=>scoreLead(l)} scoring={scoringId===l.id}/>)}</div>
        </div>}

        {/* PIPELINE */}
        {tab==="pipeline"&&<div>
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>Pipeline</div>
          <div style={{color:"#8888a0",fontSize:13,marginBottom:18}}>30 / 60 / 90 day forecast</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
            {[["Hot","#e05555","🔥 Close — 30 Days"],["Warm","#f5a623","⚡ Nurture — 60 Days"],["Cold","#5b9cf6","🧊 Long Game — 90 Days"]].map(([s,c,title])=>(
              <div key={s} style={{background:"#111118",borderRadius:14,border:`1px solid ${c}28`,overflow:"hidden"}}>
                <div style={{background:c+"14",borderBottom:`1px solid ${c}28`,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontWeight:800,fontSize:13,color:c}}>{title}</div>
                  <span style={{background:c+"28",color:c,borderRadius:20,padding:"2px 9px",fontSize:12,fontWeight:900}}>{pipeline[s].length}</span>
                </div>
                <div style={{padding:10,display:"flex",flexDirection:"column",gap:7}}>
                  {pipeline[s].length===0&&<div style={{color:"#55556a",fontSize:13,padding:8}}>Empty</div>}
                  {pipeline[s].map(l=><div key={l.id} onClick={()=>setSelectedLead(l)} style={{display:"flex",alignItems:"center",gap:10,background:"#0d0d14",borderRadius:10,padding:"9px 11px",cursor:"pointer",border:"1px solid #1a1a24"}}>
                    <ScoreRing score={l.ai_score}/><Avatar name={l.name} size={30}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.name}</div><div style={{fontSize:11,color:"#55556a"}}>{l.city} · {l.type}</div></div>
                  </div>)}
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* GEO */}
        {tab==="geo"&&<div>
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>Geo View</div>
          <div style={{color:"#8888a0",fontSize:13,marginBottom:18}}>City → ZIP Code</div>
          {Object.keys(geoData).length===0&&<Empty icon="📍" msg="Add leads with a city and ZIP to see geo view"/>}
          {Object.entries(geoData).sort(([a],[b])=>a.localeCompare(b)).map(([city,zips])=>{
            const all=Object.values(zips).flat(),hot=all.filter(l=>l.status==="Hot").length;
            return <div key={city} style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:8,borderBottom:"1px solid #1a1a24"}}>
                <div style={{fontWeight:900,fontSize:17}}>{city}</div>
                <div style={{fontSize:12,color:"#55556a"}}>{all.length} leads</div>
                {hot>0&&<Pill label={`${hot} Hot`} color="#e05555"/>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                {Object.entries(zips).sort(([a],[b])=>a.localeCompare(b)).map(([zip,group])=>{
                  const h=group.filter(l=>l.status==="Hot").length,w=group.filter(l=>l.status==="Warm").length,c=group.filter(l=>l.status==="Cold").length;
                  const hc=h>0?"#e05555":w>0?"#f5a623":"#5b9cf6";
                  return <div key={zip} style={{background:"#111118",borderRadius:12,border:`1px solid ${hc}30`,padding:"12px 13px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><div style={{fontFamily:"monospace",fontWeight:700,fontSize:14}}>{zip}</div><div style={{fontWeight:900,fontSize:20,color:hc}}>{group.length}</div></div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>{h>0&&<Pill label={`${h} Hot`} color="#e05555"/>}{w>0&&<Pill label={`${w} Warm`} color="#f5a623"/>}{c>0&&<Pill label={`${c} Cold`} color="#5b9cf6"/>}</div>
                    <div style={{height:4,background:"#1e1e28",borderRadius:2,overflow:"hidden"}}><div style={{width:`${Math.min((h*3+w*2+c)/12,1)*100}%`,height:"100%",background:hc,borderRadius:2}}/></div>
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>}

        {/* TRANSACTIONS */}
        {tab==="transactions"&&<div>
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>Transactions</div>
          <div style={{color:"#8888a0",fontSize:13,marginBottom:18}}>Active deals & milestone tracking</div>
          {transactions.length===0&&<Empty icon="🏠" msg="No active transactions yet. Add one from any lead's detail screen."/>}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {transactions.map(l=>{
              const tx=l.transaction,done=tx.milestones.filter(m=>m.done).length,total=tx.milestones.length,pct=Math.round(done/total*100);
              return <div key={l.id} style={{background:"#111118",borderRadius:16,border:"1px solid #1e1e28",overflow:"hidden"}}>
                <div style={{padding:"14px 16px",borderBottom:"1px solid #1e1e28"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                    <Avatar name={l.name} size={40}/>
                    <div style={{flex:1}}><div style={{fontWeight:900,fontSize:15}}>{l.name}</div><div style={{fontSize:12,color:"#8888a0"}}>{tx.address}</div><div style={{fontSize:12,color:"#55556a"}}>Close: {tx.closingDate} · {tx.price}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:900,fontSize:22,color:"#4eca8b"}}>{pct}%</div><div style={{fontSize:11,color:"#55556a"}}>{done}/{total}</div></div>
                  </div>
                  <div style={{height:6,background:"#1e1e28",borderRadius:3,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#4eca8b,#6ee8a8)",borderRadius:3}}/></div>
                </div>
                <div style={{padding:"12px 16px",display:"flex",flexWrap:"wrap",gap:8}}>
                  {tx.milestones.map((m,i)=><button key={i} onClick={()=>{const updated={...tx,milestones:tx.milestones.map((ms,idx)=>idx===i?{...ms,done:!ms.done}:ms)};updateLeadDB(l.id,{transaction:updated});showToast("Updated ✓");}} style={{background:m.done?"#4eca8b18":"#1e1e28",border:`1px solid ${m.done?"#4eca8b40":"#2e2e3e"}`,color:m.done?"#4eca8b":"#8888a0",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{m.done?"✓ ":""}{m.label}</button>)}
                </div>
                <div style={{padding:"0 16px 14px",display:"flex",gap:8}}>
                  <button onClick={()=>setTextLead(l)} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>💬 Text</button>
                  <button onClick={()=>setTxLead(l)} style={{background:"#4eca8b18",border:"1px solid #4eca8b30",color:"#4eca8b",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>✏ Edit</button>
                </div>
              </div>;
            })}
          </div>
        </div>}

        {/* INVESTORS */}
        {tab==="investors"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div><div style={{fontSize:20,fontWeight:900}}>Investor Network</div><div style={{color:"#8888a0",fontSize:13,marginTop:2}}>{investors.length} investors</div></div>
            <button onClick={()=>setShowAddInvestor(true)} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Add Investor</button>
          </div>
          <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:20,paddingBottom:4}}>
            {INV_PIPELINE.map(stage=>{const count=investors.filter(i=>i.pipeline===stage).length;return <div key={stage} style={{background:"#111118",borderRadius:10,border:"1px solid #1e1e28",padding:"10px 14px",flexShrink:0,minWidth:120,textAlign:"center"}}><div style={{fontWeight:800,fontSize:18,color:"#1db954"}}>{count}</div><div style={{fontSize:11,color:"#55556a",marginTop:2}}>{stage}</div></div>;})}
          </div>
          <div style={{background:"#111118",borderRadius:14,border:"1px solid #1db95425",padding:"14px 16px",marginBottom:18}}>
            <div style={{fontSize:12,color:"#1db954",fontWeight:700,letterSpacing:0.8,marginBottom:10}}>🎯 AI DEAL MATCHING</div>
            <div style={{display:"flex",gap:8}}>
              <input id="dealDesc" placeholder='"2-unit multifamily, Detroit 48201, $180k, light rehab, 12% cap rate"' style={{flex:1,background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:8,padding:"9px 12px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
              <button onClick={()=>matchInvestors(document.getElementById("dealDesc").value)} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:13,flexShrink:0}}>{invMatchLoading?"Matching...":"Match"}</button>
            </div>
            {invMatch&&<div style={{marginTop:12}}>
              {invMatch.recommendation&&<div style={{background:"#1db95415",borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:13,color:"#1db954"}}>{invMatch.recommendation}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {invMatch.matches?.map((m,i)=><div key={i} style={{background:"#0d0d14",borderRadius:10,padding:"10px 12px",border:`1px solid ${m.fitScore>=75?"#1db95430":"#1e1e28"}`,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"#111118",border:`2px solid ${m.fitScore>=75?"#1db954":"#2e2e3e"}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:m.fitScore>=75?"#1db954":"#8888a0",flexShrink:0}}>{m.fitScore}%</div>
                  <div style={{flex:1}}><div style={{fontWeight:700}}>{m.investorName}</div><div style={{fontSize:12,color:"#8888a0"}}>{m.reason}</div><div style={{fontSize:12,color:"#1db954",marginTop:3}}>{m.action}</div></div>
                  {m.doNotSend&&<Pill label="Skip" color="#e05555"/>}
                </div>)}
              </div>
            </div>}
          </div>
          {investors.length===0&&<Empty icon="💼" msg="No investors yet. Tap + Add Investor to get started."/>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {investors.map(inv=>(
              <div key={inv.id} onClick={()=>setSelectedInvestor(inv)} style={{background:"#111118",borderRadius:14,border:"1px solid #1e1e28",padding:"14px 16px",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar name={inv.name} size={42}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontWeight:800,fontSize:15}}>{inv.name}</span><Pill label={inv.pipeline||"Prospect"} color="#1db954"/>{inv.cash_buyer&&<Pill label="Cash" color="#f5a623"/>}</div>
                    <div style={{fontSize:12,color:"#8888a0",marginTop:2}}>{inv.city}{inv.state?`, ${inv.state}`:""} · ${(inv.budget_min/1000).toFixed(0)}k–${(inv.budget_max/1000).toFixed(0)}k · ROI: {inv.expected_roi}%+</div>
                  </div>
                  <div style={{fontSize:11,color:"#55556a",flexShrink:0}}>{daysSince(inv.last_contact||todayStr)}d ago</div>
                </div>
                {inv.ai_memory&&<div style={{background:"#1db95410",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#1db95480",fontStyle:"italic",marginTop:8}}>🧠 {typeof inv.ai_memory==="object"?inv.ai_memory.insight:inv.ai_memory}</div>}
              </div>
            ))}
          </div>
        </div>}

        {/* PAST CLIENTS */}
        {tab==="pastclients"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div><div style={{fontSize:20,fontWeight:900}}>Past Clients</div><div style={{color:"#8888a0",fontSize:13,marginTop:2}}>{pastClients.length} clients · your most valuable asset</div></div>
            <button onClick={()=>setShowAddPastClient(true)} style={{background:"#c8a96e",color:"#09090e",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Add Past Client</button>
          </div>
          {pastClients.length===0&&<div style={{textAlign:"center",padding:"60px 20px",background:"#111118",borderRadius:16,border:"1px dashed #2e2e3e"}}>
            <div style={{fontSize:40,marginBottom:12}}>⭐</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Your past clients live here</div>
            <div style={{color:"#8888a0",fontSize:14,maxWidth:360,margin:"0 auto 20px"}}>These are your warmest leads. Past clients are your best source of referrals. Keep them close.</div>
            <button onClick={()=>setShowAddPastClient(true)} style={{background:"#c8a96e",color:"#09090e",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Add Your First Past Client</button>
          </div>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {pastClients.map(client=>(
              <div key={client.id} style={{background:"#111118",borderRadius:14,border:"1px solid #1e1e28",padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar name={client.name} size={44}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:800,fontSize:15}}>{client.name}</span>
                      {client.referral_given&&<Pill label="Gave Referral ⭐" color="#1db954"/>}
                      {client.property_type&&<Pill label={client.property_type} color="#5b9cf6"/>}
                    </div>
                    <div style={{fontSize:12,color:"#8888a0",marginTop:2}}>{client.city}{client.state?`, ${client.state}`:""}{client.zip?` ${client.zip}`:""}{client.phone?` · ${client.phone}`:""}</div>
                    {client.address&&<div style={{fontSize:11,color:"#55556a",marginTop:1}}>{client.address}</div>}
                    <div style={{display:"flex",gap:12,marginTop:4,flexWrap:"wrap"}}>
                      {client.closed_date&&<div style={{fontSize:11,color:"#55556a"}}>Closed: {client.closed_date}</div>}
                      {client.sale_price&&<div style={{fontSize:11,color:"#c8a96e",fontWeight:700}}>{client.sale_price}</div>}
                      {client.birthday&&<div style={{fontSize:11,color:"#e05555"}}>🎂 {client.birthday}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setTextLead(client)} style={iB("#5b9cf6")}>💬</button>
                    <button onClick={()=>setSelectedPastClient(client)} style={iB("#c8a96e")}>✏</button>
                  </div>
                </div>
                {client.notes&&<div style={{marginTop:10,background:"#0d0d14",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#8888a0"}}>{client.notes}</div>}
              </div>
            ))}
          </div>
        </div>}

        {/* REVENUE */}
        {tab==="revenue"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div><div style={{fontSize:20,fontWeight:900}}>Revenue Engine</div><div style={{color:"#8888a0",fontSize:13,marginTop:2}}>AI scans your pipeline for missed money</div></div>
            <button onClick={runRevenueEngine} style={{background:"linear-gradient(135deg,#1db954,#17a349)",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{revenueLoading?"Scanning...":"🔍 Run Scan"}</button>
          </div>
          {!revenueData&&!revenueLoading&&<div style={{textAlign:"center",padding:"50px 20px",background:"#111118",borderRadius:16,border:"1px dashed #2e2e3e"}}><div style={{fontSize:40,marginBottom:12}}>💰</div><div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Autonomous Revenue Engine</div><div style={{color:"#8888a0",fontSize:14,maxWidth:380,margin:"0 auto"}}>Run a scan and AI analyzes your entire pipeline.</div></div>}
          {revenueLoading&&<div style={{textAlign:"center",padding:50,color:"#8888a0"}}><div style={{fontSize:28,marginBottom:10}}>🔍</div><div>Scanning...</div></div>}
          {revenueData&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
            {revenueData.topPriority&&<div style={{background:"#e0555518",border:"1px solid #e0555540",borderRadius:13,padding:"14px 16px"}}><div style={{fontSize:11,color:"#e05555",fontWeight:700,letterSpacing:0.8,marginBottom:6}}>🚨 TOP PRIORITY</div><div style={{fontSize:15,fontWeight:800}}>{revenueData.topPriority}</div></div>}
            {revenueData.weeklyForecast&&<div style={{background:"#4eca8b18",border:"1px solid #4eca8b30",borderRadius:13,padding:"12px 16px"}}><div style={{fontSize:11,color:"#4eca8b",fontWeight:700,letterSpacing:0.8,marginBottom:4}}>📈 WEEKLY FORECAST</div><div style={{fontSize:14}}>{revenueData.weeklyForecast}</div></div>}
            {revenueData.hotOpportunities?.length>0&&<div><div style={{fontSize:13,fontWeight:800,marginBottom:10,color:"#f5a623"}}>🔥 Hot Opportunities</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{revenueData.hotOpportunities.map((o,i)=><div key={i} style={{background:"#111118",borderRadius:12,border:"1px solid #f5a62328",padding:"12px 14px"}}><div style={{fontWeight:800,fontSize:14,marginBottom:3}}>{o.name}</div><div style={{fontSize:13,color:"#8888a0",marginBottom:6}}>{o.reason}</div><div style={{fontSize:12,color:"#f5a623",fontWeight:700}}>→ {o.action}</div></div>)}</div></div>}
            {revenueData.missedMoney?.length>0&&<div><div style={{fontSize:13,fontWeight:800,marginBottom:10,color:"#e05555"}}>💸 Missed Money</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{revenueData.missedMoney.map((m,i)=><div key={i} style={{background:"#111118",borderRadius:12,border:"1px solid #e0555520",padding:"12px 14px",display:"flex",gap:12,alignItems:"flex-start"}}><Pill label={m.urgency} color={m.urgency==="High"?"#e05555":m.urgency==="Medium"?"#f5a623":"#5b9cf6"}/><div><div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{m.issue}</div><div style={{fontSize:12,color:"#4eca8b"}}>Fix: {m.fix}</div></div></div>)}</div></div>}
          </div>}
        </div>}

        {/* DNC */}
        {tab==="dnc"&&<div>
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>Do Not Call</div>
          <div style={{color:"#8888a0",fontSize:13,marginBottom:18}}>These contacts will never appear on your call list</div>
          {dncLeads.length===0?<Empty icon="✓" msg="No DNC contacts"/>:
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{dncLeads.map(l=><div key={l.id} style={{background:"#111118",borderRadius:12,border:"1px solid #1e1e28",padding:"12px 14px",display:"flex",alignItems:"center",gap:12,opacity:0.65}}>
            <Avatar name={l.name}/><div style={{flex:1}}><div style={{fontWeight:700}}>{l.name}</div><div style={{fontSize:12,color:"#55556a"}}>{l.phone} · {l.city} {l.state} {l.zip}</div></div>
            <button onClick={()=>{updateLeadDB(l.id,{dnc:false});showToast("Removed from DNC");}} style={{background:"#4eca8b18",border:"1px solid #4eca8b35",color:"#4eca8b",borderRadius:8,padding:"6px 11px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Remove</button>
          </div>)}</div>}
        </div>}

      </div>

      {/* CALL MODE */}
      {callMode&&currentCall&&<div style={{position:"fixed",inset:0,background:"#07070c",zIndex:200,overflowY:"auto"}}>
        <div style={{maxWidth:520,margin:"0 auto",padding:"18px 14px 40px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div style={{fontSize:13,color:"#55556a"}}>{callIdx+1}/{callList.length}</div>
            <button onClick={()=>{setCallMode(false);setCallIdx(0);setCoach(null);setAdvisor(null);}} style={{background:"#1e1e28",border:"none",color:"#8888a0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>✕ Exit</button>
          </div>
          <div style={{textAlign:"center",marginBottom:18}}>
            <Avatar name={currentCall.name} size={60}/>
            <div style={{marginTop:10,fontSize:22,fontWeight:900}}>{currentCall.name}</div>
            <div style={{color:"#8888a0",fontSize:14,marginTop:3}}>{currentCall.city}{currentCall.state?`, ${currentCall.state}`:""} · {currentCall.type}</div>
            {currentCall.address&&<div style={{color:"#55556a",fontSize:12,marginTop:2}}>{currentCall.address}</div>}
            <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:8,flexWrap:"wrap"}}>
              <Pill label={currentCall.status} color={statusColor(currentCall.status)}/>
              {currentCall.ai_score!=null&&<Pill label={`Score: ${currentCall.ai_score}`} color={scoreColor(currentCall.ai_score)}/>}
              {currentCall.ai_memory&&<Pill label="🧠 Memory" color="#1db954"/>}
            </div>
            <a href={`tel:${currentCall.phone}`} style={{display:"inline-block",marginTop:14,background:"#4eca8b",color:"#fff",borderRadius:50,padding:"12px 28px",fontWeight:900,fontSize:17,textDecoration:"none"}}>📞 {currentCall.phone}</a>
          </div>
          {currentCall.ai_memory&&<div style={{background:"#1db95410",border:"1px solid #1db95425",borderRadius:13,padding:13,marginBottom:11}}>
            <div style={{fontSize:11,color:"#1db954",fontWeight:700,letterSpacing:0.8,marginBottom:8}}>🧠 RELATIONSHIP MEMORY</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[["Personality",currentCall.ai_memory.personality],["Style",currentCall.ai_memory.style],["Goals",currentCall.ai_memory.goals],["Timing",currentCall.ai_memory.timing],["Objections",currentCall.ai_memory.objections],["Budget",currentCall.ai_memory.budget||"Unknown"]].map(([k,v])=>(
                <div key={k} style={{background:"#0d0d14",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,color:"#55556a",fontWeight:700,marginBottom:2}}>{k.toUpperCase()}</div><div style={{fontSize:12}}>{v}</div></div>
              ))}
            </div>
          </div>}
          <div style={{background:"#111118",borderRadius:13,padding:13,marginBottom:11,border:"1px solid #1e1e28"}}>
            <div style={{fontSize:11,color:"#1db954",fontWeight:700,letterSpacing:0.8,marginBottom:7}}>✨ AI OPENING LINE</div>
            {loadingOpener?<div style={{color:"#55556a",fontSize:13}}>Generating...</div>:<div style={{fontSize:14,lineHeight:1.65}}>{opener||"Tap Regenerate"}</div>}
            <button onClick={()=>genOpener(currentCall)} style={{marginTop:9,background:"#1db95415",border:"1px solid #1db95430",color:"#1db954",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>↻ Regenerate</button>
          </div>
          <div style={{background:"#111118",borderRadius:13,padding:13,marginBottom:11,border:"1px solid #1e1e28"}}>
            <div style={{fontSize:11,color:"#5b9cf6",fontWeight:700,letterSpacing:0.8,marginBottom:9}}>🎯 CONVERSATION COACH</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:9}}>
              {["I'm not interested","I already have an agent","Now's not a good time","Just send me info","How'd you get my number?","I'm not ready yet"].map(obj=>(
                <button key={obj} onClick={()=>handleObjection(obj,currentCall)} style={{background:"#5b9cf615",border:"1px solid #5b9cf628",color:"#5b9cf6",borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{obj}</button>
              ))}
            </div>
            {coach&&<div style={{background:"#0d0d14",borderRadius:10,padding:12,border:"1px solid #5b9cf625"}}>
              <div style={{fontSize:11,color:"#5b9cf6",fontWeight:700,marginBottom:5}}>"{coach.objection}"</div>
              {coach.loading?<div style={{color:"#55556a",fontSize:13}}>Thinking...</div>:<div style={{fontSize:13,lineHeight:1.65}}>{coach.response}</div>}
            </div>}
          </div>
          <div style={{background:"#111118",borderRadius:13,padding:13,marginBottom:11,border:"1px solid #1e1e28"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
              <div style={{fontSize:11,color:"#4eca8b",fontWeight:700,letterSpacing:0.8}}>📋 FOLLOW-UP ADVISOR</div>
              <button onClick={()=>getAdvisor(currentCall)} style={{background:"#4eca8b15",border:"1px solid #4eca8b30",color:"#4eca8b",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Generate</button>
            </div>
            {advisor?.loading&&<div style={{color:"#55556a",fontSize:13}}>Building plan...</div>}
            {advisor?.plan&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
              <div style={{background:"#0d0d14",borderRadius:9,padding:11}}><div style={{fontSize:11,color:"#4eca8b",fontWeight:700,marginBottom:4}}>NEXT · {advisor.plan.nextAction?.toUpperCase()} · {advisor.plan.when}</div><div style={{fontSize:13,lineHeight:1.6}}>{advisor.plan.message}</div></div>
              <div style={{background:"#0d0d14",borderRadius:9,padding:11}}><div style={{fontSize:11,color:"#4eca8b",fontWeight:700,marginBottom:4}}>30-DAY STRATEGY</div><div style={{fontSize:13,color:"#8888a0",lineHeight:1.6}}>{advisor.plan.longTerm}</div></div>
            </div>}
          </div>
          <div style={{background:"#111118",borderRadius:11,padding:12,marginBottom:13,border:"1px solid #1a1a24",fontSize:13,color:"#8888a0",lineHeight:1.55}}><strong style={{color:"#f0eee8"}}>Notes: </strong>{currentCall.notes||"None"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
            <button onClick={()=>setTextLead(currentCall)} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>💬 Text</button>
            <button onClick={()=>setVmLead(currentCall)} style={{background:"#f5a62318",border:"1px solid #f5a62330",color:"#f5a623",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>📢 VM</button>
            <button onClick={()=>setShowLog(true)} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Log →</button>
          </div>
        </div>
      </div>}

      {/* LOG CALL */}
      {showLog&&currentCall&&<Modal title="Log Call" onClose={()=>setShowLog(false)}>
        <div style={{marginBottom:12}}><Label>Outcome</Label><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{["Voicemail","Spoke","Callback","Not Interested","No Answer"].map(o=><button key={o} onClick={()=>setCallOutcome(o)} style={{background:callOutcome===o?"#1db954":"#16161f",color:callOutcome===o?"#09090e":"#8888a0",border:`1px solid ${callOutcome===o?"#1db954":"#22222e"}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>{o}</button>)}</div></div>
        <div style={{marginBottom:14}}><Label>Notes</Label><textarea value={callNote} onChange={e=>setCallNote(e.target.value)} rows={3} placeholder="What happened?" style={{width:"100%",background:"#16161f",border:"1px solid #22222e",borderRadius:8,padding:"9px 11px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,resize:"vertical",boxSizing:"border-box",outline:"none"}}/></div>
        <button onClick={logCall} style={{width:"100%",background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save & Next →</button>
      </Modal>}

      {textLead&&<TextModal lead={textLead} onClose={()=>setTextLead(null)}/>}
      {vmLead&&<VoicemailModal lead={vmLead} onClose={()=>setVmLead(null)}/>}
      {memoryLead&&<MemoryModal lead={memoryLead} onClose={()=>setMemoryLead(null)} onBuild={()=>buildMemory(memoryLead)} onSave={async(mem)=>{await updateLeadDB(memoryLead.id,{ai_memory:mem});showToast("Memory saved ✓");setMemoryLead(null);}}/>}
      {txLead&&<TxModal lead={txLead} onClose={()=>setTxLead(null)} onSave={async(tx)=>{await updateLeadDB(txLead.id,{transaction:tx});showToast("Transaction saved ✓");setTxLead(null);}}/>}

      {selectedLead&&<LeadDetail lead={selectedLead} onClose={()=>setSelectedLead(null)} onText={()=>{setTextLead(selectedLead);setSelectedLead(null);}} onVM={()=>{setVmLead(selectedLead);setSelectedLead(null);}} onMemory={()=>{buildMemory(selectedLead);setMemoryLead({...selectedLead});setSelectedLead(null);}} onDNC={()=>{updateLeadDB(selectedLead.id,{dnc:!selectedLead.dnc});showToast(selectedLead.dnc?"Removed from DNC":"Added to DNC");setSelectedLead(null);}} onScore={()=>scoreLead(selectedLead)} onSave={async(patch)=>{await updateLeadDB(selectedLead.id,patch);showToast("Saved ✓");setSelectedLead(null);}} onAdvisor={()=>getAdvisor(selectedLead)} onTx={()=>{setTxLead(selectedLead);setSelectedLead(null);}} scoring={scoringId===selectedLead.id} advisor={advisor}/>}

      {selectedInvestor&&<Modal title={selectedInvestor.name} onClose={()=>setSelectedInvestor(null)} wide>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,background:"#0d0d14",borderRadius:12,padding:"12px 13px"}}>
          <Avatar name={selectedInvestor.name} size={48}/>
          <div style={{flex:1}}><div style={{fontWeight:900,fontSize:16}}>{selectedInvestor.name}</div><div style={{fontSize:13,color:"#8888a0"}}>{selectedInvestor.phone}{selectedInvestor.email?` · ${selectedInvestor.email}`:""}</div><div style={{fontSize:12,color:"#55556a"}}>{selectedInvestor.city}{selectedInvestor.state?`, ${selectedInvestor.state}`:""} {selectedInvestor.zip}</div></div>
        </div>
        <div style={{background:"#1db95410",borderRadius:12,padding:13,marginBottom:12,border:"1px solid #1db95420"}}>
          <div style={{fontSize:11,color:"#1db954",fontWeight:700,marginBottom:10}}>💼 BUY BOX</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[["Budget",`$${(selectedInvestor.budget_min/1000).toFixed(0)}k–$${(selectedInvestor.budget_max/1000).toFixed(0)}k`],["Target ROI",`${selectedInvestor.expected_roi}%+`],["Property Types",selectedInvestor.property_types||"—"],["Preferred Areas",selectedInvestor.preferred_areas||"—"],["Deal Structure",selectedInvestor.deal_structure||"—"],["Cash Buyer",selectedInvestor.cash_buyer?"Yes":"No"]].map(([k,v])=><div key={k} style={{background:"#0d0d14",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:9,color:"#55556a",fontWeight:700,marginBottom:2}}>{k.toUpperCase()}</div><div style={{fontSize:12}}>{v}</div></div>)}
          </div>
        </div>
        {selectedInvestor.notes&&<div style={{background:"#0d0d14",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:13,color:"#8888a0"}}>{selectedInvestor.notes}</div>}
        <div style={{marginBottom:12}}><Label>Pipeline Stage</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{INV_PIPELINE.map(s=><button key={s} onClick={()=>setSelectedInvestor(p=>({...p,pipeline:s}))} style={{background:selectedInvestor.pipeline===s?"#1db954":"#16161f",color:selectedInvestor.pipeline===s?"#09090e":"#8888a0",border:`1px solid ${selectedInvestor.pipeline===s?"#1db954":"#22222e"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"inherit"}}>{s}</button>)}</div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={()=>{setTextLead(selectedInvestor);setSelectedInvestor(null);}} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>💬 Text</button>
          <button onClick={async()=>{await updateInvestorDB(selectedInvestor.id,{pipeline:selectedInvestor.pipeline});showToast("Saved ✓");setSelectedInvestor(null);}} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Save ✓</button>
        </div>
      </Modal>}

      {selectedPastClient&&<Modal title={selectedPastClient.name} onClose={()=>setSelectedPastClient(null)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["name","Name"],["phone","Phone"],["email","Email"]].map(([k,lbl])=>(
            <div key={k} style={{gridColumn:k==="email"?"1 / -1":"auto"}}><Label>{lbl}</Label><input value={selectedPastClient[k]||""} onChange={e=>setSelectedPastClient(p=>({...p,[k]:e.target.value}))} style={iS}/></div>
          ))}
          <AddressFields data={selectedPastClient} onChange={(k,v)=>setSelectedPastClient(p=>({...p,[k]:v}))}/>
          {[["birthday","Birthday","date"],["closed_date","Closed Date","date"],["sale_price","Sale Price","text"],["property_type","Property Type","text"]].map(([k,lbl,t])=>(
            <div key={k}><Label>{lbl}</Label><input value={selectedPastClient[k]||""} onChange={e=>setSelectedPastClient(p=>({...p,[k]:e.target.value}))} type={t} style={iS}/></div>
          ))}
          <div style={{gridColumn:"1 / -1"}}><Label>Notes</Label><textarea value={selectedPastClient.notes||""} onChange={e=>setSelectedPastClient(p=>({...p,notes:e.target.value}))} rows={3} style={{...iS,resize:"vertical"}}/></div>
          <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={selectedPastClient.referral_given||false} onChange={e=>setSelectedPastClient(p=>({...p,referral_given:e.target.checked}))} style={{width:16,height:16}}/><Label>Has given a referral</Label></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
          <button onClick={()=>{setTextLead(selectedPastClient);setSelectedPastClient(null);}} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>💬 Text</button>
          <button onClick={async()=>{await updatePastClientDB(selectedPastClient.id,selectedPastClient);showToast("Saved ✓");setSelectedPastClient(null);}} style={{background:"#c8a96e",color:"#09090e",border:"none",borderRadius:10,padding:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Save ✓</button>
        </div>
      </Modal>}

      {/* ADD LEAD */}
      {showAddLead&&<Modal title="Add New Lead" onClose={()=>setShowAddLead(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>Full Name *</Label><input value={newLead.name} onChange={e=>setNewLead(p=>({...p,name:e.target.value}))} style={iS}/></div>
          <div><Label>Phone *</Label><input value={newLead.phone} onChange={e=>setNewLead(p=>({...p,phone:e.target.value}))} style={iS}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Email</Label><input value={newLead.email} onChange={e=>setNewLead(p=>({...p,email:e.target.value}))} style={iS}/></div>
          <AddressFields data={newLead} onChange={(k,v)=>setNewLead(p=>({...p,[k]:v}))}/>
          <div><Label>Source</Label><input value={newLead.source} onChange={e=>setNewLead(p=>({...p,source:e.target.value}))} placeholder="REDX, Zillow, Referral..." style={iS}/></div>
          <div><Label>Birthday</Label><input value={newLead.birthday} onChange={e=>setNewLead(p=>({...p,birthday:e.target.value}))} type="date" style={iS}/></div>
          <div><Label>Date Added</Label><input value={newLead.dateAdded} onChange={e=>setNewLead(p=>({...p,dateAdded:e.target.value}))} type="date" style={iS}/></div>
          <div><Label>Type</Label><select value={newLead.type} onChange={e=>setNewLead(p=>({...p,type:e.target.value}))} style={iS}><option>Buyer</option><option>Seller</option></select></div>
          <div><Label>Status</Label><select value={newLead.status} onChange={e=>setNewLead(p=>({...p,status:e.target.value}))} style={iS}><option>Hot</option><option>Warm</option><option>Cold</option></select></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Notes</Label><textarea value={newLead.notes} onChange={e=>setNewLead(p=>({...p,notes:e.target.value}))} rows={2} style={{...iS,resize:"vertical"}}/></div>
        </div>
        <button onClick={addLead} disabled={!newLead.name||!newLead.phone} style={{width:"100%",marginTop:16,background:newLead.name&&newLead.phone?"#1db954":"#22222e",color:newLead.name&&newLead.phone?"#09090e":"#55556a",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:newLead.name&&newLead.phone?"pointer":"not-allowed",fontFamily:"inherit"}}>Add Lead</button>
      </Modal>}

      {/* ADD INVESTOR */}
      {showAddInvestor&&<Modal title="Add Investor" onClose={()=>setShowAddInvestor(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>Full Name *</Label><input value={newInv.name} onChange={e=>setNewInv(p=>({...p,name:e.target.value}))} style={iS}/></div>
          <div><Label>Phone *</Label><input value={newInv.phone} onChange={e=>setNewInv(p=>({...p,phone:e.target.value}))} style={iS}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Email</Label><input value={newInv.email} onChange={e=>setNewInv(p=>({...p,email:e.target.value}))} style={iS}/></div>
          <AddressFields data={newInv} onChange={(k,v)=>setNewInv(p=>({...p,[k]:v}))}/>
          <div><Label>Budget Min ($)</Label><input value={newInv.budgetMin} onChange={e=>setNewInv(p=>({...p,budgetMin:e.target.value}))} type="number" style={iS}/></div>
          <div><Label>Budget Max ($)</Label><input value={newInv.budgetMax} onChange={e=>setNewInv(p=>({...p,budgetMax:e.target.value}))} type="number" style={iS}/></div>
          <div><Label>Target ROI (%)</Label><input value={newInv.expectedROI} onChange={e=>setNewInv(p=>({...p,expectedROI:e.target.value}))} type="number" style={iS}/></div>
          <div><Label>Timeline</Label><input value={newInv.timeline} onChange={e=>setNewInv(p=>({...p,timeline:e.target.value}))} placeholder="e.g. 30-60 days" style={iS}/></div>
          <div><Label>Risk Tolerance</Label><select value={newInv.riskTolerance} onChange={e=>setNewInv(p=>({...p,riskTolerance:e.target.value}))} style={iS}><option>Conservative</option><option>Moderate</option><option>Aggressive</option></select></div>
          <div><Label>Deal Structure</Label><select value={newInv.dealStructure} onChange={e=>setNewInv(p=>({...p,dealStructure:e.target.value}))} style={iS}><option>Cash</option><option>Financing</option><option>Both</option></select></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Property Types (comma separated)</Label><input value={newInv.propertyTypes} onChange={e=>setNewInv(p=>({...p,propertyTypes:e.target.value}))} placeholder="Multifamily, Single Family..." style={iS}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Preferred Areas (comma separated)</Label><input value={newInv.preferredAreas} onChange={e=>setNewInv(p=>({...p,preferredAreas:e.target.value}))} placeholder="Detroit, Southfield, Oak Park..." style={iS}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Notes / Buy Box Statement</Label><textarea value={newInv.notes} onChange={e=>setNewInv(p=>({...p,notes:e.target.value}))} rows={3} style={{...iS,resize:"vertical"}}/></div>
          <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={newInv.cashBuyer} onChange={e=>setNewInv(p=>({...p,cashBuyer:e.target.checked}))} style={{width:16,height:16}}/><Label>Cash Buyer</Label></div>
        </div>
        <button onClick={addInvestor} disabled={!newInv.name||!newInv.phone} style={{width:"100%",marginTop:16,background:newInv.name&&newInv.phone?"#1db954":"#22222e",color:newInv.name&&newInv.phone?"#09090e":"#55556a",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:newInv.name&&newInv.phone?"pointer":"not-allowed",fontFamily:"inherit"}}>Add Investor</button>
      </Modal>}

      {/* ADD PAST CLIENT */}
      {showAddPastClient&&<Modal title="Add Past Client" onClose={()=>setShowAddPastClient(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>Full Name *</Label><input value={newPC.name} onChange={e=>setNewPC(p=>({...p,name:e.target.value}))} style={iS}/></div>
          <div><Label>Phone</Label><input value={newPC.phone} onChange={e=>setNewPC(p=>({...p,phone:e.target.value}))} style={iS}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Email</Label><input value={newPC.email} onChange={e=>setNewPC(p=>({...p,email:e.target.value}))} style={iS}/></div>
          <AddressFields data={newPC} onChange={(k,v)=>setNewPC(p=>({...p,[k]:v}))}/>
          <div><Label>Birthday 🎂</Label><input value={newPC.birthday} onChange={e=>setNewPC(p=>({...p,birthday:e.target.value}))} type="date" style={iS}/></div>
          <div><Label>Closed Date</Label><input value={newPC.closedDate} onChange={e=>setNewPC(p=>({...p,closedDate:e.target.value}))} type="date" style={iS}/></div>
          <div><Label>Sale Price</Label><input value={newPC.salePrice} onChange={e=>setNewPC(p=>({...p,salePrice:e.target.value}))} placeholder="$000,000" style={iS}/></div>
          <div><Label>Property Type</Label><input value={newPC.propertyType} onChange={e=>setNewPC(p=>({...p,propertyType:e.target.value}))} placeholder="Single Family, Condo..." style={iS}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Notes</Label><textarea value={newPC.notes} onChange={e=>setNewPC(p=>({...p,notes:e.target.value}))} rows={2} style={{...iS,resize:"vertical"}}/></div>
          <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={newPC.referralGiven} onChange={e=>setNewPC(p=>({...p,referralGiven:e.target.checked}))} style={{width:16,height:16}}/><Label>Has given a referral</Label></div>
        </div>
        <button onClick={addPastClient} disabled={!newPC.name} style={{width:"100%",marginTop:16,background:newPC.name?"#c8a96e":"#22222e",color:newPC.name?"#09090e":"#55556a",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:newPC.name?"pointer":"not-allowed",fontFamily:"inherit"}}>Add Past Client</button>
      </Modal>}

    </div>
  );
}

function LeadRow({lead,rank,onSelect,onText,onVM,onDNC,onScore,scoring}) {
  const ds=daysSince(lead.last_contact||lead.lastContact||new Date().toISOString().split("T")[0]);
  return <div onClick={onSelect} style={{background:"#111118",borderRadius:13,border:"1px solid #1a1a24",padding:"12px 14px",display:"flex",alignItems:"center",gap:11,cursor:"pointer"}}>
    {rank&&<div style={{width:22,height:22,borderRadius:6,background:rank===1?"#e05555":rank===2?"#f5a623":"#1e1e28",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:rank<=2?"#fff":"#55556a",flexShrink:0}}>{rank}</div>}
    <ScoreRing score={lead.ai_score}/>
    <Avatar name={lead.name}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:14}}>{lead.name}</span>
        <Pill label={lead.status} color={statusColor(lead.status)}/>
        <Pill label={lead.type} color={lead.type==="Buyer"?"#5b9cf6":"#f5a623"}/>
        {lead.ai_score!=null&&<Pill label={scoreLabel(lead.ai_score)} color={scoreColor(lead.ai_score)}/>}
        {lead.ai_memory&&<span style={{fontSize:12}} title="Memory">🧠</span>}
        {lead.transaction&&<span style={{fontSize:12}} title="Transaction">🏠</span>}
      </div>
      <div style={{fontSize:12,color:"#8888a0",marginTop:2}}>{lead.city}{lead.state?`, ${lead.state}`:""}{lead.zip?` ${lead.zip}`:""} · {lead.phone}</div>
      <div style={{fontSize:11,color:"#55556a",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.notes}</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
      <div style={{fontSize:11,color:ds>14?"#e05555":"#55556a"}}>{ds}d ago</div>
      {lead.streak>0&&<div style={{fontSize:11,color:"#1db954"}}>🔥{lead.streak}</div>}
      <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
        <button onClick={onScore} style={iB("#1db954")}>{scoring?"…":"✨"}</button>
        <button onClick={onText} style={iB("#5b9cf6")}>💬</button>
        <button onClick={onVM} style={iB("#f5a623")}>📢</button>
        <button onClick={onDNC} style={iB(lead.dnc?"#4eca8b":"#e05555")}>🚫</button>
      </div>
    </div>
  </div>;
}

function LeadDetail({lead,onClose,onText,onVM,onMemory,onDNC,onScore,onSave,onAdvisor,onTx,scoring,advisor}) {
  const [notes,setNotes]=useState(lead.notes||"");
  const [followUp,setFollowUp]=useState(lead.next_follow_up||lead.nextFollowUp||"");
  const [status,setStatus]=useState(lead.status);
  return <Modal title={lead.name} onClose={onClose} wide>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,background:"#0d0d14",borderRadius:12,padding:"12px 13px"}}>
      <Avatar name={lead.name} size={48}/>
      <div style={{flex:1}}><div style={{fontWeight:900,fontSize:16}}>{lead.name}</div><div style={{fontSize:13,color:"#8888a0"}}>{lead.phone}{lead.email?` · ${lead.email}`:""}</div><div style={{fontSize:12,color:"#55556a"}}>{lead.address?`${lead.address}, `:""}{lead.city}{lead.state?`, ${lead.state}`:""} {lead.zip}</div>{lead.birthday&&<div style={{fontSize:12,color:"#e05555"}}>🎂 {lead.birthday}</div>}{lead.date_added&&<div style={{fontSize:11,color:"#55556a"}}>Added: {lead.date_added}</div>}</div>
      <ScoreRing score={lead.ai_score}/>
    </div>
    {lead.ai_score!=null&&lead.ai_score_reason&&<div style={{background:"#0d0d14",borderRadius:10,padding:"10px 12px",marginBottom:12,border:`1px solid ${scoreColor(lead.ai_score)}25`}}><div style={{fontSize:11,color:scoreColor(lead.ai_score),fontWeight:700,marginBottom:3}}>AI SCORE REASON</div><div style={{fontSize:13,color:"#8888a0"}}>{lead.ai_score_reason}</div></div>}
    {lead.ai_memory&&<div style={{background:"#1db95410",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #1db95420"}}><div style={{fontSize:11,color:"#1db954",fontWeight:700,marginBottom:6}}>🧠 MEMORY</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{[["Personality",lead.ai_memory.personality],["Goals",lead.ai_memory.goals],["Timing",lead.ai_memory.timing],["Budget",lead.ai_memory.budget||"Unknown"]].map(([k,v])=><div key={k} style={{background:"#0d0d14",borderRadius:7,padding:"7px 9px"}}><div style={{fontSize:9,color:"#55556a",fontWeight:700,marginBottom:2}}>{k.toUpperCase()}</div><div style={{fontSize:12}}>{v}</div></div>)}</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>{[["Calls",lead.calls||0],["Streak",`🔥${lead.streak||0}`],["Last",`${daysSince(lead.last_contact||lead.lastContact||new Date().toISOString().split("T")[0])}d ago`]].map(([l,v])=><div key={l} style={{background:"#0d0d14",borderRadius:9,padding:"9px 10px",textAlign:"center",border:"1px solid #1a1a24"}}><div style={{fontSize:17,fontWeight:900}}>{v}</div><div style={{fontSize:10,color:"#55556a",marginTop:2}}>{l}</div></div>)}</div>
    <div style={{marginBottom:11}}><Label>Status</Label><div style={{display:"flex",gap:7}}>{["Hot","Warm","Cold"].map(s=><button key={s} onClick={()=>setStatus(s)} style={{flex:1,background:status===s?statusColor(s):"#16161f",color:status===s?"#fff":"#8888a0",border:`1px solid ${status===s?"transparent":"#22222e"}`,borderRadius:8,padding:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{s}</button>)}</div></div>
    <div style={{marginBottom:11}}><Label>Next Follow-Up</Label><input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)} style={iS}/></div>
    <div style={{marginBottom:12}}><Label>Notes</Label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...iS,resize:"vertical"}}/></div>
    <div style={{marginBottom:12}}>
      <button onClick={onAdvisor} style={{width:"100%",background:"#4eca8b15",border:"1px solid #4eca8b30",color:"#4eca8b",borderRadius:10,padding:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>📋 Follow-Up Plan</button>
      {advisor?.loading&&<div style={{color:"#55556a",fontSize:13,marginTop:8,textAlign:"center"}}>Building...</div>}
      {advisor?.plan&&<div style={{marginTop:9,background:"#0d0d14",borderRadius:10,padding:12}}><div style={{fontSize:12,color:"#4eca8b",fontWeight:700,marginBottom:5}}>NEXT: {advisor.plan.nextAction?.toUpperCase()} · {advisor.plan.when}</div><div style={{fontSize:13,lineHeight:1.6,marginBottom:7}}>{advisor.plan.message}</div><div style={{fontSize:12,color:"#55556a"}}>{advisor.plan.longTerm}</div></div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
      {[["✨",onScore,"#1db954"],["💬",onText,"#5b9cf6"],["📢",onVM,"#f5a623"],["🧠",onMemory,"#1db954"],["🏠",onTx,"#4eca8b"]].map(([lbl,fn,c])=><button key={lbl} onClick={fn} style={{background:c+"15",border:`1px solid ${c}30`,color:c,borderRadius:9,padding:"9px 4px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14,textAlign:"center"}}>{lbl}</button>)}
    </div>
    <button onClick={()=>onSave({notes,next_follow_up:followUp,status})} style={{width:"100%",marginTop:10,background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:12,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save ✓</button>
  </Modal>;
}

function TextModal({lead,onClose}) {
  const [type,setType]=useState("checkin");
  const firstName = (lead.name||"there").split(" ")[0];
  const [text,setText]=useState(TEXT_TEMPLATES.checkin(firstName));
  const [loading,setLoading]=useState(false);
  const TYPES=[{id:"checkin",label:"Check-in"},{id:"market",label:"Market Update"},{id:"reengage",label:"Re-engage"},{id:"birthday",label:"Birthday 🎂"},{id:"holiday",label:"Holiday 🎄"}];
  const aiRewrite=async()=>{setLoading(true);try{const r=await callClaude("You are texting a real estate contact for an agent. Warm, casual, human, not salesy. Short. No hashtags.",`Type:${type}. Contact:${firstName}, in ${lead.city||""}. Notes:"${lead.notes||""}". Write the text.`);setText(r);}catch{}setLoading(false);};
  return <Modal title={`Text ${firstName}`} onClose={onClose}>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{TYPES.map(t=><button key={t.id} onClick={()=>{setType(t.id);setText(TEXT_TEMPLATES[t.id](firstName));}} style={{background:type===t.id?"#1db954":"#16161f",color:type===t.id?"#09090e":"#8888a0",border:`1px solid ${type===t.id?"#1db954":"#22222e"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{t.label}</button>)}</div>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={5} style={{width:"100%",background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:10,padding:12,color:"#f0eee8",fontFamily:"inherit",fontSize:14,resize:"vertical",boxSizing:"border-box",lineHeight:1.65,outline:"none"}}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginTop:11}}>
      <button onClick={aiRewrite} disabled={loading} style={{background:"#1db95415",border:"1px solid #1db95430",color:"#1db954",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{loading?"Writing...":"✨ AI Rewrite"}</button>
      <a href={`sms:${lead.phone}?body=${encodeURIComponent(text)}`} style={{background:"#5b9cf6",color:"#fff",borderRadius:10,padding:11,fontWeight:900,textDecoration:"none",textAlign:"center",fontSize:13,display:"block"}}>Send SMS →</a>
    </div>
  </Modal>;
}

function VoicemailModal({lead,onClose}) {
  const firstName = (lead.name||"there").split(" ")[0];
  const [type,setType]=useState("firstTouch");
  const [script,setScript]=useState(VOICEMAIL_TEMPLATES.firstTouch(firstName));
  const [loading,setLoading]=useState(false);
  const TYPES=[{id:"firstTouch",label:"First Touch"},{id:"followUp",label:"Follow-Up"},{id:"expired",label:"Expired"},{id:"fsbo",label:"FSBO"},{id:"reEngage",label:"Re-Engage"}];
  const aiRewrite=async()=>{setLoading(true);try{const r=await callClaude("Write a voicemail script for a real estate agent. Warm, professional, brief (20-30 seconds). Conversational.",`Type:${type}. Lead:${firstName}, in ${lead.city||""}. Notes:"${lead.notes||""}". Write the script.`);setScript(r);}catch{}setLoading(false);};
  return <Modal title={`Voicemail — ${firstName}`} onClose={onClose}>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{TYPES.map(t=><button key={t.id} onClick={()=>{setType(t.id);setScript(VOICEMAIL_TEMPLATES[t.id](firstName));}} style={{background:type===t.id?"#f5a623":"#16161f",color:type===t.id?"#09090e":"#8888a0",border:`1px solid ${type===t.id?"#f5a623":"#22222e"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{t.label}</button>)}</div>
    <div style={{background:"#0d0d14",borderRadius:10,padding:"8px 12px",marginBottom:10,border:"1px solid #1e1e28",fontSize:12,color:"#8888a0"}}>~{Math.round(script.split(" ").length/2.5)} seconds</div>
    <textarea value={script} onChange={e=>setScript(e.target.value)} rows={6} style={{width:"100%",background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:10,padding:12,color:"#f0eee8",fontFamily:"inherit",fontSize:14,resize:"vertical",boxSizing:"border-box",lineHeight:1.65,outline:"none"}}/>
    <button onClick={aiRewrite} disabled={loading} style={{width:"100%",marginTop:11,background:"#f5a62318",border:"1px solid #f5a62330",color:"#f5a623",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{loading?"Writing...":"✨ AI Rewrite"}</button>
  </Modal>;
}

function MemoryModal({lead,onClose,onBuild,onSave}) {
  const [mem,setMem]=useState(lead.ai_memory||lead.aiMemory||{personality:"",objections:"",goals:"",budget:"",timing:"",style:"",insight:""});
  return <Modal title={`🧠 Memory — ${lead.name}`} onClose={onClose} wide>
    <button onClick={onBuild} style={{width:"100%",marginBottom:14,background:"#1db95418",border:"1px solid #1db95435",color:"#1db954",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{lead.building?"Building...":"✨ Auto-Build from Notes"}</button>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
      {[["personality","Personality"],["style","Comm Style"],["goals","Goals"],["budget","Budget"],["timing","Timing"],["objections","Objections"],["insight","Key Insight"]].map(([k,lbl])=><div key={k} style={{gridColumn:k==="insight"?"1 / -1":"auto"}}><Label>{lbl}</Label><input value={mem[k]||""} onChange={e=>setMem(p=>({...p,[k]:e.target.value}))} style={iS}/></div>)}
    </div>
    <button onClick={()=>onSave(mem)} style={{width:"100%",marginTop:14,background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:12,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save Memory ✓</button>
  </Modal>;
}

function TxModal({lead,onClose,onSave}) {
  const DEFAULT_MILESTONES=["Listing Agreement","Photos Scheduled","Listed on MLS","Offer Received","Under Contract","Inspection","Appraisal","Clear to Close","Closed"];
  const [tx,setTx]=useState(lead.transaction||{stage:"Active Listing",address:lead.address||"",price:"",closingDate:"",milestones:DEFAULT_MILESTONES.map(l=>({label:l,done:false}))});
  return <Modal title={`🏠 Transaction — ${lead.name}`} onClose={onClose} wide>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:14}}>
      <div><Label>Stage</Label><input value={tx.stage} onChange={e=>setTx(p=>({...p,stage:e.target.value}))} style={iS}/></div>
      <div><Label>Price</Label><input value={tx.price} onChange={e=>setTx(p=>({...p,price:e.target.value}))} style={iS} placeholder="$000,000"/></div>
      <div style={{gridColumn:"1 / -1"}}><Label>Property Address</Label><input value={tx.address} onChange={e=>setTx(p=>({...p,address:e.target.value}))} style={iS}/></div>
      <div><Label>Target Close Date</Label><input type="date" value={tx.closingDate} onChange={e=>setTx(p=>({...p,closingDate:e.target.value}))} style={iS}/></div>
    </div>
    <Label>Milestones</Label>
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>{tx.milestones.map((m,i)=><button key={i} onClick={()=>setTx(p=>({...p,milestones:p.milestones.map((ms,idx)=>idx===i?{...ms,done:!ms.done}:ms)}))} style={{background:m.done?"#4eca8b18":"#16161f",border:`1px solid ${m.done?"#4eca8b40":"#22222e"}`,color:m.done?"#4eca8b":"#8888a0",borderRadius:20,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{m.done?"✓ ":""}{m.label}</button>)}</div>
    <button onClick={()=>onSave(tx)} style={{width:"100%",background:"#4eca8b",color:"#09090e",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save Transaction ✓</button>
  </Modal>;
}
