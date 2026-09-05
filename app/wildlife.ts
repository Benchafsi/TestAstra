import * as THREE from 'three';
import { sunElevation } from './day-cycle';

/** Small mullet-like fish, modelled in metres and lit in the beach's world space. */
export function createWildlife() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(.5 / 1.35) * 180 / Math.PI, 1, .1, 200);
  const fish = new THREE.Group();
  scene.add(fish);
  const waterline = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.015);
  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: .32, metalness: .18,
    clearcoat: .65, clearcoatRoughness: .2, clippingPlanes: [waterline],
  });
  const finMaterial = new THREE.MeshPhysicalMaterial({
    color: '#778b89', roughness: .44, metalness: .12, side: THREE.DoubleSide,
    transparent: true, opacity: .8, depthWrite: false, clippingPlanes: [waterline],
  });
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = 48, sides = 32;
  const back = new THREE.Color('#243f43'), flank = new THREE.Color('#91aaa8'), belly = new THREE.Color('#d4dad1');
  for (let row = 0; row <= rows; row++) {
    const s = row / rows, x = -.31 + s * .65;
    const radius = Math.pow(Math.sin(Math.PI * s), .78) * .076 + .011 * (1 - s);
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const y = Math.cos(angle) * radius, z = Math.sin(angle) * radius * .72;
      positions.push(x, y, z);
      const c = y > 0 ? flank.clone().lerp(back, Math.pow(y / .087, .7)) : flank.clone().lerp(belly, Math.min(1, -y / .06));
      // Fine, low-contrast longitudinal striping rather than sparkling dots.
      const stripe = Math.pow(.5 + .5 * Math.cos(angle * 12), 10) * .065;
      c.multiplyScalar(1 - stripe);
      colors.push(c.r, c.g, c.b);
      if (row < rows && side < sides) {
        const a = row * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeometry.setIndex(indices); bodyGeometry.computeVertexNormals();
  fish.add(new THREE.Mesh(bodyGeometry, skin));

  function fin(points: [number, number][], z = 0) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), finMaterial);
    mesh.position.z = z;
    return mesh;
  }
  const tail = new THREE.Group(); tail.position.x = -.295;
  tail.add(fin([[.015,.017],[-.155,.12],[-.13,.057],[-.08,0],[-.13,-.057],[-.155,-.12],[.015,-.017]]));
  fish.add(tail);
  fish.add(fin([[-.15,.055],[-.115,.139],[-.065,.118],[.006,.076],[.08,.071]]));
  fish.add(fin([[-.12,-.053],[-.17,-.096],[-.07,-.064]]));
  for (const side of [-1, 1]) {
    const pectoral = fin([[.12,.005],[-.065,-.07],[.018,-.029]], side * .043);
    pectoral.rotation.x = side * .48;
    fish.add(pectoral);
  }
  const eyeMaterial = new THREE.MeshPhysicalMaterial({color:'#111b1b', roughness:.13, clearcoat:1, clippingPlanes:[waterline]});
  const eyeGeometry = new THREE.SphereGeometry(.008, 12, 8);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(.245, .018, side * .029); fish.add(eye);
  }
  const ambient = new THREE.HemisphereLight('#dbe9f0', '#314c54', 1.6);
  const sunlight = new THREE.DirectionalLight('#fff2d5', 2.1);
  scene.add(ambient, sunlight);
  const warm = new THREE.Color('#ffa76c'), day = new THREE.Color('#fff2d5'), moon = new THREE.Color('#8aaad9');
  function update(time: number, progress: number, pointer: THREE.Vector2, aspect: number) {
    const phase = time % 22, flight = phase - 3;
    fish.visible = flight >= 0 && flight <= .9;
    if (fish.visible) {
      fish.position.set(8 + flight * 2, -.12 + 4.4145 * flight - 4.905 * flight * flight, -38);
      fish.rotation.set(0, .10 * Math.sin(flight * 8), Math.atan2(4.4145 - 9.81 * flight, 2));
      tail.rotation.y = Math.sin(flight * 34) * .26 * Math.exp(-flight * 1.5);
    }
    const night = THREE.MathUtils.smoothstep(progress, .84, .99);
    const gold = THREE.MathUtils.smoothstep(progress, .14, .56) * (1 - THREE.MathUtils.smoothstep(progress, .74, .99));
    sunlight.color.copy(day).lerp(warm, gold).lerp(moon, night);
    sunlight.intensity = 2.1 * (1 - night) + .22 * night;
    sunlight.position.set(THREE.MathUtils.lerp(.34,.63,THREE.MathUtils.smoothstep(progress,0,.8)), sunElevation(progress), -1).lerp(new THREE.Vector3(.58,.4,-1), night);
    ambient.intensity = 1.4 * (1 - night) + .16 * night;
    camera.position.set(pointer.x * .15, 3.4 + progress * .25, 14 - progress * .7);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    // Match the fullscreen ocean's off-axis rays exactly.
    camera.projectionMatrix.elements[8] = .012 * pointer.x / aspect;
    camera.projectionMatrix.elements[9] = -.08 + .008 * pointer.y;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    fish.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    geometries.forEach(geometry => geometry.dispose());
    skin.dispose(); finMaterial.dispose(); eyeMaterial.dispose();
  }
  return {scene, camera, update, dispose};
}
