"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Waves, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { createBeach } from './scene';
import { createQuietSurf } from './surf-audio';
const chapters = [
 { name:'Morning', title:['A slower kind','of time.'], note:'The world wakes. The ocean breathes.', at:0 },
 { name:'Golden hour', title:['Stay for','the afterglow.'], note:'Everything the light touches turns to gold.', at:.58 },
 { name:'Nightfall', title:['Under the','same stars.'], note:'A thousand lights. A little more stillness.', at:1 }
];
export default function Home(){
 const host=useRef<HTMLDivElement>(null), progress=useRef(0), audio=useRef<AudioContext|null>(null);
 const audioGain=useRef<GainNode|null>(null);
 const [p,setP]=useState(0),[sound,setSound]=useState(false),[immersive,setImmersive]=useState(false),[error,setError]=useState(false);
 const active=p<.35?0:p<.86?1:2;
 useEffect(()=>{const scroll=()=>{progress.current=Math.min(1,Math.max(0,window.scrollY/(document.documentElement.scrollHeight-innerHeight)));setP(progress.current)};window.addEventListener('scroll',scroll,{passive:true});scroll();let dispose:(()=>void)|undefined;try{dispose=createBeach(host.current!,progress)}catch{queueMicrotask(()=>setError(true))}return()=>{dispose?.();window.removeEventListener('scroll',scroll);void audio.current?.close()}},[]);
 const go=(at:number)=>window.scrollTo({top:at*(document.documentElement.scrollHeight-innerHeight),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 async function toggleSound(){
  if(!audio.current){const ctx=new AudioContext();audio.current=ctx;audioGain.current=createQuietSurf(ctx);}
  const ctx=audio.current;
  if(ctx.state==='suspended')await ctx.resume();
  const gain=audioGain.current!.gain;
  gain.cancelScheduledValues(ctx.currentTime);
  gain.setTargetAtTime(sound?0:.11,ctx.currentTime,.45);
  setSound(!sound);
 }

 const minutes=Math.round(420+p*900);
 return <main className={immersive?'experience immersive':'experience'}>
 <div className="scene" ref={host} aria-hidden="true"/><div className="vignette"/>
 <header className="topbar"><button className="wordmark" onClick={()=>go(0)} aria-label="Solstice, return to morning"><Waves size={26} strokeWidth={1.2}/>solstice<span>®</span></button><span className="edition">A DAY, UNHURRIED</span><button className="sound-button" onClick={toggleSound} aria-pressed={sound}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>Sound {sound?'on':'off'}</span></button></header>
 <div className="story" aria-live="polite"><div className="eyebrow"><span/>SOMEWHERE YOU’D RATHER BE</div><h1 key={active}>{chapters[active].title.map((line,i)=><span key={line} className={i===1?'italic':''}>{line}</span>)}</h1><p>{chapters[active].note}</p></div>
 <aside className="time-display"><span className="time-dot"/><span>{String(Math.floor(minutes/60)).padStart(2,'0')}:{String(minutes%60).padStart(2,'0')}</span><small>LOCAL TIME</small></aside>
 <nav className="chapter-nav" aria-label="Time of day">{chapters.map((c,i)=><button key={c.name} className={active===i?'selected':''} aria-current={active===i?'step':undefined} onClick={()=>go(c.at)}><span className="chapter-label">{c.name}</span><span className="chapter-mark"/></button>)}</nav>
 <footer className="bottom-bar"><div className="location"><span>THE ART OF DOING NOTHING</span><small>Just you. The sea. And a little time.</small></div><button className="scroll-cue" onClick={()=>go(p>.96?0:chapters[active+1]?.at??1)}>{p>.96?<ArrowUp size={17}/>:<ArrowDown size={17}/>}<span>{p>.96?'RETURN TO MORNING':'SCROLL TO LET THE DAY UNFOLD'}</span></button><button className="view-button" onClick={()=>setImmersive(!immersive)} aria-label={immersive?'Show interface':'Hide interface'} aria-pressed={immersive}>{immersive?<Minimize size={19}/>:<Maximize size={19}/>}</button></footer>
 <div className="day-progress"><div style={{width:`${p*100}%`}}/></div>{error&&<output className="status-message">This scene needs WebGL. Try a browser with hardware acceleration enabled.</output>}<div className="scroll-space" aria-hidden="true"/>
 </main>
}

