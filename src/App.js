import { useState, useRef } from "react";

const SEED_LEADS = [];
const SEED_INVESTORS = [];
const SEED_PAST_CLIENTS = [];

const daysSince = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
const today = () => new Date().toISOString().split("T")[0];
const statusColor = (s) => s === "Hot" ? "#e05555" : s === "Warm" ? "#f5a623" : "#5b9cf6";
const scoreColor = (n) => n == null ? "#55556a" : n >= 75 ? "#e05555" : n >= 50 ? "#f5a623" : n >= 25 ? "#5b9cf6" : "#55556a";
const scoreLabel = (n) => n == null ? "Unscored" : n >= 75 ? "🔥 Call Now" : n >= 50 ? "⚡ This Week" : n >= 25 ? "🧊 Nurture" : "❄ Re-engage";
const INV_PIPELINE = ["Prospect","Active","Reviewing Deals","Funding","Repeat Investor","Inactive"];

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
      <defs>
        <linearGradient id="cfg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1db954"/>
          <stop offset="100%" stopColor="#17a349"/>
        </linearGradient>
      </defs>
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
const inputStyle = {width:"100%",background:"#16161f",border:"1px solid #22222e",borderRadius:8,padding:"9px 11px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,boxSizing:"border-box",outline:"none"};
const selStyle = {background:"#111118",border:"1px solid #1e1e28",borderRadius:8,padding:"7px 10px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,cursor:"pointer"};
const iconBtn = (c) => ({background:c+"15",border:`1px solid ${c}28`,color:c,borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"});

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
  followUp:(n)=>`Hey ${n}, just following up from my last message. I know you're busy — totally get it. I just wanted to make sure you got my info. I'm here whenever the time is right.`,
  expired:(n)=>`Hey ${n}, I noticed your listing recently came off the market and wanted to reach out personally. I've had a lot of success in your area and I'd love to share a few ideas. Give me a call back whenever works — no obligation at all.`,
  fsbo:(n)=>`Hey ${n}, I saw you're selling your home on your own and just wanted to reach out as a resource — not to pitch you, just to be helpful. Happy to answer any questions for free. Call or text anytime.`,
  reEngage:(n)=>`Hey ${n}, I know it's been a little while. Just wanted to check in and see if anything has changed. No pressure whatsoever — I'm still here whenever you're ready.`,
};

export default function ClientFlowCRM() {
  const [leads, setLeads] = useState(SEED_LEADS);
  const [investors, setInvestors] = useState(SEED_INVESTORS);
  const [pastClients, setPastClients] = useState(SEED_PAST_CLIENTS);
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
  const [fZip, setFZip] = useState("All");
  const [toast, setToast] = useState(null);
  const [scoringId, setScoringId] = useState(null);
  const [newLead, setNewLead] = useState({name:"",phone:"",email:"",type:"Buyer",status:"Warm",city:"",zip:"",address:"",source:"",birthday:"",notes:""});
  const [newInv, setNewInv] = useState({name:"",phone:"",email:"",city:"",zip:"",cashBuyer:false,budgetMin:"",budgetMax:"",propertyTypes:"",preferredAreas:"",riskTolerance:"Moderate",expectedROI:"",timeline:"",dealStructure:"Cash",notes:""});
  const [newPastClient, setNewPastClient] = useState({name:"",phone:"",email:"",city:"",zip:"",address:"",closedDate:"",salePrice:"",propertyType:"",notes:"",referralGiven:false});
  const fileRef = useRef();

  const todayStr = today();
  const activeLeads = leads.filter(l=>!l.dnc);
  const callList = activeLeads.filter(l=>l.nextFollowUp<=todayStr).sort((a,b)=>(b.aiScore||0)-(a.aiScore||0));
  const currentCall = callList[callIdx];
  const dncLeads = leads.filter(l=>l.dnc);
  const allCities = ["All",...new Set(activeLeads.map(l=>l.city).filter(Boolean).sort())];
  const zipsForCity = fCity==="All"?["All",...new Set(activeLeads.map(l=>l.zip).filter(Boolean).sort())]:["All",...new Set(activeLeads.filter(l=>l.city===fCity).map(l=>l.zip).filter(Boolean).sort())];
  const transactions = leads.filter(l=>l.transaction);
  const pipeline = {Hot:activeLeads.filter(l=>l.status==="Hot"),Warm:activeLeads.filter(l=>l.status==="Warm"),Cold:activeLeads.filter(l=>l.status==="Cold")};
  const geoData = activeLeads.reduce((acc,l)=>{if(!l.city)return acc;if(!acc[l.city])acc[l.city]={};if(!acc[l.city][l.zip||"No ZIP"])acc[l.city][l.zip||"No ZIP"]=[];acc[l.city][l.zip||"No ZIP"].push(l);return acc;},{});

  const showToast = (msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};
  const updateLead = (id,patch)=>setLeads(p=>p.map(l=>l.id===id?{...l,...patch}:l));
  const updateInvestor = (id,patch)=>setInvestors(p=>p.map(i=>i.id===id?{...i,...patch}:i));
  const updatePastClient = (id,patch)=>setPastClients(p=>p.map(c=>c.id===id?{...c,...patch}:c));

  const scoreLead = async(lead)=>{
    setScoringId(lead.id);
    try {
      const text = await callClaude("You are a real estate AI scoring leads. Return ONLY valid JSON: {\"score\":0-100,\"reason\":\"1 sentence\",\"priority\":\"Call Now|This Week|Nurture|Re-engage\"}",`Name:${lead.name},Type:${lead.type},Status:${lead.status},Source:${lead.source},City:${lead.city},Calls:${lead.calls},Days since contact:${daysSince(lead.lastContact)},Streak:${lead.streak},Notes:"${lead.notes}"`);
      const p=JSON.parse(text.replace(/```json|```/g,"").trim());
      updateLead(lead.id,{aiScore:p.score,aiScoreReason:p.reason,aiPriority:p.priority});
    } catch{showToast("Score failed","error");}
    setScoringId(null);
  };
  const scoreAll = async()=>{for(const l of activeLeads.filter(x=>x.aiScore===null))await scoreLead(l);showToast("All leads scored ✓");};

  const genOpener = async(lead)=>{
    setLoadingOpener(true);setOpener("");
    try {
      const mem=lead.aiMemory?`Memory: personality=${lead.aiMemory.personality}, objections="${lead.aiMemory.objections}", style="${lead.aiMemory.style}".`:"";
      const text=await callClaude("You are helping a real estate agent make cold calls. Write a SHORT warm natural opening (2 sentences max). Conversational, not salesy.",`Lead:${lead.name},Type:${lead.type},Status:${lead.status},Source:${lead.source},City:${lead.city},Notes:"${lead.notes}". ${mem}`);
      setOpener(text);
    } catch{setOpener(`Hey ${lead.name.split(" ")[0]}, just wanted to reach out real quick...`);}
    setLoadingOpener(false);
  };

  const handleObjection = async(objection,lead)=>{
    setCoach({objection,response:"",loading:true});
    try {
      const mem=lead.aiMemory?`Their personality: ${lead.aiMemory.personality}.`:"";
      const text=await callClaude("You are a real estate sales coach. Give a SHORT natural confident response to this objection (2-3 sentences). Empathetic, keeps conversation going.",`Lead:${lead.name},Type:${lead.type},City:${lead.city}. ${mem} Objection:"${objection}"`);
      setCoach({objection,response:text,loading:false});
    } catch{setCoach({objection,response:"Acknowledge, empathize, ask one open question.",loading:false});}
  };

  const getAdvisor = async(lead)=>{
    setAdvisor({plan:null,loading:true});
    try {
      const text=await callClaude("You are a real estate follow-up strategist. Return ONLY valid JSON: {\"nextAction\":\"call|text|email\",\"when\":\"e.g. Tomorrow 10am\",\"message\":\"exactly what to say\",\"channel\":\"why\",\"longTerm\":\"30-day strategy\"}",`Lead:${lead.name},Type:${lead.type},Status:${lead.status},Last contact:${lead.lastContact}(${daysSince(lead.lastContact)} days ago),Calls:${lead.calls},Notes:"${lead.notes}"`);
      setAdvisor({plan:JSON.parse(text.replace(/```json|```/g,"").trim()),loading:false});
    } catch{setAdvisor({plan:null,loading:false});}
  };

  const buildMemory = async(lead)=>{
    setMemoryLead({...lead,building:true});
    try {
      const text=await callClaude("Build a relationship memory profile. Return ONLY valid JSON: {\"personality\":\"string\",\"objections\":\"string\",\"goals\":\"string\",\"budget\":\"string or null\",\"timing\":\"string\",\"style\":\"string\",\"notes\":\"1 sentence insight\"}",`Lead:${lead.name},Type:${lead.type},Status:${lead.status},Calls:${lead.calls},Notes:"${lead.notes}",Source:${lead.source}`);
      const mem=JSON.parse(text.replace(/```json|```/g,"").trim());
      updateLead(lead.id,{aiMemory:mem});
      setMemoryLead({...lead,aiMemory:mem,building:false});
    } catch{setMemoryLead(l=>({...l,building:false}));}
  };

  const runRevenueEngine = async()=>{
    setRevenueLoading(true);setRevenueData(null);
    try {
      const summary=activeLeads.map(l=>`${l.name}(${l.type},${l.status},score:${l.aiScore},lastContact:${daysSince(l.lastContact)}d,calls:${l.calls})`).join("; ");
      const text=await callClaude("You are an autonomous revenue engine for a solo real estate agent. Return ONLY valid JSON: {\"missedMoney\":[{\"issue\":\"string\",\"fix\":\"string\",\"urgency\":\"High|Medium|Low\"}],\"hotOpportunities\":[{\"name\":\"string\",\"reason\":\"string\",\"action\":\"string\"}],\"pipelineWarnings\":[{\"warning\":\"string\",\"detail\":\"string\"}],\"topPriority\":\"1 sentence\",\"weeklyForecast\":\"1 sentence\"}",`Pipeline: ${summary}. Total:${activeLeads.length},Hot:${pipeline.Hot.length},Warm:${pipeline.Warm.length},Cold:${pipeline.Cold.length}.`,1500);
      setRevenueData(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch{showToast("Revenue scan failed","error");}
    setRevenueLoading(false);
  };

  const buildActionPlan = async()=>{
    setActionLoading(true);setActionItems(null);
    try {
      const summary=activeLeads.slice(0,12).map(l=>`${l.name}(${l.type},${l.status},score:${l.aiScore},due:${l.nextFollowUp},lastContact:${daysSince(l.lastContact)}d)`).join("; ");
      const text=await callClaude("You are an AI executive advisor for a solo real estate agent. Return ONLY valid JSON: {\"actions\":[{\"priority\":1,\"action\":\"string\",\"lead\":\"name or null\",\"why\":\"string\",\"channel\":\"call|text|email|other\",\"timeEst\":\"e.g. 5 min\"}],\"todayGoal\":\"string\",\"motivationalNote\":\"1 encouraging sentence\"}. Max 6 actions.",`Today: ${todayStr}. Due today:${callList.length}. Pipeline: ${summary}.`,1200);
      setActionItems(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch{showToast("Action plan failed","error");}
    setActionLoading(false);
  };

  const matchInvestors = async(dealDesc)=>{
    setInvMatchLoading(true);setInvMatch(null);
    try {
      const invSummary=investors.map(i=>`${i.name}(budget:$${i.budgetMin}-$${i.budgetMax},types:${i.propertyTypes?.join(",")},areas:${i.preferredAreas?.join(",")},ROI:${i.expectedROI}%,rehab:${i.rehabTolerance},cash:${i.cashBuyer},memory:"${i.aiMemory}")`).join("; ");
      const text=await callClaude("You are an AI investor matching engine. Return ONLY valid JSON: {\"matches\":[{\"investorName\":\"string\",\"fitScore\":0-100,\"reason\":\"string\",\"action\":\"string\",\"doNotSend\":false}],\"recommendation\":\"string\"}",`Deal: ${dealDesc}. Investors: ${invSummary}.`,1200);
      setInvMatch(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch{showToast("Match failed","error");}
    setInvMatchLoading(false);
  };

  const parseBuyBox = async(rawText,invId)=>{
    try {
      const text=await callClaude("Parse this investor buy box statement. Return ONLY valid JSON: {\"propertyTypes\":[],\"preferredAreas\":[],\"budgetMin\":0,\"budgetMax\":0,\"minROI\":0,\"rehabTolerance\":\"None|Light|Moderate|Heavy\",\"cashBuyer\":true,\"notes\":\"string\"}",`Statement: "${rawText}"`);
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      updateInvestor(invId,{propertyTypes:parsed.propertyTypes,preferredAreas:parsed.preferredAreas,budgetMin:parsed.budgetMin,budgetMax:parsed.budgetMax,expectedROI:parsed.minROI,rehabTolerance:parsed.rehabTolerance,cashBuyer:parsed.cashBuyer});
      showToast("Buy box parsed ✓");
    } catch{showToast("Parse failed","error");}
  };

  const runROISim = (inv)=>{
    const price=inv.budgetMax||200000;
    const rehab=inv.rehabTolerance==="Heavy"?price*0.25:inv.rehabTolerance==="Moderate"?price*0.12:price*0.05;
    const arv=(price+rehab)*1.3;
    const monthlyRent=price*0.009;
    const annualCash=monthlyRent*12-(price*0.008*12);
    const cashOnCash=((annualCash/(price+rehab))*100).toFixed(1);
    const flipProfit=(arv-price-rehab-price*0.08).toFixed(0);
    const capRate=((monthlyRent*12/price)*100).toFixed(1);
    const irr=(parseFloat(cashOnCash)*1.4).toFixed(1);
    setRoiSim({price,rehab:rehab.toFixed(0),arv:arv.toFixed(0),monthlyRent:monthlyRent.toFixed(0),cashOnCash,flipProfit,capRate,irr,holdReturn:(parseFloat(cashOnCash)*5).toFixed(1)});
  };

  const logCall = ()=>{
    const daysOut=callOutcome==="Callback"?1:callOutcome==="Spoke"?3:callOutcome==="Not Interested"?30:4;
    const nfu=new Date(Date.now()+daysOut*86400000).toISOString().split("T")[0];
    updateLead(currentCall.id,{lastContact:todayStr,calls:currentCall.calls+1,notes:callNote?`[${todayStr}] ${callOutcome}: ${callNote}\n${currentCall.notes}`:currentCall.notes,nextFollowUp:nfu,streak:callOutcome!=="Not Interested"?currentCall.streak+1:0,aiScore:null});
    setCallNote("");setCallOutcome("Voicemail");setShowLog(false);showToast("Call logged ✓");
    if(callIdx<callList.length-1){setCallIdx(i=>i+1);genOpener(callList[callIdx+1]);setCoach(null);setAdvisor(null);}
    else{setCallMode(false);setCallIdx(0);}
  };

  const addLead=()=>{setLeads(p=>[{...newLead,id:Date.now(),calls:0,lastContact:todayStr,nextFollowUp:todayStr,dnc:false,streak:0,tags:[],aiScore:null,aiMemory:null,transaction:null},...p]);setShowAddLead(false);setNewLead({name:"",phone:"",email:"",type:"Buyer",status:"Warm",city:"",zip:"",address:"",source:"",birthday:"",notes:""});showToast("Lead added ✓");};

  const addInvestor=()=>{
    const inv={...newInv,id:Date.now(),status:"Warm",pipeline:"Prospect",lastContact:todayStr,responseRate:0,reliability:0,speedToClose:"Unknown",commStyle:"Unknown",personality:"",tags:[],activityFeed:[],aiMemory:"",deployedCapital:0,avgDealSize:0,pastDeals:0,availableCapital:parseInt(newInv.budgetMax)||0,propertyTypes:newInv.propertyTypes?newInv.propertyTypes.split(",").map(s=>s.trim()):[],preferredAreas:newInv.preferredAreas?newInv.preferredAreas.split(",").map(s=>s.trim()):[],budgetMin:parseInt(newInv.budgetMin)||0,budgetMax:parseInt(newInv.budgetMax)||0,expectedROI:parseInt(newInv.expectedROI)||0};
    setInvestors(p=>[inv,...p]);setShowAddInvestor(false);setNewInv({name:"",phone:"",email:"",city:"",zip:"",cashBuyer:false,budgetMin:"",budgetMax:"",propertyTypes:"",preferredAreas:"",riskTolerance:"Moderate",expectedROI:"",timeline:"",dealStructure:"Cash",notes:""});showToast("Investor added ✓");
  };

  const addPastClient=()=>{
    setPastClients(p=>[{...newPastClient,id:Date.now()},...p]);
    setShowAddPastClient(false);
    setNewPastClient({name:"",phone:"",email:"",city:"",zip:"",address:"",closedDate:"",salePrice:"",propertyType:"",notes:"",referralGiven:false});
    showToast("Past client added ✓");
  };

  const handleCSV=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const lines=ev.target.result.split("\n").slice(1);
      const imported=lines.filter(Boolean).map((line,i)=>{const[name,phone,email,city,zip,address,type,status,source]=line.split(",").map(s=>s?.trim());return{id:Date.now()+i,name:name||"Unknown",phone:phone||"",email:email||"",city:city||"",zip:zip||"",address:address||"",type:type||"Buyer",status:status||"Cold",source:source||"Import",calls:0,lastContact:todayStr,nextFollowUp:todayStr,notes:"",dnc:false,streak:0,tags:["Imported"],birthday:"",aiScore:null,aiMemory:null,transaction:null};});
      setLeads(p=>[...imported,...p]);showToast(`${imported.length} leads imported ✓`);
    };
    reader.readAsText(file);
  };

  const filteredLeads = leads.filter(l=>{
    if(tab==="dnc")return l.dnc;if(l.dnc)return false;
    if(fStatus!=="All"&&l.status!==fStatus)return false;if(fType!=="All"&&l.type!==fType)return false;
    if(fCity!=="All"&&l.city!==fCity)return false;if(fZip!=="All"&&l.zip!==fZip)return false;
    if(search&&!l.name.toLowerCase().includes(search.toLowerCase())&&!l.phone.includes(search)&&!l.zip.includes(search)&&!l.city.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>(b.aiScore||0)-(a.aiScore||0));

  const geoDataFull = activeLeads.reduce((acc,l)=>{if(!l.city)return acc;if(!acc[l.city])acc[l.city]={};if(!acc[l.city][l.zip||"No ZIP"])acc[l.city][l.zip||"No ZIP"]=[];acc[l.city][l.zip||"No ZIP"].push(l);return acc;},{});

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

  return (
    <div style={{background:"#09090e",minHeight:"100vh",color:"#f0eee8",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",fontSize:14}}>
      <div style={{background:"#0d0d14",borderBottom:"1px solid #1a1a24",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1120,margin:"0 auto",padding:"0 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:9,background:"#040d07",border:"1px solid #1db95428",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 12px #1db95415"}}>
                <CFLogo size={22}/>
              </div>
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
            {[["Leads",activeLeads.length,"#1db954"],["Due Today",callList.length,"#e05555"],["Hot",pipeline.Hot.length,"#e05555"],["Warm",pipeline.Warm.length,"#f5a623"],["Cold",pipeline.Cold.length,"#5b9cf6"],["Investors",investors.length,"#1db954"],["Past Clients",pastClients.length,"#c8a96e"],["Transactions",transactions.length,"#4eca8b"]].map(([label,val,color])=>(
              <div key={label} style={{background:"#111118",borderRadius:12,border:`1px solid ${color}25`,padding:"14px 12px"}}>
                <div style={{fontSize:24,fontWeight:900,color}}>{val}</div>
                <div style={{fontSize:11,color:"#55556a",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
          {!actionItems&&!actionLoading&&<div style={{textAlign:"center",padding:"50px 20px",background:"#111118",borderRadius:16,border:"1px dashed #2e2e3e"}}><div style={{fontSize:36,marginBottom:12}}>🧠</div><div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Your AI executive advisor is ready</div><div style={{color:"#8888a0",fontSize:14,maxWidth:360,margin:"0 auto"}}>Tap Generate Plan to get your personalized action list based on your entire pipeline.</div></div>}
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
          {callList.length===0?<Empty icon="✓" msg="All caught up for today!"/>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{callList.map((l,i)=><LeadRow key={l.id} lead={l} rank={i+1} onSelect={()=>setSelectedLead(l)} onText={()=>setTextLead(l)} onVM={()=>setVmLead(l)} onDNC={()=>{updateLead(l.id,{dnc:true});showToast("Added to DNC");}} onScore={()=>scoreLead(l)} scoring={scoringId===l.id}/>)}</div>}
        </div>}

        {/* ALL LEADS */}
        {tab==="all"&&<div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, city, ZIP…" style={{flex:1,minWidth:170,background:"#111118",border:"1px solid #1e1e28",borderRadius:8,padding:"8px 12px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
            {["All","Hot","Warm","Cold"].map(s=><FPill key={s} label={s} active={fStatus===s} onClick={()=>setFStatus(s)} color={s==="Hot"?"#e05555":s==="Warm"?"#f5a623":s==="Cold"?"#5b9cf6":"#1db954"}/>)}
            {["All","Buyer","Seller"].map(s=><FPill key={s} label={s} active={fType===s} onClick={()=>setFType(s)} color="#5b9cf6"/>)}
            <select value={fCity} onChange={e=>{setFCity(e.target.value);setFZip("All");}} style={selStyle}>{allCities.map(c=><option key={c}>{c}</option>)}</select>
            <select value={fZip} onChange={e=>setFZip(e.target.value)} style={selStyle}>{zipsForCity.map(z=><option key={z}>{z}</option>)}</select>
            <label style={{background:"#111118",border:"1px solid #1e1e28",borderRadius:8,padding:"7px 12px",color:"#8888a0",cursor:"pointer",fontSize:13,fontWeight:600}}>⬆ CSV<input type="file" accept=".csv" ref={fileRef} onChange={handleCSV} style={{display:"none"}}/></label>
          </div>
          <div style={{color:"#55556a",fontSize:12,marginBottom:9}}>{filteredLeads.length} leads</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>{filteredLeads.map(l=><LeadRow key={l.id} lead={l} onSelect={()=>setSelectedLead(l)} onText={()=>setTextLead(l)} onVM={()=>setVmLead(l)} onDNC={()=>{updateLead(l.id,{dnc:!l.dnc});showToast(l.dnc?"Removed from DNC":"Added to DNC");}} onScore={()=>scoreLead(l)} scoring={scoringId===l.id}/>)}</div>
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
                    <ScoreRing score={l.aiScore}/><Avatar name={l.name} size={30}/>
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
          {Object.keys(geoDataFull).length===0&&<Empty icon="📍" msg="Add leads with a city and ZIP to see geo view"/>}
          {Object.entries(geoDataFull).sort(([a],[b])=>a.localeCompare(b)).map(([city,zips])=>{
            const all=Object.values(zips).flat(),hot=all.filter(l=>l.status==="Hot").length;
            return <div key={city} style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:8,borderBottom:"1px solid #1a1a24"}}>
                <div style={{fontWeight:900,fontSize:17}}>{city}</div>
                <div style={{fontSize:12,color:"#55556a"}}>{all.length} leads</div>
                {hot>0&&<Pill label={`${hot} Hot`} color="#e05555"/>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
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
                    <div style={{textAlign:"right"}}><div style={{fontWeight:900,fontSize:22,color:"#4eca8b"}}>{pct}%</div><div style={{fontSize:11,color:"#55556a"}}>{done}/{total} steps</div></div>
                  </div>
                  <div style={{height:6,background:"#1e1e28",borderRadius:3,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#4eca8b,#6ee8a8)",borderRadius:3,transition:"width 0.5s"}}/></div>
                </div>
                <div style={{padding:"12px 16px",display:"flex",flexWrap:"wrap",gap:8}}>
                  {tx.milestones.map((m,i)=><button key={i} onClick={()=>{const updated={...tx,milestones:tx.milestones.map((ms,idx)=>idx===i?{...ms,done:!ms.done}:ms)};updateLead(l.id,{transaction:updated});showToast("Milestone updated ✓");}} style={{background:m.done?"#4eca8b18":"#1e1e28",border:`1px solid ${m.done?"#4eca8b40":"#2e2e3e"}`,color:m.done?"#4eca8b":"#8888a0",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{m.done?"✓ ":""}{m.label}</button>)}
                </div>
                <div style={{padding:"0 16px 14px",display:"flex",gap:8}}>
                  <button onClick={()=>setTextLead(l)} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>💬 Text Client</button>
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
            {INV_PIPELINE.map(stage=>{
              const count=investors.filter(i=>i.pipeline===stage).length;
              return <div key={stage} style={{background:"#111118",borderRadius:10,border:"1px solid #1e1e28",padding:"10px 14px",flexShrink:0,minWidth:120,textAlign:"center"}}>
                <div style={{fontWeight:800,fontSize:18,color:"#1db954"}}>{count}</div>
                <div style={{fontSize:11,color:"#55556a",marginTop:2}}>{stage}</div>
              </div>;
            })}
          </div>
          <div style={{background:"#111118",borderRadius:14,border:"1px solid #1db95425",padding:"14px 16px",marginBottom:18}}>
            <div style={{fontSize:12,color:"#1db954",fontWeight:700,letterSpacing:0.8,marginBottom:10}}>🎯 AI DEAL MATCHING</div>
            <div style={{display:"flex",gap:8}}>
              <input id="dealDesc" placeholder='e.g. "2-unit multifamily, Detroit 48201, $180k, light rehab, 12% cap rate"' style={{flex:1,background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:8,padding:"9px 12px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
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
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <Avatar name={inv.name} size={42}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:800,fontSize:15}}>{inv.name}</span>
                      <Pill label={inv.pipeline} color="#1db954"/>
                      {inv.cashBuyer&&<Pill label="Cash" color="#f5a623"/>}
                    </div>
                    <div style={{fontSize:12,color:"#8888a0",marginTop:2}}>{inv.city} · Budget: ${(inv.budgetMin/1000).toFixed(0)}k–${(inv.budgetMax/1000).toFixed(0)}k · ROI: {inv.expectedROI}%+</div>
                  </div>
                  <div style={{fontSize:11,color:"#55556a",flexShrink:0}}>{daysSince(inv.lastContact)}d ago</div>
                </div>
                {inv.aiMemory&&<div style={{background:"#1db95410",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#1db95480",fontStyle:"italic"}}>🧠 {inv.aiMemory}</div>}
              </div>
            ))}
          </div>
        </div>}

        {/* PAST CLIENTS */}
        {tab==="pastclients"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div>
              <div style={{fontSize:20,fontWeight:900}}>Past Clients</div>
              <div style={{color:"#8888a0",fontSize:13,marginTop:2}}>{pastClients.length} clients · your most valuable asset</div>
            </div>
            <button onClick={()=>setShowAddPastClient(true)} style={{background:"#c8a96e",color:"#09090e",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Add Past Client</button>
          </div>
          {pastClients.length===0&&<div style={{textAlign:"center",padding:"60px 20px",background:"#111118",borderRadius:16,border:"1px dashed #2e2e3e"}}>
            <div style={{fontSize:40,marginBottom:12}}>⭐</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Your past clients live here</div>
            <div style={{color:"#8888a0",fontSize:14,maxWidth:360,margin:"0 auto 20px"}}>These are your warmest leads. Past clients who loved working with you are your best source of referrals. Keep them close.</div>
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
                      {client.referralGiven&&<Pill label="Gave Referral" color="#1db954"/>}
                      {client.propertyType&&<Pill label={client.propertyType} color="#5b9cf6"/>}
                    </div>
                    <div style={{fontSize:12,color:"#8888a0",marginTop:2}}>{client.city}{client.zip?` ${client.zip}`:""}{client.phone?` · ${client.phone}`:""}</div>
                    {client.address&&<div style={{fontSize:11,color:"#55556a",marginTop:1}}>{client.address}</div>}
                    <div style={{display:"flex",gap:12,marginTop:4}}>
                      {client.closedDate&&<div style={{fontSize:11,color:"#55556a"}}>Closed: {client.closedDate}</div>}
                      {client.salePrice&&<div style={{fontSize:11,color:"#c8a96e",fontWeight:700}}>{client.salePrice}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setTextLead(client)} style={iconBtn("#5b9cf6")}>💬</button>
                    <button onClick={()=>setSelectedPastClient(client)} style={iconBtn("#c8a96e")}>✏</button>
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
          {!revenueData&&!revenueLoading&&<div style={{textAlign:"center",padding:"50px 20px",background:"#111118",borderRadius:16,border:"1px dashed #2e2e3e"}}><div style={{fontSize:40,marginBottom:12}}>💰</div><div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Autonomous Revenue Engine</div><div style={{color:"#8888a0",fontSize:14,maxWidth:380,margin:"0 auto"}}>Tap Run Scan and AI analyzes your entire pipeline — finds where you're losing money and tells you exactly what to fix.</div></div>}
          {revenueLoading&&<div style={{textAlign:"center",padding:50,color:"#8888a0"}}><div style={{fontSize:28,marginBottom:10}}>🔍</div><div>Scanning your pipeline...</div></div>}
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
            <Avatar name={l.name}/><div style={{flex:1}}><div style={{fontWeight:700}}>{l.name}</div><div style={{fontSize:12,color:"#55556a"}}>{l.phone} · {l.city} {l.zip}</div></div>
            <button onClick={()=>{updateLead(l.id,{dnc:false});showToast("Removed from DNC");}} style={{background:"#4eca8b18",border:"1px solid #4eca8b35",color:"#4eca8b",borderRadius:8,padding:"6px 11px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Remove</button>
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
            <div style={{color:"#8888a0",fontSize:14,marginTop:3}}>{currentCall.city} {currentCall.zip} · {currentCall.type}</div>
            {currentCall.address&&<div style={{color:"#55556a",fontSize:12,marginTop:2}}>{currentCall.address}</div>}
            <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:8,flexWrap:"wrap"}}>
              <Pill label={currentCall.status} color={statusColor(currentCall.status)}/>
              {currentCall.aiScore!=null&&<Pill label={`Score: ${currentCall.aiScore}`} color={scoreColor(currentCall.aiScore)}/>}
              {currentCall.aiMemory&&<Pill label="🧠 Memory" color="#1db954"/>}
            </div>
            <a href={`tel:${currentCall.phone}`} style={{display:"inline-block",marginTop:14,background:"#4eca8b",color:"#fff",borderRadius:50,padding:"12px 28px",fontWeight:900,fontSize:17,textDecoration:"none"}}>📞 {currentCall.phone}</a>
          </div>
          {currentCall.aiMemory&&<div style={{background:"#1db95410",border:"1px solid #1db95425",borderRadius:13,padding:13,marginBottom:11}}>
            <div style={{fontSize:11,color:"#1db954",fontWeight:700,letterSpacing:0.8,marginBottom:8}}>🧠 RELATIONSHIP MEMORY</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[["Personality",currentCall.aiMemory.personality],["Style",currentCall.aiMemory.style],["Goals",currentCall.aiMemory.goals],["Timing",currentCall.aiMemory.timing],["Objections",currentCall.aiMemory.objections],["Budget",currentCall.aiMemory.budget||"Unknown"]].map(([k,v])=>(
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
            <button onClick={()=>setVmLead(currentCall)} style={{background:"#f5a62318",border:"1px solid #f5a62330",color:"#f5a623",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>📢 Voicemail</button>
            <button onClick={()=>setShowLog(true)} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Log Call →</button>
          </div>
        </div>
      </div>}

      {/* MODALS */}
      {showLog&&currentCall&&<Modal title="Log Call" onClose={()=>setShowLog(false)}>
        <div style={{marginBottom:12}}><Label>Outcome</Label><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{["Voicemail","Spoke","Callback","Not Interested","No Answer"].map(o=><button key={o} onClick={()=>setCallOutcome(o)} style={{background:callOutcome===o?"#1db954":"#16161f",color:callOutcome===o?"#09090e":"#8888a0",border:`1px solid ${callOutcome===o?"#1db954":"#22222e"}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>{o}</button>)}</div></div>
        <div style={{marginBottom:14}}><Label>Notes</Label><textarea value={callNote} onChange={e=>setCallNote(e.target.value)} rows={3} placeholder="What happened?" style={{width:"100%",background:"#16161f",border:"1px solid #22222e",borderRadius:8,padding:"9px 11px",color:"#f0eee8",fontFamily:"inherit",fontSize:13,resize:"vertical",boxSizing:"border-box",outline:"none"}}/></div>
        <button onClick={logCall} style={{width:"100%",background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save & Next →</button>
      </Modal>}

      {textLead&&<TextModal lead={textLead} onClose={()=>setTextLead(null)}/>}
      {vmLead&&<VoicemailModal lead={vmLead} onClose={()=>setVmLead(null)}/>}
      {memoryLead&&<MemoryModal lead={memoryLead} onClose={()=>setMemoryLead(null)} onBuild={()=>buildMemory(memoryLead)} onSave={(mem)=>{updateLead(memoryLead.id,{aiMemory:mem});showToast("Memory saved ✓");setMemoryLead(null);}}/>}
      {txLead&&<TxModal lead={txLead} onClose={()=>setTxLead(null)} onSave={(tx)=>{updateLead(txLead.id,{transaction:tx});showToast("Transaction saved ✓");setTxLead(null);}}/>}

      {selectedLead&&<LeadDetail lead={selectedLead} onClose={()=>setSelectedLead(null)} onText={()=>{setTextLead(selectedLead);setSelectedLead(null);}} onVM={()=>{setVmLead(selectedLead);setSelectedLead(null);}} onMemory={()=>{buildMemory(selectedLead);setMemoryLead({...selectedLead});setSelectedLead(null);}} onDNC={()=>{updateLead(selectedLead.id,{dnc:!selectedLead.dnc});showToast(selectedLead.dnc?"Removed from DNC":"Added to DNC");setSelectedLead(null);}} onScore={()=>scoreLead(selectedLead)} onSave={(patch)=>{updateLead(selectedLead.id,patch);showToast("Saved ✓");setSelectedLead(null);}} onAdvisor={()=>getAdvisor(selectedLead)} onTx={()=>{setTxLead(selectedLead);setSelectedLead(null);}} scoring={scoringId===selectedLead.id} advisor={advisor}/>}

      {selectedInvestor&&<InvestorDetail investor={selectedInvestor} onClose={()=>setSelectedInvestor(null)} onSave={(patch)=>{updateInvestor(selectedInvestor.id,patch);showToast("Saved ✓");setSelectedInvestor(null);}} onParseBuyBox={(txt)=>parseBuyBox(txt,selectedInvestor.id)} onROI={()=>runROISim(selectedInvestor)} roiSim={roiSim} onText={()=>{setTextLead(selectedInvestor);setSelectedInvestor(null);}}/>}

      {selectedPastClient&&<Modal title={selectedPastClient.name} onClose={()=>setSelectedPastClient(null)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["name","Name"],["phone","Phone"],["email","Email"],["city","City"],["zip","ZIP"],["address","Address"],["closedDate","Closed Date"],["salePrice","Sale Price"],["propertyType","Property Type"]].map(([k,lbl])=>(
            <div key={k} style={{gridColumn:k==="address"||k==="email"?"1 / -1":"auto"}}>
              <Label>{lbl}</Label>
              <input value={selectedPastClient[k]||""} onChange={e=>setSelectedPastClient(p=>({...p,[k]:e.target.value}))} style={inputStyle}/>
            </div>
          ))}
          <div style={{gridColumn:"1 / -1"}}><Label>Notes</Label><textarea value={selectedPastClient.notes||""} onChange={e=>setSelectedPastClient(p=>({...p,notes:e.target.value}))} rows={3} style={{...inputStyle,resize:"vertical"}}/></div>
          <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={selectedPastClient.referralGiven||false} onChange={e=>setSelectedPastClient(p=>({...p,referralGiven:e.target.checked}))} style={{width:16,height:16}}/><Label>Has given a referral</Label></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
          <button onClick={()=>setTextLead(selectedPastClient)} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>💬 Text</button>
          <button onClick={()=>{updatePastClient(selectedPastClient.id,selectedPastClient);showToast("Saved ✓");setSelectedPastClient(null);}} style={{background:"#c8a96e",color:"#09090e",border:"none",borderRadius:10,padding:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Save ✓</button>
        </div>
      </Modal>}

      {showAddPastClient&&<Modal title="Add Past Client" onClose={()=>setShowAddPastClient(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["name","Full Name *","text"],["phone","Phone","text"],["email","Email","text"],["city","City","text"],["zip","ZIP","text"],["address","Property Address","text"],["closedDate","Closed Date","date"],["salePrice","Sale Price","text"],["propertyType","Property Type","text"]].map(([k,lbl,t])=>(
            <div key={k} style={{gridColumn:k==="address"||k==="email"?"1 / -1":"auto"}}>
              <Label>{lbl}</Label>
              <input value={newPastClient[k]} onChange={e=>setNewPastClient(p=>({...p,[k]:e.target.value}))} type={t} style={inputStyle}/>
            </div>
          ))}
          <div style={{gridColumn:"1 / -1"}}><Label>Notes</Label><textarea value={newPastClient.notes} onChange={e=>setNewPastClient(p=>({...p,notes:e.target.value}))} rows={2} style={{...inputStyle,resize:"vertical"}}/></div>
          <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={newPastClient.referralGiven} onChange={e=>setNewPastClient(p=>({...p,referralGiven:e.target.checked}))} style={{width:16,height:16}}/><Label>Has given a referral</Label></div>
        </div>
        <button onClick={addPastClient} disabled={!newPastClient.name} style={{width:"100%",marginTop:16,background:newPastClient.name?"#c8a96e":"#22222e",color:newPastClient.name?"#09090e":"#55556a",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:newPastClient.name?"pointer":"not-allowed",fontFamily:"inherit"}}>Add Past Client</button>
      </Modal>}

      {showAddLead&&<Modal title="Add New Lead" onClose={()=>setShowAddLead(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["name","Full Name *","text"],["phone","Phone *","text"],["email","Email","text"],["city","City","text"],["zip","ZIP Code","text"],["address","Street Address","text"],["source","Source","text"],["birthday","Birthday","date"]].map(([k,lbl,t])=>(
            <div key={k} style={{gridColumn:k==="address"||k==="email"?"1 / -1":"auto"}}><Label>{lbl}</Label><input value={newLead[k]} onChange={e=>setNewLead(p=>({...p,[k]:e.target.value}))} type={t} style={inputStyle}/></div>
          ))}
          <div><Label>Type</Label><select value={newLead.type} onChange={e=>setNewLead(p=>({...p,type:e.target.value}))} style={inputStyle}><option>Buyer</option><option>Seller</option></select></div>
          <div><Label>Status</Label><select value={newLead.status} onChange={e=>setNewLead(p=>({...p,status:e.target.value}))} style={inputStyle}><option>Hot</option><option>Warm</option><option>Cold</option></select></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Notes</Label><textarea value={newLead.notes} onChange={e=>setNewLead(p=>({...p,notes:e.target.value}))} rows={2} style={{...inputStyle,resize:"vertical"}}/></div>
        </div>
        <button onClick={addLead} disabled={!newLead.name||!newLead.phone} style={{width:"100%",marginTop:16,background:newLead.name&&newLead.phone?"#1db954":"#22222e",color:newLead.name&&newLead.phone?"#09090e":"#55556a",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:newLead.name&&newLead.phone?"pointer":"not-allowed",fontFamily:"inherit"}}>Add Lead</button>
      </Modal>}

      {showAddInvestor&&<Modal title="Add Investor" onClose={()=>setShowAddInvestor(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["name","Full Name *"],["phone","Phone *"],["email","Email"],["city","City"],["zip","ZIP"],["timeline","Timeline"]].map(([k,lbl])=>(
            <div key={k}><Label>{lbl}</Label><input value={newInv[k]} onChange={e=>setNewInv(p=>({...p,[k]:e.target.value}))} style={inputStyle}/></div>
          ))}
          {[["budgetMin","Budget Min ($)"],["budgetMax","Budget Max ($)"],["expectedROI","Target ROI (%)"]].map(([k,lbl])=>(
            <div key={k}><Label>{lbl}</Label><input value={newInv[k]} onChange={e=>setNewInv(p=>({...p,[k]:e.target.value}))} type="number" style={inputStyle}/></div>
          ))}
          <div><Label>Risk Tolerance</Label><select value={newInv.riskTolerance} onChange={e=>setNewInv(p=>({...p,riskTolerance:e.target.value}))} style={inputStyle}><option>Conservative</option><option>Moderate</option><option>Aggressive</option></select></div>
          <div><Label>Deal Structure</Label><select value={newInv.dealStructure} onChange={e=>setNewInv(p=>({...p,dealStructure:e.target.value}))} style={inputStyle}><option>Cash</option><option>Financing</option><option>Both</option></select></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Property Types (comma separated)</Label><input value={newInv.propertyTypes} onChange={e=>setNewInv(p=>({...p,propertyTypes:e.target.value}))} placeholder="e.g. Multifamily, Single Family" style={inputStyle}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Preferred Areas (comma separated)</Label><input value={newInv.preferredAreas} onChange={e=>setNewInv(p=>({...p,preferredAreas:e.target.value}))} placeholder="e.g. Detroit, Southfield" style={inputStyle}/></div>
          <div style={{gridColumn:"1 / -1"}}><Label>Notes / Buy Box</Label><textarea value={newInv.notes} onChange={e=>setNewInv(p=>({...p,notes:e.target.value}))} rows={3} style={{...inputStyle,resize:"vertical"}}/></div>
          <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={newInv.cashBuyer} onChange={e=>setNewInv(p=>({...p,cashBuyer:e.target.checked}))} style={{width:16,height:16}}/><Label>Cash Buyer</Label></div>
        </div>
        <button onClick={addInvestor} disabled={!newInv.name||!newInv.phone} style={{width:"100%",marginTop:16,background:newInv.name&&newInv.phone?"#1db954":"#22222e",color:newInv.name&&newInv.phone?"#09090e":"#55556a",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:newInv.name&&newInv.phone?"pointer":"not-allowed",fontFamily:"inherit"}}>Add Investor</button>
      </Modal>}

    </div>
  );
}

function LeadRow({lead,rank,onSelect,onText,onVM,onDNC,onScore,scoring}) {
  const ds=daysSince(lead.lastContact);
  return <div onClick={onSelect} style={{background:"#111118",borderRadius:13,border:"1px solid #1a1a24",padding:"12px 14px",display:"flex",alignItems:"center",gap:11,cursor:"pointer"}}>
    {rank&&<div style={{width:22,height:22,borderRadius:6,background:rank===1?"#e05555":rank===2?"#f5a623":"#1e1e28",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:rank<=2?"#fff":"#55556a",flexShrink:0}}>{rank}</div>}
    <ScoreRing score={lead.aiScore}/>
    <Avatar name={lead.name}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:14}}>{lead.name}</span>
        <Pill label={lead.status} color={statusColor(lead.status)}/>
        <Pill label={lead.type} color={lead.type==="Buyer"?"#5b9cf6":"#f5a623"}/>
        {lead.aiScore!=null&&<Pill label={scoreLabel(lead.aiScore)} color={scoreColor(lead.aiScore)}/>}
        {lead.aiMemory&&<span style={{fontSize:12}} title="Memory">🧠</span>}
        {lead.transaction&&<span style={{fontSize:12}} title="Transaction">🏠</span>}
      </div>
      <div style={{fontSize:12,color:"#8888a0",marginTop:2}}>{lead.city} · {lead.zip} · {lead.phone}</div>
      <div style={{fontSize:11,color:"#55556a",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.notes}</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
      <div style={{fontSize:11,color:ds>14?"#e05555":"#55556a"}}>{ds}d ago</div>
      {lead.streak>0&&<div style={{fontSize:11,color:"#1db954"}}>🔥{lead.streak}</div>}
      <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
        <button onClick={onScore} style={iconBtn("#1db954")}>{scoring?"…":"✨"}</button>
        <button onClick={onText} style={iconBtn("#5b9cf6")}>💬</button>
        <button onClick={onVM} style={iconBtn("#f5a623")}>📢</button>
        <button onClick={onDNC} style={iconBtn(lead.dnc?"#4eca8b":"#e05555")}>🚫</button>
      </div>
    </div>
  </div>;
}

function LeadDetail({lead,onClose,onText,onVM,onMemory,onDNC,onScore,onSave,onAdvisor,onTx,scoring,advisor}) {
  const [notes,setNotes]=useState(lead.notes);
  const [followUp,setFollowUp]=useState(lead.nextFollowUp);
  const [status,setStatus]=useState(lead.status);
  return <Modal title={lead.name} onClose={onClose} wide>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,background:"#0d0d14",borderRadius:12,padding:"12px 13px"}}>
      <Avatar name={lead.name} size={48}/>
      <div style={{flex:1}}><div style={{fontWeight:900,fontSize:16}}>{lead.name}</div><div style={{fontSize:13,color:"#8888a0"}}>{lead.phone}{lead.email?` · ${lead.email}`:""}</div><div style={{fontSize:12,color:"#55556a"}}>{lead.address?`${lead.address}, `:""}{lead.city} {lead.zip}</div></div>
      <ScoreRing score={lead.aiScore}/>
    </div>
    {lead.aiScore!=null&&lead.aiScoreReason&&<div style={{background:"#0d0d14",borderRadius:10,padding:"10px 12px",marginBottom:12,border:`1px solid ${scoreColor(lead.aiScore)}25`}}><div style={{fontSize:11,color:scoreColor(lead.aiScore),fontWeight:700,marginBottom:3}}>AI SCORE REASON</div><div style={{fontSize:13,color:"#8888a0"}}>{lead.aiScoreReason}</div></div>}
    {lead.aiMemory&&<div style={{background:"#1db95410",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #1db95420"}}><div style={{fontSize:11,color:"#1db954",fontWeight:700,marginBottom:6}}>🧠 MEMORY</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{[["Personality",lead.aiMemory.personality],["Goals",lead.aiMemory.goals],["Timing",lead.aiMemory.timing],["Budget",lead.aiMemory.budget||"Unknown"]].map(([k,v])=><div key={k} style={{background:"#0d0d14",borderRadius:7,padding:"7px 9px"}}><div style={{fontSize:9,color:"#55556a",fontWeight:700,marginBottom:2}}>{k.toUpperCase()}</div><div style={{fontSize:12}}>{v}</div></div>)}</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>{[["Calls",lead.calls],["Streak",`🔥${lead.streak}`],["Last",`${daysSince(lead.lastContact)}d ago`]].map(([l,v])=><div key={l} style={{background:"#0d0d14",borderRadius:9,padding:"9px 10px",textAlign:"center",border:"1px solid #1a1a24"}}><div style={{fontSize:17,fontWeight:900}}>{v}</div><div style={{fontSize:10,color:"#55556a",marginTop:2}}>{l}</div></div>)}</div>
    <div style={{marginBottom:11}}><Label>Status</Label><div style={{display:"flex",gap:7}}>{["Hot","Warm","Cold"].map(s=><button key={s} onClick={()=>setStatus(s)} style={{flex:1,background:status===s?statusColor(s):"#16161f",color:status===s?"#fff":"#8888a0",border:`1px solid ${status===s?"transparent":"#22222e"}`,borderRadius:8,padding:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{s}</button>)}</div></div>
    <div style={{marginBottom:11}}><Label>Next Follow-Up</Label><input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)} style={inputStyle}/></div>
    <div style={{marginBottom:12}}><Label>Notes</Label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:"vertical"}}/></div>
    <div style={{marginBottom:12}}>
      <button onClick={onAdvisor} style={{width:"100%",background:"#4eca8b15",border:"1px solid #4eca8b30",color:"#4eca8b",borderRadius:10,padding:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>📋 Follow-Up Plan</button>
      {advisor?.loading&&<div style={{color:"#55556a",fontSize:13,marginTop:8,textAlign:"center"}}>Building...</div>}
      {advisor?.plan&&<div style={{marginTop:9,background:"#0d0d14",borderRadius:10,padding:12}}><div style={{fontSize:12,color:"#4eca8b",fontWeight:700,marginBottom:5}}>NEXT: {advisor.plan.nextAction?.toUpperCase()} · {advisor.plan.when}</div><div style={{fontSize:13,lineHeight:1.6,marginBottom:7}}>{advisor.plan.message}</div><div style={{fontSize:12,color:"#55556a"}}>{advisor.plan.longTerm}</div></div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
      {[["✨",onScore,"#1db954"],["💬",onText,"#5b9cf6"],["📢",onVM,"#f5a623"],["🧠",onMemory,"#1db954"],["🏠",onTx,"#4eca8b"]].map(([lbl,fn,c])=><button key={lbl} onClick={fn} style={{background:c+"15",border:`1px solid ${c}30`,color:c,borderRadius:9,padding:"9px 4px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14,textAlign:"center"}}>{lbl}</button>)}
    </div>
    <button onClick={()=>onSave({notes,nextFollowUp:followUp,status})} style={{width:"100%",marginTop:10,background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:12,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save ✓</button>
  </Modal>;
}

function InvestorDetail({investor,onClose,onSave,onParseBuyBox,onROI,roiSim,onText}) {
  const [notes,setNotes]=useState(investor.notes||"");
  const [pipeline,setPipeline]=useState(investor.pipeline);
  const [buyBoxRaw,setBuyBoxRaw]=useState("");
  return <Modal title={investor.name} onClose={onClose} wide>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,background:"#0d0d14",borderRadius:12,padding:"12px 13px"}}>
      <Avatar name={investor.name} size={48}/>
      <div style={{flex:1}}><div style={{fontWeight:900,fontSize:16}}>{investor.name}</div><div style={{fontSize:13,color:"#8888a0"}}>{investor.phone}{investor.email?` · ${investor.email}`:""}</div><div style={{fontSize:12,color:"#55556a"}}>{investor.city} {investor.zip}</div></div>
    </div>
    <div style={{background:"#1db95410",borderRadius:12,padding:13,marginBottom:12,border:"1px solid #1db95420"}}>
      <div style={{fontSize:11,color:"#1db954",fontWeight:700,marginBottom:10}}>💼 BUY BOX</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
        {[["Budget",`$${(investor.budgetMin/1000).toFixed(0)}k–$${(investor.budgetMax/1000).toFixed(0)}k`],["Target ROI",`${investor.expectedROI}%+`],["Property Types",investor.propertyTypes?.join(", ")||"—"],["Preferred Areas",investor.preferredAreas?.join(", ")||"—"],["Deal Structure",investor.dealStructure||"—"],["Cash Buyer",investor.cashBuyer?"Yes":"No"]].map(([k,v])=><div key={k} style={{background:"#0d0d14",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:9,color:"#55556a",fontWeight:700,marginBottom:2}}>{k.toUpperCase()}</div><div style={{fontSize:12}}>{v}</div></div>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={buyBoxRaw} onChange={e=>setBuyBoxRaw(e.target.value)} placeholder='"Only east-side Detroit, multifamily, no heavy rehab..."' style={{flex:1,background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:8,padding:"8px 11px",color:"#f0eee8",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
        <button onClick={()=>onParseBuyBox(buyBoxRaw)} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:8,padding:"8px 13px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12,flexShrink:0}}>AI Parse</button>
      </div>
    </div>
    {investor.aiMemory&&<div style={{background:"#0d0d14",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #1db95425",fontSize:13,color:"#1db95480",fontStyle:"italic"}}>🧠 {investor.aiMemory}</div>}
    <div style={{marginBottom:12}}><Label>Pipeline Stage</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{["Prospect","Active","Reviewing Deals","Funding","Repeat Investor","Inactive"].map(s=><button key={s} onClick={()=>setPipeline(s)} style={{background:pipeline===s?"#1db954":"#16161f",color:pipeline===s?"#09090e":"#8888a0",border:`1px solid ${pipeline===s?"#1db954":"#22222e"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"inherit"}}>{s}</button>)}</div></div>
    <div style={{marginBottom:12}}><Label>Notes</Label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:"vertical"}}/></div>
    <button onClick={onROI} style={{width:"100%",marginBottom:10,background:"#f5a62318",border:"1px solid #f5a62330",color:"#f5a623",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>📊 Run ROI Simulator</button>
    {roiSim&&<div style={{background:"#0d0d14",borderRadius:12,padding:13,marginBottom:12,border:"1px solid #f5a62330"}}>
      <div style={{fontSize:11,color:"#f5a623",fontWeight:700,marginBottom:10}}>ROI SIMULATION</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
        {[["Purchase Price",`$${parseInt(roiSim.price).toLocaleString()}`],["Est. Rehab",`$${parseInt(roiSim.rehab).toLocaleString()}`],["ARV",`$${parseInt(roiSim.arv).toLocaleString()}`],["Monthly Rent",`$${parseInt(roiSim.monthlyRent).toLocaleString()}`],["Cash-on-Cash",`${roiSim.cashOnCash}%`],["Cap Rate",`${roiSim.capRate}%`],["Est. IRR",`${roiSim.irr}%`],["Flip Profit",`$${parseInt(roiSim.flipProfit).toLocaleString()}`]].map(([k,v])=><div key={k} style={{background:"#111118",borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:9,color:"#55556a",fontWeight:700,marginBottom:2}}>{k.toUpperCase()}</div><div style={{fontSize:13,fontWeight:700,color:"#f5a623"}}>{v}</div></div>)}
      </div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <button onClick={onText} style={{background:"#5b9cf618",border:"1px solid #5b9cf630",color:"#5b9cf6",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>💬 Text</button>
      <button onClick={()=>onSave({notes,pipeline})} style={{background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Save ✓</button>
    </div>
  </Modal>;
}

function TextModal({lead,onClose}) {
  const [type,setType]=useState("checkin");
  const [text,setText]=useState(TEXT_TEMPLATES.checkin(lead.name.split(" ")[0]));
  const [loading,setLoading]=useState(false);
  const TYPES=[{id:"checkin",label:"Check-in"},{id:"market",label:"Market Update"},{id:"reengage",label:"Re-engage"},{id:"birthday",label:"Birthday 🎂"},{id:"holiday",label:"Holiday 🎄"}];
  const aiRewrite=async()=>{setLoading(true);try{const r=await callClaude("You are texting a real estate contact for an agent. Warm, casual, human, not salesy. Short. No hashtags.",`Type:${type}. Contact:${lead.name.split(" ")[0]}, in ${lead.city||""}. Notes:"${lead.notes||""}". Write the text.`);setText(r);}catch{}setLoading(false);};
  return <Modal title={`Text ${lead.name.split(" ")[0]}`} onClose={onClose}>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{TYPES.map(t=><button key={t.id} onClick={()=>{setType(t.id);setText(TEXT_TEMPLATES[t.id](lead.name.split(" ")[0]));}} style={{background:type===t.id?"#1db954":"#16161f",color:type===t.id?"#09090e":"#8888a0",border:`1px solid ${type===t.id?"#1db954":"#22222e"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{t.label}</button>)}</div>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={5} style={{width:"100%",background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:10,padding:12,color:"#f0eee8",fontFamily:"inherit",fontSize:14,resize:"vertical",boxSizing:"border-box",lineHeight:1.65,outline:"none"}}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginTop:11}}>
      <button onClick={aiRewrite} disabled={loading} style={{background:"#1db95415",border:"1px solid #1db95430",color:"#1db954",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{loading?"Writing...":"✨ AI Rewrite"}</button>
      <a href={`sms:${lead.phone}?body=${encodeURIComponent(text)}`} style={{background:"#5b9cf6",color:"#fff",borderRadius:10,padding:11,fontWeight:900,textDecoration:"none",textAlign:"center",fontSize:13,display:"block"}}>Send SMS →</a>
    </div>
  </Modal>;
}

function VoicemailModal({lead,onClose}) {
  const [type,setType]=useState("firstTouch");
  const [script,setScript]=useState(VOICEMAIL_TEMPLATES.firstTouch(lead.name.split(" ")[0]));
  const [loading,setLoading]=useState(false);
  const TYPES=[{id:"firstTouch",label:"First Touch"},{id:"followUp",label:"Follow-Up"},{id:"expired",label:"Expired"},{id:"fsbo",label:"FSBO"},{id:"reEngage",label:"Re-Engage"}];
  const aiRewrite=async()=>{setLoading(true);try{const r=await callClaude("Write a voicemail script for a real estate agent. Warm, professional, brief (20-30 seconds). Conversational, not salesy.",`Type:${type}. Lead:${lead.name.split(" ")[0]}, in ${lead.city||""}. Notes:"${lead.notes||""}". Write the script.`);setScript(r);}catch{}setLoading(false);};
  return <Modal title={`Voicemail — ${lead.name.split(" ")[0]}`} onClose={onClose}>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{TYPES.map(t=><button key={t.id} onClick={()=>{setType(t.id);setScript(VOICEMAIL_TEMPLATES[t.id](lead.name.split(" ")[0]));}} style={{background:type===t.id?"#f5a623":"#16161f",color:type===t.id?"#09090e":"#8888a0",border:`1px solid ${type===t.id?"#f5a623":"#22222e"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{t.label}</button>)}</div>
    <div style={{background:"#0d0d14",borderRadius:10,padding:"8px 12px",marginBottom:10,border:"1px solid #1e1e28",fontSize:12,color:"#8888a0"}}>~{Math.round(script.split(" ").length/2.5)} seconds</div>
    <textarea value={script} onChange={e=>setScript(e.target.value)} rows={6} style={{width:"100%",background:"#0d0d14",border:"1px solid #1e1e28",borderRadius:10,padding:12,color:"#f0eee8",fontFamily:"inherit",fontSize:14,resize:"vertical",boxSizing:"border-box",lineHeight:1.65,outline:"none"}}/>
    <button onClick={aiRewrite} disabled={loading} style={{width:"100%",marginTop:11,background:"#f5a62318",border:"1px solid #f5a62330",color:"#f5a623",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{loading?"Writing...":"✨ AI Rewrite"}</button>
  </Modal>;
}

function MemoryModal({lead,onClose,onBuild,onSave}) {
  const [mem,setMem]=useState(lead.aiMemory||{personality:"",objections:"",goals:"",budget:"",timing:"",style:"",notes:""});
  return <Modal title={`🧠 Memory — ${lead.name}`} onClose={onClose} wide>
    <button onClick={onBuild} style={{width:"100%",marginBottom:14,background:"#1db95418",border:"1px solid #1db95435",color:"#1db954",borderRadius:10,padding:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{lead.building?"Building...":"✨ Auto-Build from Notes"}</button>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
      {[["personality","Personality"],["style","Comm Style"],["goals","Goals"],["budget","Budget"],["timing","Timing"],["objections","Objections"],["notes","Key Insight"]].map(([k,lbl])=><div key={k} style={{gridColumn:k==="notes"?"1 / -1":"auto"}}><Label>{lbl}</Label><input value={mem[k]||""} onChange={e=>setMem(p=>({...p,[k]:e.target.value}))} style={inputStyle}/></div>)}
    </div>
    <button onClick={()=>onSave(mem)} style={{width:"100%",marginTop:14,background:"#1db954",color:"#09090e",border:"none",borderRadius:10,padding:12,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save Memory ✓</button>
  </Modal>;
}

function TxModal({lead,onClose,onSave}) {
  const DEFAULT_MILESTONES=["Listing Agreement","Photos Scheduled","Listed on MLS","Offer Received","Under Contract","Inspection","Appraisal","Clear to Close","Closed"];
  const [tx,setTx]=useState(lead.transaction||{stage:"Active Listing",address:lead.address||"",price:"",closingDate:"",milestones:DEFAULT_MILESTONES.map(l=>({label:l,done:false}))});
  return <Modal title={`🏠 Transaction — ${lead.name}`} onClose={onClose} wide>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:14}}>
      <div><Label>Stage</Label><input value={tx.stage} onChange={e=>setTx(p=>({...p,stage:e.target.value}))} style={inputStyle}/></div>
      <div><Label>Price</Label><input value={tx.price} onChange={e=>setTx(p=>({...p,price:e.target.value}))} style={inputStyle} placeholder="$000,000"/></div>
      <div style={{gridColumn:"1 / -1"}}><Label>Property Address</Label><input value={tx.address} onChange={e=>setTx(p=>({...p,address:e.target.value}))} style={inputStyle}/></div>
      <div><Label>Target Close Date</Label><input type="date" value={tx.closingDate} onChange={e=>setTx(p=>({...p,closingDate:e.target.value}))} style={inputStyle}/></div>
    </div>
    <Label>Milestones</Label>
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>{tx.milestones.map((m,i)=><button key={i} onClick={()=>setTx(p=>({...p,milestones:p.milestones.map((ms,idx)=>idx===i?{...ms,done:!ms.done}:ms)}))} style={{background:m.done?"#4eca8b18":"#16161f",border:`1px solid ${m.done?"#4eca8b40":"#22222e"}`,color:m.done?"#4eca8b":"#8888a0",borderRadius:20,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{m.done?"✓ ":""}{m.label}</button>)}</div>
    <button onClick={()=>onSave(tx)} style={{width:"100%",background:"#4eca8b",color:"#09090e",border:"none",borderRadius:10,padding:13,fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Save Transaction ✓</button>
  </Modal>;
}
