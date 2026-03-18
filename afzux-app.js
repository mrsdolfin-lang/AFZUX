// ╔══════════════════════════════════════════════════════════╗
// ║  AFZUX v4.0 — FIZUX Admin Dashboard                    ║
// ║  Master Key: MHAG29NL04Q6391339919                      ║
// ║  Full user management · Ukey generator · Cost calc      ║
// ╚══════════════════════════════════════════════════════════╝

const { useState, useEffect, useRef } = React;

// ── MASTER KEY (hardcoded) ──
const DEFAULT_MASTER = "MHAG29NL04Q6391339919";

// ── VERSIONS ──
const VERSIONS = [
  { id:"v3", label:"v3.0 Standard", color:"#7B5FE0", price:799, earlyBird:299, desc:"Claude+Gemini, 35 Tools, AI Memory", features:"35 tools, Claude+Gemini, Memory, Analytics" },
  { id:"v4", label:"v4.0 Professional", color:"#C9A84C", price:1799, earlyBird:699, desc:"DeepThink, Canvas, Compare, 60+ Tools", features:"60+ tools, DeepThink, Canvas, Compare, Personalities" },
  { id:"v5", label:"v5.0 Ultimate", color:"#FF6B9D", price:2999, earlyBird:999, desc:"All 130+ Tools, Full Access", features:"130+ tools, all categories, bulk processor" },
  { id:"v6", label:"v6.0 Enterprise", color:"#EF4060", price:5999, earlyBird:1999, desc:"Source Code, White Label, Reseller", features:"Source code, white label, reseller panel, teams" },
];

// ── DURATIONS ──
const DURATIONS = [
  {label:"3 Days",days:3},{label:"7 Days",days:7},{label:"15 Days",days:15},
  {label:"1 Month",days:30},{label:"2 Months",days:60},{label:"3 Months",days:90},
  {label:"4 Months",days:120},{label:"5 Months",days:150},{label:"6 Months",days:180},
  {label:"7 Months",days:210},{label:"8 Months",days:240},{label:"9 Months",days:270},
  {label:"10 Months",days:300},{label:"11 Months",days:330},{label:"1 Year",days:365},
  {label:"Lifetime",days:-1},
];

const genUkey = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({length:20}, ()=>c[Math.floor(Math.random()*c.length)]).join("");
};

const sha256 = async(p) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p+"__AFZUX_V4__"));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
};

const getDurationMonths = (days) => {
  if(days === -1) return "Lifetime";
  if(days < 30) return `${days}d`;
  if(days < 365) return `${Math.round(days/30)}mo`;
  return "1yr";
};

// ── COST CALCULATOR ──
const calcCost = (version, duration, qty) => {
  const v = VERSIONS.find(v=>v.id===version);
  if(!v) return 0;
  const base = v.earlyBird;
  const factor = duration.days === -1 ? 1 :
    duration.days <= 7 ? 0.1 :
    duration.days <= 30 ? 0.25 :
    duration.days <= 90 ? 0.5 :
    duration.days <= 180 ? 0.7 :
    duration.days <= 365 ? 0.9 : 1;
  return Math.round(base * factor * qty);
};

function AFZUXApp() {
  const [screen, setScreen] = useState("loading");
  const [masterInput, setMasterInput] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState({msg:"",type:"ok"});

  // Data
  const [allUkeys, setAllUkeys] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState({total:0,active:0,blocked:0,google:0,ukey:0,premium:0,rev:0});

  // Generate
  const [selVersion, setSelVersion] = useState(VERSIONS[1]);
  const [selDuration, setSelDuration] = useState(DURATIONS[3]);
  const [quantity, setQuantity] = useState(1);
  const [clientLabel, setClientLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUkeys, setGeneratedUkeys] = useState([]);

  // Filters
  const [ukeyFilter, setUkeyFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [searchUkeys, setSearchUkeys] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  // Master key change
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [newKey1, setNewKey1] = useState("");
  const [newKey2, setNewKey2] = useState("");
  const [storedHash, setStoredHash] = useState("");

  const notify = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast({msg:"",type:"ok"}),3200); };

  // ── INIT ──
  useEffect(()=>{
    (async()=>{
      const stored = await window.storage.get("afzux:masterkeyhash",true).catch(()=>null);
      if(stored) { setStoredHash(stored.value); }
      else {
        const h = await sha256(DEFAULT_MASTER);
        await window.storage.set("afzux:masterkeyhash",h,true);
        setStoredHash(h);
      }
      setScreen("login");
    })();
  },[]);

  // ── LOGIN ──
  const doLogin = async () => {
    const key = masterInput.trim().toUpperCase();
    if(!key) { setLoginErr("Enter Master Key"); return; }
    setLoginErr("");
    const h = await sha256(key);
    const currentHash = storedHash || await sha256(DEFAULT_MASTER);
    if(h !== currentHash) { setLoginErr("Invalid Master Key — access denied"); return; }
    await loadAll();
    setScreen("dashboard");
  };

  // ── LOAD ALL DATA ──
  const loadAll = async () => {
    await Promise.all([loadUkeys(), loadUsers()]);
  };

  const loadUkeys = async () => {
    try {
      const keys = await window.storage.list("afzux:ukey:",true);
      if(!keys?.keys?.length) { setAllUkeys([]); return; }
      const list = [];
      for(const k of keys.keys) {
        const d = await window.storage.get(k,true).catch(()=>null);
        if(d) {
          const uk = JSON.parse(d.value);
          const id = k.replace("afzux:ukey:","");
          list.push({...uk, ukey:id, expired:uk.expiry!=="never"&&new Date(uk.expiry)<new Date()});
        }
      }
      list.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
      setAllUkeys(list);
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const keys = await window.storage.list("fizux:user:",true);
      if(!keys?.keys?.length) { setAllUsers([]); updateStats([]); return; }
      const list = [];
      for(const k of keys.keys) {
        const d = await window.storage.get(k,true).catch(()=>null);
        if(d) {
          const user = JSON.parse(d.value);
          const bl = await window.storage.get(`fizux:blocked:${user.uid}`,true).catch(()=>null);
          if(bl) user.blocked = JSON.parse(bl.value).blocked;
          const pd = await window.storage.get(`fizux:premium:${user.uid}`).catch(()=>null);
          if(pd) { const p=JSON.parse(pd.value); const ok=p.expiry==="lifetime"||new Date(p.expiry)>new Date(); if(ok){user.premium=true;user.premiumVersion=p.version;user.premiumExpiry=p.expiry;} }
          list.push(user);
        }
      }
      list.sort((a,b)=>new Date(b.lastLogin||0)-new Date(a.lastLogin||0));
      setAllUsers(list);
      updateStats(list);
    } catch {}
  };

  const updateStats = (users) => {
    const revMap = {"v3.0 Standard":799,"v4.0 Professional":1799,"v5.0 Ultimate":2999,"v6.0 Enterprise":5999};
    const rev = users.filter(u=>u.premium).reduce((s,u)=>s+(revMap[u.premiumVersion]||0),0);
    setStats({
      total:users.length,
      active:users.filter(u=>!u.blocked).length,
      blocked:users.filter(u=>u.blocked).length,
      google:users.filter(u=>u.method==="google").length,
      ukey:users.filter(u=>u.method==="ukey").length,
      premium:users.filter(u=>u.premium).length,
      rev
    });
  };

  // ── GENERATE UKEYS ──
  const generateUkeys = async () => {
    setGenerating(true);
    const newOnes = [];
    for(let i=0;i<quantity;i++) {
      const ukey = genUkey();
      const expiry = selDuration.days===-1?"never":new Date(Date.now()+selDuration.days*86400000).toISOString();
      const data = {
        label:clientLabel||`Client-${Date.now()}`,
        version:selVersion.label,
        versionId:selVersion.id,
        duration:selDuration.label,
        durationDays:selDuration.days,
        expiry,
        free:false,
        used:false,
        blocked:false,
        lastLogin:null,
        usedBy:null,
        createdAt:new Date().toISOString(),
        cost:Math.round(calcCost(selVersion.id,selDuration,1)),
      };
      await window.storage.set(`afzux:ukey:${ukey}`,JSON.stringify(data),true);
      newOnes.push({ukey,...data});
    }
    setGeneratedUkeys(newOnes);
    await loadUkeys();
    notify(`✓ ${quantity} Ukey${quantity>1?"s":""} generated!`);
    setGenerating(false);
  };

  // ── UKEY ACTIONS ──
  const blockUkey = async (ukey, block) => {
    const d = await window.storage.get(`afzux:ukey:${ukey}`,true).catch(()=>null);
    if(!d) return;
    const uk = JSON.parse(d.value); uk.blocked = block;
    await window.storage.set(`afzux:ukey:${ukey}`,JSON.stringify(uk),true);
    await loadUkeys(); notify(block?"🚫 Ukey blocked":"✓ Ukey unblocked");
  };

  const revokeUkey = async (ukey) => {
    const d = await window.storage.get(`afzux:ukey:${ukey}`,true).catch(()=>null);
    if(!d) return;
    const uk = JSON.parse(d.value); uk.expiry=new Date(0).toISOString(); uk.blocked=true;
    await window.storage.set(`afzux:ukey:${ukey}`,JSON.stringify(uk),true);
    await loadUkeys(); notify("Ukey revoked");
  };

  const deleteUkey = async (ukey) => {
    await window.storage.delete(`afzux:ukey:${ukey}`,true);
    await loadUkeys(); notify("Deleted");
  };

  // ── USER ACTIONS ──
  const blockUser = async (uid, block) => {
    await window.storage.set(`fizux:blocked:${uid}`,JSON.stringify({blocked:block,at:Date.now()}),true);
    await loadUsers();
    if(selectedUser?.uid===uid) setSelectedUser({...selectedUser,blocked:block});
    notify(block?"🚫 User blocked":"✓ User unblocked");
  };

  // ── CHANGE MASTER KEY ──
  const changeMasterKey = async () => {
    if(newKey1.trim().length<16){notify("Min 16 characters","err");return;}
    if(newKey1!==newKey2){notify("Keys don't match","err");return;}
    const h = await sha256(newKey1.trim().toUpperCase());
    await window.storage.set("afzux:masterkeyhash",h,true);
    setStoredHash(h); setShowChangeKey(false); setNewKey1(""); setNewKey2("");
    notify("✓ Master Key updated!");
  };

  const copy = (t) => { navigator.clipboard.writeText(t); notify("📋 Copied!"); };
  const copyAll = () => { const t=generatedUkeys.map(u=>`${u.ukey} | ${u.version} | ${u.duration} | Cost: ₹${u.cost}`).join("\n"); navigator.clipboard.writeText(t); notify("📋 All copied!"); };

  const filteredUkeys = allUkeys.filter(u => {
    const q = searchUkeys.toLowerCase();
    const match = !q||u.ukey.toLowerCase().includes(q)||(u.label||"").toLowerCase().includes(q);
    const f = ukeyFilter==="all"||
      (ukeyFilter==="active"&&!u.blocked&&!u.expired)||
      (ukeyFilter==="used"&&u.used)||(ukeyFilter==="blocked"&&u.blocked)||(ukeyFilter==="expired"&&u.expired);
    return match&&f;
  });

  const filteredUsers = allUsers.filter(u => {
    const q = searchUsers.toLowerCase();
    const match = !q||(u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q);
    const f = userFilter==="all"||
      (userFilter==="active"&&!u.blocked)||(userFilter==="blocked"&&u.blocked)||
      (userFilter==="google"&&u.method==="google")||(userFilter==="ukey"&&u.method==="ukey")||
      (userFilter==="premium"&&u.premium);
    return match&&f;
  });

  // ── STYLES ──
  const C = {
    bg:"var(--bg)",surface:"var(--surface)",card:"var(--card)",card2:"var(--card2)",
    border:"var(--border)",text:"var(--text)",sub:"var(--sub)",muted:"var(--muted)",dim:"var(--dim)",
    accent:"var(--accent)",purple:"var(--purple)",blue:"var(--blue)",green:"var(--green)",red:"var(--red)",orange:"var(--orange)",
  };

  const S = {
    inp:(x={})=>({background:"var(--card)",border:"1.5px solid var(--border)",borderRadius:"10px",padding:"10px 14px",color:"var(--text)",fontSize:"13px",fontFamily:"var(--font)",width:"100%",boxSizing:"border-box",outline:"none",...x}),
    btnGold:(x={})=>({padding:"11px 18px",borderRadius:"10px",border:"none",background:"var(--gradGold)",color:"#1A1000",fontWeight:700,fontSize:"13px",cursor:"pointer",fontFamily:"var(--font)",boxShadow:"var(--shadowGold)",...x}),
    btnGhost:(x={})=>({padding:"7px 12px",borderRadius:"9px",border:"1px solid var(--border)",background:"transparent",color:"var(--sub)",fontSize:"12px",cursor:"pointer",fontFamily:"var(--font)",...x}),
    card:(x={})=>({background:"var(--card)",border:"1px solid var(--border)",borderRadius:"14px",padding:"16px",...x}),
    badge:(col,x={})=>({background:col+"22",color:col,border:`1px solid ${col}44`,borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:600,display:"inline-block",...x}),
  };

  const ce = (tag,props,...children) => React.createElement(tag,props,...children);

  const Toast = () => !toast.msg?null:ce("div",{style:{position:"fixed",top:"16px",left:"50%",transform:"translateX(-50%)",background:"var(--card)",border:`1.5px solid ${toast.type==="err"?"var(--red)":"var(--green)"}`,borderRadius:"11px",padding:"9px 18px",fontSize:"13px",zIndex:9999,color:toast.type==="err"?"var(--red)":"var(--green)",boxShadow:"var(--shadowLg)",whiteSpace:"nowrap",fontWeight:500}},toast.msg);

  // ── LOADING ──
  if(screen==="loading") return ce("div",{style:{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"14px"}},
    ce("div",{style:{width:"72px",height:"72px",borderRadius:"22px",background:"var(--gradGold)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--display)",fontWeight:800,fontSize:"32px",color:"#1A1000",boxShadow:"var(--shadowGold)"}},"A"),
    ce("div",{style:{fontSize:"11px",color:"var(--muted)"}},"Loading AFZUX...")
  );

  // ── LOGIN ──
  if(screen==="login") return ce("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",background:"var(--bg)"}},
    ce(Toast),
    ce("div",{style:{position:"fixed",top:"-100px",right:"-100px",width:"350px",height:"350px",borderRadius:"50%",background:"var(--gradGold)",opacity:"0.04",filter:"blur(80px)",pointerEvents:"none"}}),
    ce("div",{style:{width:"100%",maxWidth:"380px",animation:"fadeUp 0.4s ease"}},
      ce("div",{style:{textAlign:"center",marginBottom:"30px"}},
        ce("div",{style:{width:"72px",height:"72px",borderRadius:"22px",background:"var(--gradGold)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--display)",fontWeight:800,fontSize:"32px",color:"#1A1000",margin:"0 auto 14px",boxShadow:"var(--shadowGold)"}},"A"),
        ce("div",{style:{fontFamily:"var(--display)",fontSize:"26px",fontWeight:800,marginBottom:"5px"}},"AFZUX v4.0"),
        ce("div",{style:{fontSize:"12px",color:"var(--muted)"}},"FIZUX Admin Dashboard — Owner Only")
      ),
      ce("div",{style:{...S.card({padding:"26px",borderRadius:"20px"}),boxShadow:"var(--shadowLg)"}},
        ce("label",{style:{fontSize:"10px",color:"var(--sub)",fontWeight:700,letterSpacing:"0.8px",display:"block",marginBottom:"7px"}},"MASTER KEY"),
        ce("input",{type:"password",value:masterInput,onChange:e=>{setMasterInput(e.target.value.toUpperCase());setLoginErr("");},onKeyDown:e=>e.key==="Enter"&&doLogin(),placeholder:"Enter master key",style:{...S.inp({fontFamily:"var(--mono)",letterSpacing:"2px",textAlign:"center",fontSize:"13px",padding:"13px",marginBottom:loginErr?"4px":"14px",borderColor:loginErr?"var(--red)":"var(--border)"})},autoFocus:true}) loginErr&&ce("div",{style:{color:"var(--red)",fontSize:"11px",textAlign:"center",marginBottom:"14px"}},loginErr),
        ce("button",{onClick:doLogin,style:S.btnGold({width:"100%",padding:"13px",borderRadius:"12px",fontSize:"14px"})},"🔓 Login to AFZUX")
      ),
      ce("div",{style:{textAlign:"center",marginTop:"14px",fontSize:"10px",color:"var(--dim)"}},"Protected · Owner access only")
    )
  );

  // ── CHANGE MASTER KEY MODAL ──
  const ChangeMasterModal = () => ce("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:"20px",backdropFilter:"blur(8px)"}},
    ce("div",{style:{...S.card({padding:"26px",borderRadius:"20px",maxWidth:"380px",width:"100%"}),boxShadow:"var(--shadowLg)",animation:"fadeUp 0.3s ease"}},
      ce("div",{style:{fontFamily:"var(--display)",fontWeight:700,fontSize:"17px",marginBottom:"5px"}},"⬡ Change Master Key"),
      ce("div",{style:{fontSize:"12px",color:"var(--muted)",marginBottom:"18px"}},"Min 16 characters. Save new key safely."),
      ce("label",{style:{fontSize:"10px",color:"var(--sub)",fontWeight:700,display:"block",marginBottom:"5px"}},"NEW MASTER KEY"),
      ce("input",{value:newKey1,onChange:e=>setNewKey1(e.target.value.toUpperCase()),placeholder:"Minimum 16 characters",style:{...S.inp({fontFamily:"var(--mono)",letterSpacing:"2px",marginBottom:"10px"})}}),
      ce("label",{style:{fontSize:"10px",color:"var(--sub)",fontWeight:700,display:"block",marginBottom:"5px"}},"CONFIRM NEW KEY"),
      ce("input",{value:newKey2,onChange:e=>setNewKey2(e.target.value.toUpperCase()),placeholder:"Repeat new key",style:{...S.inp({fontFamily:"var(--mono)",letterSpacing:"2px",marginBottom:"12px"})}}),
      ce("div",{style:{...S.card({padding:"10px 12px",marginBottom:"14px",borderColor:"rgba(239,64,96,0.3)",background:"rgba(239,64,96,0.06)"})}},
        ce("div",{style:{fontSize:"11px",color:"var(--red)"}},"⚠ Save new key before updating. Cannot be recovered if lost.")
      ),
      ce("button",{onClick:changeMasterKey,style:S.btnGold({width:"100%",borderRadius:"12px",padding:"12px",marginBottom:"8px"})},"✓ Update Master Key"),
      ce("button",{onClick:()=>{setShowChangeKey(false);setNewKey1("");setNewKey2("");},style:S.btnGhost({width:"100%",textAlign:"center"})},"Cancel")
    )
  );

  // ── USER DETAIL MODAL ──
  const UserDetailModal = () => {
    if(!selectedUser) return null;
    const u = selectedUser;
    return ce("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:"16px",backdropFilter:"blur(8px)"}},
      ce("div",{style:{...S.card({padding:"24px",borderRadius:"20px",maxWidth:"440px",width:"100%",maxHeight:"80vh",overflowY:"auto"}),boxShadow:"var(--shadowLg)",animation:"fadeUp 0.3s ease"}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}},
          ce("div",{style:{display:"flex",gap:"12px",alignItems:"center"}},
            ce("div",{style:{width:"48px",height:"48px",borderRadius:"50%",background:u.method==="google"?"#4285F4":"var(--purple)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"20px",color:"#fff",flexShrink:0}},(u.name||"U").charAt(0).toUpperCase()),
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:"16px"}},u.name),
              ce("div",{style:{fontSize:"11px",color:"var(--muted)"}},u.email||"No email")
            )
          ),
          ce("button",{onClick:()=>setSelectedUser(null),style:{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:"22px"}},"✕")
        ),
        ce("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px"}},
          u.blocked&&ce("span",{style:S.badge("var(--red)")},"🚫 Blocked"),
          ce("span",{style:S.badge(u.method==="google"?"#4285F4":"var(--purple)")},(u.method==="google"?"🌐":"🔑")+" "+u.method),
          u.premium&&ce("span",{style:S.badge("var(--accent)")},"✦ "+u.premiumVersion),
          !u.premium&&ce("span",{style:S.badge("var(--green)")},"Free")
        ),
        ce("div",{style:{...S.card({padding:"14px",marginBottom:"14px"})}},
          ce("div",{style:{fontSize:"10px",color:"var(--muted)",fontWeight:700,letterSpacing:"0.8px",marginBottom:"10px"}},"USER INFO"),
          [
            ["UID",u.uid?.slice(0,20)+"..."],
            ["Last Login",u.lastLogin?new Date(u.lastLogin).toLocaleString():"Never"],
            ["Login Method",u.method],
            ["Premium",u.premium?(u.premiumVersion+" · "+(u.premiumExpiry==="lifetime"?"Lifetime":new Date(u.premiumExpiry).toLocaleDateString())):"No"],
          ].map(([k,v])=>ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",fontSize:"12px",marginBottom:"7px"}},
            ce("span",{style:{color:"var(--muted)"}},k),
            ce("span",{style:{color:"var(--text)",fontWeight:500,maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},v)
          ))
        ),
        ce("div",{style:{display:"flex",gap:"8px"}},
          ce("button",{onClick:()=>blockUser(u.uid,!u.blocked),style:{flex:1,padding:"11px",borderRadius:"10px",border:"none",background:u.blocked?"rgba(40,187,122,0.15)":"rgba(239,64,96,0.15)",color:u.blocked?"var(--green)":"var(--red)",fontWeight:600,fontSize:"12px",cursor:"pointer",fontFamily:"var(--font)"}},u.blocked?"✓ Unblock User":"🚫 Block User"),
          ce("button",{onClick:()=>setSelectedUser(null),style:S.btnGhost({flex:1,textAlign:"center"})},"Close")
        )
      )
    );
  };

  const TABS = [
    {id:"overview",icon:"▦",label:"Overview"},
    {id:"users",icon:"◎",label:"Users"},
    {id:"ukeys",icon:"⬡",label:"Ukeys"},
    {id:"generate",icon:"◈",label:"Generate"},
    {id:"security",icon:"⬡",label:"Security"},
  ];

  const estimatedCost = calcCost(selVersion.id, selDuration, quantity);

  return ce("div",{style:{minHeight:"100vh",background:"var(--bg)",fontFamily:"var(--font)"}},
    ce(Toast),
    showChangeKey&&ce(ChangeMasterModal),
    selectedUser&&ce(UserDetailModal),

    // Header
    ce("div",{style:{background:"var(--surface)",borderBottom:"1px solid var(--border)",padding:"13px 18px",display:"flex",alignItems:"center",gap:"12px",position:"sticky",top:0,zIndex:10}},
      ce("div",{style:{width:"38px",height:"38px",borderRadius:"12px",background:"var(--gradGold)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--display)",fontWeight:800,fontSize:"17px",color:"#1A1000"}},"A"),
      ce("div",{style:{flex:1}},
        ce("div",{style:{fontFamily:"var(--display)",fontWeight:700,fontSize:"15px"}},"AFZUX v4.0"),
        ce("div",{style:{fontSize:"10px",color:"var(--muted)"}}),`${stats.total} users · ${allUkeys.length} ukeys · ₹${stats.rev.toLocaleString()} est.`
      ),
      ce("button",{onClick:async()=>{await loadAll();notify("✓ Refreshed!");},style:S.btnGhost({padding:"7px 12px",fontSize:"11px"})},"↻"),
      ce("button",{onClick:()=>setScreen("login"),style:S.btnGhost({color:"var(--red)",fontSize:"11px"})},"Logout")
    ),

    // Tab bar
    ce("div",{style:{background:"var(--surface)",borderBottom:"1px solid var(--border)",display:"flex",overflowX:"auto",padding:"0 12px"}},
      TABS.map(t=>ce("button",{key:t.id,onClick:()=>setActiveTab(t.id),style:{
        padding:"12px 14px",background:"none",border:"none",
        borderBottom:`2px solid ${activeTab===t.id?"var(--accent)":"transparent"}`,
        color:activeTab===t.id?"var(--accent)":"var(--muted)",
        fontWeight:activeTab===t.id?700:400,fontSize:"12px",cursor:"pointer",
        fontFamily:"var(--font)",whiteSpace:"nowrap",transition:"all 0.15s"
      }},t.icon+" "+t.label))
    ),

    ce("div",{style:{padding:"16px",maxWidth:"800px",margin:"0 auto"}},

      // ── OVERVIEW ──
      activeTab==="overview"&&ce("div",null,
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",marginBottom:"14px"}},
          [["◎","Total Users",stats.total,"var(--purple)"],["✓","Active",stats.active,"var(--green)"],["🚫","Blocked",stats.blocked,"var(--red)"],["⬡","Ukeys",allUkeys.length,"var(--blue)"]].map(([icon,label,val,col])=>
            ce("div",{key:label,style:{...S.card({textAlign:"center",padding:"16px"})}},
              ce("div",{style:{fontSize:"22px",color:col,marginBottom:"5px"}},icon),
              ce("div",{style:{fontSize:"28px",fontWeight:900,color:col}},val),
              ce("div",{style:{fontSize:"11px",color:"var(--muted)",marginTop:"3px"}},label)
            )
          )
        ),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",marginBottom:"14px"}},
          [["🌐","Google Login",stats.google,"#4285F4"],["🔑","Ukey Login",stats.ukey,"var(--purple)"],["✦","Premium",stats.premium,"var(--accent)"],["₹","Est. Revenue",`₹${(stats.rev/1000).toFixed(0)}K`,"var(--green)"]].map(([icon,label,val,col])=>
            ce("div",{key:label,style:{...S.card({textAlign:"center",padding:"14px"})}},
              ce("div",{style:{fontSize:"18px",color:col,marginBottom:"4px"}},icon),
              ce("div",{style:{fontSize:"22px",fontWeight:900,color:col}},val),
              ce("div",{style:{fontSize:"10px",color:"var(--muted)",marginTop:"2px"}},label)
            )
          )
        ),

        // Recent users
        ce("div",{style:S.card()},
          ce("div",{style:{fontWeight:700,fontSize:"14px",marginBottom:"14px"}},"◎ Recent FIZUX Users (Google + Ukey)"),
          allUsers.length===0&&ce("div",{style:{textAlign:"center",padding:"24px",color:"var(--muted)",fontSize:"13px"}},"No users yet. Share FIZUX!"),
          allUsers.slice(0,8).map((u,i)=>ce("div",{key:i,onClick:()=>setSelectedUser(u),style:{display:"flex",gap:"10px",alignItems:"center",padding:"10px 0",borderBottom:i<7?"1px solid var(--border)":"none",cursor:"pointer"}},
            ce("div",{style:{width:"36px",height:"36px",borderRadius:"50%",background:u.method==="google"?"#4285F4":"var(--purple)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"14px",color:"#fff",flexShrink:0}},(u.name||"U").charAt(0).toUpperCase()),
            ce("div",{style:{flex:1,minWidth:0}},
              ce("div",{style:{fontSize:"13px",fontWeight:600,display:"flex",alignItems:"center",gap:"6px"}},u.name),
              u.blocked&&ce("span",{style:S.badge("var(--red)",{fontSize:"9px"})},"Blocked"),
              u.premium&&ce("span",{style:S.badge("var(--accent)",{fontSize:"9px"})},u.premiumVersion),
              ce("div",{style:{fontSize:"11px",color:"var(--muted)",marginTop:"2px"}}),`${u.method==="google"?"🌐 Google":"🔑 Ukey"} · Last: ${u.lastLogin?new Date(u.lastLogin).toLocaleDateString():"Never"}`
            ),
            ce("button",{onClick:e=>{e.stopPropagation();blockUser(u.uid,!u.blocked);},style:{...S.btnGhost({fontSize:"10px",padding:"4px 9px",color:u.blocked?"var(--green)":"var(--red)",borderColor:u.blocked?"rgba(40,187,122,0.4)":"rgba(239,64,96,0.4)"})}},u.blocked?"Unblock":"Block")
          ))
        )
      ),

      // ── USERS ──
      activeTab==="users"&&ce("div",null,
        ce("div",{style:{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}},
          ce("input",{value:searchUsers,onChange:e=>setSearchUsers(e.target.value),placeholder:"Search users...",style:{...S.inp({flex:1,minWidth:"150px",padding:"8px 12px",fontSize:"12px"})}}),
          ["all","active","blocked","google","ukey","premium"].map(f=>ce("button",{key:f,onClick:()=>setUserFilter(f),style:{padding:"7px 11px",borderRadius:"18px",border:`1.5px solid ${userFilter===f?"var(--accent)":"var(--border)"}`,background:userFilter===f?"var(--accentSoft)":"transparent",color:userFilter===f?"var(--accent)":"var(--muted)",fontSize:"10px",cursor:"pointer",textTransform:"capitalize",fontFamily:"var(--font)"}},f))
        ),
        ce("div",{style:{fontSize:"11px",color:"var(--muted)",marginBottom:"10px"}}),`${filteredUsers.length} users`,
        filteredUsers.length===0&&ce("div",{style:{...S.card({textAlign:"center",padding:"32px",color:"var(--muted)",fontSize:"13px"})}},
          "No users found."
        ),
        filteredUsers.map((u,i)=>ce("div",{key:i,onClick:()=>setSelectedUser(u),style:{...S.card({marginBottom:"9px",padding:"14px",cursor:"pointer",transition:"background 0.15s"}),opacity:u.blocked?0.7:1,borderColor:u.blocked?"rgba(239,64,96,0.3)":"var(--border)"}},
          ce("div",{style:{display:"flex",gap:"10px",alignItems:"flex-start"}},
            ce("div",{style:{width:"40px",height:"40px",borderRadius:"50%",background:u.method==="google"?"#4285F4":"var(--purple)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"16px",color:"#fff",flexShrink:0}},(u.name||"U").charAt(0).toUpperCase()),
            ce("div",{style:{flex:1,minWidth:0}},
              ce("div",{style:{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap",marginBottom:"4px"}},
                ce("span",{style:{fontSize:"13px",fontWeight:700}},u.name),
                u.blocked&&ce("span",{style:S.badge("var(--red)")},"🚫 Blocked"),
                u.premium&&ce("span",{style:S.badge("var(--accent)")},"✦ "+u.premiumVersion),
                ce("span",{style:S.badge(u.method==="google"?"#4285F4":"var(--purple)",{fontSize:"10px"})},u.method)
              ),
              u.email&&ce("div",{style:{fontSize:"11px",color:"var(--muted)",marginBottom:"2px"}},u.email),
              ce("div",{style:{fontSize:"10px",color:"var(--muted)"}}),`Last login: ${u.lastLogin?new Date(u.lastLogin).toLocaleString():"Never"}`
            ),
            ce("button",{onClick:e=>{e.stopPropagation();blockUser(u.uid,!u.blocked);},style:{...S.btnGhost({fontSize:"11px",padding:"5px 10px",color:u.blocked?"var(--green)":"var(--red)",borderColor:u.blocked?"rgba(40,187,122,0.4)":"rgba(239,64,96,0.4)",flexShrink:0})}},u.blocked?"✓ Unblock":"🚫 Block")
          )
        ))
      ),

      // ── UKEYS ──
      activeTab==="ukeys"&&ce("div",null,
        ce("div",{style:{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}},
          ce("input",{value:searchUkeys,onChange:e=>setSearchUkeys(e.target.value),placeholder:"Search ukeys...",style:{...S.inp({flex:1,minWidth:"140px",padding:"8px 12px",fontSize:"12px"})}}),
          ["all","active","used","blocked","expired"].map(f=>ce("button",{key:f,onClick:()=>setUkeyFilter(f),style:{padding:"6px 10px",borderRadius:"16px",border:`1.5px solid ${ukeyFilter===f?"var(--accent)":"var(--border)"}`,background:ukeyFilter===f?"var(--accentSoft)":"transparent",color:ukeyFilter===f?"var(--accent)":"var(--muted)",fontSize:"10px",cursor:"pointer",textTransform:"capitalize",fontFamily:"var(--font)"}},f))
        ),
        ce("div",{style:{fontSize:"11px",color:"var(--muted)",marginBottom:"10px"}}),`${filteredUkeys.length} ukeys`,
        filteredUkeys.length===0&&ce("div",{style:{...S.card({textAlign:"center",padding:"32px",color:"var(--muted)",fontSize:"13px"})}},"No ukeys found."),
        filteredUkeys.map((u,i)=>ce("div",{key:i,style:{...S.card({marginBottom:"9px",padding:"14px"}),borderColor:u.blocked?"rgba(239,64,96,0.3)":u.expired?"rgba(239,124,48,0.3)":"var(--border)"}},
          ce("div",{style:{display:"flex",gap:"10px",alignItems:"flex-start",flexWrap:"wrap"}},
            ce("div",{style:{flex:1,minWidth:0}},
              ce("div",{style:{fontFamily:"var(--mono)",fontSize:"12px",fontWeight:600,letterSpacing:"1.5px",color:u.blocked?"var(--red)":"var(--text)",marginBottom:"7px",wordBreak:"break-all"}},u.ukey),
              ce("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"5px"}},
                ce("span",{style:S.badge("var(--purple)")},u.version),
                ce("span",{style:S.badge(u.durationDays===-1?"var(--accent)":"var(--blue)")},u.duration),
                ce("span",{style:S.badge(u.blocked?"var(--red)":u.expired?"var(--orange)":u.used?"var(--blue)":"var(--green)")},u.blocked?"🚫 Blocked":u.expired?"⏰ Expired":u.used?"✓ Used":"◎ Active",
                u.cost&&ce("span",{style:S.badge("var(--green)")}),"₹"+u.cost
              ),
              ce("div",{style:{fontSize:"10px",color:"var(--dim)"}}),`Label: ${u.label} · Created: ${u.createdAt?new Date(u.createdAt).toLocaleDateString():""}${u.expiry&&u.expiry!=="never"?" · Expires: "+new Date(u.expiry).toLocaleDateString():""}`
            ),
            ce("div",{style:{display:"flex",gap:"4px",flexWrap:"wrap",flexShrink:0}},
              ce("button",{onClick:()=>copy(u.ukey),style:S.btnGhost({fontSize:"10px",padding:"4px 8px"})},"Copy"),
              !u.blocked?ce("button",{onClick:()=>blockUkey(u.ukey,true),style:S.btnGhost({fontSize:"10px",padding:"4px 8px",color:"var(--red)"})},"Block"):ce("button",{onClick:()=>blockUkey(u.ukey,false),style:S.btnGhost({fontSize:"10px",padding:"4px 8px",color:"var(--green)"})},"Unblock"),
              ce("button",{onClick:()=>revokeUkey(u.ukey),style:S.btnGhost({fontSize:"10px",padding:"4px 8px",color:"var(--orange)"})},"Revoke"),
              ce("button",{onClick:()=>deleteUkey(u.ukey),style:S.btnGhost({fontSize:"10px",padding:"4px 8px",color:"var(--red)"})},"Del")
            )
          )
        ))
      ),

      // ── GENERATE ──
      activeTab==="generate"&&ce("div",{style:{display:"flex",flexDirection:"column",gap:"14px"}},
        // Client label
        ce("div",{style:S.card()},
          ce("div",{style:{fontSize:"10px",color:"var(--muted)",fontWeight:700,letterSpacing:"0.8px",marginBottom:"8px"}},"CLIENT LABEL (Optional)"),
          ce("input",{value:clientLabel,onChange:e=>setClientLabel(e.target.value),placeholder:"Customer name / order reference",style:S.inp()})
        ),

        // Version selector
        ce("div",{style:S.card()},
          ce("div",{style:{fontSize:"10px",color:"var(--muted)",fontWeight:700,letterSpacing:"0.8px",marginBottom:"12px"}},"SELECT VERSION"),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}},
            VERSIONS.map(v=>ce("button",{key:v.id,onClick:()=>setSelVersion(v),style:{
              padding:"13px 11px",borderRadius:"12px",
              border:`2px solid ${selVersion.id===v.id?v.color:"var(--border)"}`,
              background:selVersion.id===v.id?v.color+"14":"var(--surface)",
              cursor:"pointer",textAlign:"left",fontFamily:"var(--font)"
            }},
              ce("div",{style:{fontSize:"11px",fontWeight:700,color:selVersion.id===v.id?v.color:"var(--text)",marginBottom:"3px"}},v.label),
              ce("div",{style:{fontSize:"9px",color:"var(--muted)"}},v.desc),
              ce("div",{style:{fontSize:"10px",color:v.color,fontWeight:700,marginTop:"5px"}}),`₹${v.earlyBird} Early Bird · ₹${v.price} Normal`
            ))
          )
        ),

        // Duration
        ce("div",{style:S.card()},
          ce("div",{style:{fontSize:"10px",color:"var(--muted)",fontWeight:700,letterSpacing:"0.8px",marginBottom:"12px"}},"SELECT DURATION"),
          ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px"}},
            DURATIONS.map(d=>ce("button",{key:d.label,onClick:()=>setSelDuration(d),style:{
              padding:"8px 5px",borderRadius:"9px",
              border:`1.5px solid ${selDuration.label===d.label?(d.days===-1?"var(--accent)":"var(--green)"):"var(--border)"}`,
              background:selDuration.label===d.label?(d.days===-1?"var(--accentSoft)":"rgba(40,187,122,0.1)"):"var(--surface)",
              color:selDuration.label===d.label?(d.days===-1?"var(--accent)":"var(--green)"):"var(--muted)",
              fontSize:"10px",fontWeight:selDuration.label===d.label?700:400,cursor:"pointer",textAlign:"center",
              fontFamily:"var(--font)"
            }},d.days===-1?"♾ ":"",d.label))
          )
        ),

        // Quantity
        ce("div",{style:S.card()},
          ce("div",{style:{fontSize:"10px",color:"var(--muted)",fontWeight:700,letterSpacing:"0.8px",marginBottom:"12px"}},"QUANTITY"),
          ce("div",{style:{display:"flex",alignItems:"center",gap:"16px",marginBottom:"10px"}},
            ce("button",{onClick:()=>setQuantity(Math.max(1,quantity-1)),style:{...S.btnGhost({padding:"9px 20px",fontSize:"18px",fontWeight:700})}},"-"),
            ce("div",{style:{flex:1,textAlign:"center",fontSize:"36px",fontWeight:900}},quantity),
            ce("button",{onClick:()=>setQuantity(Math.min(100,quantity+1)),style:{...S.btnGhost({padding:"9px 20px",fontSize:"18px",fontWeight:700})}},"+")
          ),
          ce("div",{style:{display:"flex",gap:"5px"}},
            [1,5,10,25,50,100].map(n=>ce("button",{key:n,onClick:()=>setQuantity(n),style:{flex:1,padding:"6px 0",borderRadius:"7px",border:`1.5px solid ${quantity===n?"var(--accent)":"var(--border)"}`,background:quantity===n?"var(--accentSoft)":"transparent",color:quantity===n?"var(--accent)":"var(--muted)",fontSize:"11px",cursor:"pointer",fontFamily:"var(--font)"}},n))
          )
        ),

        // Cost Summary — THE DETAILED COST BREAKDOWN
        ce("div",{style:{...S.card({borderColor:"rgba(201,168,76,0.3)",background:"var(--accentSoft)"})}},
          ce("div",{style:{fontSize:"11px",color:"var(--accent)",fontWeight:700,letterSpacing:"0.8px",marginBottom:"12px"}},"💰 COST SUMMARY"),
          [
            ["Version",selVersion.label,selVersion.color],
            ["Duration",selDuration.label,selDuration.days===-1?"var(--accent)":"var(--green)"],
            ["Quantity",`${quantity} Ukey${quantity>1?"s":""}`,selVersion.color],
            ["Per Ukey Cost",`₹${Math.round(calcCost(selVersion.id,selDuration,1))}`,selVersion.color],
            ["Total Estimate",`₹${estimatedCost.toLocaleString()}`,selVersion.color],
          ].map(([k,v,col])=>ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",fontSize:"13px",marginBottom:"8px",paddingBottom:"8px",borderBottom:"1px solid var(--border)15"}},
            ce("span",{style:{color:"var(--muted)"}},k),
            ce("span",{style:{fontWeight:700,color:col}},v)
          )),
          // Features included
          ce("div",{style:{marginTop:"6px"}}),
          ce("div",{style:{fontSize:"10px",color:"var(--muted)",marginBottom:"5px"}},"FEATURES INCLUDED:"),
          ce("div",{style:{fontSize:"11px",color:"var(--sub)"}},selVersion.features)
        ),

        ce("button",{onClick:generateUkeys,disabled:generating,style:{...S.btnGold({width:"100%",padding:"14px",fontSize:"15px",borderRadius:"14px"}),opacity:generating?0.7:1}},
          generating?ce("span",null,"⚡ Generating..."):ce("span",null,`⬡ Generate ${quantity} Ukey${quantity>1?"s":""}`)
        ),

        // Generated ukeys
        generatedUkeys.length>0&&ce("div",{style:S.card()},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}},
            ce("div",{style:{fontWeight:700,fontSize:"14px"}}),`✓ Generated (${generatedUkeys.length})`,
            ce("button",{onClick:copyAll,style:S.btnGhost({fontSize:"11px",padding:"6px 12px"})},"Copy All")
          ),
          generatedUkeys.map((u,i)=>ce("div",{key:i,style:{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"12px",padding:"14px",marginBottom:"10px"}},
            ce("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}},
              ce("div",{style:{fontFamily:"var(--mono)",fontSize:"13px",fontWeight:700,letterSpacing:"2px",flex:1,wordBreak:"break-all"}},u.ukey),
              ce("button",{onClick:()=>copy(u.ukey),style:S.btnGhost({fontSize:"10px",padding:"4px 9px",flexShrink:0})},"Copy")
            ),
            ce("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap"}}),
            ce("span",{style:S.badge(selVersion.color)},u.version),
            ce("span",{style:S.badge(u.durationDays===-1?"var(--accent)":"var(--green)")},u.duration),
            ce("span",{style:S.badge("var(--green)")}),`₹${u.cost}`
          ))
        )
      ),

      // ── SECURITY ──
      activeTab==="security"&&ce("div",{style:{display:"flex",flexDirection:"column",gap:"14px"}},
        ce("div",{style:{...S.card({borderColor:"rgba(201,168,76,0.3)"})}},
          ce("div",{style:{fontFamily:"var(--display)",fontWeight:700,fontSize:"16px",color:"var(--accent)",marginBottom:"6px"}},"⬡ Master Key"),
          ce("div",{style:{fontSize:"12px",color:"var(--muted)",marginBottom:"14px"}},"Your master key is the only way to access AFZUX. Keep it safe."),
          ce("div",{style:{...S.card({padding:"12px",background:"var(--surface)",marginBottom:"14px"})}},
            ce("div",{style:{fontSize:"10px",color:"var(--muted)",marginBottom:"3px"}},"CURRENT KEY STATUS"),
            ce("div",{style:{fontSize:"14px",color:"var(--green)",fontWeight:600}},"✓ Active & Secure"),
            ce("div",{style:{fontSize:"10px",color:"var(--dim)",marginTop:"2px"}},"Stored as SHA-256 hash in local storage")
          ),
          ce("button",{onClick:()=>setShowChangeKey(true),style:S.btnGold({width:"100%",padding:"12px",borderRadius:"12px"})},"⬡ Change Master Key")
        ),

        ce("div",{style:S.card()},
          ce("div",{style:{fontWeight:700,fontSize:"14px",marginBottom:"14px"}},"▦ Full Statistics"),
          [
            ["Total FIZUX Users",stats.total],
            ["Active Users",stats.active],
            ["Blocked Users",stats.blocked],
            ["Google Login Users",stats.google],
            ["Ukey Login Users",stats.ukey],
            ["Premium Users",stats.premium],
            ["Revenue Estimate",`₹${stats.rev.toLocaleString()}`],
            ["Total Ukeys Generated",allUkeys.length],
            ["Active Ukeys",allUkeys.filter(u=>!u.blocked&&!u.expired).length],
            ["Used Ukeys",allUkeys.filter(u=>u.used).length],
          ].map(([k,v])=>ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",fontSize:"12px",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}},
            ce("span",{style:{color:"var(--muted)"}},k),
            ce("span",{style:{fontWeight:700,color:"var(--text)"}},String(v))
          ))
        ),

        ce("div",{style:{...S.card({borderColor:"rgba(239,64,96,0.3)",background:"rgba(239,64,96,0.04)"})}},
          ce("div",{style:{fontWeight:700,fontSize:"14px",color:"var(--red)",marginBottom:"8px"}},"⚠ Danger Zone"),
          ce("div",{style:{fontSize:"12px",color:"var(--muted)",marginBottom:"14px"}},"These actions are irreversible."),
          ce("button",{onClick:async()=>{if(!window.confirm("Delete ALL ukeys? Cannot undo!"))return;const keys=await window.storage.list("afzux:ukey:",true).catch(()=>null);if(keys?.keys)for(const k of keys.keys)await window.storage.delete(k,true).catch(()=>{});await loadUkeys();notify("All ukeys deleted");},style:{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid rgba(239,64,96,0.3)",background:"rgba(239,64,96,0.08)",color:"var(--red)",fontWeight:600,fontSize:"12px",cursor:"pointer",fontFamily:"var(--font)",marginBottom:"8px"}},"🗑 Delete All Ukeys"),
          ce("button",{onClick:async()=>{if(!window.confirm("Clear ALL user data?"))return;const keys=await window.storage.list("fizux:user:",true).catch(()=>null);if(keys?.keys)for(const k of keys.keys)await window.storage.delete(k,true).catch(()=>{});await loadUsers();notify("User data cleared");},style:{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid rgba(239,64,96,0.3)",background:"rgba(239,64,96,0.08)",color:"var(--red)",fontWeight:600,fontSize:"12px",cursor:"pointer",fontFamily:"var(--font)"}},"🗑 Clear All User Data")
        ),

        ce("div",{style:S.card()},
          ce("div",{style:{fontWeight:700,fontSize:"14px",marginBottom:"12px"}},"ℹ About AFZUX v4.0"),
          [["App","AFZUX v4.0"],["Connected to","FIZUX v9.0"],["Owner contact","dofizuxai@gmail.com"],["Ukey format","20 alphanumeric chars"],["Max generate","100 at once"],["Login","Master Key only"],["Premium codes","Removed (Ukey only)"],["V1/V2 Ukeys","Not available"]].map(([k,v])=>
            ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",fontSize:"11px",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}},
              ce("span",{style:{color:"var(--muted)"}},k),
              ce("span",{style:{color:"var(--sub)"}},v)
            )
          )
        )
      ),

      ce("div",{style:{height:"32px"}})
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(AFZUXApp));
