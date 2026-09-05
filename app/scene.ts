import * as THREE from 'three';
import Lenis from 'lenis';
import { createWildlife } from './wildlife';
import { sunElevation } from './day-cycle';

const fragmentShader = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uProgress;
uniform float uSunElevation;
uniform vec2 uPointer;
uniform sampler2D uCloudPhoto;
uniform float uPhotoReady;
uniform sampler2D uRidgeProfile;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return f;}
float night;float gold;vec3 sunDir;vec3 moonDir;
float sunsetWarmth(){return (1.-smoothstep(.015,.23,sunDir.y))*(1.-night);}
vec3 sunlightColor(){return mix(vec3(1.,.96,.84),vec3(1.,.43,.14),sunsetWarmth());}
// The supplied Oropos photo provides real cloud contours and internal detail.
// Only its sky is sampled: the lower 56% (land and sea) never enters this layer.
vec4 clouds(vec3 rd){
 if(rd.y<0.||uPhotoReady<.5)return vec4(0.);
 float azimuth=atan(rd.x,-rd.z);
 float elevation=atan(max(rd.y,0.),length(rd.xz));
 // Reverse the panorama so its warm light agrees with our sun on the right.
 float u=clamp(.5-azimuth/1.27+sin(uTime*.009)*.009,.012,.988);
 float v=mix(.56,.995,clamp(elevation/.365,0.,1.));
 // Small, soft reconstruction footprint reduces JPEG block edges in the source.
 vec2 uv=vec2(u,v),texel=vec2(1./2048.,1./1537.);
 vec2 radius=max(texel*2.5,fwidth(uv)*.7);
 vec3 photo=texture2D(uCloudPhoto,uv).rgb*.28;
 photo+=texture2D(uCloudPhoto,uv+vec2(radius.x,0.)).rgb*.12;
 photo+=texture2D(uCloudPhoto,uv-vec2(radius.x,0.)).rgb*.12;
 photo+=texture2D(uCloudPhoto,uv+vec2(0.,radius.y)).rgb*.12;
 photo+=texture2D(uCloudPhoto,uv-vec2(0.,radius.y)).rgb*.12;
 photo+=texture2D(uCloudPhoto,uv+radius).rgb*.06;
 photo+=texture2D(uCloudPhoto,uv-radius).rgb*.06;
 photo+=texture2D(uCloudPhoto,uv+vec2(radius.x,-radius.y)).rgb*.06;
 photo+=texture2D(uCloudPhoto,uv+vec2(-radius.x,radius.y)).rgb*.06;
 float luminance=dot(photo,vec3(.2126,.7152,.0722));
 float blue=photo.b-photo.r;
 float cloud=1.-smoothstep(.05,.255,blue);
 // Relight the real cloud detail from the current sun, not a fixed side tint.
 float value=clamp((luminance-.16)/.65,0.,1.);
 float warmth=sunsetWarmth();
 float sunAzimuth=atan(sunDir.x,-sunDir.z);
 float separation=abs(azimuth-sunAzimuth);
 float nearSun=exp(-separation*separation/ .32);
 float lowBank=1.-smoothstep(.06,.40,elevation);
 float illumination=nearSun*(.4+.6*lowBank);
 vec3 morning=mix(vec3(.29,.37,.44),vec3(.96,.97,.94),value);
 vec3 coolShadow=mix(vec3(.24,.29,.35),vec3(.51,.54,.57),value);
 vec3 amber=mix(vec3(.49,.29,.18),vec3(1.,.77,.38),value);
 vec3 dusk=mix(coolShadow,amber,clamp(illumination*.8+value*.20,0.,1.));
 vec3 lit=mix(morning,dusk,warmth);
 // Thin sunward edges transmit more light than the dense cloud interiors.
 vec2 sunUV=vec2(.5-sunAzimuth/1.27,mix(.56,.995,clamp(asin(sunDir.y)/.365,0.,1.)));
 vec2 towardSun=normalize(sunUV-uv+vec2(.00001));
 vec3 neighbor=texture2D(uCloudPhoto,clamp(uv+towardSun*.006,vec2(.005),vec2(.995))).rgb;
 float neighborCloud=1.-smoothstep(.05,.255,neighbor.b-neighbor.r);
 float rim=smoothstep(.015,.22,max(cloud-neighborCloud,0.));
 float transmission=pow(1.-cloud*.82,2.);
 float afterglow=smoothstep(-.13,-.035,sunDir.y)*(1.-night);
 lit+=sunlightColor()*(rim*.46+transmission*.15)*illumination*afterglow*(.35+warmth*.8);
 vec3 nocturnal=mix(vec3(.014,.025,.045),vec3(.10,.14,.21),value);
 lit=mix(lit,nocturnal,night);
 float alpha=cloud*.97;
 // Thin horizon haze ties the cloud banks into the distant mountain atmosphere.
 alpha*=smoothstep(0.,.016,rd.y);
 return vec4(lit*alpha,alpha);
}
vec3 sky(vec3 rd){
 float h=max(rd.y,0.);
 vec3 zenith=mix(vec3(.20,.43,.60),vec3(.23,.37,.50),gold);
 vec3 horizon=mix(vec3(.83,.88,.83),vec3(1.,.61,.30),sunsetWarmth());
 zenith=mix(zenith,vec3(.008,.019,.065),night);
 horizon=mix(horizon,vec3(.055,.105,.18),night);
 vec3 col=mix(horizon,zenith,pow(clamp(h,0.,1.),.42));
 float sd=max(dot(rd,sunDir),0.);
 float sunVisibility=smoothstep(-.045,.025,sunDir.y)*(1.-night);
 vec3 tangent=normalize(cross(sunDir,vec3(0.,1.,0.)));
 vec3 bitangent=cross(tangent,sunDir);
 vec2 offset=vec2(dot(rd,tangent),dot(rd,bitangent));
 float radius=length(offset),angle=atan(offset.y,offset.x);
 float spokes=pow(.5+.5*sin(angle*9.+sin(angle*3.)*.8),10.);
 spokes+=pow(.5+.5*sin(angle*15.+1.7),16.)*.35;
 float shafts=spokes*exp(-radius*13.)*smoothstep(.012,.04,radius)*(1.-smoothstep(.25,.42,radius));
 col+=sunlightColor()*shafts*(.20+gold*.16)*sunVisibility;
 col+=sunlightColor()*pow(sd,9.)*.24*sunVisibility;
 col+=sunlightColor()*pow(sd,70.)*.42*sunVisibility;
 col+=mix(vec3(1.,.98,.88),vec3(1.,.56,.22),sunsetWarmth())*smoothstep(.99972,.99986,sd)*2.4*sunVisibility;
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
// Distant terrain is evaluated as continuous ridge cross-sections. Unlike
// height-field marching, this cannot exhaust a step budget and tear open.
float ridgeHeight(float x,float layer){
 float u=clamp(.5+x/1390.,.001,.999);
 vec3 profile=texture2D(uRidgeProfile,vec2(u,.5)).rgb;
 float silhouette=layer<.5?profile.r:(layer<1.5?profile.g:profile.b);
 return max(.3,silhouette*165.);
}
vec4 mountains(vec3 ro,vec3 rd){
 if(rd.y<-.018||rd.y>.095||rd.z>=-.1)return vec4(0.);
 vec3 result=vec3(0.);float opacity=0.;
 // Each range has its own silhouette rather than an offset copy of the same hill.
 for(int i=0;i<3;i++){
  float layer=float(i),depth=2050.-layer*460.;
  float t=(-depth-ro.z)/rd.z;if(t<=0.)continue;
  vec3 p=ro+rd*t;float x=p.x*1000./depth;
  float height=ridgeHeight(x,layer);
  float aa=max(fwidth(p.y-height),.12);
  float coverage=(1.-smoothstep(-aa,aa,p.y-height))*smoothstep(-aa,aa,p.y+.5);
  float elevation=clamp(p.y/max(height,1.),0.,1.);
  float slope=(ridgeHeight(x+1.8,layer)-ridgeHeight(x-1.8,layer))/3.6;
  // Branching gullies run downhill from the skyline, fading into coastal haze.
  float warp=noise(vec2(x*.012,elevation*2.+layer*4.));
  vec2 reliefUV=vec2(x*.019+warp*1.4+(1.-elevation)*slope*.8,elevation*1.8+layer*7.);
  float relief=fbm(reliefUV);
  float facing=clamp(.5-slope*.25+(relief-.5)*.75,.12,.9);
  float valley=pow(1.-abs(relief*2.-1.),5.);
  vec3 shaded=mix(vec3(.09,.145,.17),vec3(.20,.255,.27),facing);
  shaded*=1.-valley*.12*smoothstep(.05,.5,elevation);
  // Only broad relief survives at this distance; avoid noisy rock texture.
  vec3 warmLight=vec3(1.10,.88,.70);
  shaded=mix(shaded,shaded*warmLight,gold*.7);
  shaded=mix(shaded,vec3(.016,.029,.047)*(1.+facing*.3),night);
  vec3 haze=mix(vec3(.54,.65,.69),vec3(.61,.48,.37),gold);
  haze=mix(haze,vec3(.051,.080,.13),night);
  float distanceHaze=.40-layer*.14;
  float mist=exp(-max(p.y,0.)*.085)*.085;
  shaded=mix(shaded,haze,distanceHaze+mist);
  result=result*(1.-coverage)+shaded*coverage;
  opacity=coverage+opacity*(1.-coverage);
 }
 return vec4(result/max(opacity,.0001),opacity);
}
vec3 splash(vec3 color,vec3 ro,vec3 rd,float age,vec3 center){
 if(age<0.||age>1.7)return color;
 for(int i=0;i<16;i++){
  float seed=float(i);float angle=seed*2.39996;
  float speed=.25+hash(vec2(seed,8.))*.65;
  vec3 drop=center+vec3(cos(angle)*age*speed,age*(.9+hash(vec2(seed,2.))*1.4)-4.905*age*age,sin(angle)*age*speed);
  if(drop.y<.02)continue;
  vec3 delta=drop-ro;float t=dot(delta,rd);
  float d=length(delta-rd*t),r=.007+hash(vec2(seed,4.))*.012;
  float pixel=max(t/uResolution.y*.65,.006);
  float alpha=(1.-smoothstep(r,r+pixel,d))*(1.-smoothstep(1.,1.7,age));
  color=mix(color,mix(vec3(.90,.95,.94),vec3(.30,.42,.57),night),alpha*.85);
 }
 return color;
}
void main(){
 vec2 uv=(vUv-.5)*vec2(uResolution.x/uResolution.y,1.);
 night=smoothstep(.84,.99,uProgress);
 gold=smoothstep(.14,.56,uProgress)*(1.-smoothstep(.74,.99,uProgress));
 float sunHeight=uSunElevation;
 sunDir=normalize(vec3(mix(.34,.63,smoothstep(0.,.8,uProgress)),sunHeight,-1.));moonDir=normalize(vec3(.58,.40,-1.));
 vec3 ro=vec3(uPointer.x*.15,3.4+uProgress*.25,14.-uProgress*.7);
 vec3 rd=normalize(vec3(uv.x+uPointer.x*.006,uv.y-.04+uPointer.y*.004,-1.35));
 vec3 color=sky(rd);
 float breachPhase=mod(uTime,22.);
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
   float sunAbove=smoothstep(-.045,.025,sunDir.y);
   color+=mix(sunlightColor()*sunAbove,vec3(.42,.60,.85),night)*spec*(1.4+gold*1.2);
   // A broken, elongated glitter path uses the same moving sun as the sky rays.
   vec3 reflectedRay=reflect(rd,n);
   float horizontal=reflectedRay.x/max(.1,-reflectedRay.z)-sunDir.x/max(.1,-sunDir.z);
   float vertical=reflectedRay.y-sunDir.y;
   float glitter=exp(-horizontal*horizontal/ .0016-vertical*vertical/.035);
   float fragments=smoothstep(.48,.82,noise(pos.xz*vec2(8.,19.)+vec2(0.,uTime*.35)));
   color+=sunlightColor()*glitter*fragments*.27*sunAbove*(1.-night);
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
    float age=breachPhase-(i==0?3.:3.9);
    if(age>0.&&age<3.){
     vec2 center=vec2(i==0?8.:9.8,-38.);
     float radius=length(pos.xz-center);
     float ring=exp(-pow((radius-age*1.35)/.095,2.));
     ring+=exp(-pow((radius-age*.95)/.08,2.))*.5;
     color+=mix(vec3(.29,.36,.35),vec3(.06,.11,.17),night)*ring*(1.-age/3.)*.6;
    }
   }
  }
 }
 vec4 land=mountains(ro,rd);color=mix(color,land.rgb,land.a);
 
 color=splash(color,ro,rd,breachPhase-3.,vec3(8.,.03,-38.));
 color=splash(color,ro,rd,breachPhase-3.9,vec3(9.8,.03,-38.));
 color=pow(max(color,vec3(0)),vec3(.92));
 color+=(hash(gl_FragCoord.xy+fract(uTime))-.5)/255.;
 gl_FragColor=vec4(color,1.);
}`;

export function createBeach(host:HTMLDivElement, progress:{current:number}) {
 const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.localClippingEnabled=true;
 renderer.autoClear=false;
 const wildlife=createWildlife();
 host.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 // Independently shaped skyline, middle-distance shoulders and coastal foothills.
 const ridgeProfiles=[
  [.06,.075,.09,.11,.15,.18,.24,.30,.26,.22,.245,.21,.29,.33,.40,.46,.43,.39,.44,.405,.47,.45,.34,.27,.295,.28,.31,.37,.43,.47,.455,.49,.475,.39,.33,.28,.23,.205,.18,.16,.13],
  [.025,.03,.045,.07,.11,.16,.19,.165,.14,.12,.10,.12,.16,.20,.245,.23,.195,.17,.18,.155,.14,.11,.12,.15,.19,.215,.245,.235,.27,.25,.205,.18,.16,.15,.12,.105,.095,.08,.07,.065,.05],
  [.014,.02,.025,.035,.045,.06,.085,.10,.095,.085,.07,.058,.052,.06,.065,.075,.09,.095,.085,.07,.06,.052,.055,.06,.075,.09,.11,.12,.115,.105,.095,.08,.07,.065,.06,.055,.045,.04,.035,.03,.025]
 ];
 const profileData=new Uint8Array(2048*4);
 for(let i=0;i<2048;i++){
  for(let channel=0;channel<3;channel++){
   const knots=ridgeProfiles[channel];
   const x=i/2047*(knots.length-1),j=Math.min(knots.length-2,Math.floor(x)),f=x-j;
   // Mostly linear slopes keep craggy summits rather than inflated, round hills.
   const easing=f*.78+(f*f*(3-2*f))*.22;
   const silhouette=THREE.MathUtils.lerp(knots[j],knots[j+1],easing);
   const roughness=(Math.sin(i*.071+channel*4)*.0018+Math.sin(i*.193)*.0007)*Math.sin(Math.PI*f);
   profileData[i*4+channel]=Math.round(THREE.MathUtils.clamp(silhouette+roughness,0,1)*255);
  }
  profileData[i*4+3]=255;
 }
 const ridgeTexture=new THREE.DataTexture(profileData,2048,1,THREE.RGBAFormat);
 ridgeTexture.minFilter=THREE.LinearFilter;ridgeTexture.magFilter=THREE.LinearFilter;ridgeTexture.needsUpdate=true;
 const placeholder=new THREE.DataTexture(new Uint8Array([110,130,150,255]),1,1);placeholder.needsUpdate=true;
 let disposed=false;
 const uniforms={uSunElevation:{value:sunElevation(progress.current)},uCloudPhoto:{value:placeholder as THREE.Texture},uPhotoReady:{value:0},uRidgeProfile:{value:ridgeTexture},uResolution:{value:new THREE.Vector2()},uTime:{value:0},uProgress:{value:progress.current},uPointer:{value:new THREE.Vector2()}};
 const cloudTexture=new THREE.TextureLoader().load('/textures/oropos-sky.jpg',texture=>{
  if(disposed){texture.dispose();return;}
  texture.colorSpace=THREE.NoColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  uniforms.uCloudPhoto.value=texture;uniforms.uPhotoReady.value=1;
 });
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader,depthTest:false,depthWrite:false});
 const geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const lenis=reduced?null:new Lenis({duration:1.4,smoothWheel:true});
 const resize=()=>{renderer.setSize(innerWidth,innerHeight);uniforms.uResolution.value.set(innerWidth,innerHeight)};
 const pointer=(e:PointerEvent)=>{if(!reduced)uniforms.uPointer.value.set((e.clientX/innerWidth-.5)*2,(.5-e.clientY/innerHeight)*2)};
 resize();window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer,{passive:true});
 let frame=0,last=0,elapsed=0;
 const animate=(now:number)=>{frame=requestAnimationFrame(animate);lenis?.raf(now);if(document.hidden){last=now;return}const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;uniforms.uTime.value=reduced?0:elapsed;uniforms.uProgress.value=THREE.MathUtils.lerp(uniforms.uProgress.value,progress.current,reduced?1:1-Math.exp(-dt*5));uniforms.uSunElevation.value=sunElevation(uniforms.uProgress.value);renderer.clear();renderer.render(scene,camera);wildlife.update(uniforms.uTime.value,uniforms.uProgress.value,uniforms.uPointer.value,innerWidth/innerHeight);renderer.clearDepth();renderer.render(wildlife.scene,wildlife.camera)};
 frame=requestAnimationFrame(animate);
 return()=>{disposed=true;cloudTexture.dispose();placeholder.dispose();ridgeTexture.dispose();cancelAnimationFrame(frame);lenis?.destroy();window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);geometry.dispose();material.dispose();wildlife.dispose();renderer.dispose();renderer.domElement.remove()};
}

