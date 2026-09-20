"use strict";

// Browser acceptance follows the traced textbook graph. In particular SB1 is
// NC stop, SB2 is NO start, SQ3 is NC, and KT is an off-delay relay.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");
const repo = path.resolve(__dirname, "../../../../../..");
const output = path.join(repo, "output/playwright");
const base = path.resolve(__dirname, "..");
const url = `${process.env.ECTP_TEST_URL || "http://127.0.0.1:4173"}/index.html`;
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const capture = await browser.newPage();
  const reports = [], browserErrors = [], screenshots = [], states = [];
  let fatal = null;
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  const check = (id, pass, detail = null) => reports.push({ id, pass: Boolean(pass), detail });
  const action = (type, payload = {}) => page.evaluate(({ type, payload }) => platformApi.dispatchAction(type, payload, "machine-patch-acceptance"), { type, payload });
  const command = (name, payload = {}) => action("PROTECTION_SECONDARY_TOGGLE", { command: name, ...payload });
  const jog = (name) => action("JOG_PRESS", { command: name });
  const unjog = (name) => action("JOG_RELEASE", { command: name });
  const playback = (name, value) => page.evaluate(({ name, value }) => platformApi.dispatchPlayback(name, value), { name, value });
  const scene = (id) => page.locator(`.machine-v2-scene-tab[data-scene="${id}"]`).click();
  const read = () => page.evaluate(() => ({ snapshot: platformApi.getCurrentStateSnapshot(), solver: platformApi.getCurrentSolverResult(), playback: platformApi.getCurrentPlaybackViewModel(), diagnostics: platformApi.getDiagnostics(), feedback: platformApi.getCurrentTeachingFeedback() }));
  const remember = async (name) => { const state = await read(); states.push({ name, ...state }); return state; };
  const release = async () => { await page.mouse.move(4, 4); await page.mouse.up(); };
  const holdShellPrimary = async () => {
    const box = await page.locator("#pressSb1").boundingBox();
    assert(box, "Primary shell control exists");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  };
  const hold = async (id) => {
    const box = await page.locator(`.machine-v2-device[data-component-id="${id}"] .machine-v2-hitbox`).boundingBox();
    assert(box, `Interactive source symbol ${id} exists`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
  };
  const photograph = async (name, nativeBox = null) => {
    const filename = `machine-patch-${name}.png`;
    if (nativeBox) {
      const svg = await page.locator(".machine-v2-board").evaluate((el) => el.outerHTML);
      const css = fs.readFileSync(path.join(base, "styles.css"), "utf8");
      const [x, y, width, height] = nativeBox;
      await capture.setViewportSize({ width: Math.ceil(width), height: Math.ceil(height) });
      await capture.setContent(`<html><head><style>body{margin:0}${css}</style></head><body>${svg}</body></html>`);
      await capture.locator("svg").evaluate((el, box) => { el.setAttribute("viewBox", box.join(" ")); el.style.width = `${box[2]}px`; el.style.height = `${box[3]}px`; }, [x, y, width, height]);
      await capture.screenshot({ path: path.join(output, filename), animations: "disabled" });
    } else await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: "disabled" });
    screenshots.push(filename);
  };
  const fullBox = [76, 180, 1935, 1280];
  async function assertVisual(name) {
    const evidence = await page.evaluate(() => {
      const live = platformApi.getCurrentSolverResult(), playback = platformApi.getCurrentPlaybackViewModel();
      const result = playback?.mode === "Playback" ? playback.displayState.solverResult : live;
      const svg = document.querySelector(".machine-v2-board"), data = ECTPPlatform.moduleCircuitData.ch02MachineToolCircuitsV2;
      const list = (selector, attribute) => [...svg.querySelectorAll(selector)].map((el) => el.getAttribute(attribute)).sort();
      const wires = [...new Set(result.activeWireIds || [...result.activeMainWireIds, ...result.activeControlWireIds])].sort();
      const representedEdges = new Set(list(".machine-v2-conductor", "data-edge-id"));
      const edges = (result.activeEdgeIds || []).filter((id) => representedEdges.has(id) && result.edgeStates[id]?.conductive).sort();
      const activeEdges = list(".is-active-conductor", "data-edge-id"), activeWires = list(".machine-v2-wire-active", "data-wire-id");
      const flowWires = list("[data-flow-wire-id]", "data-flow-wire-id"), flowEdges = list("[data-flow-edge-id]", "data-flow-edge-id");
      const invalidRefs = [...svg.querySelectorAll(".machine-v2-wire-flow,.machine-v2-wire-active,.is-active-conductor")].filter((el) => {
        const target = svg.querySelector(el.getAttribute("href"));
        const wireId = el.dataset.flowWireId || el.dataset.wireId, edgeId = el.dataset.flowEdgeId || el.dataset.edgeId;
        const base = wireId ? svg.querySelector(`.machine-v2-wire[data-wire-id="${wireId}"]`) : svg.querySelector(`.machine-v2-conductor[data-edge-id="${edgeId}"]`);
        return !target || target.tagName.toLowerCase() !== "path" || !target.closest("defs") || /mechanical|decoration|hitbox/.test(el.getAttribute("href")) || !base || el.getAttribute("href") !== base.getAttribute("href");
      }).map((el) => el.outerHTML);
      const unknownWires = wires.filter((id) => !data.wires.some((wire) => wire.wireId === id));
      const openActiveEdges = (result.activeEdgeIds || []).filter((id) => !result.edgeStates[id]?.conductive);
      const motorMismatch = data.components.filter((c) => c.type === "motor").filter((c) => svg.querySelector(`[data-component-id="${c.componentId}"]`)?.dataset.running !== String(Boolean(result.motorStates[c.label]?.running))).map((c) => c.componentId);
      return { wires, edges, activeWires, activeEdges, flowWires, flowEdges, invalidRefs, unknownWires, openActiveEdges, motorMismatch, mutuallyExclusive: !(result.stableDeviceStates.KM2 && result.stableDeviceStates.KM3) && !(result.stableDeviceStates.KM4 && result.stableDeviceStates.KM5) };
    });
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check(`${name}: Solver/active/flow geometry agreement`, same(evidence.wires, evidence.activeWires) && same(evidence.wires, evidence.flowWires) && same(evidence.edges, evidence.activeEdges) && same(evidence.edges, evidence.flowEdges) && !evidence.invalidRefs.length && !evidence.unknownWires.length && !evidence.openActiveEdges.length && !evidence.motorMismatch.length && evidence.mutuallyExclusive, evidence);
  }
  async function prepared(id = "spindle") {
    await action("RESET_MODULE"); await scene(id); await action("POWER_CLOSE");
    await command("clampLimit", { value: true });
  }

  try {
    await page.goto(url);
    await page.waitForFunction(() => window.platformApi);
    // Keep actual disposed scopes available to test cleanup, not just absence
    // of a DOM node. No application files or behavior are changed by this probe.
    await page.evaluate(() => {
      const runtime = ECTPPlatform.runtime; window.__machineAuditScopes = [];
      ECTPPlatform.runtime = Object.freeze({ ...runtime, createRuntimeScope(id) { const scope = runtime.createRuntimeScope(id); if (id === "ch02_machine_tool_circuits_v2") window.__machineAuditScopes.push(scope); return scope; } });
      platformApi.switchModule("machine-tool-circuits");
    });
    await page.locator(".machine-v2-board").waitFor();
    let current = await remember("initial");
    const staticEvidence = await page.evaluate(() => {
      const data = ECTPPlatform.moduleCircuitData.ch02MachineToolCircuitsV2, svg = document.querySelector(".machine-v2-board");
      return { reference: data.reference, geometry: data.validateGeometry(), wires: svg.querySelectorAll(".machine-v2-wire").length, devices: svg.querySelectorAll(".machine-v2-device").length, active: svg.querySelectorAll(".machine-v2-wire-active,.machine-v2-wire-flow,.is-active-conductor,.machine-v2-junction.is-active").length, ports: svg.querySelectorAll("[data-port-id],.machine-v2-crossing,[data-debug],.debug-marker").length, sourceTerminals: svg.querySelectorAll(".machine-v2-source-terminal").length, tabs: document.querySelectorAll(".machine-v2-scene-tab").length, contract: platformApi.getCurrentContractReport(), hitboxesHidden: [...svg.querySelectorAll(".machine-v2-hitbox")].every((el) => getComputedStyle(el).stroke === "none") };
    });
    check("route/module contract", current.snapshot.moduleId === "ch02_machine_tool_circuits_v2" && staticEvidence.contract.valid, staticEvidence.contract);
    check("geometry graph rendered without debug crossings", staticEvidence.geometry.valid && staticEvidence.wires === staticEvidence.geometry.counts.wires && staticEvidence.devices === staticEvidence.geometry.counts.components && staticEvidence.tabs === 6 && staticEvidence.sourceTerminals === 3 && staticEvidence.ports === 0 && staticEvidence.hitboxesHidden, staticEvidence);
    check("source-normal NC/NO state, entirely black initial", staticEvidence.active === 0 && current.solver.edgeStates.sb1_nc.conductive && !current.solver.edgeStates.sb2_no.conductive && current.solver.edgeStates.sq3_nc.conductive && !current.solver.motorStates.M1.running);
    const imagePath = staticEvidence.reference.path, bytes = fs.readFileSync(imagePath), sha256 = crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
    check("textbook source identity", sha256 === staticEvidence.reference.sha256, { imagePath, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256 });
    fs.copyFileSync(imagePath, path.join(output, "machine-patch-A-reference.png")); screenshots.push("machine-patch-A-reference.png");
    await photograph("B-static-full", fullBox);
    await photograph("D-main-detail", [100, 210, 920, 1245]);
    await photograph("E-control-detail", [1000, 520, 1010, 690]);
    await photograph("F-auxiliary-detail", [1210, 1200, 510, 260]);
    await assertVisual("initial");

    await page.locator('[data-component-id="qf"] .machine-v2-hitbox').click();
    current = await remember("power-on-automatic-clamp");
    check("unclamped SQ3 NC: QF starts automatic clamp", current.solver.stableDeviceStates.KM5 && current.solver.stableDeviceStates.YV && !current.solver.stableDeviceStates.KM4 && current.solver.motorStates.M3.direction === "clamp");
    await photograph("L-automatic-clamp"); await assertVisual("automatic clamp");
    await command("clampLimit", { value: true });
    current = await read(); check("SQ3 cuts automatic hydraulic branch", !current.solver.motorStates.M3.running && !current.solver.stableDeviceStates.YV && !current.solver.edgeStates.sq3_nc.conductive);

    const sb2OpenPath = await page.locator("#machine-v2-edge-sb2_no").getAttribute("d");
    await hold("sb2"); await page.waitForTimeout(350);
    current = await remember("spindle-start-held");
    check("SB2 real hold drives coil/contact/motor", current.snapshot.operation.controls.sb2 === "pressed" && current.solver.stableDeviceStates.KM1 && current.solver.motorStates.M1.running && current.solver.edgeStates.km1_self_no.conductive && sb2OpenPath !== await page.locator("#machine-v2-edge-sb2_no").getAttribute("d"));
    await photograph("G-spindle-start"); await assertVisual("SB2 held");
    await release(); current = await read(); check("SB2 release keeps true self hold", current.snapshot.operation.controls.sb2 === "released" && !current.solver.edgeStates.sb2_no.conductive && current.solver.stableDeviceStates.KM1);
    await hold("sb1"); current = await remember("spindle-stop-held");
    check("SB1 NC opens and releases KM1", !current.solver.edgeStates.sb1_nc.conductive && !current.solver.motorStates.M1.running && !current.solver.edgeStates.km1_self_no.conductive);
    await photograph("H-spindle-stop"); await release();
    await jog("spindleStart"); await unjog("spindleStart"); await action("PROTECTION_TOGGLE", { target: "primary" });
    current = await read(); check("FR1 trips coil but thermal power elements stay continuous", !current.solver.motorStates.M1.running && !current.solver.edgeStates.fr1_nc.conductive && current.solver.edgeStates.fr1_main_l1.conductive && current.solver.edgeStates.fr1_main_l3.conductive);
    await action("PROTECTION_RESET", { target: "primary" }); current = await read(); check("FR1 reset cannot restart dropped spindle", !current.solver.stableDeviceStates.KM1 && !current.snapshot.devices.FR1.tripped);

    await prepared("up"); await hold("sb3");
    current = await read(); check("SB3 initiates real KT and hydraulic loosen before SQ2", current.solver.stableDeviceStates.KT && current.solver.stableDeviceStates.KM4 && !current.solver.stableDeviceStates.KM2 && current.snapshot.operation.controls.sb3 === "pressed");
    await command("looseLimit", { value: true }); current = await remember("up-after-sq2");
    check("SQ2 transfers held command to KM2/M2 up", current.solver.stableDeviceStates.KM2 && !current.solver.stableDeviceStates.KM3 && !current.solver.stableDeviceStates.KM4 && current.solver.motorStates.M2.direction === "up" && current.snapshot.operation.controls.sb3 === "pressed");
    await photograph("I-rocker-up"); await photograph("N-sq2-loose-limit", [1000, 670, 1010, 310]); await photograph("O-up-interlock", [1000, 670, 1010, 220]); await assertVisual("up after SQ2");
    await release(); current = await remember("rocker-release-offdelay");
    check("release stops M2 immediately and starts KT offdelay", !current.solver.motorStates.M2.running && !current.solver.stableDeviceStates.KT && current.snapshot.operation.timer === "timing" && !current.solver.stableDeviceStates.KM5);
    await page.waitForTimeout(1750); current = await read(); check("KT offdelay expiration starts automatic clamp", current.solver.stableDeviceStates.KM5 && current.solver.motorStates.M3.direction === "clamp");
    await command("clampLimit", { value: true }); current = await remember("sq3-automatic-stop"); check("SQ3 completion stops auto clamp without fake motor action", !current.solver.motorStates.M3.running && !current.solver.edgeStates.sq3_nc.conductive);
    await photograph("N-sq3-completion");

    await prepared("down"); await page.locator('[data-component-id="sb4"]').focus(); await page.keyboard.down("Space");
    await command("looseLimit", { value: true }); current = await remember("down-keyboard-held");
    check("keyboard hold SB4 drives KM3/M2 down", current.snapshot.operation.controls.sb4 === "pressed" && current.solver.stableDeviceStates.KM3 && !current.solver.stableDeviceStates.KM2 && current.solver.motorStates.M2.direction === "down");
    await photograph("J-rocker-down"); await assertVisual("down keyboard");
    await command("lowerLimit", { value: true }); current = await read(); check("SQ1-2 opens real downward request path", !current.solver.edgeStates.sq1_down_nc.conductive && !current.solver.motorStates.M2.running);
    await photograph("N-sq1-lower-limit"); await page.keyboard.up("Space"); current = await read(); check("keyup releases despite SVG rerender", current.snapshot.operation.controls.sb4 === "released");
    await prepared("up"); await jog("rockerUp"); await command("looseLimit", { value: true }); await command("upperLimit", { value: true }); current = await read(); check("SQ1-1 opens upward request path", !current.solver.edgeStates.sq1_up_nc.conductive && !current.solver.motorStates.M2.running); await unjog("rockerUp");

    await prepared("up"); await holdShellPrimary(); await page.waitForTimeout(350); current = await read();
    check("shell primary stays held beyond old pulse duration", current.snapshot.operation.controls.sb3 === "pressed" && current.solver.edgeStates.sb3_no.conductive && !current.solver.edgeStates.sb3_nc.conductive);
    await command("looseLimit", { value: true }); current = await read(); check("shell held action survives mechanical limit update", current.solver.motorStates.M2.direction === "up");
    await release(); current = await read(); check("shell outside release drops physical button", current.snapshot.operation.controls.sb3 === "released" && !current.solver.motorStates.M2.running);
    await prepared("up"); await page.locator("#pressSb1").focus(); await page.keyboard.down("Space");
    await page.locator('[data-component-id="sq2_up"] .machine-v2-hitbox').click(); current = await read();
    check("shell keyboard hold survives real SQ2 click/focus change", current.solver.motorStates.M2.direction === "up" && current.snapshot.operation.controls.sb3 === "pressed");
    await page.locator("#tripFr2").click(); current = await read(); check("FR2 operation preserves held rocker release ownership", current.snapshot.operation.controls.sb3 === "pressed" && current.solver.motorStates.M2.direction === "up");
    await page.keyboard.up("Space"); current = await read(); check("actual keyup after FR2 reliably releases SB3", current.snapshot.operation.controls.sb3 === "released" && !current.solver.motorStates.M2.running);
    await prepared("up"); await page.locator("#pressSb1").focus(); await page.keyboard.down("Space"); await page.locator('[data-component-id="sq2_up"] .machine-v2-hitbox').click();
    await scene("down"); current = await read(); check("scene selection releases a keyboard-held command", current.snapshot.operation.scene === "down" && Object.values(current.snapshot.operation.controls).every((value) => value === "released") && !current.solver.motorStates.M2.running);
    await page.keyboard.up("Space"); current = await read(); check("stale keyup after scene switch cannot restart motion", !current.solver.motorStates.M2.running && current.snapshot.operation.scene === "down");

    await prepared("loosen"); await hold("sb5"); current = await remember("manual-loosen-held");
    check("SB5 atomic NO/NC plus hydraulic interlock", current.solver.edgeStates.sb5_no.conductive && !current.solver.edgeStates.sb5_nc.conductive && current.solver.stableDeviceStates.KM4 && !current.solver.stableDeviceStates.KM5 && !current.solver.stableDeviceStates.YV && current.solver.motorStates.M3.direction === "loosen");
    await photograph("K-manual-loosen"); await photograph("P-loosen-interlock", [1000, 885, 1010, 325]); await assertVisual("manual loosen");
    await command("looseLimit", { value: true }); current = await read(); check("manual SB5 branch bypasses SQ2 as drawn", current.solver.stableDeviceStates.KM4 && !current.solver.edgeStates.sq2_nc.conductive); await release();
    await prepared("clamp"); await hold("sb6"); current = await remember("manual-clamp-held");
    check("SB6 atomic NO/NC and manual clamp bypass", current.solver.edgeStates.sb6_no.conductive && !current.solver.edgeStates.sb6_nc.conductive && current.solver.stableDeviceStates.KM5 && !current.solver.stableDeviceStates.KM4 && !current.solver.stableDeviceStates.YV);
    await photograph("L-manual-clamp"); await photograph("P-clamp-interlock", [1000, 885, 1010, 325]); await assertVisual("manual clamp"); await release(); current = await read(); check("manual clamp release stops at SQ3 clamped", !current.solver.stableDeviceStates.KM5);

    await prepared("up"); await command("looseLimit", { value: true }); await jog("rockerUp"); await jog("rockerDown"); current = await remember("both-rocker-buttons");
    check("opposite SB NO/NC prevents simultaneous rocker coils", !current.solver.edgeStates.sb3_nc.conductive && !current.solver.edgeStates.sb4_nc.conductive && !current.solver.stableDeviceStates.KM2 && !current.solver.stableDeviceStates.KM3);
    await photograph("O-both-rocker-buttons"); await assertVisual("both rocker buttons"); await unjog("rockerUp"); await unjog("rockerDown");
    await prepared("loosen"); await jog("loosen"); await jog("clamp"); current = await read(); check("KM4/KM5 electrical interlock excludes double pickup", !(current.solver.stableDeviceStates.KM4 && current.solver.stableDeviceStates.KM5)); await assertVisual("both hydraulic commands"); await unjog("loosen"); await unjog("clamp");

    await prepared("up"); await jog("spindleStart"); await unjog("spindleStart"); await jog("rockerUp"); await command("looseLimit", { value: true });
    await action("PROTECTION_TOGGLE", { target: "secondary" }); current = await read();
    check("FR2 protects M3 branch without inventing M1/M2 series contact", current.solver.motorStates.M1.running && current.solver.motorStates.M2.direction === "up" && !current.solver.motorStates.M3.running && !current.solver.edgeStates.fr2_nc.conductive);
    await action("PROTECTION_TOGGLE", { target: "primary" }); current = await read(); check("FR1 protects spindle without inventing rocker series contact", !current.solver.motorStates.M1.running && current.solver.motorStates.M2.direction === "up"); await unjog("rockerUp");

    await prepared("auxiliary"); await page.locator('[data-component-id="sa1"] .machine-v2-hitbox').click(); await page.locator('[data-component-id="sa2"] .machine-v2-hitbox').click();
    await jog("spindleStart"); await unjog("spindleStart"); current = await remember("auxiliary-on");
    check("auxiliary source switches drive EL/M4 and KM1 drives HL3", current.solver.extension.lamps.EL && current.solver.motorStates.M4.running && current.solver.extension.lamps.HL3);
    const beforeLamps = current.solver.extension.lamps; await command("indicator"); current = await read();
    check("SQ4 mechanically exchanges HL1/HL2", current.solver.extension.lamps.HL1 !== beforeLamps.HL1 && current.solver.extension.lamps.HL2 !== beforeLamps.HL2 && current.solver.extension.lamps.HL1 !== current.solver.extension.lamps.HL2);
    await photograph("M-auxiliary"); await assertVisual("auxiliary");
    const chinese = await page.locator("#operationControlCard button:visible").allTextContents(); check("visible module operations use Chinese labels", chinese.every((label) => /[\u3400-\u9fff]/.test(label) && !/\b(?:Start|Stop|Up|Down|Loose|Clamp|Reset|Trip|Scene)\b/.test(label)), chinese);

    await prepared("up"); await jog("rockerUp"); await command("looseLimit", { value: true }); await unjog("rockerUp");
    const liveTiming = (await read()).snapshot;
    await playback("scenario", "down"); await playback("restart"); await playback("toggle"); await page.waitForTimeout(1750);
    current = await remember("playback-timing-isolation");
    check("Playback pauses live KT remainder without altering Live", JSON.stringify(current.snapshot) === JSON.stringify(liveTiming) && current.playback.mode === "Playback" && current.playback.displayState.source === "Playback");
    const statusEvidence = await page.evaluate(() => ({ rows: platformApi.getCurrentStatusViewModel().rows.slice(0, 7).map((row) => ({ label: row.label, value: row.value })), dom: [...document.querySelectorAll("#statusCard .status-row:not(.hidden)")].map((row) => ({ label: row.firstElementChild.textContent, value: row.lastElementChild.textContent })), source: platformApi.getCurrentPlaybackViewModel().displayState.source }));
    check("status panel mirrors the Playback view model", statusEvidence.source === "Playback" && JSON.stringify(statusEvidence.rows) === JSON.stringify(statusEvidence.dom), statusEvidence);
    await playback("next"); await playback("next"); current = await remember("playback-down-motion");
    check("Playback motor direction is displayed without changing Live", current.playback.displayState.solverResult.motorStates.M2.direction === "down" && !current.solver.motorStates.M2.running && JSON.stringify(current.snapshot) === JSON.stringify(liveTiming));
    await photograph("Q-playback"); await assertVisual("Playback");
    await playback("exit"); await page.waitForTimeout(1750); current = await read(); check("Playback exit resumes pending Live offdelay", current.playback.mode === "Live" && current.solver.stableDeviceStates.KM5);
    const catalogue = [];
    for (const id of ["spindle", "up", "down", "loosen", "clamp", "auxiliary"]) { await playback("scenario", id); const view = (await read()).playback; catalogue.push({ id, count: view.count, mode: view.mode }); }
    check("six teaching sequences available", catalogue.every((item) => item.count >= 3 && item.mode === "Live"), catalogue);
    await photograph("status-and-buttons");

    await page.setViewportSize({ width: 1366, height: 768 });
    check("1366 page has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await photograph("R-platform-1366");
    await page.setViewportSize({ width: 390, height: 844 });
    check("mobile page has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await photograph("mobile-390");
    await page.setViewportSize({ width: 1600, height: 1000 });
    await prepared("up"); await jog("rockerUp"); await command("looseLimit", { value: true }); await unjog("rockerUp");
    const pending = (await read()).diagnostics.loader.currentScope; check("cleanup exercise has a live timer", pending.timeoutCount > 0, pending);
    await page.evaluate(() => platformApi.switchModule("forward-reverse"));
    await page.waitForTimeout(1750);
    const cleaned = await page.evaluate(() => ({ scopes: window.__machineAuditScopes.map((scope) => scope.diagnostics()), machines: document.querySelectorAll(".machine-v2-module").length, classLeft: document.body.classList.contains("ch02-machine-tool-v2-active"), module: platformApi.getCurrentStateSnapshot().moduleId }));
    check("unmount clears actual scope timer/listeners and module DOM", cleaned.scopes.every((scope) => scope.disposed && scope.timeoutCount === 0 && scope.intervalCount === 0 && scope.cleanupCount === 0) && cleaned.machines === 0 && !cleaned.classLeft && cleaned.module !== "ch02_machine_tool_circuits_v2", cleaned);
    await page.evaluate(() => platformApi.switchModule("machine-tool-circuits")); current = await read(); check("remount starts clean", current.snapshot.operation.power === "open" && !current.solver.motorStates.M1.running && !current.solver.motorStates.M2.running && !current.solver.motorStates.M3.running);
  } catch (error) {
    fatal = error.stack || String(error); check("acceptance completes all required stages", false, fatal);
    try { await photograph("failure"); } catch (_) { /* Preserve original failure. */ }
  } finally {
    const result = { passed: !fatal && reports.every((item) => item.pass) && browserErrors.length === 0, reports, browserErrors, screenshots, states };
    fs.writeFileSync(path.join(output, "machine-patch-validation.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: result.passed, checks: reports.length, failures: reports.filter((item) => !item.pass), browserErrors, screenshots, stateSnapshots: states.length, report: "output/playwright/machine-patch-validation.json" }, null, 2));
    await browser.close();
    if (!result.passed) process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
