import {cloneElement,useEffect,useId,useRef,useState,type ReactElement} from 'react';
import {createPortal} from 'react-dom';
/** Owner UI rule: 300 ms on hover, immediate on keyboard focus. */
export function Tooltip({label,children}:{label:string;children:ReactElement<any>}) {
 const id=useId(),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),[point,setPoint]=useState<{left:number;top:number}>();
 const hide=()=>{clearTimeout(timer.current);setPoint(undefined);};
 const show=(element:HTMLElement)=>{const r=element.getBoundingClientRect();setPoint({left:Math.max(8,Math.min(innerWidth-150,r.left)),top:r.bottom+6});};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 return <>{cloneElement(children,{'aria-describedby':point?id:undefined,onMouseEnter:(e:any)=>{children.props.onMouseEnter?.(e);const el=e.currentTarget;clearTimeout(timer.current);timer.current=setTimeout(()=>show(el),300);},onMouseLeave:(e:any)=>{children.props.onMouseLeave?.(e);hide();},onFocus:(e:any)=>{children.props.onFocus?.(e);clearTimeout(timer.current);show(e.currentTarget);},onBlur:(e:any)=>{children.props.onBlur?.(e);hide();},onKeyDown:(e:any)=>{children.props.onKeyDown?.(e);if(e.key==='Escape')hide();}})}{point&&createPortal(<span id={id} role="tooltip" style={{position:'fixed',...point,zIndex:10000,pointerEvents:'none',background:'#222',color:'#fff',padding:'5px 8px',borderRadius:4,fontSize:13}}>{label}</span>,document.body)}</>;
}
