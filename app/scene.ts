import * as THREE from 'three';
import Lenis from 'lenis';

const fragmentShader = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uProgress;
uniform vec2 uPointer;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return f;}
float night;float gold;vec3 sunDir;vec3 moonDir;
vec3 sky(vec3 rd){
 float h=max(rd.y,0.);
 vec3 zenith=mix(vec3(.20,.43,.60),vec3(.23,.24,.38),gold);
 vec3 horizon=mix(vec3(.83,.88,.83),vec3(1.,.49,.22),gold);
 zenith=mix(zenith,vec3(.008,.019,.065),night);
 horizon=mix(horizon,vec3(.055,.105,.18),night);
 vec3 col=mix(horizon,zenith,pow(clamp(h,0.,1.),.42));
 float sd=max(dot(rd,sunDir),0.);
 col+=vec3(1.,.65,.30)*pow(sd,9.)*.24*(1.-night);
 col+=vec3(1.,.65,.31)*pow(sd,70.)*.42*(1.-night);
 col+=vec3(1.,.90,.65)*smoothstep(.99972,.99986,sd)*2.4*(1.-night);
 float md=max(dot(rd,moonDir),0.);
 col+=vec3(.50,.64,.90)*pow(md,90.)*.20*night;
 col+=vec3(.88,.93,1.)*smoothstep(.99982,.99990,md)*night;
 if(rd.y>0.){
  vec2 sp=vec2(atan(rd.x,-rd.z),asin(rd.y))*420.;
  vec2 cell=floor(sp);float star=hash(cell);
  float point=1.-smoothstep(.025,.17,length(fract(sp)-.5));
  col+=point*step(.991,star)*night*smoothstep(.015,.25,rd.y)*(vec3(.6,.72,1.)+star*.35)*(.7+.3*sin(uTime*.6+star*100.));
  float milky=pow(fbm(rd.xz*5.+rd.y*2.),3.)*.1*night*smoothstep(.0,.25,rd.y);
  col+=vec3(.38,.43,.7)*milky;
  vec2 cp=rd.xz/(rd.y+.17)*1.5+vec2(uTime*.004,0.);
  float cloud=fbm(cp*1.3+vec2(fbm(cp*2.),0.));
  float wisps=smoothstep(.48,.76,cloud)*smoothstep(.0,.11,rd.y)*.68;
  vec3 cc=mix(vec3(.97,.95,.88),vec3(1.,.65,.45),gold);
  cc=mix(cc,vec3(.08,.115,.19),night);
  col=mix(col,cc,wisps);
 }
 return col;
}
float shore(vec2 p){return 5.3+sin(p.x*.12)*1.2+p.x*.12;}
float wave(vec2 p){
 float t=uTime*.65;
 float w=sin(p.y*.55-t+sin(p.x*.14)*1.2)*.105;
 w+=sin(p.y*1.08-t*1.36+p.x*.24)*.053;
 w+=sin(p.x*1.9+p.y*1.5+t*.9)*.019;
 w+=sin(p.x*3.8-p.y*2.7+t*1.2)*.011;
 w+=(noise(p*5.+t)-.5)*.014;
 return w;
}
float surface(vec2 p){float d=p.y-shore(p);return max(wave(p)*(1.-smoothstep(-5.,1.5,d)),d*.115-.11);}
void main(){
 vec2 uv=(vUv-.5)*vec2(uResolution.x/uResolution.y,1.);
 night=smoothstep(.72,.97,uProgress);
 gold=smoothstep(.14,.56,uProgress)*(1.-smoothstep(.74,.99,uProgress));
 float sunHeight=mix(.42,-.14,smoothstep(0.,.86,uProgress));
 sunDir=normalize(vec3(.55,sunHeight,-1.));moonDir=normalize(vec3(.58,.40,-1.));
 vec3 ro=vec3(uPointer.x*.15,3.4+uProgress*.25,14.-uProgress*.7);
 vec3 rd=normalize(vec3(uv.x+uPointer.x*.006,uv.y-.04+uPointer.y*.004,-1.35));
 vec3 color=sky(rd);
 if(rd.y<0.){
  float dist=-ro.y/rd.y;
  for(int i=0;i<7;i++){vec3 q=ro+rd*dist;float hh=surface(q.xz);dist=mix(dist,(hh-ro.y)/rd.y,.7);}
  vec3 pos=ro+rd*dist;
  float shoreD=pos.z-shore(pos.xz);
  float oceanHeight=wave(pos.xz);
  float sandHeight=shoreD*.115-.11;
  vec3 light=mix(vec3(.96,.91,.77),vec3(.95,.49,.24),gold);
  light=mix(light,vec3(.13,.21,.34),night);
  float grain=noise(pos.xz*150.);
  float sandNoise=fbm(pos.xz*3.);
  vec3 sand=vec3(.68,.54,.35)*(1.+sandNoise*.26+grain*.07);
  float ripple=sin(pos.x*8.+sin(pos.z*2.)+fbm(pos.xz)*6.);
  sand*=.97+ripple*.028;
  sand*=light;
  if(sandHeight>oceanHeight&&shoreD>-.4){
   float wet=1.-smoothstep(.1,2.6,shoreD);
   sand*=1.-wet*.26;
   vec3 reflected=sky(reflect(rd,vec3(0,1,0)));
   sand=mix(sand,reflected,.22*wet);
   float waterline=sin(uTime*.7+pos.x*.15)*.22+.55;
   float edge=1.-smoothstep(.0,.14,abs(shoreD-waterline));
   float lace=smoothstep(.38,.64,noise(pos.xz*26.+uTime*.3));
   color=sand+edge*lace*light*.3;
  }else{
   float eps=.035;
   float dx=wave(pos.xz+vec2(eps,0))-wave(pos.xz-vec2(eps,0));
   float dz=wave(pos.xz+vec2(0,eps))-wave(pos.xz-vec2(0,eps));
   vec3 n=normalize(vec3(-dx,eps*2.,-dz));
   vec3 reflected=sky(reflect(rd,n));
   float fresnel=.035+.965*pow(1.-max(dot(-rd,n),0.),5.);
   vec3 deep=mix(vec3(.025,.24,.28),vec3(.085,.16,.17),gold);
   deep=mix(deep,vec3(.006,.035,.058),night);
   float shallow=smoothstep(-6.,1.,shoreD);
   vec3 base=mix(deep,sand*.72+vec3(.02,.10,.075)*(1.-night),shallow*.85);
   color=mix(base,reflected,clamp(fresnel+.13,.0,1.));
   vec3 lightDir=mix(sunDir,moonDir,night);
   vec3 halfDir=normalize(lightDir-rd);
   float spec=pow(max(dot(n,halfDir),0.),170.);
   color+=mix(vec3(1.,.76,.41),vec3(.42,.60,.85),night)*spec*(1.4+gold*1.2);
   float phase=pos.z*.67-uTime*.68+sin(pos.x*.20)*.65;
   float crest=pow(.5+.5*sin(phase),18.);
   float breaker=crest*smoothstep(-13.,-1.,shoreD)*(1.-smoothstep(-.8,1.1,shoreD));
   float bubbles=smoothstep(.30,.65,noise(pos.xz*22.+vec2(0,uTime*.3)));
   float edge=1.-smoothstep(.03,.45,abs(shoreD-(sin(uTime*.7+pos.x*.15)*.22+.20)));
   float foam=clamp(breaker*.8+edge*bubbles,0.,.9);
   color=mix(color,mix(vec3(.83,.91,.86),vec3(.14,.23,.31),night),foam);
   color=mix(color,sky(vec3(rd.x,.0,rd.z)),1.-exp(-dist*.0023));
  }
 }
 // A distant headland, softened by sea haze.
 float ridge=.012+.016*fbm(vec2(rd.x*36.,2.));
 float island=smoothstep(.25,.42,-rd.x)*(1.-smoothstep(.65,.95,-rd.x));
 if(rd.y>-.002&&rd.y<ridge*island){color=mix(vec3(.19,.31,.33),vec3(.024,.045,.08),night)*mix(1.,.8,gold);}
 color=pow(max(color,vec3(0)),vec3(.92));
 color+=(hash(gl_FragCoord.xy+fract(uTime))-.5)/255.;
 gl_FragColor=vec4(color,1.);
}`;

export function createBeach(host:HTMLDivElement, progress:{current:number}) {
 const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 host.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const uniforms={uResolution:{value:new THREE.Vector2()},uTime:{value:0},uProgress:{value:progress.current},uPointer:{value:new THREE.Vector2()}};
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader,depthTest:false,depthWrite:false});
 const geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const lenis=reduced?null:new Lenis({duration:1.4,smoothWheel:true});
 const resize=()=>{renderer.setSize(innerWidth,innerHeight);uniforms.uResolution.value.set(innerWidth,innerHeight)};
 const pointer=(e:PointerEvent)=>{if(!reduced)uniforms.uPointer.value.set((e.clientX/innerWidth-.5)*2,(.5-e.clientY/innerHeight)*2)};
 resize();window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer,{passive:true});
 let frame=0,last=0,elapsed=0;
 const animate=(now:number)=>{frame=requestAnimationFrame(animate);lenis?.raf(now);if(document.hidden){last=now;return}const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;uniforms.uTime.value=reduced?0:elapsed;uniforms.uProgress.value=THREE.MathUtils.lerp(uniforms.uProgress.value,progress.current,reduced?1:1-Math.exp(-dt*5));renderer.render(scene,camera)};
 frame=requestAnimationFrame(animate);
 return()=>{cancelAnimationFrame(frame);lenis?.destroy();window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);geometry.dispose();material.dispose();renderer.dispose();renderer.domElement.remove()};
}

