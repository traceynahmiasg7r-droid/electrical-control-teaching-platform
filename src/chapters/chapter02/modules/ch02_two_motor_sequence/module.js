moduleCatalog["two-motor-sequence"] = {
        code: "05",
        name: "两电机顺序控制",
        experimentTitle: "两电动机顺序启动控制演示",
        experimentSubtitle: "1M 先通过 KM1 启动并自锁；KM1 辅助常开顺序触点闭合后，2M 才获得启动许可并可通过 KM2 自锁保持运行。",
        principleTitle: "为什么 2M 必须等 1M 先运行",
        principleText: "M2 控制支路串入 KM1 的辅助常开触点。KM1 未得电时，该触点断开，即使按下 SB4，KM2 也无法得电；KM1 得电后顺序触点闭合，M2 才能启动。若 KM1 因 SB1 停止或 FR1 过载释放，顺序触点随即断开，KM2 与 2M 同步停止。",
        promptText: "先合上 QF1，直接按 SB4 验证 2M 不能先启动；再按 SB2 启动 1M，随后按 SB4 启动 2M。最后按 SB1 或触发 FR1，观察两台电机的级联停止。",
        footerTip: "本模块复用双电机主电路几何，只在 2M 控制支路增加 KM1 顺序允许常开触点。",
        placeholderTag: "",
        placeholderNote: "",
        zones: []
      };

state.twoMotorSequence = {

      operationState: {

        qf1: "open",

        sb1: "released",

        sb2: "released",

        sb3: "released",

        sb4: "released",

        fr1: "normal",

        fr2: "normal"

      },

      stableControlState: {

        km1: false,

        km2: false

      },

      solver: {

        iterationCount: 0,

        converged: true,

        edgeStates: {},

        activeControlWireIds: [],

        activeMainWireIds: [],

        partialControlWireIds: [],

        activeControlEdgeIds: [],

        activeMainEdgeIds: [],

        motorStates: {

          motor1: "stopped",

          motor2: "stopped"

        },

        lastAction: "two motor sequence solver initialized",

        testReport: [],

        controlSupplyBoundary: "independent"

      }

    };


    const twoMotorSequenceWires = mainControlWires.filter((wire) => wire.wireId !== "cw_13");

    const twoMotorSequenceComponentBBoxes = [
      ...mainControlComponentBBoxes,
      { componentId: "cmp_km1_sequence", deviceId: "dev_km1", x: 916, y: 681, width: 34, height: 32, label: "KM1 顺序允许" }
    ];

    const twoMotorSequenceBBoxMap = Object.fromEntries(twoMotorSequenceComponentBBoxes.map((bbox) => [bbox.componentId, bbox]));

    const twoMotorSequenceWireMap = Object.fromEntries(twoMotorSequenceWires.map((wire) => [wire.wireId, wire]));

    const twoMotorSequenceDeviceEdgeDefs = [
      ...mainControlDeviceEdgeDefs,
      {
        edgeId: "edge_km1_sequence_no",
        fromPort: "sb3_r",
        toPort: "km2_after_stop",
        deviceId: "dev_km1",
        domain: "control",
        label: "KM1 顺序允许 NO"
      }
    ];


    function isTwoMotorSequenceModule() {
      return uiState.currentModule === "two-motor-sequence";
    }






   function resetTwoMotorSequenceSolverState() {

      state.twoMotorSequence.operationState = {

        qf1: "open",

        sb1: "released",

        sb2: "released",

        sb3: "released",

        sb4: "released",

        fr1: "normal",

        fr2: "normal"

      };

      state.twoMotorSequence.stableControlState = {

        km1: false,

        km2: false

      };

      recomputeTwoMotorSequenceSolver(
        "two motor sequence reset"
      );
    }


    function recomputeTwoMotorSequenceSolver(actionMessage = state.twoMotorSequence.solver.lastAction) {
      const control = solveTwoMotorSequenceControlCircuit(state.twoMotorSequence.operationState, state.twoMotorSequence.stableControlState);
      const main = solveTwoMotorSequenceMainCircuit(control.edgeStates);
      state.twoMotorSequence.stableControlState = control.coils;
      state.twoMotorSequence.solver = {
        ...state.twoMotorSequence.solver,
        iterationCount: control.iterationCount,
        converged: control.converged,
        edgeStates: control.edgeStates,
        activeControlWireIds: control.activeControlWireIds,
        activeMainWireIds: main.activeMainWireIds,
        partialControlWireIds: control.partialControlWireIds,
        activeControlEdgeIds: control.activeControlEdgeIds,
        activeMainEdgeIds: main.activeMainEdgeIds,
        motorStates: main.motorStates,
        lastAction: actionMessage,
        controlSupplyBoundary: "independent"
      };
    }


    function runTwoMotorSequenceSolverTests() {
      const originalOperation = cloneTwoMotorSequenceOperationState();
      const originalCoils = cloneTwoMotorSequenceCoilState();
      const originalSolver = JSON.parse(JSON.stringify(state.twoMotorSequence.solver));
      const results = [];
      const expect = (name, condition) => results.push({ name, passed: Boolean(condition) });
      try {
        resetTwoMotorSequenceSolverState();
        state.twoMotorSequence.operationState.qf1 = "closed"; recomputeTwoMotorSequenceSolver("test qf close");
        state.twoMotorSequence.operationState.sb4 = "pressed"; recomputeTwoMotorSequenceSolver("test M2 early start");
        expect("M2 cannot start before M1", !state.twoMotorSequence.stableControlState.km2 && state.twoMotorSequence.solver.motorStates.motor2 === "stopped");
        state.twoMotorSequence.operationState.sb4 = "released"; recomputeTwoMotorSequenceSolver("test release SB4");
        state.twoMotorSequence.operationState.sb2 = "pressed"; recomputeTwoMotorSequenceSolver("test M1 start press");
        state.twoMotorSequence.operationState.sb2 = "released"; recomputeTwoMotorSequenceSolver("test M1 start release");
        expect("M1 self-holds after SB2 release", state.twoMotorSequence.stableControlState.km1 && state.twoMotorSequence.solver.motorStates.motor1 === "running");
        state.twoMotorSequence.operationState.sb4 = "pressed"; recomputeTwoMotorSequenceSolver("test M2 start press");
        state.twoMotorSequence.operationState.sb4 = "released"; recomputeTwoMotorSequenceSolver("test M2 start release");
        expect("M2 starts after KM1 permit", state.twoMotorSequence.stableControlState.km2 && state.twoMotorSequence.solver.motorStates.motor2 === "running");
        state.twoMotorSequence.operationState.sb1 = "pressed"; recomputeTwoMotorSequenceSolver("test M1 stop cascade");
        state.twoMotorSequence.operationState.sb1 = "released"; recomputeTwoMotorSequenceSolver("test release SB1");
        expect("Stopping M1 cascades to M2", !state.twoMotorSequence.stableControlState.km1 && !state.twoMotorSequence.stableControlState.km2);
        state.twoMotorSequence.operationState.sb2 = "pressed"; recomputeTwoMotorSequenceSolver("restart M1"); state.twoMotorSequence.operationState.sb2 = "released"; recomputeTwoMotorSequenceSolver("release SB2");
        state.twoMotorSequence.operationState.sb4 = "pressed"; recomputeTwoMotorSequenceSolver("restart M2"); state.twoMotorSequence.operationState.sb4 = "released"; recomputeTwoMotorSequenceSolver("release SB4");
        state.twoMotorSequence.operationState.fr2 = "overload"; recomputeTwoMotorSequenceSolver("FR2 overload");
        expect("FR2 stops only M2", state.twoMotorSequence.stableControlState.km1 && !state.twoMotorSequence.stableControlState.km2 && state.twoMotorSequence.solver.motorStates.motor1 === "running");
        state.twoMotorSequence.operationState.fr2 = "normal"; recomputeTwoMotorSequenceSolver("FR2 reset");
        expect("FR2 reset does not auto restart M2", state.twoMotorSequence.stableControlState.km1 && !state.twoMotorSequence.stableControlState.km2);
        state.twoMotorSequence.operationState.sb4 = "pressed"; recomputeTwoMotorSequenceSolver("M2 after reset"); state.twoMotorSequence.operationState.sb4 = "released"; recomputeTwoMotorSequenceSolver("release M2 after reset");
        state.twoMotorSequence.operationState.fr1 = "overload"; recomputeTwoMotorSequenceSolver("FR1 overload");
        expect("FR1 overload cascades to both motors", !state.twoMotorSequence.stableControlState.km1 && !state.twoMotorSequence.stableControlState.km2);
        expect("Solver converges", state.twoMotorSequence.solver.converged);
      } finally {
        state.twoMotorSequence.operationState = originalOperation;
        state.twoMotorSequence.stableControlState = originalCoils;
        state.twoMotorSequence.solver = originalSolver;
      }
      state.twoMotorSequence.solver.testReport = results;
      return results;
    }


    function cloneTwoMotorSequenceOperationState(operationState = state.twoMotorSequence.operationState) {
      return JSON.parse(JSON.stringify(operationState));
    }


    function cloneTwoMotorSequenceCoilState(coilState = state.twoMotorSequence.stableControlState) {
      return {
        km1: Boolean(coilState.km1),
        km2: Boolean(coilState.km2)
      };
    }


    function getTwoMotorSequenceEdgeConductive(edgeId, operationState, coilState) {
      if (edgeId === "edge_km1_sequence_no") return Boolean(coilState.km1);
      return getMainControlEdgeConductive(edgeId, operationState, coilState);
    }


    function computeTwoMotorSequenceEdgeStates(operationState, coilState) {
      return Object.fromEntries(
        twoMotorSequenceDeviceEdgeDefs.map((edge) => [
          edge.edgeId,
          { ...edge, conductive: getTwoMotorSequenceEdgeConductive(edge.edgeId, operationState, coilState) }
        ])
      );
    }


    function buildTwoMotorSequenceElectricalGraph({ wireFilter, edgeFilter }) {
      const adjacency = new Map();
      function addConnection(from, to, item) {
        if (!from || !to) return;
        if (!adjacency.has(from)) adjacency.set(from, []);
        if (!adjacency.has(to)) adjacency.set(to, []);
        adjacency.get(from).push({ to, item });
        adjacency.get(to).push({ to: from, item });
      }
      twoMotorSequenceWires.filter(wireFilter).forEach((wire) => {
        const significantIndexes = new Set([0, wire.routePoints.length - 1]);
        wire.routePoints.forEach((point, index) => {
          if (index !== 0 && index !== wire.routePoints.length - 1 && mainControlElectricalJunctionCoordKeys.has(`${point.x},${point.y}`)) significantIndexes.add(index);
        });
        const sortedIndexes = [...significantIndexes].sort((x, y) => x - y);
        for (let index = 0; index < sortedIndexes.length - 1; index += 1) {
          const fromPoint = wire.routePoints[sortedIndexes[index]];
          const toPoint = wire.routePoints[sortedIndexes[index + 1]];
          addConnection(`${fromPoint.x},${fromPoint.y}`, `${toPoint.x},${toPoint.y}`, { id: wire.wireId, type: "wire", wireId: wire.wireId, kind: wire.kind });
        }
      });
      twoMotorSequenceDeviceEdgeDefs.filter(edgeFilter).forEach((edge) => {
        addConnection(getMainControlPortCoordKey(edge.fromPort), getMainControlPortCoordKey(edge.toPort), { id: edge.edgeId, type: "edge", edgeId: edge.edgeId, domain: edge.domain });
      });
      return adjacency;
    }


    function solveTwoMotorSequenceControlCircuit(operationState, previousCoils) {
      let assumedCoils = cloneTwoMotorSequenceCoilState(previousCoils);
      let iterationCount = 0;
      let converged = false;

      while (iterationCount < SOLVER_MAX_ITERATIONS) {
        iterationCount += 1;
        const edgeStates = computeTwoMotorSequenceEdgeStates(operationState, assumedCoils);
        const adjacency = buildTwoMotorSequenceElectricalGraph({
          wireFilter: (wire) => wire.kind === "control",
          edgeFilter: (edge) => edge.domain !== "coil" && edge.domain === "control" && edgeStates[edge.edgeId]?.conductive
        });
        const sourceReach = collectReachableNodes(adjacency, getMainControlPortCoordKey("control_supply_left"));
        const returnReach = collectReachableNodes(adjacency, getMainControlPortCoordKey("control_supply_right"));
        const nextCoils = {
          km1: sourceReach.has(getMainControlPortCoordKey("coil_km1_l")) && returnReach.has(getMainControlPortCoordKey("coil_km1_r")),
          km2: sourceReach.has(getMainControlPortCoordKey("coil_km2_l")) && returnReach.has(getMainControlPortCoordKey("coil_km2_r"))
        };
        if (nextCoils.km1 === assumedCoils.km1 && nextCoils.km2 === assumedCoils.km2) {
          converged = true;
          assumedCoils = nextCoils;
          break;
        }
        assumedCoils = nextCoils;
      }

      const edgeStates = computeTwoMotorSequenceEdgeStates(operationState, assumedCoils);
      const adjacency = buildTwoMotorSequenceElectricalGraph({
        wireFilter: (wire) => wire.kind === "control",
        edgeFilter: (edge) => edge.domain !== "coil" && edge.domain === "control" && edgeStates[edge.edgeId]?.conductive
      });
      const activeControlWireIds = new Set();
      const activeControlEdgeIds = new Set();
      [["km1", "coil_km1_l", "coil_km1_r", "edge_coil_km1"], ["km2", "coil_km2_l", "coil_km2_r", "edge_coil_km2"]].forEach(([coilKey, leftPort, rightPort, edgeId]) => {
        if (!assumedCoils[coilKey]) return;
        collectPathMembership(findPathItems(adjacency, getMainControlPortCoordKey("control_supply_left"), getMainControlPortCoordKey(leftPort)), activeControlWireIds, activeControlEdgeIds, {});
        collectPathMembership(findPathItems(adjacency, getMainControlPortCoordKey(rightPort), getMainControlPortCoordKey("control_supply_right")), activeControlWireIds, activeControlEdgeIds, {});
        activeControlEdgeIds.add(edgeId);
      });
      return {
        coils: assumedCoils,
        iterationCount,
        converged,
        edgeStates,
        activeControlWireIds: [...activeControlWireIds],
        activeControlEdgeIds: [...activeControlEdgeIds],
        partialControlWireIds: [...activeControlWireIds]
      };
    }


    function solveTwoMotorSequenceMainCircuit(edgeStates) {
      const adjacency = buildTwoMotorSequenceElectricalGraph({
        wireFilter: (wire) => wire.kind === "main",
        edgeFilter: (edge) => edgeStates[edge.edgeId]?.conductive && (edge.domain === "supply" || edge.domain === "main")
      });
      const loadGroups = {
        motor1: { U: ["src_l1", "motor1_u_in"], V: ["src_l2", "motor1_v_in"], W: ["src_l3", "motor1_w_in"] },
        motor2: { U: ["src_l1", "motor2_u_in"], V: ["src_l2", "motor2_v_in"], W: ["src_l3", "motor2_w_in"] }
      };
      const activeMainWireIds = new Set();
      const activeMainEdgeIds = new Set();
      const motorStates = { motor1: "stopped", motor2: "stopped" };
      Object.entries(loadGroups).forEach(([motorKey, phases]) => {
        const allReach = Object.values(phases).every(([sourcePort, loadPort]) =>
          collectReachableNodes(adjacency, getMainControlPortCoordKey(sourcePort)).has(getMainControlPortCoordKey(loadPort))
        );
        if (!allReach) return;
        motorStates[motorKey] = "running";
        Object.values(phases).forEach(([sourcePort, loadPort]) => {
          collectPathMembership(findPathItems(adjacency, getMainControlPortCoordKey(sourcePort), getMainControlPortCoordKey(loadPort)), activeMainWireIds, activeMainEdgeIds, {});
        });
      });
      return { motorStates, activeMainWireIds: [...activeMainWireIds], activeMainEdgeIds: [...activeMainEdgeIds] };
    }


    function validateTwoMotorSequenceGeometryData() {
      const portUsage = new Map();
      twoMotorSequenceWires.forEach((wire) => {
        [wire.fromPort, wire.toPort].forEach((portId) => portUsage.set(portId, (portUsage.get(portId) || 0) + 1));
      });
      twoMotorSequenceDeviceEdgeDefs.forEach((edge) => {
        [edge.fromPort, edge.toPort].forEach((portId) => portUsage.set(portId, (portUsage.get(portId) || 0) + 1));
      });
      const danglingRequiredPorts = Object.entries(mainControlPortMap)
        .filter(([, point]) => point.kind !== "node")
        .filter(([portId]) => !portUsage.has(portId))
        .map(([portId]) => portId);
      return {
        geometryLockId: "two_motor_sequence_geometry_v1",
        geometryLocked: true,
        sourceImageSize: { width: MAIN_CONTROL_IMAGE_WIDTH, height: MAIN_CONTROL_IMAGE_HEIGHT },
        counts: {
          wires: twoMotorSequenceWires.length,
          mainWires: twoMotorSequenceWires.filter((wire) => wire.kind === "main").length,
          controlWires: twoMotorSequenceWires.filter((wire) => wire.kind === "control").length,
          ports: Object.values(mainControlPortMap).filter((point) => point.kind !== "node").length,
          junctions: mainControlJunctions.length,
          componentBBoxes: twoMotorSequenceComponentBBoxes.length,
          componentAnchors: twoMotorSequenceComponentBBoxes.length
        },
        danglingWires: [], danglingRequiredPorts, ambiguousCrossings: [], duplicateWireIds: [], missingWireIds: []
      };
    }





    function createTwoMotorSequenceSnapshot(label = state.twoMotorSequence.solver.lastAction) {
      const snapshot = {
        label,
        operationState: cloneTwoMotorSequenceOperationState(),
        coils: cloneTwoMotorSequenceCoilState(),
        edgeStates: JSON.parse(JSON.stringify(state.twoMotorSequence.solver.edgeStates)),
        activeControlWireIds: [...state.twoMotorSequence.solver.activeControlWireIds],
        activeMainWireIds: [...state.twoMotorSequence.solver.activeMainWireIds],
        activeControlEdgeIds: [...state.twoMotorSequence.solver.activeControlEdgeIds],
        activeMainEdgeIds: [...state.twoMotorSequence.solver.activeMainEdgeIds],
        partialControlWireIds: [...state.twoMotorSequence.solver.partialControlWireIds],
        motorStates: { ...state.twoMotorSequence.solver.motorStates },
        controlSupplyBoundary: state.twoMotorSequence.solver.controlSupplyBoundary
      };
      snapshot.flowMeta = getMainControlFlowMetaFromSnapshot(snapshot);
      return snapshot;
    }


    function buildTwoMotorSequenceQfReplay(beforeSnapshot, finalSnapshot) {
      const closed = finalSnapshot.operationState.qf1 === "closed";
      return {
        kind: closed ? "two_motor_sequence_qf_close" : "two_motor_sequence_qf_open",
        title: closed ? "QF1 合闸" : "QF1 分闸",
        steps: [
          createReplayStep(closed ? "合上 QF1" : "断开 QF1", closed ? "QF1 合闸后，两台电动机的主回路都具备送电条件。" : "QF1 分闸后，两台电动机主回路均断电。", "key", buildMainControlDisplayStateFromSnapshot(finalSnapshot)),
          createReplayStep("顺序控制待命", closed ? "此时 2M 仍不能直接启动；必须先使 KM1 得电，让 KM1 顺序允许常开触点闭合。" : "系统回到断电状态。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
            callout: closed ? { componentId: "cmp_km1_sequence", text: "等待 KM1 闭合顺序触点" } : null
          }))
        ]
      };
    }


    function buildTwoMotorSequenceStartM1Replay(beforeSnapshot, pressedSnapshot, finalSnapshot) {
      const controlOnly = buildMainControlDisplayStateFromSnapshot(pressedSnapshot, {
        activeMainWireIds: [], activeMainEdgeIds: [], motor1Running: false, motor2Running: false
      });
      const finalDisplay = buildMainControlDisplayStateFromSnapshot(finalSnapshot);
      return {
        kind: "two_motor_sequence_m1_start",
        title: "1M 顺序启动第一阶段",
        steps: [
          createReplayStep("系统待命", "KM1 尚未得电，2M 支路中的 KM1 顺序允许触点处于断开状态。", "standard", buildMainControlDisplayStateFromSnapshot(beforeSnapshot, {
            callout: { componentId: "cmp_km1_sequence", text: "顺序触点断开" }
          })),
          createReplayStep("按下 SB2", "SB2 闭合后，1M 控制回路建立，电流流向 KM1 线圈。", "key", controlOnly),
          createReplayStep("KM1 线圈得电", "KM1 吸合，KM1 三极主触点闭合，1M 主回路接通。", "key", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
            callout: { componentId: "cmp_coil_km1", text: "KM1 得电" }
          })),
          createReplayStep("KM1 自锁保持", "SB2 松开后，KM1 自锁常开触点继续维持线圈得电，1M 持续运行。", "key", finalDisplay),
          createReplayStep("顺序允许触点闭合", "KM1 得电的同时，串入 2M 控制支路的 KM1 顺序允许常开触点闭合，2M 获得启动许可。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
            callout: { componentId: "cmp_km1_sequence", text: "2M 已获启动许可" }
          }))
        ]
      };
    }


    function buildTwoMotorSequenceStartM2Replay(beforeSnapshot, pressedSnapshot, finalSnapshot) {
      const permit = Boolean(beforeSnapshot.coils.km1);
      const started = Boolean(finalSnapshot.coils.km2);
      if (!permit || !started) {
        return {
          kind: "two_motor_sequence_m2_blocked",
          title: "2M 顺序联锁验证",
          steps: [
            createReplayStep("尝试按下 SB4", "SB4 被按下，但 KM1 尚未吸合。", "key", buildMainControlDisplayStateFromSnapshot(pressedSnapshot, {
              activeMainWireIds: [], activeMainEdgeIds: [], motor1Running: false, motor2Running: false
            })),
            createReplayStep("KM1 顺序触点仍断开", "由于 KM1 未得电，顺序允许常开触点断开，KM2 线圈没有完整通路。", "blocked", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
              callout: { componentId: "cmp_km1_sequence", text: "顺序联锁：禁止 2M 先启动" }
            })),
            createReplayStep("2M 保持停止", "必须先按 SB2 启动 1M，待 KM1 顺序触点闭合后，再按 SB4。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot))
          ]
        };
      }
      return {
        kind: "two_motor_sequence_m2_start",
        title: "2M 顺序启动第二阶段",
        steps: [
          createReplayStep("1M 已运行", "KM1 已吸合，KM1 顺序允许触点处于闭合状态。", "standard", buildMainControlDisplayStateFromSnapshot(beforeSnapshot, {
            callout: { componentId: "cmp_km1_sequence", text: "顺序许可已成立" }
          })),
          createReplayStep("按下 SB4", "SB4 闭合后，电流经 KM1 顺序允许触点、FR2 常闭触点流向 KM2 线圈。", "key", buildMainControlDisplayStateFromSnapshot(pressedSnapshot, {
            activeMainWireIds: [], activeMainEdgeIds: [], motor2Running: false
          })),
          createReplayStep("KM2 线圈得电", "KM2 吸合，第二台电动机的三相主回路接通。", "key", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
            callout: { componentId: "cmp_coil_km2", text: "KM2 得电" }
          })),
          createReplayStep("KM2 自锁保持", "SB4 松开后，KM2 自锁触点维持控制回路，2M 持续运行。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot))
        ]
      };
    }


    function buildTwoMotorSequenceStopM1Replay(beforeSnapshot, pressedSnapshot, finalSnapshot) {
      return {
        kind: "two_motor_sequence_m1_stop_cascade",
        title: "停止 1M 并级联停止 2M",
        steps: [
          createReplayStep("两机顺序运行", "当前 KM1、KM2 均得电，两台电动机处于运行状态。", "standard", buildMainControlDisplayStateFromSnapshot(beforeSnapshot)),
          createReplayStep("按下 SB1", "SB1 常闭停止按钮断开，KM1 控制回路被切断。", "key", buildMainControlDisplayStateFromSnapshot(pressedSnapshot, {
            buttonStates: { ...pressedSnapshot.operationState, sb1: true }
          })),
          createReplayStep("KM1 释放", "KM1 失电后，1M 主回路断开，同时 KM1 顺序允许触点恢复断开。", "key", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
            callout: { componentId: "cmp_km1_sequence", text: "顺序触点断开" }
          })),
          createReplayStep("KM2 同步释放", "KM1 顺序触点断开后，KM2 失去控制通路，2M 随之停止，实现顺序级联停机。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot))
        ]
      };
    }


    function buildTwoMotorSequenceStopM2Replay(beforeSnapshot, pressedSnapshot, finalSnapshot) {
      return {
        kind: "two_motor_sequence_m2_stop",
        title: "单独停止 2M",
        steps: [
          createReplayStep("2M 运行中", "KM1 保持得电，KM1 顺序许可仍然成立。", "standard", buildMainControlDisplayStateFromSnapshot(beforeSnapshot)),
          createReplayStep("按下 SB3", "SB3 常闭停止按钮断开，KM2 控制回路被切断。", "key", buildMainControlDisplayStateFromSnapshot(pressedSnapshot)),
          createReplayStep("KM2 释放，2M 停止", "KM2 线圈失电、主触点断开；1M 与 KM1 保持运行。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot))
        ]
      };
    }


    function buildTwoMotorSequenceProtectionReplay(which, beforeSnapshot, finalSnapshot) {
      const isFr1 = which === "fr1";
      const tripped = finalSnapshot.operationState[which] === "overload";
      return {
        kind: `two_motor_sequence_${which}_${tripped ? "trip" : "reset"}`,
        title: `${which.toUpperCase()} ${tripped ? "过载动作" : "复位"}`,
        steps: tripped ? [
          createReplayStep("保护动作前", "电动机按当前顺序状态运行。", "standard", buildMainControlDisplayStateFromSnapshot(beforeSnapshot)),
          createReplayStep(`${which.toUpperCase()} 常闭触点断开`, isFr1 ? "FR1 使 KM1 释放，并同时撤销 2M 的顺序许可。" : "FR2 只切断 KM2 控制回路。", "blocked", buildMainControlDisplayStateFromSnapshot(finalSnapshot, {
            callout: { componentId: isFr1 ? "cmp_fr1_nc" : "cmp_fr2_nc", text: `${which.toUpperCase()} 保护断开` }
          })),
          createReplayStep(isFr1 ? "两台电机停止" : "仅 2M 停止", isFr1 ? "KM1 释放使顺序触点断开，KM2 / 2M 也被级联切断。" : "KM1 / 1M 保持运行，只有 KM2 / 2M 停止。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot))
        ] : [
          createReplayStep(`${which.toUpperCase()} 已复位`, "保护触点恢复闭合，但电机不会自动重新启动。", "final", buildMainControlDisplayStateFromSnapshot(finalSnapshot))
        ]
      };
    }






    function createTwoMotorSequenceModulePort() {
      function readRawState() {
        return {
          operationState: cloneTwoMotorSequenceOperationState(),
          stableControlState: cloneTwoMotorSequenceCoilState(),
          solver: cloneFacadePortValue(state.twoMotorSequence.solver)
        };
      }
      function finish(actionId, label, feedbackText, tone = "info", replayDescriptor = null) {
        setActionFeedback({ actionId, label, feedbackText, tone });
        setCurrentFlowReplayDescriptor(replayDescriptor);
      }
      function momentary(buttonId, actionLabel) {
        const beforeSnapshot = createTwoMotorSequenceSnapshot(`${buttonId} before press`);
        state.twoMotorSequence.operationState[buttonId] = "pressed";
        recomputeTwoMotorSequenceSolver(`${actionLabel} press`);
        const pressedSnapshot = createTwoMotorSequenceSnapshot(`${buttonId} pressed`);
        state.twoMotorSequence.operationState[buttonId] = "released";
        recomputeTwoMotorSequenceSolver(`${actionLabel} release`);
        const finalSnapshot = createTwoMotorSequenceSnapshot(`${buttonId} released`);
        return { beforeSnapshot, pressedSnapshot, finalSnapshot };
      }
      return Object.freeze({
        readRawState,
        reset: () => {
          resetTwoMotorSequenceSolverState();
          setCurrentFlowReplayDescriptor(null);
          return readRawState();
        },
        solve: (actionMessage) => { recomputeTwoMotorSequenceSolver(actionMessage); return readRawState(); },
        togglePower: () => {
          const beforeSnapshot = createTwoMotorSequenceSnapshot("QF1 before toggle");
          state.twoMotorSequence.operationState.qf1 = state.twoMotorSequence.operationState.qf1 === "closed" ? "open" : "closed";
          recomputeTwoMotorSequenceSolver("sequence QF1 toggle");
          const finalSnapshot = createTwoMotorSequenceSnapshot("QF1 after toggle");
          finish("qf1", "QF1 动作反馈", state.twoMotorSequence.operationState.qf1 === "closed" ? "QF1 已合闸，主电路获得送电条件；2M 仍需等待 KM1 顺序许可。" : "QF1 已分闸，两台电动机主回路断电。", state.twoMotorSequence.operationState.qf1 === "closed" ? "success" : "info", buildTwoMotorSequenceQfReplay(beforeSnapshot, finalSnapshot));
        },
        startPrimary: () => {
          const snapshots = momentary("sb2", "SB2 start M1");
          finish("sb2", "SB2 启动反馈", state.twoMotorSequence.stableControlState.km1 ? "KM1 已吸合并通过自锁触点保持，1M 运行；KM1 顺序允许触点同时闭合。" : "M1 未能启动，请检查 QF1、FR1 与控制回路。", state.twoMotorSequence.stableControlState.km1 ? "success" : "warning", buildTwoMotorSequenceStartM1Replay(snapshots.beforeSnapshot, snapshots.pressedSnapshot, snapshots.finalSnapshot));
        },
        stopPrimary: () => {
          const snapshots = momentary("sb1", "SB1 stop M1");
          finish("sb1", "SB1 停止反馈", "SB1 切断 KM1 控制回路；KM1 释放后顺序允许触点断开，KM2 / 2M 同步停止。", "info", buildTwoMotorSequenceStopM1Replay(snapshots.beforeSnapshot, snapshots.pressedSnapshot, snapshots.finalSnapshot));
        },
        startSecondary: () => {
          const snapshots = momentary("sb4", "SB4 start M2");
          const started = Boolean(state.twoMotorSequence.stableControlState.km2);
          const permitBefore = Boolean(snapshots.beforeSnapshot.coils.km1);
          finish("sb4", "SB4 启动反馈", started ? "KM1 顺序允许触点已闭合，KM2 吸合并自锁，2M 运行。" : permitBefore ? "KM1 已允许启动，但 2M 未能启动，请检查 QF1 与 FR2。" : "KM1 尚未吸合，顺序允许触点断开；2M 不能先于 1M 启动。", started ? "success" : "warning", buildTwoMotorSequenceStartM2Replay(snapshots.beforeSnapshot, snapshots.pressedSnapshot, snapshots.finalSnapshot));
        },
        stopSecondary: () => {
          const snapshots = momentary("sb3", "SB3 stop M2");
          finish("sb3", "SB3 停止反馈", "SB3 切断 KM2 控制回路，2M 停止；1M 保持原状态。", "info", buildTwoMotorSequenceStopM2Replay(snapshots.beforeSnapshot, snapshots.pressedSnapshot, snapshots.finalSnapshot));
        },
        toggleProtection: () => {
          const beforeSnapshot = createTwoMotorSequenceSnapshot("FR1 before toggle");
          state.twoMotorSequence.operationState.fr1 = state.twoMotorSequence.operationState.fr1 === "normal" ? "overload" : "normal";
          recomputeTwoMotorSequenceSolver("sequence FR1 toggle");
          const finalSnapshot = createTwoMotorSequenceSnapshot("FR1 after toggle");
          finish("fr1_trip", "FR1 保护反馈", state.twoMotorSequence.operationState.fr1 === "overload" ? "FR1 过载动作使 KM1 释放，顺序允许触点断开，KM2 / 2M 也停止。" : "FR1 已恢复正常；电机不会自动重新启动。", state.twoMotorSequence.operationState.fr1 === "overload" ? "warning" : "info", buildTwoMotorSequenceProtectionReplay("fr1", beforeSnapshot, finalSnapshot));
        },
        resetProtection: () => {
          const beforeSnapshot = createTwoMotorSequenceSnapshot("FR1 before reset");
          state.twoMotorSequence.operationState.fr1 = "normal";
          recomputeTwoMotorSequenceSolver("sequence FR1 reset");
          const finalSnapshot = createTwoMotorSequenceSnapshot("FR1 after reset");
          finish("fr1_reset", "FR1 复位反馈", "FR1 已复位；需要重新按 SB2 启动 1M。", "info", buildTwoMotorSequenceProtectionReplay("fr1", beforeSnapshot, finalSnapshot));
        },
        toggleSecondaryProtection: () => {
          const beforeSnapshot = createTwoMotorSequenceSnapshot("FR2 before toggle");
          state.twoMotorSequence.operationState.fr2 = state.twoMotorSequence.operationState.fr2 === "normal" ? "overload" : "normal";
          recomputeTwoMotorSequenceSolver("sequence FR2 toggle");
          const finalSnapshot = createTwoMotorSequenceSnapshot("FR2 after toggle");
          finish("fr2_trip", "FR2 保护反馈", state.twoMotorSequence.operationState.fr2 === "overload" ? "FR2 过载动作使 KM2 / 2M 停止，1M 保持运行。" : "FR2 已恢复正常；2M 不会自动重新启动。", state.twoMotorSequence.operationState.fr2 === "overload" ? "warning" : "info", buildTwoMotorSequenceProtectionReplay("fr2", beforeSnapshot, finalSnapshot));
        },
        resetSecondaryProtection: () => {
          const beforeSnapshot = createTwoMotorSequenceSnapshot("FR2 before reset");
          state.twoMotorSequence.operationState.fr2 = "normal";
          recomputeTwoMotorSequenceSolver("sequence FR2 reset");
          const finalSnapshot = createTwoMotorSequenceSnapshot("FR2 after reset");
          finish("fr2_reset", "FR2 复位反馈", "FR2 已复位；若 KM1 仍吸合，可重新按 SB4 启动 2M。", "info", buildTwoMotorSequenceProtectionReplay("fr2", beforeSnapshot, finalSnapshot));
        },
        render: () => render(),
        pause: () => cancelCurrentFlowReplay(),
        unmount: () => { cancelCurrentFlowReplay(); clearLegacyInteractionDom(); },
        validateGeometry: () => validateTwoMotorSequenceGeometryData(),
        runTests: () => runTwoMotorSequenceSolverTests(),
        getFeedback: () => cloneFacadePortValue(state.actionFeedback),
        getReplaySteps: () => cloneFacadePortValue(state.currentFlow.lastReplayDescriptor && state.currentFlow.lastReplayDescriptor.steps || [])
      });
    }



(function installTwoMotorSequenceDefinition(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleDefinitions = platform.moduleDefinitions || {};

  platform.moduleDefinitions.createCh02TwoMotorSequence = (options) =>
    platform.facadeAdapter.createFacadeModuleDefinition({
      circuitData: options.circuitData,
      createFacade: () => platform.moduleFacades.createTwoMotorSequenceFacade({ port: options.port }),
      meta: {
        schemaVersion: "1.0",
        chapterId: "ch02",
        moduleId: "ch02_two_motor_sequence",
        routeId: "two-motor-sequence",
        order: 5,
        code: "05",
        title: "两电机顺序控制",
        shortTitle: "顺序控制",
        moduleType: "interactive",
        simulationLevel: "S2",
        maturity: "M3",
        status: "ready",
        integrationMode: "facade-v1",
        geometryLockId: "two_motor_sequence_geometry_v1"
      },
      aliases: ["ch02_two_motor_sequence"]
    });
})(globalThis);
