'use client';

import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Props = { value?: string | number; onChange?: (event: { target: { value: string } }) => void; children?: React.ReactNode; disabled?: boolean; className?: string; required?: boolean; name?: string; 'aria-label'?: string; title?: string };

/** Theme-aware dropdown that replaces browser-native select menus across VMS. */
export default function VmsSelect({ value, onChange, children, disabled, className = '', required, name, ...rest }: Props) {
 const root=useRef<HTMLDivElement>(null); const [open,setOpen]=useState(false);
 const options=useMemo(()=>Children.toArray(children).filter(isValidElement).map((node:any)=>({value:String(node.props.value??node.props.children??''),label:node.props.children,disabled:Boolean(node.props.disabled)})),[children]);
 const selected=options.find(option=>option.value===String(value??''));
 useEffect(()=>{if(!open)return;const outside=(event:MouseEvent|TouchEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('mousedown',outside);document.addEventListener('touchstart',outside,{passive:true});document.addEventListener('keydown',escape);return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('touchstart',outside);document.removeEventListener('keydown',escape)}},[open]);
 const choose=(next:string)=>{onChange?.({target:{value:next}});setOpen(false)};
 return <div ref={root} className={'vmsSelectRoot '+className}><button type="button" className="vmsSelectTrigger" aria-haspopup="listbox" aria-expanded={open} aria-label={rest['aria-label']} title={rest.title} disabled={disabled} onClick={()=>setOpen(v=>!v)}><span className="vmsSelectValue">{selected?.label??(value?String(value):'Select an option')}</span><ChevronDown size={16} className={open?'vmsSelectChevron isOpen':'vmsSelectChevron'}/></button>{required&&<input className="vmsSelectRequired" aria-label="Required selection" required value={String(value??'')} onChange={()=>{}} onInvalid={event=>{event.preventDefault();setOpen(true);root.current?.querySelector('button')?.focus()}}/>}{name&&<input type="hidden" name={name} value={String(value??'')}/>}{open&&<div className="vmsSelectMenu" role="listbox">{options.map((option,index)=><button key={option.value+'-'+index} type="button" role="option" aria-selected={option.value===String(value??'')} disabled={option.disabled} className={'vmsSelectOption '+(option.value===String(value??'')?'isSelected':'')} onClick={()=>choose(option.value)}><span>{option.label}</span>{option.value===String(value??'')&&<Check size={15}/>}</button>)}</div>}</div>;
}
