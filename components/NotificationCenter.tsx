'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, CalendarCheck, CheckCheck, Clock3, PackageCheck, ArrowRightLeft, X, ChevronRight, MapPin, Check } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

type NoticeProfile = { uid:string; name:string; role:'admin'|'security'; locationId:string };
type NoticeLocation = { id:string; name:string; active?:boolean };
export type Notice = { id:string; type:'appointment'|'incoming'|'overdue'|'received'; title:string; message:string; locationId:string; locationName:string; target:'appointments'|'transfers'|'visitors'; read:boolean; sourceId:string };
type Props = { profile:NoticeProfile; locations:NoticeLocation[]; onNavigate:(tab:string)=>void; onUnreadChange?:(count:number)=>void; onHistoryChange?:(items:Notice[])=>void };
const toMs = (v:any):number => { if(!v)return 0; if(typeof v.toDate==='function')return v.toDate().getTime(); if(typeof v==='number')return v; const n=new Date(v).getTime(); return Number.isFinite(n)?n:0; };
const receivedStatus = (s:any) => ['RECEIVED','RECEIVED_CLOSED','CLOSED','COMPLETED'].includes(String(s||'').toUpperCase());

export default function NotificationCenter({profile,locations,onNavigate,onUnreadChange,onHistoryChange}:Props){
 const historyKey='vms-notification-history:'+profile.uid+':'+profile.role+':'+profile.locationId;
 const [notices,setNotices]=useState<Notice[]>([]);
 const [historyLoaded,setHistoryLoaded]=useState(false);
 const rootRef=useRef<HTMLDivElement|null>(null);
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState<'all'|'unread'>('all');
 const priorTransferStatus=useRef<Record<string,string>>({});
 const overdueSeen=useRef<Set<string>>(new Set());
 const firstSnapshot=useRef<Record<string,boolean>>({});
 const visitorRecords=useRef<Record<string,{location:NoticeLocation;docs:any[]}>>({});
 const locs=useMemo(()=>profile.role==='admin'?locations:locations.filter(x=>x.id===profile.locationId),[profile,locations]);
 const locLabel=(id:string)=>locations.find(x=>x.id===id)?.name||id;
 const addNotice=(n:Omit<Notice,'id'|'read'>)=>{
  const id=n.type+':'+n.locationId+':'+n.sourceId;
  setNotices(old=>{
   if(old.some(x=>x.id===id))return old;
   setOpen(true);
   return [{...n,id,read:false},...old].slice(0,500);
  });
 };
 useEffect(()=>{
  try{const raw=localStorage.getItem(historyKey);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))setNotices(parsed.filter(x=>x&&typeof x.id==='string').slice(0,500));}}catch{}
  setHistoryLoaded(true);
 },[historyKey]);
 useEffect(()=>{if(!historyLoaded)return;try{localStorage.setItem(historyKey,JSON.stringify(notices));}catch{}onHistoryChange?.(notices);},[notices,historyLoaded,historyKey,onHistoryChange]);
 useEffect(()=>{
  if(!historyLoaded)return;
  const unsubscribers:(()=>void)[]=[];
  const timers:number[]=[];
  locs.forEach(loc=>{
   const appointmentKey='appointments:'+loc.id;
   firstSnapshot.current[appointmentKey]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'visitorAppointments'),where('locationId','==',loc.id)),snap=>{
    if(!firstSnapshot.current[appointmentKey]){firstSnapshot.current[appointmentKey]=true;return;}
    snap.docChanges().forEach(change=>{
     if(change.type!=='added')return;
     const d=change.doc.data();
     if(['REJECTED','CANCELLED','CANCELED'].includes(String(d.status||'').toUpperCase()))return;
     const visitor=d.visitorName||d.name||'A visitor';
     const date=d.appointmentDate?' for '+d.appointmentDate:'';
     addNotice({type:'appointment',title:'New appointment booked',message:visitor+' has booked an appointment'+date+'. Review the request and destination.',locationId:loc.id,locationName:loc.name,target:'appointments',sourceId:change.doc.id});
    });
   },()=>{}));

   const incomingKey='incoming:'+loc.id;
   firstSnapshot.current[incomingKey]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'internalTransfers'),where('destinationLocationId','==',loc.id)),snap=>{
    if(!firstSnapshot.current[incomingKey]){firstSnapshot.current[incomingKey]=true;snap.docs.forEach(d=>{priorTransferStatus.current[d.id]=String(d.data().status||'')});return;}
    snap.docChanges().forEach(change=>{
     const d=change.doc.data();const prev=priorTransferStatus.current[change.doc.id];const next=String(d.status||'');priorTransferStatus.current[change.doc.id]=next;
     if((change.type==='added'||prev!==next)&&['SENT','IN_TRANSIT','SCHEDULED'].includes(next.toUpperCase())){
      const sender=locLabel(d.sourceLocationId||'Unknown location');
      const item=d.itemName||d.description||'material';
      const qty=d.quantity?' · Qty '+d.quantity:'';
      addNotice({type:'incoming',title:'Incoming material scheduled',message:sender+' has sent '+item+' to '+loc.name+qty+'. Open incoming transfers to review it.',locationId:loc.id,locationName:loc.name,target:'transfers',sourceId:change.doc.id});
     }
    });
   },()=>{}));

   const processOverdue=(location:NoticeLocation,docs:any[])=>docs.forEach((d:any)=>{
    const v=d.data();
    if(v.checkOutAt||v.checkedOutAt||String(v.status||'').toUpperCase()==='CHECKED_OUT')return;
    let start=toMs(v.checkInAt||v.checkedInAt||v.entryAt||v.createdAt||v.timestamp);
    if(!start&&v.entryDate&&v.entryTime){const n=new Date(String(v.entryDate)+'T'+String(v.entryTime)).getTime();start=Number.isFinite(n)?n:0;}
    if(!start||Date.now()-start<4*60*60*1000)return;
    const key=location.id+':'+d.id;
    if(overdueSeen.current.has(key))return;
    overdueSeen.current.add(key);
    try{
     const saved=JSON.parse(localStorage.getItem('vms-overdue-notifications')||'[]');
     if(saved.includes(key))return;
     saved.push(key);localStorage.setItem('vms-overdue-notifications',JSON.stringify(saved.slice(-500)));
    }catch{}
    const visitor=v.name||v.visitorName||'A visitor';
    addNotice({type:'overdue',title:'Visitor stay exceeds 4 hours',message:visitor+' checked in at '+(v.entryTime||'an earlier time')+' and is still checked in at '+location.name+'. Please verify their status.',locationId:location.id,locationName:location.name,target:'visitors',sourceId:d.id});
   });
   try{const saved=JSON.parse(localStorage.getItem('vms-overdue-notifications')||'[]');saved.forEach((x:string)=>overdueSeen.current.add(x));}catch{}
   unsubscribers.push(onSnapshot(query(collection(db,'visitors'),where('locationId','==',loc.id)),snap=>{
    visitorRecords.current[loc.id]={location:loc,docs:snap.docs};
    processOverdue(loc,snap.docs);
   },()=>{}));
   timers.push(window.setInterval(()=>processOverdue(loc,visitorRecords.current[loc.id]?.docs||[]),60000));

   const sentKey='sent:'+loc.id;
   firstSnapshot.current[sentKey]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'internalTransfers'),where('sourceLocationId','==',loc.id)),snap=>{
    if(!firstSnapshot.current[sentKey]){firstSnapshot.current[sentKey]=true;snap.docs.forEach(d=>{priorTransferStatus.current[d.id]=String(d.data().status||'')});return;}
    snap.docChanges().forEach(change=>{
     const d=change.doc.data();const prev=priorTransferStatus.current[change.doc.id];const next=String(d.status||'');priorTransferStatus.current[change.doc.id]=next;
     if(change.type==='modified'&&!receivedStatus(prev)&&receivedStatus(next)){
      const destination=locLabel(d.destinationLocationId||'destination');
      const item=d.itemName||d.description||'the transferred material';
      const qty=d.quantity?' · Qty '+d.quantity:'';
      addNotice({type:'received',title:'Transfer received by destination',message:destination+' has received '+item+qty+'.',locationId:loc.id,locationName:loc.name,target:'transfers',sourceId:change.doc.id});
     }
    });
   },()=>{}));
  });
  return()=>{unsubscribers.forEach(u=>u());timers.forEach(timer=>window.clearInterval(timer));};
 },[locs,historyLoaded]);
 const unread=notices.filter(n=>!n.read).length;
 useEffect(()=>{onUnreadChange?.(unread)},[unread,onUnreadChange]);
 useEffect(()=>{if(!open)return;const handlePointer=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false);};const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',handlePointer);document.addEventListener('keydown',handleKey);return()=>{document.removeEventListener('pointerdown',handlePointer);document.removeEventListener('keydown',handleKey);};},[open]);
 const visible=notices.filter(n=>filter==='all'||!n.read);
 const iconFor=(type:Notice['type'])=>type==='appointment'?<CalendarCheck size={18}/>:type==='incoming'?<PackageCheck size={18}/>:type==='overdue'?<Clock3 size={18}/>:<ArrowRightLeft size={18}/>;
 const go=(n:Notice)=>{setNotices(old=>old.map(x=>x.id===n.id?{...x,read:true}:x));setOpen(false);onNavigate(n.target);};
 const markAll=()=>setNotices(old=>old.map(n=>({...n,read:true})));
 return <div className="notificationCenter" ref={rootRef}>
  <button className={'notificationBell '+(open?'isOpen':'')} aria-label="Open notifications" title="Notifications" onClick={()=>setOpen(x=>!x)}><Bell size={18}/>{unread>0&&<span className="notificationCount">{unread>99?'99+':unread}</span>}</button>
  {open&&<section className="notificationPopover" role="dialog" aria-label="Notifications">
   <header className="notificationHead"><div className="notificationHeadIcon"><BellRing size={19}/></div><div className="notificationHeadCopy"><b>Notifications</b><span>{unread?unread+' unread update'+(unread===1?'':'s'):'You’re all caught up'}</span></div><button className="notificationClose" aria-label="Close" onClick={()=>setOpen(false)}><X size={17}/></button></header>
   <div className="notificationToolbar"><div className="notificationFilters"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All <span>{notices.length}</span></button><button className={filter==='unread'?'selected':''} onClick={()=>setFilter('unread')}>Unread <span>{unread}</span></button></div><button className="notificationMarkAll" onClick={markAll} disabled={!unread}><CheckCheck size={14}/> Mark all read</button></div>
   <div className="notificationList">{visible.length===0?<div className="notificationEmpty"><span><Bell size={22}/></span><b>{filter==='unread'?'No unread notifications':'You’re all caught up'}</b><p>New appointments, incoming materials, long visits and received transfers will appear here.</p></div>:visible.map(n=><button className={'notificationItem '+(n.read?'read':'')} key={n.id} onClick={()=>go(n)}><span className={'notificationItemIcon '+n.type}>{iconFor(n.type)}</span><span className="notificationItemBody"><b>{n.title}</b><small>{n.message}</small><span className="notificationItemMeta"><MapPin size={12}/>{n.locationName}<i/>Live update</span></span>{!n.read&&<span className="notificationUnreadDot"/>}<ChevronRight className="notificationChevron" size={16}/></button>)}</div>
   <footer className="notificationFoot"><span><Check size={13}/> Live updates enabled</span><button onClick={()=>{setOpen(false);onNavigate('notifications')}}>Open notification center <ChevronRight size={14}/></button></footer>
  </section>}
 </div>;
}
