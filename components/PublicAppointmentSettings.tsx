"use client";
import {useEffect,useState} from "react";
import {doc,getDoc,setDoc,serverTimestamp} from "firebase/firestore";
import {Check,Eye,Globe2,MonitorSmartphone,ShieldCheck,Smartphone,ArrowUpRight,Loader2} from "lucide-react";
import {db} from "../lib/firebase";

type Design="classic"|"visitor-v2";

export default function PublicAppointmentSettings(){
 const [active,setActive]=useState<Design>("classic"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{getDoc(doc(db,"publicSettings","appointment")).then(s=>{const d=s.exists()?s.data().activeDesign:"classic";setActive(d==="visitor-v2"?"visitor-v2":"classic")}).catch(()=>setActive("classic")).finally(()=>setLoading(false))},[]);
 const choose=async(design:Design)=>{
  if(design===active||saving)return;
  setSaving(true);setMessage("");
  try{await setDoc(doc(db,"publicSettings","appointment"),{activeDesign:design,updatedAt:serverTimestamp(),updatedBy:"admin"},{merge:true});setActive(design);setMessage("Public appointment page updated successfully.");}
  catch(e:any){setMessage("Could not update the public appointment page: "+(e?.message||"Please try again."))}
  finally{setSaving(false)}
 };
 const isV2=active==="visitor-v2";
 return <section className="appointmentSettings">
  <div className="appointmentSettingsHeader">
   <div className="appointmentSettingsTitle"><div className="settingsIconLarge"><Globe2 size={21}/></div><div><span className="eyebrow">PUBLIC EXPERIENCE</span><h2>Appointment booking</h2><p>Control the visitor-facing experience served from the permanent appointment link.</p></div></div>
   <div className="appointmentLiveBadge"><span className="liveDot"/> LIVE · /appointment</div>
  </div>

  <div className="appointmentPublishedBar">
   <div><span className="appointmentLabel">CURRENTLY PUBLISHED</span><strong>{loading?"Checking…":isV2?"Modern Visitor V2":"Classic / Current"}</strong><span>{loading?"Reading the public configuration…":"Visitors are being served this design right now."}</span></div>
   <div className="appointmentPublishedMeta"><Check size={15}/>{loading?"Loading":"Active"}</div>
  </div>

  <div className="appointmentDesignHead"><div><b>Choose public design</b><span>Preview either experience before making it live. Switching does not change appointment data.</span></div><a className="secondary tiny" href="/appointment" target="_blank" rel="noreferrer"><Eye size={13}/> Open live page <ArrowUpRight size={12}/></a></div>

  <div className="appointmentDesignGrid">
   <DesignCard title="Classic / Current" icon={<MonitorSmartphone size={20}/>} description="The existing production experience. Kept as the safe default and fallback." active={active==="classic"} saving={saving} loading={loading} previewHref="/appointment" onMake={()=>choose("classic")} accent="blue"/>
   <DesignCard title="Modern Visitor V2" icon={<Smartphone size={20}/>} description="A visitor-first, mobile-optimized experience with a simpler two-step booking journey." active={active==="visitor-v2"} saving={saving} loading={loading} previewHref="/appointment-v2" onMake={()=>choose("visitor-v2")} accent="green"/>
  </div>

  <div className="appointmentSafety"><div className="appointmentSafetyIcon"><ShieldCheck size={17}/></div><div><b>Safe design switching</b><span>Both designs use the same <strong>visitorAppointments</strong> collection and existing approval, check-in, check-out and security workflows.</span></div></div>
  {message&&<div className={message.startsWith("Public")?"appointmentSuccess":"appointmentError"}>{message}</div>}
 </section>;
}

function DesignCard({title,icon,description,active,saving,loading,previewHref,onMake,accent}:{title:string;icon:React.ReactNode;description:string;active:boolean;saving:boolean;loading:boolean;previewHref:string;onMake:()=>void;accent:"blue"|"green"}){
 return <article className={`appointmentDesignCard ${active?"isActive":""} accent-${accent}`}>
  <div className="appointmentCardTop"><div className="appointmentDesignIcon">{icon}</div>{active?<span className="appointmentPublishedPill"><Check size={12}/> Published</span>:<span className="appointmentDraftPill">Available</span>}</div>
  <div className="appointmentDesignCopy"><h3>{title}</h3><p>{description}</p></div>
  <div className="appointmentCardDivider"/>
  <div className="appointmentCardActions"><a className="secondary tiny" href={previewHref} target="_blank" rel="noreferrer"><Eye size={13}/> Preview</a>{active?<span className="appointmentCurrentText"><Check size={13}/> Currently public</span>:<button className="primary" disabled={saving||loading} onClick={onMake}>{saving?<><Loader2 size={13} className="spin"/> Updating…</>:"Make public"}</button>}</div>
 </article>;
}
