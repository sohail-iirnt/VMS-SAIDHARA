'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import VmsSelect from './VmsSelect';
import { Bell, BellRing, CalendarCheck, CheckCheck, Clock3, PackageCheck, ArrowRightLeft, X, ChevronRight, MapPin, Check } from 'lucide-react';
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

type NoticeProfile = { uid:string; name:string; role:'admin'|'security'|'official'; locationId:string; accessTabs?:string[] };
type NoticeLocation = { id:string; name:string; active?:boolean };
export type Notice = { id:string; type:'appointment'|'incoming'|'overdue'|'received'; title:string; message:string; locationId:string; locationName:string; target:'appointments'|'transfers'|'visitors'; read:boolean; sourceId:string; recipientUid?:string; clearedAt?:any; clearedBy?:string };
type Props = { profile:NoticeProfile; locations:NoticeLocation[]; onNavigate:(tab:string)=>void; onUnreadChange?:(count:number)=>void; onHistoryChange?:(items:Notice[])=>void };
const toMs = (v:any):number => { if(!v)return 0; if(typeof v.toDate==='function')return v.toDate().getTime(); if(typeof v==='number')return v; const n=new Date(v).getTime(); return Number.isFinite(n)?n:0; };
const receivedStatus = (s:any) => ['RECEIVED','RECEIVED_CLOSED','CLOSED','COMPLETED'].includes(String(s||'').toUpperCase());

export default function NotificationCenter({profile,locations,onNavigate,onUnreadChange,onHistoryChange}:Props){
 const [notices,setNotices]=useState<Notice[]>([]);
 const rootRef=useRef<HTMLDivElement|null>(null);
 const popoverRef=useRef<HTMLElement|null>(null);
 const [isMobile,setIsMobile]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(max-width: 560px)');const update=()=>setIsMobile(media.matches);update();media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update);},[]);
 const noticeIdsRef=useRef<Set<string>>(new Set());
 const [open,setOpen]=useState(false);
 const [feedError,setFeedError]=useState('');
 const [filter,setFilter]=useState<'all'|'unread'>('all');
 const [clearScopeLocation,setClearScopeLocation]=useState('all');
 const priorTransferStatus=useRef<Record<string,string>>({});
 const priorAppointmentState=useRef<Record<string,string>>({});
 const overdueSeen=useRef<Set<string>>(new Set());
 const firstSnapshot=useRef<Record<string,boolean>>({});
 const visitorRecords=useRef<Record<string,{location:NoticeLocation;docs:any[]}>>({});
 const normalizeLocation=(value:any)=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const locs=useMemo(()=>profile.role==='admin'?locations:profile.role==='official'?[]:locations.filter(x=>x.id===profile.locationId||normalizeLocation(x.id)===normalizeLocation(profile.locationId)||normalizeLocation(x.name)===normalizeLocation(profile.locationId)),[profile,locations]);
 const locLabel=(id:string)=>locations.find(x=>x.id===id)?.name||locations.find(x=>x.name===id)?.name||id;
 const canUse=(moduleName:string)=>profile.role==='admin'||profile.role==='official'||!Array.isArray(profile.accessTabs)||profile.accessTabs.includes(moduleName);
 const onFeedError=(source:string)=>(error:any)=>{console.error('[VMS notifications] '+source,error);setFeedError(error?.code==='permission-denied'?'Notifications are blocked by Firestore permissions for this location login. Ask an administrator to verify this login’s active status and location assignment, then publish the latest Firestore rules.':'Live notifications temporarily could not connect. Check the connection and reload.');};
 const addNotice=(n:Omit<Notice,'id'|'read'>)=>{
  const id=n.recipientUid?'user:'+n.recipientUid+':'+n.type+':'+n.sourceId:n.type+':'+n.locationId+':'+n.sourceId;
  if(noticeIdsRef.current.has(id))return;
  const ref=doc(db,n.recipientUid?'userNotifications':'locationNotifications',encodeURIComponent(id));
  void runTransaction(db,async transaction=>{
   const existing=await transaction.get(ref);
   if(existing.exists())return false;
   transaction.set(ref,{...n,id,read:false,createdAt:serverTimestamp(),createdBy:profile.uid});
   return true;
  }).then(created=>{if(created)setOpen(true);}).catch(error=>{onFeedError('saving notification') (error);});
 };
 useEffect(()=>{
  const applySnapshot=(snap:any,locationId?:string)=>{
   const rows=snap.docs.map((d:any)=>({ ...d.data(), id:d.data().id||decodeURIComponent(d.id) } as Notice)).filter((n:Notice)=>!n.clearedAt);
   if(profile.role==='admin'||!locationId){
    noticeIdsRef.current=new Set(rows.map((n:Notice)=>n.id));
    setNotices(rows.sort((a: any,b: any)=>toMs(b.createdAt)-toMs(a.createdAt)));
    return;
   }
   setNotices(old=>{
    const keep=old.filter(n=>n.locationId!==locationId);
    const merged=[...keep,...rows];
    noticeIdsRef.current=new Set(merged.map(n=>n.id));
    return merged.sort((a:any,b:any)=>toMs(b.createdAt)-toMs(a.createdAt));
   });
  };
  const unsubscribers:(()=>void)[]=[];
  if(profile.role==='admin'){
   unsubscribers.push(onSnapshot(collection(db,'locationNotifications'),snap=>applySnapshot(snap),onFeedError('shared notification feed')));
  }else if(profile.role==='official'){
   unsubscribers.push(onSnapshot(query(collection(db,'userNotifications'),where('recipientUid','==',profile.uid)),snap=>applySnapshot(snap),onFeedError('official notification feed')));
  }else{
   locs.forEach(loc=>unsubscribers.push(onSnapshot(query(collection(db,'locationNotifications'),where('locationId','==',loc.id)),snap=>applySnapshot(snap,loc.id),onFeedError('shared notification feed '+loc.id))));
  }
  return()=>unsubscribers.forEach(unsubscribe=>unsubscribe());
 },[profile.role,locs]);
 useEffect(()=>{onHistoryChange?.(notices);},[notices,onHistoryChange]);
 useEffect(()=>{
  setFeedError('');
  const unsubscribers:(()=>void)[]=[];
  const timers:number[]=[];
  if(profile.role==='official'){
   const key='official-appointments:'+profile.uid;firstSnapshot.current[key]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'visitorAppointments'),where('hostId','==',profile.uid)),snap=>{
    if(!firstSnapshot.current[key]){firstSnapshot.current[key]=true;return;}
    snap.docChanges().forEach(change=>{if(change.type!=='added')return;const d=change.doc.data();const loc=locations.find(x=>x.id===d.locationId);addNotice({type:'appointment',title:'Appointment request for you',message:(d.visitorName||'A visitor')+' requested a visit on '+(d.appointmentDate||'the scheduled date')+'. Approve, reject or pass it to location security.',locationId:d.locationId||'UNKNOWN',locationName:loc?.name||d.locationName||d.locationId||'Location',target:'appointments',sourceId:change.doc.id,recipientUid:profile.uid});});
   },onFeedError('official appointments')));
   return()=>unsubscribers.forEach(u=>u());
  }
  locs.forEach(loc=>{
   if(canUse('appointments')){
   const appointmentKey='appointments:'+loc.id;
   firstSnapshot.current[appointmentKey]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'visitorAppointments'),where('locationId','==',loc.id)),snap=>{
    if(!firstSnapshot.current[appointmentKey]){
     firstSnapshot.current[appointmentKey]=true;
     snap.docs.forEach(d=>{const v=d.data();priorAppointmentState.current[appointmentKey+':'+d.id]=String(v.status||'PENDING')+'|'+String(v.approvalMode||'OFFICIAL');});
     return;
    }
    snap.docChanges().forEach(change=>{
     const d=change.doc.data(),stateKey=appointmentKey+':'+change.doc.id;
     const previous=priorAppointmentState.current[stateKey]||'',nextStatus=String(d.status||'PENDING'),nextMode=String(d.approvalMode||'OFFICIAL');
     priorAppointmentState.current[stateKey]=nextStatus+'|'+nextMode;
     const visitor=d.visitorName||d.name||'A visitor',date=d.appointmentDate?' for '+d.appointmentDate:'';
     if(change.type==='added'){
      if(!['REJECTED','CANCELLED','CANCELED'].includes(nextStatus.toUpperCase()))addNotice({type:'appointment',title:'New appointment booked',message:visitor+' has booked an appointment'+date+'. Review the request and destination.',locationId:loc.id,locationName:loc.name,target:'appointments',sourceId:change.doc.id});
      return;
     }
     if(change.type!=='modified'||previous===nextStatus+'|'+nextMode)return;
     const previousMode=previous.split('|')[1]||'OFFICIAL',previousStatus=previous.split('|')[0]||'PENDING';
     if(nextMode==='LOCATION'&&previousMode!=='LOCATION'){
      addNotice({type:'appointment',title:'Appointment passed to security',message:(d.passedToSecurityByName||'The host official')+' passed '+visitor+' for approval at '+loc.name+'.',locationId:loc.id,locationName:loc.name,target:'appointments',sourceId:change.doc.id+':delegated'});
     }else if((nextStatus==='APPROVED'||nextStatus==='REJECTED')&&previousStatus!==nextStatus){
      addNotice({type:'appointment',title:'Appointment '+nextStatus.toLowerCase(),message:visitor+' was '+nextStatus.toLowerCase()+' by '+(d.reviewedByName||'an authorized reviewer')+'.',locationId:loc.id,locationName:loc.name,target:'appointments',sourceId:change.doc.id+':decision:'+nextStatus});
     }
    });
   },onFeedError('appointments '+loc.id)));

   }
   if(canUse('transfers')){
   const incomingKey='incoming:'+loc.id;
   firstSnapshot.current[incomingKey]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'internalTransfers'),where('destinationLocationId','==',loc.id)),snap=>{
    if(!firstSnapshot.current[incomingKey]){firstSnapshot.current[incomingKey]=true;snap.docs.forEach(d=>{const data=d.data(),status=String(data.status||'').toUpperCase();priorTransferStatus.current[incomingKey+':'+d.id]=status;if(['SENT','IN_TRANSIT','SCHEDULED'].includes(status)){const sender=locLabel(data.sourceLocationId||'Unknown location'),item=data.itemName||data.description||'material',qty=data.quantity?' · Qty '+data.quantity:'';addNotice({type:'incoming',title:'Incoming material scheduled',message:sender+' has sent '+item+' to '+loc.name+qty+'. Open incoming transfers to review it.',locationId:loc.id,locationName:loc.name,target:'transfers',sourceId:d.id});}});return;}
    snap.docChanges().forEach(change=>{
     const d=change.doc.data();const statusKey=incomingKey+':'+change.doc.id;const prev=priorTransferStatus.current[statusKey];const next=String(d.status||'');priorTransferStatus.current[statusKey]=next;
     if((change.type==='added'||prev!==next)&&['SENT','IN_TRANSIT','SCHEDULED'].includes(next.toUpperCase())){
      const sender=locLabel(d.sourceLocationId||'Unknown location');
      const item=d.itemName||d.description||'material';
      const qty=d.quantity?' · Qty '+d.quantity:'';
      addNotice({type:'incoming',title:'Incoming material scheduled',message:sender+' has sent '+item+' to '+loc.name+qty+'. Open incoming transfers to review it.',locationId:loc.id,locationName:loc.name,target:'transfers',sourceId:change.doc.id});
     }
    });
   },onFeedError('incoming transfers '+loc.id)));

   }
   if(canUse('visitors')){
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
   },onFeedError('visitors '+loc.id)));
   timers.push(window.setInterval(()=>processOverdue(loc,visitorRecords.current[loc.id]?.docs||[]),60000));

   }
   if(canUse('transfers')){
   const sentKey='sent:'+loc.id;
   firstSnapshot.current[sentKey]=false;
   unsubscribers.push(onSnapshot(query(collection(db,'internalTransfers'),where('sourceLocationId','==',loc.id)),snap=>{
    if(!firstSnapshot.current[sentKey]){firstSnapshot.current[sentKey]=true;snap.docs.forEach(d=>{priorTransferStatus.current[sentKey+':'+d.id]=String(d.data().status||'')});return;}
    snap.docChanges().forEach(change=>{
     const d=change.doc.data();const statusKey=sentKey+':'+change.doc.id;const prev=priorTransferStatus.current[statusKey];const next=String(d.status||'');priorTransferStatus.current[statusKey]=next;
     if(change.type==='modified'&&!receivedStatus(prev)&&receivedStatus(next)){
      const destination=locLabel(d.destinationLocationId||'destination');
      const item=d.itemName||d.description||'the transferred material';
      const qty=d.quantity?' · Qty '+d.quantity:'';
      addNotice({type:'received',title:'Transfer received by destination',message:destination+' has received '+item+qty+'.',locationId:loc.id,locationName:loc.name,target:'transfers',sourceId:change.doc.id});
     }
    });
   },onFeedError('sent transfers '+loc.id)));
   }
  });
  return()=>{unsubscribers.forEach(u=>u());timers.forEach(timer=>window.clearInterval(timer));};
 },[locs]);
 const unread=notices.filter(n=>!n.read).length;
 useEffect(()=>{onUnreadChange?.(unread)},[unread,onUnreadChange]);
 const markOneRead=(id:string)=>{const notice=notices.find(n=>n.id===id);setNotices(old=>old.map(n=>n.id===id?{...n,read:true}:n));if(!notice)return;void updateDoc(doc(db,notice.recipientUid?'userNotifications':'locationNotifications',encodeURIComponent(id)),{read:true,readAt:serverTimestamp(),readBy:profile.uid}).catch(error=>onFeedError('marking notification read')(error));};
 const markAll=()=>{const unreadRows=notices.filter(n=>!n.read);setNotices(old=>old.map(n=>({...n,read:true})));void Promise.all(unreadRows.map(n=>updateDoc(doc(db,n.recipientUid?'userNotifications':'locationNotifications',encodeURIComponent(n.id)),{read:true,readAt:serverTimestamp(),readBy:profile.uid}))).catch(error=>onFeedError('marking all notifications read')(error));};
 const clearableNotices=profile.role==='admin'&&clearScopeLocation!=='all'?notices.filter(n=>n.locationId===clearScopeLocation):notices;
 const clearNotifications=(requestedScope:string)=>{
  const targetScope=profile.role==='admin'?requestedScope:profile.role==='official'?'official':(locs[0]?.id||profile.locationId);
  const clearing=targetScope==='all'||targetScope==='official'?notices:notices.filter(n=>n.locationId===targetScope);
  if(!clearing.length)return;
  const scope=targetScope==='all'?'all locations':targetScope==='official'?'your appointment notifications':locLabel(targetScope);
  if(typeof window!=='undefined'&&!window.confirm('Clear all '+clearing.length+' notification'+(clearing.length===1?'':'s')+' from '+scope+' for every login in this scope?'))return;
  setNotices(old=>old.filter(n=>!clearing.some(c=>c.id===n.id)));
  const commits:Promise<void>[]=[];
  for(let i=0;i<clearing.length;i+=450){
   const batch=writeBatch(db);
   clearing.slice(i,i+450).forEach(n=>batch.update(doc(db,n.recipientUid?'userNotifications':'locationNotifications',encodeURIComponent(n.id)),{clearedAt:serverTimestamp(),clearedBy:profile.uid}));
   commits.push(batch.commit());
  }
  void Promise.all(commits).catch(error=>onFeedError('clearing shared notification history')(error));
 };
 const clearAllNotifications=()=>clearNotifications(clearScopeLocation);
 useEffect(()=>{const markRead=(event:Event)=>{const id=(event as CustomEvent<string>).detail;markOneRead(id);};const markAllRead=()=>markAll();const clearRequested=(event:Event)=>clearNotifications((event as CustomEvent<string>).detail||'all');window.addEventListener('vms:notification-read',markRead);window.addEventListener('vms:notifications-mark-all-read',markAllRead);window.addEventListener('vms:notifications-clear',clearRequested);return()=>{window.removeEventListener('vms:notification-read',markRead);window.removeEventListener('vms:notifications-mark-all-read',markAllRead);window.removeEventListener('vms:notifications-clear',clearRequested);};},[profile.uid,profile.role,notices,locs,clearScopeLocation]);
 useEffect(()=>{if(!open)return;const handlePointer=(event:PointerEvent)=>{const target=event.target as Node;if(rootRef.current?.contains(target)||popoverRef.current?.contains(target))return;setOpen(false);};const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',handlePointer);document.addEventListener('keydown',handleKey);return()=>{document.removeEventListener('pointerdown',handlePointer);document.removeEventListener('keydown',handleKey);};},[open]);
 const visible=notices.filter(n=>filter==='all'||!n.read);
 const iconFor=(type:Notice['type'])=>type==='appointment'?<CalendarCheck size={18}/>:type==='incoming'?<PackageCheck size={18}/>:type==='overdue'?<Clock3 size={18}/>:<ArrowRightLeft size={18}/>;
 const go=(n:Notice)=>{markOneRead(n.id);setOpen(false);onNavigate(n.target);};
 const popover = open ? <section ref={popoverRef} className="notificationPopover" role="dialog" aria-label="Notifications">
  <header className="notificationHead"><div className="notificationHeadIcon"><BellRing size={19}/></div><div className="notificationHeadCopy"><b>Notifications</b><span>{unread?unread+' unread update'+(unread===1?'':'s'):'You’re all caught up'}</span></div><button className="notificationClose" aria-label="Close" onClick={()=>setOpen(false)}><X size={17}/></button></header>
  <div className="notificationToolbar"><div className="notificationFilters"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All <span>{notices.length}</span></button><button className={filter==='unread'?'selected':''} onClick={()=>setFilter('unread')}>Unread <span>{unread}</span></button></div><div className="notificationActions">{profile.role==='admin'&&<VmsSelect className="notificationClearScope" aria-label="Location to clear" value={clearScopeLocation} onChange={e=>setClearScopeLocation(e.target.value)}><option value="all">All locations</option>{locations.map(loc=><option key={loc.id} value={loc.id}>{loc.name}</option>)}</VmsSelect>}<button className="notificationMarkAll" onClick={markAll} disabled={!unread}><CheckCheck size={14}/> Mark all read</button><button className="notificationMarkAll notificationClearAll" onClick={clearAllNotifications} disabled={!clearableNotices.length} title="Clear notifications for every login in the selected scope"><X size={14}/> Clear history</button></div></div>
  <div className="notificationList">{visible.length===0?<div className="notificationEmpty"><span><Bell size={22}/></span><b>{filter==='unread'?'No unread notifications':'You’re all caught up'}</b><p>New appointments, incoming materials, long visits and received transfers will appear here.</p></div>:visible.map(n=><button className={'notificationItem '+(n.read?'read':'')} key={n.id} onClick={()=>go(n)}><span className={'notificationItemIcon '+n.type}>{iconFor(n.type)}</span><span className="notificationItemBody"><b>{n.title}</b><small>{n.message}</small><span className="notificationItemMeta"><MapPin size={12}/>{n.locationName}<i/>Live update</span></span>{!n.read&&<span className="notificationUnreadDot"/>}<ChevronRight className="notificationChevron" size={16}/></button>)}</div>
  <footer className="notificationFoot"><span><Check size={13}/> Live updates enabled</span><button onClick={()=>{setOpen(false);onNavigate('notifications')}}>Open notification center <ChevronRight size={14}/></button></footer>
 </section> : null;
 return <div className="notificationCenter" ref={rootRef}>
  <button className={'notificationBell '+(open?'isOpen':'')} aria-label="Open notifications" title="Notifications" onClick={()=>setOpen(x=>!x)}><Bell size={18}/>{unread>0&&<span className="notificationCount">{unread>99?'99+':unread}</span>}</button>
  {feedError&&<div className="notificationFeedError" role="status">{feedError}</div>}
  {isMobile && popover ? createPortal(popover,document.body) : popover}
 </div>;
}
