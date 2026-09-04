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
// Layered density samples give clouds lit tops, shadowed interiors and soft edges.
float noise3(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 vec2 q=i.xy+vec2(37.,113.)*i.z;
 return mix(mix(mix(hash(q),hash(q+vec2(1,0)),f.x),mix(hash(q+vec2(0,1)),hash(q+1.),f.x),f.y),
 mix(mix(hash(q+vec2(37,113)),hash(q+vec2(38,113)),f.x),mix(hash(q+vec2(37,114)),hash(q+vec2(38,114)),f.x),f.y),f.z);
}
float cloudDensity(vec3 p){
 float shape=noise3(p*.85)*.57+noise3(p*1.8)*.28+noise3(p*3.9)*.15;
 float detail=noise3(p*8.)*.055;
 float envelope=smoothstep(0.,.18,p.y)*(1.-smoothstep(.55,1.35,p.y));
 return smoothstep(.43,.68,shape-detail)*envelope;
}
vec4 clouds(vec3 rd){
 if(rd.y<.015)return vec4(0.);
 vec3 lightDir=normalize(mix(sunDir,moonDir,night));
 vec3 lit=mix(vec3(1.,.98,.91),vec3(1.,.69,.42),gold);
 vec3 shade=mix(vec3(.43,.55,.66),vec3(.39,.29,.37),gold);
 lit=mix(lit,vec3(.28,.36,.53),night);shade=mix(shade,vec3(.035,.055,.10),night);
 vec3 sum=vec3(0.);float transmittance=1.;
 for(int i=0;i<8;i++){
  float layer=(float(i)+.5)/8.;
  vec3 p=vec3(rd.xz*((1.8+layer*.48)/(rd.y+.08)),layer*1.35).xzy;
  p.xz+=vec2(uTime*.008,2.7);
  float density=cloudDensity(p);
  float shadow=cloudDensity(p+lightDir*.32);
  float lighting=clamp(.82-shadow*1.9+layer*.18,.08,1.);
  float silver=pow(max(dot(rd,lightDir),0.),12.)*(1.-density)*.65;
  vec3 sampleColor=mix(shade,lit,lighting)+lit*silver;
  float alpha=1.-exp(-density*.72);
  sum+=transmittance*alpha*sampleColor;transmittance*=1.-alpha;
 }
 float horizonFade=smoothstep(.015,.095,rd.y);
 return vec4(sum*horizonFade,(1.-transmittance)*horizonFade);
}
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
  vec4 volume=clouds(rd);
  col=col*(1.-volume.a)+volume.rgb;
  // Thin, high cirrus streaks above the slower cumulus layer.
  vec2 cp=rd.xz/(rd.y+.24)+vec2(uTime*.0015,0.);
  float cirrus=smoothstep(.59,.79,fbm(cp*vec2(2.,15.)))*.19*smoothstep(.12,.5,rd.y);
  col=mix(col,mix(vec3(.94,.89,.80),vec3(.13,.17,.27),night),cirrus);
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
float mountainHeight(vec2 p){
 float a=exp(-dot((p-vec2(-175.,-370.))/vec2(125.,180.),(p-vec2(-175.,-370.))/vec2(125.,180.)));
 float b=exp(-dot((p-vec2(-305.,-500.))/vec2(160.,175.),(p-vec2(-305.,-500.))/vec2(160.,175.)));
 float c=exp(-dot((p-vec2(270.,-480.))/vec2(120.,200.),(p-vec2(270.,-480.))/vec2(120.,200.)));
 float ridge=1.-abs(noise(p*.017)*2.-1.);
 float folds=noise(p*.043)*.15+noise(p*.11)*.055;
 return max(0.,(a*60.+b*87.+c*64.)*(.58+ridge*.47+folds)-8.);
}
vec4 mountains(vec3 ro,vec3 rd){
 if(rd.y<-.025||rd.y>.24||rd.z>=-.1)return vec4(0.);
 float t=max(0.,(-150.-ro.z)/rd.z),lastT=t;bool hit=false;
 for(int i=0;i<56;i++){
  vec3 p=ro+rd*t;if(p.z< -850.||p.y<-.5)break;
  float d=p.y-mountainHeight(p.xz);
  if(d<.12&&p.y>.05){hit=true;break;}
  lastT=t;t+=max(1.4,d*.60);
 }
 if(!hit)return vec4(0.);
 for(int i=0;i<5;i++){float mid=(lastT+t)*.5;vec3 p=ro+rd*mid;if(p.y<mountainHeight(p.xz))t=mid;else lastT=mid;}
 vec3 p=ro+rd*t;float e=.35;
 vec3 n=normalize(vec3(mountainHeight(p.xz-vec2(e,0))-mountainHeight(p.xz+vec2(e,0)),2.*e,mountainHeight(p.xz-vec2(0,e))-mountainHeight(p.xz+vec2(0,e))));
 vec3 lightDir=normalize(mix(sunDir,moonDir,night));
 float diffuse=max(dot(n,lightDir),0.);
 float crags=fbm(p.xz*.35+vec2(p.y*.31));
 float strata=sin(p.y*1.65+noise(p.xz*.18)*4.)*.035;
 float stone=smoothstep(.35,.76,1.-n.y+crags*.2);
 vec3 terrain=mix(vec3(.105,.19,.14),vec3(.36,.35,.30),stone);
 terrain*=.83+crags*.32+strata;
 vec3 sunlight=mix(vec3(1.,.97,.86),vec3(1.,.52,.26),gold);
 terrain*=vec3(.43,.53,.64)+sunlight*diffuse*.85;
 terrain=mix(terrain*.95,terrain*vec3(.19,.30,.52),night);
 vec3 haze=mix(vec3(.58,.70,.73),vec3(.68,.48,.39),gold);
 haze=mix(haze,vec3(.055,.093,.15),night);
 float aerial=1.-exp(-t*.0018);
 terrain=mix(terrain,haze,aerial);
 float coastalMist=exp(-p.y*.13)*.22;
 terrain=mix(terrain,haze,coastalMist);
 return vec4(terrain,1.);
}
// A small offshore fish uses a ray-marched body and fins in world coordinates.
float ellipsoid(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/max(k1,.0001);}
float fishShape(vec3 p){
 p.z+=sin(p.x*5.+uTime*17.)*.025*smoothstep(.1,.8,-p.x);
 float body=ellipsoid(p,vec3(.64,.18,.12));
 float tail=ellipsoid(p-vec3(-.67,0,0),vec3(.24,.27,.032));
 tail=max(tail,-ellipsoid(p-vec3(-.89,0,0),vec3(.20,.14,.10)));
 float dorsal=ellipsoid(p-vec3(-.12,.19,0),vec3(.23,.14,.022));
 float fin=ellipsoid(p-vec3(.02,-.11,.11),vec3(.20,.06,.18));
 return min(min(body,tail),min(dorsal,fin));
}
vec3 fishLocal(vec3 p,float angle){float c=cos(angle),s=sin(angle);return vec3(c*p.x+s*p.y,-s*p.x+c*p.y,p.z);}
vec4 jumpingFish(vec3 ro,vec3 rd,float phase){
 float flight=(phase-2.)/2.3;if(flight<0.||flight>1.)return vec4(0.);
 vec3 center=vec3(10.+flight*5.,sin(flight*3.14159265)*2.8-.3,-50.);
 float angle=atan(cos(flight*3.14159265)*8.8,5.);
 vec3 oc=ro-center;float b=dot(oc,rd),c=dot(oc,oc)-1.3;
 float discriminant=b*b-c;if(discriminant<0.)return vec4(0.);
 float t=-b-sqrt(discriminant);bool hit=false;vec3 local=vec3(0.);
 for(int i=0;i<32;i++){local=fishLocal(ro+rd*t-center,angle);float d=fishShape(local);if(d<.003){hit=true;break;}t+=max(d*.8,.003);if(t> -b+sqrt(discriminant))break;}
 if(!hit||(ro+rd*t).y<wave((ro+rd*t).xz))return vec4(0.);
 float e=.004;vec3 n=normalize(vec3(fishShape(local+vec3(e,0,0))-fishShape(local-vec3(e,0,0)),fishShape(local+vec3(0,e,0))-fishShape(local-vec3(0,e,0)),fishShape(local+vec3(0,0,e))-fishShape(local-vec3(0,0,e))));
 vec3 light=fishLocal(normalize(mix(sunDir,moonDir,night)),angle);
 vec3 view=fishLocal(-rd,angle);
 float scales=pow(max(0.,sin(local.x*105.+sin(local.y*95.)*1.5)*sin(local.y*95.)),4.);
 vec3 silver=mix(vec3(.62,.74,.75),vec3(.055,.19,.23),smoothstep(-.07,.15,local.y));
 silver*=.72+.32*max(dot(n,light),0.)+scales*.15;
 silver+=vec3(1.,.87,.65)*pow(max(dot(n,normalize(light+view)),0.),65.);
 float eye=length((local.xy-vec2(.43,.045))/vec2(.033,.03));
 silver=mix(silver,vec3(.015,.024,.028),1.-smoothstep(.75,1.,eye));
 float gill=1.-smoothstep(.008,.019,abs(local.x-.31+local.y*.30));
 silver*=1.-gill*.25;
 silver=mix(silver,silver*vec3(.19,.29,.46),night);
 return vec4(silver,1.);
}
vec3 splash(vec3 color,vec3 ro,vec3 rd,float age,vec3 center){
 if(age<0.||age>1.7)return color;
 for(int i=0;i<16;i++){
  float seed=float(i);float angle=seed*2.39996;
  float speed=.55+hash(vec2(seed,8.))*.9;
  vec3 drop=center+vec3(cos(angle)*age*speed,age*(1.5+hash(vec2(seed,2.))*1.7)-2.4*age*age,sin(angle)*age*speed);
  if(drop.y<.02)continue;
  vec3 delta=drop-ro;float t=dot(delta,rd);
  float d=length(delta-rd*t),r=.016+hash(vec2(seed,4.))*.022;
  float pixel=max(t/uResolution.y*.65,.006);
  float alpha=(1.-smoothstep(r,r+pixel,d))*(1.-smoothstep(1.,1.7,age));
  color=mix(color,mix(vec3(.90,.95,.94),vec3(.30,.42,.57),night),alpha*.85);
 }
 return color;
}
void main(){
 vec2 uv=(vUv-.5)*vec2(uResolution.x/uResolution.y,1.);
 night=smoothstep(.72,.97,uProgress);
 gold=smoothstep(.14,.56,uProgress)*(1.-smoothstep(.74,.99,uProgress));
 float sunHeight=mix(.42,-.14,smoothstep(0.,.86,uProgress));
 sunDir=normalize(vec3(.55,sunHeight,-1.));moonDir=normalize(vec3(.58,.40,-1.));
 vec3 ro=vec3(uPointer.x*.15,3.4+uProgress*.25,14.-uProgress*.7);
 vec3 rd=normalize(vec3(uv.x+uPointer.x*.006,uv.y-.04+uPointer.y*.004,-1.35));
 vec3 color=sky(rd);
 float breachPhase=mod(uTime,16.);
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
   if(pos.z< -18.){
    vec4 reflectedLand=mountains(pos+vec3(0.,.16,0.),reflect(rd,n));
    reflected=mix(reflected,reflectedLand.rgb,reflectedLand.a*.8);
   }
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
   // Expanding rings connect takeoff and landing to the moving ocean.
   for(int i=0;i<2;i++){
    float age=breachPhase-(i==0?2.:4.3);
    if(age>0.&&age<3.){
     vec2 center=vec2(i==0?10.:15.,-50.);
     float radius=length(pos.xz-center);
     float ring=exp(-pow((radius-age*1.35)/.095,2.));
     ring+=exp(-pow((radius-age*.95)/.08,2.))*.5;
     color+=mix(vec3(.29,.36,.35),vec3(.06,.11,.17),night)*ring*(1.-age/3.)*.6;
    }
   }
  }
 }
 vec4 land=mountains(ro,rd);color=mix(color,land.rgb,land.a);
 vec4 fish=jumpingFish(ro,rd,breachPhase);color=mix(color,fish.rgb,fish.a);
 color=splash(color,ro,rd,breachPhase-2.,vec3(10.,.03,-50.));
 color=splash(color,ro,rd,breachPhase-4.3,vec3(15.,.03,-50.));
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

