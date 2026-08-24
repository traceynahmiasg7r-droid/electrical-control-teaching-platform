(function initializeCh02AdditionsPreview(global) {
  "use strict";

  const platform = global.ECTPPlatform;
  const refs = {
    root: document.getElementById("previewExperimentRoot"),
    title: document.getElementById("previewTitle"),
    subtitle: document.getElementById("previewSubtitle"),
    power: document.getElementById("previewPower"),
    controls: document.getElementById("previewControls"),
    protection: document.getElementById("previewProtection"),
    status: document.getElementById("previewStatus"),
    feedback: document.getElementById("previewFeedback"),
    steps: document.getElementById("previewSteps"),
    reset: document.getElementById("previewReset"),
    diagnostics: document.getElementById("previewDiagnostics"),
    navButtons: Array.from(document.querySelectorAll("[data-module-route]"))
  };
  const copy = {
    "mixed-jog-continuous": {
      title: "点动与长动混合控制",
      subtitle: "比较SA转换、SB3复合按钮和中间继电器K三种方案的点动/长动路径差异。"
    },
    "multi-point-control": {
      title: "多地点远程控制",
      subtitle: "两个停止地点串联、两个启动地点并联，共同控制同一KM1、电机与同步指示。"
    }
  };
  let registry = null;
  let loader = null;
  let activeMomentaryRelease = null;

  function currentInstance() {
    return loader?.getCurrent()?.instance || null;
  }

  function dispatch(type, payload = {}) {
    const instance = currentInstance();
    if (!instance) return null;
    return instance.dispatchAction(platform.contracts.createAction(type, payload, "preview"));
  }

  function releaseMomentaryControl(reason) {
    const action = activeMomentaryRelease;
    activeMomentaryRelease = null;
    if (action) dispatch(action, { reason });
  }

  function renderPower(viewModel) {
    const action = viewModel.power.closed ? "POWER_OPEN" : "POWER_CLOSE";
    refs.power.innerHTML = `<button type="button" class="preview-small-button ${viewModel.power.closed ? "is-on" : ""}" data-action="${action}">${viewModel.power.closed ? viewModel.power.openLabel : viewModel.power.closeLabel}</button>`;
    refs.power.querySelector("button").addEventListener("click", () => dispatch(action));
  }

  function renderControls(viewModel) {
    refs.controls.innerHTML = "";
    viewModel.controls.filter((control) => control.visible).forEach((control) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `preview-action-button ${control.buttonClass === "stop" ? "is-stop" : ""}`;
      button.innerHTML = `${control.label}<span class="preview-button-subtitle">${control.stateText || ""}</span>`;
      if (control.pressAction && control.releaseAction) {
        const press = (event) => {
          event.preventDefault();
          if (activeMomentaryRelease) return;
          activeMomentaryRelease = control.releaseAction;
          button.classList.add("is-running");
          dispatch(control.pressAction);
        };
        button.addEventListener("pointerdown", press);
      } else if (control.action) {
        button.addEventListener("click", () => dispatch(control.action));
      }
      refs.controls.appendChild(button);
    });
  }

  function renderProtection(viewModel) {
    const protection = viewModel.protection || viewModel.protections?.[0];
    if (!protection?.visible && !protection?.label) {
      refs.protection.innerHTML = "";
      return;
    }
    refs.protection.innerHTML = `<button type="button" class="preview-small-button ${protection.tripped ? "is-danger" : ""}" data-protection-action="${protection.toggleAction}">${protection.label}</button><button type="button" class="preview-small-button" data-protection-action="${protection.resetAction}">${protection.resetLabel}</button>`;
    refs.protection.querySelectorAll("[data-protection-action]").forEach((button) => button.addEventListener("click", () => dispatch(button.dataset.protectionAction)));
  }

  function renderStatus(viewModel) {
    refs.status.innerHTML = viewModel.rows.map((row) => `<div class="preview-status-item"><span class="preview-status-label">${row.label}</span><span class="preview-status-value tone-${row.tone || "off"}">${row.value}</span></div>`).join("");
  }

  function renderFeedback(feedback) {
    refs.feedback.innerHTML = `<strong>${feedback.title}</strong><p>${feedback.text}</p>`;
  }

  function renderSteps(steps) {
    refs.steps.innerHTML = steps.map((step) => `<li><strong>${step.title}：</strong>${step.text}</li>`).join("");
  }

  function renderInspector(instance = currentInstance()) {
    if (!instance) return;
    renderPower(instance.getOperationViewModel());
    renderControls(instance.getOperationViewModel());
    renderProtection(instance.getOperationViewModel());
    renderStatus(instance.getStatusViewModel());
    renderFeedback(instance.buildTeachingFeedback());
    renderSteps(instance.buildReplaySteps());
    const contract = platform.contracts.validateModuleContract(instance);
    const facade = (() => {
      try { platform.contracts.assertFacadeOutputs(instance); return { valid: true, errors: [] }; }
      catch (error) { return { valid: false, errors: [error.message] }; }
    })();
    const tests = instance.runTests();
    const diagnostics = loader.diagnostics();
    refs.diagnostics.textContent = `Contract ${contract.valid ? "通过" : "失败"} · Facade ${facade.valid ? "通过" : "失败"} · Solver/Geometry ${tests.passed ? "通过" : "失败"} · scope timers ${diagnostics.currentScope?.timeoutCount || 0} / listeners ${diagnostics.currentScope?.cleanupCount || 0}`;
  }

  function load(routeId) {
    activeMomentaryRelease = null;
    const instance = loader.load(routeId, { reason: "preview-switch" });
    refs.title.textContent = copy[routeId].title;
    refs.subtitle.textContent = copy[routeId].subtitle;
    refs.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.moduleRoute === routeId));
    renderInspector(instance);
    return instance;
  }

  function initialize() {
    try {
      global.addEventListener("pointerup", () => releaseMomentaryControl("pointer-release"));
      global.addEventListener("pointercancel", () => releaseMomentaryControl("pointer-cancel"));
      global.addEventListener("blur", () => releaseMomentaryControl("window-blur"));
      global.document.addEventListener("visibilitychange", () => {
        if (global.document.hidden) releaseMomentaryControl("document-hidden");
      });
      registry = platform.registry.createModuleRegistry(platform.contracts);
      registry.register(platform.moduleDefinitions.createCh02MixedJogContinuous());
      registry.register(platform.moduleDefinitions.createCh02MultiPoint());
      loader = platform.loader.createModuleLoader({
        registry,
        mountRoot: refs.root,
        services: Object.freeze({ onFacadeOutput: () => renderInspector(), onModuleRender: () => undefined }),
        setActiveModuleId: () => undefined
      });
      refs.navButtons.forEach((button) => button.addEventListener("click", () => load(button.dataset.moduleRoute)));
      refs.reset.addEventListener("click", () => dispatch("RESET_MODULE"));
      load("mixed-jog-continuous");
      global.previewApi = Object.freeze({
        load,
        dispatch,
        getCurrentState: () => currentInstance()?.getStateSnapshot(),
        getCurrentSolverResult: () => currentInstance()?.normalizeSolverResult(),
        getCurrentTests: () => currentInstance()?.runTests(),
        getDiagnostics: () => loader.diagnostics()
      });
    } catch (error) {
      refs.root.innerHTML = `<pre class="preview-error">${error.stack || error.message}</pre>`;
      refs.diagnostics.textContent = `初始化失败：${error.message}`;
      throw error;
    }
  }

  initialize();
})(globalThis);
