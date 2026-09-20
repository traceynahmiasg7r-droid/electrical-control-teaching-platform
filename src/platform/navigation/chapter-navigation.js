(function installChapterNavigation(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const chapterDefinitions = Object.freeze([
    Object.freeze({
      chapterId: "ch01",
      title: "第一章",
      subtitle: "常用低压电器",
      collapsedStateKey: "chapter01Collapsed",
      modules: Object.freeze([
        Object.freeze({ routeId: "ch01-jog-control", expectedModuleId: "ch01_jog", displayIndex: "01", label: "点动控制" }),
        Object.freeze({ routeId: "ch01-continuous-control", expectedModuleId: "ch01_continuous", displayIndex: "02", label: "长动控制" }),
        Object.freeze({ routeId: "ch01-limit-switch-control", expectedModuleId: "ch01_limit", displayIndex: "03", label: "行程开关控制" })
      ])
    }),
    Object.freeze({
      chapterId: "ch02",
      title: "第二章",
      subtitle: "电器控制系统",
      collapsedStateKey: "chapter02Collapsed",
      modules: Object.freeze([
        Object.freeze({ routeId: "main-control", expectedModuleId: "ch02_main_control", displayIndex: "01", label: "主电路与控制电路" }),
        Object.freeze({ routeId: "jog-control", expectedModuleId: "ch02_jog", displayIndex: "02", label: "点动控制" }),
        Object.freeze({ routeId: "self-lock", expectedModuleId: "ch02_continuous", displayIndex: "03", label: "长动控制" }),
        Object.freeze({ routeId: "forward-reverse", expectedModuleId: "ch02_reverse", displayIndex: "04", label: "正反转控制" }),
        Object.freeze({ routeId: "machine-tool-circuits", expectedModuleId: "ch02_machine_tool_circuits_v2", displayIndex: "05", label: "机床综合线路" })
      ])
    })
  ]);
  const formalModuleRoutes = Object.freeze(chapterDefinitions.flatMap((chapter) => chapter.modules.map((module) => module.routeId)));

  function mountChapterNavigation(options) {
    const { container, registry, activeRouteId, onSelect } = options;
    const navigationState = {
      chapter01Collapsed: false,
      chapter02Collapsed: false
    };
    let currentRouteId = activeRouteId;

    function resolveFormalModule(chapter, entry) {
      const definition = registry.require(entry.routeId);
      if (definition.meta.chapterId !== chapter.chapterId || definition.meta.moduleId !== entry.expectedModuleId) {
        throw new Error(
          `Formal navigation route ${entry.routeId} resolved to ${definition.meta.moduleId}; expected ${entry.expectedModuleId}`
        );
      }
      return definition;
    }

    function syncChapter(section, chapter) {
      const collapsed = Boolean(navigationState[chapter.collapsedStateKey]);
      const header = section.querySelector(".platform-chapter-toggle");
      const moduleList = section.querySelector(".platform-module-list");
      section.dataset.collapsed = String(collapsed);
      header.setAttribute("aria-expanded", String(!collapsed));
      header.setAttribute("aria-label", `${collapsed ? "展开" : "折叠"}${chapter.title}${chapter.subtitle}`);
      moduleList.dataset.collapsed = String(collapsed);
      moduleList.setAttribute("aria-hidden", String(collapsed));
      moduleList.inert = collapsed;
      moduleList.querySelectorAll(".module-nav-item").forEach((button) => {
        button.tabIndex = collapsed ? -1 : 0;
      });
    }

    function render() {
      container.replaceChildren();
      chapterDefinitions.forEach((chapter) => {
        const section = document.createElement("section");
        section.className = "platform-chapter";
        section.dataset.chapterId = chapter.chapterId;

        const header = document.createElement("button");
        header.type = "button";
        header.className = "platform-chapter-toggle";
        header.innerHTML = `
          <span class="platform-chapter-copy">
            <strong>${chapter.title}</strong>
            <span>${chapter.subtitle}</span>
          </span>
          <span class="platform-chapter-chevron" aria-hidden="true">›</span>
        `;
        header.addEventListener("click", () => {
          navigationState[chapter.collapsedStateKey] = !navigationState[chapter.collapsedStateKey];
          syncChapter(section, chapter);
        });
        section.appendChild(header);

        const moduleList = document.createElement("nav");
        moduleList.className = "module-nav platform-module-list";
        moduleList.setAttribute("aria-label", `${chapter.title}${chapter.subtitle}`);
        chapter.modules.forEach((entry) => {
          const definition = resolveFormalModule(chapter, entry);
          const button = document.createElement("button");
          button.type = "button";
          button.className = "module-nav-item";
          button.dataset.module = definition.meta.routeId;
          button.classList.toggle("active", definition.meta.routeId === currentRouteId);

          const number = document.createElement("span");
          number.className = "num";
          number.textContent = entry.displayIndex;
          const label = document.createElement("span");
          label.className = "label";
          label.textContent = entry.label;
          button.append(number, label);
          button.addEventListener("click", () => onSelect(definition.meta.routeId));
          moduleList.appendChild(button);
        });
        section.appendChild(moduleList);
        container.appendChild(section);
        syncChapter(section, chapter);
      });
    }

    function updateActive(routeId) {
      currentRouteId = routeId;
      container.querySelectorAll(".module-nav-item").forEach((button) => {
        button.classList.toggle("active", button.dataset.module === routeId);
      });
    }

    function setChapterCollapsed(chapterId, collapsed) {
      const chapter = chapterDefinitions.find((item) => item.chapterId === chapterId);
      if (!chapter) throw new Error(`Unknown formal navigation chapter: ${chapterId}`);
      navigationState[chapter.collapsedStateKey] = Boolean(collapsed);
      const section = container.querySelector(`[data-chapter-id="${chapterId}"]`);
      if (section) syncChapter(section, chapter);
    }

    render();
    return Object.freeze({
      render,
      updateActive,
      setChapterCollapsed,
      getState: () => Object.freeze({ ...navigationState }),
      getFormalModules: () => chapterDefinitions.flatMap((chapter) => chapter.modules.map((entry) => Object.freeze({
        chapterId: chapter.chapterId,
        ...entry
      }))),
      getModuleButtons: () => Array.from(container.querySelectorAll(".module-nav-item"))
    });
  }

  platform.navigation = Object.freeze({ chapterDefinitions, formalModuleRoutes, mountChapterNavigation });
})(globalThis);
