const NUM_OSCS = 4;
const SAMPLE_RATE = Math.pow(2, 10);

const oscAnalyzers = [0, 1, 2, 4].map((_) => new Tone.Waveform(SAMPLE_RATE));

const hpFilter = new Tone.Filter({ frequency: 5, type: "highpass" });
const lpFilter = new Tone.Filter(20000, "lowpass");
const cheby = new Tone.Chebyshev({ order: 2, wet: 0 });
const limiter = new Tone.Limiter();

function Synth() {
  const ACTIVE_EFFECTS = [cheby, hpFilter, lpFilter];
  const output = new Tone.Gain().send("SYNTH_OUTPUT");
  const FX_BUS = new Tone.Gain(0.2).chain(...ACTIVE_EFFECTS, output);

  this.output = new Tone.Gain().connect(FX_BUS);
  const noiseSynth = new Tone.NoiseSynth({ volume: -Infinity });
  this.noiseSynthController = {
    noiseSynth,
    isLooping: false,
    loop: new Tone.Loop((time) => {
      noiseSynth.triggerAttack(time);
    }),
  };

  this.synths = [...new Array(NUM_OSCS)].map((_, i) => {
    const omniOsc = new Tone.OmniOscillator({
      type: "triangle",
      phase: (i / NUM_OSCS) * 360,
      volume: 0 - i * 2,
    });
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.2,
      decay: 2,
      sustain: 1,
      release: 0.3,
    });

    omniOsc.chain(env);

    const loop = new Tone.Loop((time) => {
      console.log("loop");
      env.triggerAttack(time);
    });

    const isLooping = false;

    return { harmonic: i + 1, omniOsc, env, loop, isLooping };
  });

  // connect first to output
  this.synths[0].env.fan(this.output, oscAnalyzers[0]);

  // connect rest to previous one
  for (let i = 1; i < this.synths.length; i++) {
    this.synths[i].env.fan(this.synths[0].env, oscAnalyzers[i]);
  }

  this.noiseSynthController.noiseSynth.connect(this.synths[0].env);

  const getOscs = () => this.synths;

  return {
    getOscs,
    getNoiseSynthController: () => this.noiseSynthController,
    setOscType: (oscIndex, type) => {
      this.synths[oscIndex].omniOsc.set({ type });
    },
    setLoop: (oscIndex, interval) => {
      console.log(interval);
      if (interval === "off") {
        this.synths[oscIndex].isLooping = false;
        this.synths[oscIndex].loop.cancel();
      } else {
        this.synths[oscIndex].loop.set({ interval });
        this.synths[oscIndex].isLooping = true;
      }
    },
    setHarmonic: (oscIndex, harmonic) => {
      this.synths[oscIndex].harmonic = harmonic;
    },
    setVolume: (oscIndex, volume) => {
      this.synths[oscIndex].omniOsc.volume.value =
        volume === -24 ? -Infinity : volume;
    },
    setDetune: (oscIndex, detune) => {
      this.synths[oscIndex].omniOsc.set({ detune });
    },
    setEnvValue: (oscIndex, param, val) => {
      this.synths[oscIndex].env[param] = val;
    },
    setNoiseVolume: (volume) => {
      this.noiseSynthController.noiseSynth.volume.value =
        volume === -24 ? -Infinity : volume;
    },
    setNoiseEnvValue: (param, val) => {
      this.noiseSynthController.noiseSynth.envelope[param] = val;
    },
    triggerAttack: (note, time) => {
      if (this.noiseSynthController.isLooping) {
        this.noiseSynthController.loop.cancel();
        this.noiseSynthController.loop.start();
      } else {
        this.noiseSynthController.loop.cancel();
        this.noiseSynthController.noiseSynth.triggerAttack(time);
      }

      getOscs().forEach(({ omniOsc, env, harmonic, loop, isLooping }, i) => {
        const fq = note * (harmonic === 0 ? 0.5 : harmonic);
        omniOsc.frequency.value = fq;
        if (omniOsc.state === "stopped") {
          omniOsc.start(time);
        }

        if (isLooping) {
          loop.cancel();
          loop.start();
        } else {
          loop.cancel();
          env.triggerAttack(time);
        }
      });
    },
    triggerRelease: (time) => {
      this.noiseSynthController.noiseSynth.triggerRelease();
      getOscs().forEach(({ omniOsc, env, loop }, i) => {
        loop.cancel();
        env.triggerRelease();
      });
    },
  };
}
