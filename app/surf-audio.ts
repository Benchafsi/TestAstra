/** Soft stereo shore wash with slow, uneven swells and no heavy bass rumble. */
export function createQuietSurf(ctx: AudioContext): GainNode {
  const seconds = 29, buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let slow = 0, medium = 0, fast = 0;
    // Run twice so filter state at the loop boundary settles into the same cycle.
    const white = new Float32Array(data.length);
    for (let i = 0; i < white.length; i++) white[i] = Math.random() * 2 - 1;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < data.length; i++) {
        slow = .995 * slow + .005 * white[i];
        medium = .97 * medium + .03 * white[i];
        fast = .80 * fast + .20 * white[i];
        data[i] = (medium * 1.9 + fast * .35 - slow * 1.4) * .55;
      }
    }
  }
  const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
  const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 180; highpass.Q.value = .5;
  const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 1500; lowpass.Q.value = .5;
  const swell = ctx.createGain(); swell.gain.value = .55;
  const primary = ctx.createOscillator(); primary.frequency.value = .7 / (2 * Math.PI);
  const depth = ctx.createGain(); depth.gain.value = .17;
  const secondary = ctx.createOscillator(); secondary.frequency.value = .037;
  const variation = ctx.createGain(); variation.gain.value = .065;
  primary.connect(depth).connect(swell.gain); secondary.connect(variation).connect(swell.gain);
  const master = ctx.createGain(); master.gain.value = 0;
  source.connect(highpass).connect(lowpass).connect(swell).connect(master).connect(ctx.destination);
  source.start(); primary.start(); secondary.start();
  return master;
}
