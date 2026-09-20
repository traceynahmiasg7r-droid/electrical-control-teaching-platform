(function installMachineToolV2MainGeometry(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};

  // Native pixels from the supplied 2125 × 1566 textbook image. The folds
  // below are the original three-phase reversing connections, not a new layout.
  platform.buildMachineV2Main = function buildMachineV2Main(b) {
    const positions = new Map();
    const tracedWires = [];
    const port = (id, x, y) => {
      positions.set(id, [x, y]);
      b.port(id, x, y);
      return id;
    };
    const wire = (id, from, to, via = [], domain = "main") => {
      b.wire(id, from, to, via, domain);
      tracedWires.push({ id, from, to, points: [positions.get(from), ...via, positions.get(to)] });
    };
    const junction = (id, x, y) => {
      port(id, x, y);
      // The textbook does not add a dot to these main-circuit T connections.
      b.junction(id, id, false);
      return id;
    };
    const edge = (id, from, to, condition = "always", domain = "main") => ({ id, from, to, condition, domain });
    const fuse = (id, a, c, orientation, label = "", extra = {}) => b.device(id, "fuse", { a, b: c, orientation, ...extra }, [edge(id, a, c)], label);
    const bank = (id, condition, xs, top, bottom, label, extra = {}) => {
      const poles = xs.map((x, i) => {
        const a = port(`${id}_${i + 1}_a`, x, top);
        const c = port(`${id}_${i + 1}_b`, x, bottom);
        return { a, b: c };
      });
      b.device(id, "bank", { poles, ...extra }, poles.map((p, i) => edge(`${condition.toLowerCase()}_main_l${i + 1}`, p.a, p.b, condition)), label);
      return poles;
    };

    const phaseXs = [163, 204, 245];
    const busYs = [644, 601, 560];
    const qf = bank("qf", "QF", phaseXs, 383, 420, "QF", { action:"powerToggle", mechanical: true, labelX: 292, labelY: 405 });
    const sa2 = bank("sa2", "SA2", phaseXs, 910, 990, "SA2", { action:"coolant", mechanical: true, labelX: 286, labelY: 965, labelRotate: -90 });
    phaseXs.forEach((x, i) => {
      const phase = `l${i + 1}`;
      const src = port(`src_${phase}`, x, 281);
      b.label({ text: `L${i + 1}`, x: x - 6, y: 255, size: 31 });
      wire(`supply-${phase}`, src, qf[i].a);
      const fa = port(`fu1_${phase}_a`, x, 450);
      const fb = port(`fu1_${phase}_b`, x, 487);
      wire(`qf-to-fu1-${phase}`, qf[i].b, fa);
      fuse(`fu1_${phase}`, fa, fb, "vertical", i === 2 ? "FU1" : "", { labelX: 285, labelY: 526 });
      const bus = junction(`phase_${phase}_bus`, x, busYs[i]);
      wire(`fu1-to-bus-${phase}`, fb, bus);
      wire(`coolant-in-${phase}`, bus, sa2[i].a);
    });

    const km1 = bank("km1_main", "KM1", [314, 356, 399], 910, 990, "KM1", { labelX: 433, labelY: 1010 });
    const km2 = bank("km2_main", "KM2", [484, 533, 573], 910, 990, "KM2", { labelX: 559, labelY: 880, labelRotate: -90 });
    const km3 = bank("km3_main", "KM3", [620, 662, 705], 910, 990, "KM3", { labelX: 745, labelY: 850, labelRotate: -90 });
    const km4 = bank("km4_main", "KM4", [747, 794, 836], 910, 990, "KM4", { labelX: 855, labelY: 997, labelRotate: -90 });
    const km5 = bank("km5_main", "KM5", [871, 912, 950], 910, 990, "KM5", { labelX: 988, labelY: 997, labelRotate: -90 });

    // The spindle and coolant branches leave the bus BEFORE the horizontal
    // fuses. The three horizontal fuses have no printed FU label in the source.
    const spindleXs = [314, 356, 399];
    const rockerXs = [620, 662, 705];
    phaseXs.forEach((x, i) => {
      const phase = `l${i + 1}`;
      const tap = junction(`spindle_${phase}_tap`, spindleXs[i], busYs[i]);
      wire(`bus-to-spindle-${phase}`, `phase_${phase}_bus`, tap);
      wire(`spindle-in-${phase}`, tap, km1[i].a);
      const a = port(`branch_fuse_${phase}_a`, 448, busYs[i]);
      const c = port(`branch_fuse_${phase}_b`, 487, busYs[i]);
      wire(`branch-fuse-feed-${phase}`, tap, a);
      fuse(`branch_fuse_${phase}`, a, c, "horizontal");
      const rt = junction(`rocker_${phase}_tap`, rockerXs[i], busYs[i]);
      wire(`branch-fuse-output-${phase}`, c, rt);
    });

    // The source's long L2/L3 takeoffs also feed the transformer primary.
    // These ports are the only connection to the control-geometry builder.
    junction("hydraulic_l1_tap", 871, 644);
    junction("tp_l2", 906, 601);
    junction("tp_l3", 947, 560);
    wire("main-phase-l1-feed", "rocker_l1_tap", "hydraulic_l1_tap");
    wire("main-phase-l2-feed", "rocker_l2_tap", "tp_l2");
    wire("main-phase-l3-feed", "rocker_l3_tap", "tp_l3");

    // KM2's upper folded conductors reverse the first and third phases.
    // KM3 receives the vertical, unfurled phase order. A crossing never adds
    // an electrical node; only the explicit branch ports do.
    const rockerFoldYs = [860, 825, 790];
    rockerXs.forEach((x, i) => {
      const phase = `l${i + 1}`;
      const split = junction(`rocker_${phase}_fold`, x, rockerFoldYs[i]);
      wire(`rocker-in-${phase}`, `rocker_${phase}_tap`, split);
      wire(`rocker-direct-${phase}`, split, km3[i].a);
      const opposite = 2 - i;
      wire(`rocker-cross-input-${phase}`, split, km2[opposite].a, [[positions.get(km2[opposite].a)[0], rockerFoldYs[i]]]);
    });
    const rockerMergeYs = [1115, 1075, 1034];
    const rockerOutputs = rockerXs.map((x, i) => {
      const split = junction(`rocker_output_${i + 1}`, x, rockerMergeYs[i]);
      wire(`rocker-direct-output-${i + 1}`, km3[i].b, split);
      wire(`rocker-cross-output-${i + 1}`, km2[i].b, split, [[positions.get(km2[i].b)[0], rockerMergeYs[i]]]);
      return split;
    });

    const hydraulicFeed = ["hydraulic_l1_tap", "tp_l2", "tp_l3"];
    const hydraulicXs = [871, 912, 950];
    const hydraulicFoldYs = [860, 827, 787];
    hydraulicXs.forEach((x, i) => {
      const phase = `l${i + 1}`;
      const split = junction(`hydraulic_${phase}_fold`, x, hydraulicFoldYs[i]);
      // Preserve the slight source-line offset at the two long takeoffs.
      wire(`hydraulic-in-${phase}`, hydraulicFeed[i], split);
      wire(`hydraulic-direct-${phase}`, split, km5[i].a);
      const opposite = 2 - i;
      wire(`hydraulic-cross-input-${phase}`, split, km4[opposite].a, [[positions.get(km4[opposite].a)[0], hydraulicFoldYs[i]]]);
    });
    const hydraulicMergeYs = [1110, 1072, 1030];
    const hydraulicOutputs = hydraulicXs.map((x, i) => {
      const split = junction(`hydraulic_output_${i + 1}`, x, hydraulicMergeYs[i]);
      wire(`hydraulic-direct-output-${i + 1}`, km5[i].b, split);
      wire(`hydraulic-cross-output-${i + 1}`, km4[i].b, split, [[positions.get(km4[i].b)[0], hydraulicMergeYs[i]]]);
      return split;
    });

    const motor = (id, label, x, y, radius, xs, fromPorts, thermalName = null) => {
      const phasePorts = xs.map((phaseX, i) => {
        // Three conductors terminate precisely on the circle, including the
        // two off-centre phases. They cannot stop short of the motor symbol.
        const terminalY = y - Math.sqrt(radius * radius - (phaseX - x) ** 2);
        const terminal = port(`${id}_${["u", "v", "w"][i]}`, phaseX, terminalY);
        let from = fromPorts[i];
        if (thermalName && i !== 1) {
          const a = port(`${thermalName.toLowerCase()}_main_l${i + 1}_a`, phaseX, 1180);
          const c = port(`${thermalName.toLowerCase()}_main_l${i + 1}_b`, phaseX, 1252);
          wire(`${id}-thermal-in-${i + 1}`, from, a);
          const eid = `${thermalName.toLowerCase()}_main_l${i + 1}`;
          b.device(eid, "thermal", { a, b: c, width: 62, height: 72, labelX: phaseX + 72, labelY: 1225 }, [edge(eid, a, c)], i === 2 ? thermalName : "");
          from = c;
        }
        wire(`${id}-phase-${i + 1}`, from, terminal);
        return terminal;
      });
      b.device(id, "motor", { x, y, r: radius, label, subtitle: "3~", ports: phasePorts, phasePorts }, [], label);
    };
    motor("m4", "M4", 204, 1393, 61, phaseXs, sa2.map((p) => p.b));
    motor("m1", "M1", 360, 1393, 61, spindleXs, km1.map((p) => p.b), "FR1");
    motor("m2", "M2", 667, 1395, 63, rockerXs, rockerOutputs);
    motor("m3", "M3", 923, 1385, 61, hydraulicXs, hydraulicOutputs, "FR2");

    // Isolated lighting secondary: no invented galvanic connection to L3.
    const la = port("light_t_a", 368, 442);
    const lb = port("light_t_b", 368, 494);
    b.device("lighting_winding", "winding", { a: la, b: lb, orientation: "vertical", labelX: 337, labelY: 469 }, [{...edge("lighting_winding", la, lb, "always", "auxiliary"), kind:"source"}], "T");
    const fa = port("fu3_a", 406, 415);
    const fb = port("fu3_b", 442, 415);
    wire("lighting-transformer-to-fu3", la, fa, [[368, 415]], "auxiliary");
    b.device("fu3", "fuse", { a: fa, b: fb, orientation: "horizontal", labelX: 424, labelY: 389 }, [edge("fu3", fa, fb, "always", "auxiliary")], "FU3");
    const sa = port("sa1_a", 478, 415);
    const sb = port("sa1_b", 515, 415);
    wire("lighting-fu3-to-sa1", fb, sa, [], "auxiliary");
    b.device("sa1", "contact", { a: sa, b: sb, normal: "no", symbol: "switch", action:"lighting", orientation: "horizontal", labelX: 492, labelY: 366 }, [edge("sa1", sa, sb, "SA1", "auxiliary")], "SA1");
    const ea = port("el_a", 557, 415);
    const eb = port("el_b", 597, 415);
    wire("lighting-sa1-to-el", sb, ea, [], "auxiliary");
    b.device("el", "lamp", { a: ea, b: eb, x: 577, y: 415, r: 20, labelX: 577, labelY: 385 }, [{...edge("el", ea, eb, "always", "auxiliary"),kind:"load"}], "EL");
    const ground = port("light_ground", 625, 525);
    wire("lighting-el-return", eb, ground, [[625, 415]], "auxiliary");
    wire("lighting-ground-to-winding", ground, lb, [[368, 525]], "auxiliary");
    b.device("lighting_ground", "ground", { x: 625, y: 525 }, [], "");

    // Record physical crossings independently of graph connectivity. Their
    // coordinates are evidence metadata; the textbook uses straight strokes.
    const crossingKeys = new Set();
    for (let i = 0; i < tracedWires.length; i += 1) {
      for (let j = i + 1; j < tracedWires.length; j += 1) {
        const one = tracedWires[i];
        const two = tracedWires[j];
        if ([one.from, one.to].some((id) => id === two.from || id === two.to)) continue;
        for (let a = 1; a < one.points.length; a += 1) {
          for (let c = 1; c < two.points.length; c += 1) {
            const p = one.points[a - 1];
            const p2 = one.points[a];
            const q = two.points[c - 1];
            const q2 = two.points[c];
            const rx = p2[0] - p[0]; const ry = p2[1] - p[1];
            const sx = q2[0] - q[0]; const sy = q2[1] - q[1];
            const det = rx * sy - ry * sx;
            if (Math.abs(det) < 0.001) continue;
            const t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / det;
            const u = ((q[0] - p[0]) * ry - (q[1] - p[1]) * rx) / det;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            const x = p[0] + t * rx; const y = p[1] + t * ry;
            const key = `${one.id}:${two.id}:${x.toFixed(2)}:${y.toFixed(2)}`;
            if (crossingKeys.has(key)) continue;
            crossingKeys.add(key);
            b.crossing(`main-crossing-${crossingKeys.size}`, one.id, two.id, x, y);
          }
        }
      }
    }
  };
}(window));
