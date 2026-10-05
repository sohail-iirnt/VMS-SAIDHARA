"use client";
import {useEffect,useState} from "react";
import {doc,getDoc,setDoc,serverTimestamp} from "firebase/firestore";
import {Check,Eye,Globe2,MonitorSmartphone,RefreshCw,ShieldCheck,Smartphone} from "lucide-react";
import {db} from "../lib/firebase";

type Design="classic"|"visitor-v2";

export default function PublicAppointmentSettings(){
 const [active,setActive]=useState<Design>("classic"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{getDoc(doc(db,"publicSettings","appointment")).then(s=>{const d=s.exists()?s.data().activeDesign:"classic";setActive(d==="visitor-v2"?"visitor-v2":"classic")}).catch(()=>setActive("classic")).finally(()=>setLoading(false))},[]);
 const choose=async(design:Design)=>{
  if(design===active)return;
  setSaving(true);setMessage("");
  try{await setDoc(doc(db,"publicSettings","appointment"),{activeDesign:design,updatedAt:serverTimestamp(),updatedBy:"admin"},{merge:true});setActive(design);setMessage("Public appointment page updated successfully.");}
  catch(e:any){setMessage("Could not update the public appointment page: "+(e?.message||"Please try again."));}
  finally{setSaving(false)}
 };
 return <section className="publicAppointmentControl">
  <div className="sectionTitle"><div><b>Public appointment booking</b><span>Choose which visitor-facing design is served from the permanent /appointment link.</span></div><span className="badge green"><Globe2 size={13}/> Live public URL</span></div>
  <div className="panel" style={{padding:20,marginBottom:24}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"}}>
    <div><span className="eyebrow">CURRENTLY PUBLISHED</span><h2 style={{margin:"6px 0 4px"}}>{active==="visitor-v2"?"Modern Visitor V2":"Classic / Current"}</h2><p style={{margin:0,color:"#6f7f90"}}>Visitors always use <b>vms-saidhara.vercel.app/appointment</b>. The underlying design can be switched here.</p></div>
    <span className="badge green"><Check size={13}/> {loading?"Loading…":"Active"}</span>
   </div>
  </div>
  <div className="settingsGrid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>
   <div className="locationCard" style={{display:"block",padding:20,border:active==="classic"?"2px solid #2f8f83":undefined}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div className="locIcon"><MonitorSmartphone size={19}/></div>{active==="classic"&&<span className="badge green">Published</span>}</div>
    <div style={{marginTop:14}}><b>Classic / Current</b><span>Existing production appointment experience. Preserved as the safe default and fallback.</span></div>
    <div style={{display:"flex",gap:9,marginTop:16,flexWrap:"wrap"}}><a className="secondary tiny" href="/appointment" target="_blank" rel="noreferrer">Preview current</a>{active!=="classic"&&<button className="primary" disabled={saving||loading} onClick={()=>choose("classic")}>{saving?"Updating…":"Make public"}</button>}</div>
   </div>
   <div className="locationCard" style={{display:"block",padding:20,border:active==="visitor-v2"?"2px solid #2f8f83":undefined}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div className="locIcon"><Smartphone size={19}/></div>{active==="visitor-v2"&&<span className="badge green">Published</span>}</div>
    <div style={{marginTop:14}}><b>Modern Visitor V2</b><span>Visitor-first, mobile-optimized experience with a simpler two-step booking journey.</span></div>
    <div style={{display:"flex",gap:9,marginTop:16,flexWrap:"wrap"}}><a className="secondary tiny" href="/appointment-v2" target="_blank" rel="noreferrer">Preview V2</a>{active!=="visitor-v2"&&<button className="primary" disabled={saving||loading} onClick={()=>choose("visitor-v2")}>{saving?"Updating…":"Make public"}</button>}</div>
   </div>
  </div>
  <div className="notice" style={{marginTop:18}}><ShieldCheck size={17}/><span>Switching the design does not create a new appointment system. Both designs submit to the same <b>visitorAppointments</b> collection, so approval, check-in, check-out and security workflows continue normally.</span></div>
  {message&&<div className={message.startsWith("Public")?"notice":"error"} style={{marginTop:12}}>{message}</div>}
 </section>;
}
