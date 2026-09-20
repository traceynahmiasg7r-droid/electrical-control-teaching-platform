(function installMachineToolV2CircuitData(global) {
  "use strict";
  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  platform.moduleCircuitData = platform.moduleCircuitData || {};
  // Native pixels of the supplied slide, not coordinates converted from an old renderer.
  // Port IDs define connectivity. Intersecting line segments never create connections.
  const ports = [], wires = [], components = [], deviceEdges = [], labels = [], junctions = [], crossings = [], decorations = [];
  const lookup = new Map();
  const b = {
    port(id, x, y) {
      if (lookup.has(id)) throw new Error("Duplicate port " + id);
      const p = { portId: id, x, y }; lookup.set(id, p); ports.push(p); return id;
    },
    wire(id, from, to, via = [], domain = "control") {
      if (!lookup.has(from) || !lookup.has(to)) throw new Error("Unknown wire endpoint " + id);
      wires.push({ wireId: id, from, to, points: [lookup.get(from), ...via.map(([x,y]) => ({x,y})), lookup.get(to)], domain });
      return id;
    },
    device(id, type, geometry, edgeSpecs = [], label = id) {
      components.push({ componentId: id, type, geometry, electricalEdgeIds: edgeSpecs.map(e => e.id), label });
      edgeSpecs.forEach(e => deviceEdges.push({ ...e, edgeId: e.id, componentId: id, domain: e.domain || "control" }));
    },
    label(item) { labels.push(item); },
    junction(id, portId, visible = false) { junctions.push({ junctionId:id, ...lookup.get(portId), visible }); },
    crossing(id, first, second, x, y) { crossings.push({ crossingId:id, first, second, x, y }); }
  };
  platform.buildMachineV2Main(b);
  const P = b.port, W = b.wire;
  function contact(id, edgeId, label, ax, bx, y, normal, condition, symbol = "plain", extra = {}) {
    P(id + "_a", ax, y); P(id + "_b", bx, y);
    b.device(id, "contact", { a:id+"_a", b:id+"_b", normal, symbol, labelX:(ax+bx)/2, labelY:y-28, ...extra },
      [{ id:edgeId, from:id+"_a", to:id+"_b", condition }], label);
  }
  function coil(id, label, y, x = 1733) {
    P(id+"_a", x-16, y); P(id+"_b", x+16, y);
    const labelPositions = {KT:[1692,660],KM2:[1788,731],KM3:[1788,827],KM4:[1775,891],KM5:[1785,1074]};
    const lp=labelPositions[label]||[x,y-30];
    b.device(id, "coil", {a:id+"_a", b:id+"_b", state:label, timer:label==="KT", labelX:lp[0], labelY:lp[1]},
      [{id:id,from:id+"_a",to:id+"_b",condition:label,kind:"load"}],label);
  }
  function bus(prefix,x,ys) {
    ys.forEach((y,i)=>P(prefix+i,x,y));
    ys.slice(1).forEach((y,i)=>W(prefix+"-"+i,prefix+i,prefix+(i+1)));
  }
  // Transformer primary: the upper winding is fed by two post-fuse phases.
  P("t_primary_a",1242,495); P("t_primary_b",1370,493);
  P("t_secondary_a",1242,529); P("t_secondary_b",1370,528);
  W("transformer-primary-l3","tp_l3","t_primary_a",[[947,495]],"main");
  W("transformer-primary-l2","tp_l2","t_primary_b",[[906,432],[1993,430],[1993,493]],"main");
  b.crossing("transformer-l2-over-l3", "transformer-primary-l2", "main-phase-l3-feed", 906, 560);
  b.device("transformer","transformer",{primary:["t_primary_a","t_primary_b"],secondary:["t_secondary_a","t_secondary_b"],labelX:1300,labelY:480},
    [{id:"transformer_primary",from:"t_primary_a",to:"t_primary_b",kind:"load",condition:"always",domain:"main"}],"T");
  bus("cl",1020,[529,608,752,847,952,1040,1110,1190]);
  bus("cr",1993,[528,608,684,750,847,969,1183]);
  W("secondary-left","t_secondary_a","cl0");
  W("secondary-right","t_secondary_b","cr0");
  // SB1 NC stop precedes the parallel SB2 NO / KM1 self-hold branch.
  contact("sb1","sb1_nc","SB1",1115,1170,608,"nc","!SB1","button",{action:"spindleStop",labelX:1191,labelY:591,actuatorX:1133});
  contact("sb2","sb2_no","SB2",1320,1378,608,"no","SB2","button",{action:"spindleStart",labelX:1400,labelY:582,actuatorX:1337});
  contact("km1_self","km1_self_no","KM1",1320,1378,660,"no","KM1","interlock",{labelX:1235,labelY:650});
  coil("km1_coil","KM1",608);
  contact("fr1_nc","fr1_nc","FR1",1843,1882,608,"nc","!FR1","thermal",{action:"fr1Trip",labelX:1870,labelY:589});
  P("self_left",1286,608); P("self_right",1380,608);
  W("spindle-stop-feed","cl1","sb1_a");
  W("spindle-after-stop","sb1_b","self_left");
  W("spindle-start-feed","self_left","sb2_a");
  W("spindle-start-out","sb2_b","self_right");
  W("spindle-hold-in","self_left","km1_self_a",[[1286,660]]);
  W("spindle-hold-out","km1_self_b","self_right",[[1380,660]]);
  W("spindle-coil-feed","self_right","km1_coil_a");
  W("spindle-overload-feed","km1_coil_b","fr1_nc_a");
  W("spindle-return","fr1_nc_b","cr1");
  // Shared request node E connects KT, SQ2 NO and SQ2 NC, as in the source.
  bus("e",1286,[684,752,847,918]);
  bus("d",1415,[750,847]);
  b.junction("request-junction","e1",true);
  contact("sb3","sb3_no","SB3",1110,1162,752,"no","SB3","button",{action:"rockerUp",labelX:1190,labelY:723,actuatorX:1125});
  contact("sq1_up","sq1_up_nc","SQ1-1",1199,1245,752,"nc","!SQ1_UP","limit",{action:"upperLimit",labelX:1230,labelY:802});
  contact("sb4","sb4_no","SB4",1060,1110,847,"no","SB4","button",{action:"rockerDown",labelX:1142,labelY:819,actuatorX:1081});
  contact("sq1_down","sq1_down_nc","SQ1-2",1199,1245,847,"nc","!SQ1_DOWN","limit",{action:"lowerLimit",labelX:1230,labelY:895});
  contact("sq2_up","sq2_no","SQ2",1325,1382,750,"no","SQ2","limit",{action:"looseLimit",labelX:1385,labelY:730});
  contact("sb4_nc","sb4_nc","",1452,1514,750,"nc","!SB4","button",{labelX:1460,labelY:716,actuatorX:1478});
  contact("km3_nc","km3_nc","KM3",1562,1630,750,"nc","!KM3","interlock",{labelX:1553,labelY:734});
  contact("sb3_nc","sb3_nc","",1452,1514,847,"nc","!SB3","button",{actuatorX:1478});
  contact("km2_nc","km2_nc","KM2",1562,1630,847,"nc","!KM2","interlock",{labelX:1553,labelY:826});
  coil("kt_coil","KT",684); coil("km2_coil","KM2",750); coil("km3_coil","KM3",847);
  W("up-button-feed","cl2","sb3_a"); W("up-limit-feed","sb3_b","sq1_up_a");
  W("up-request","sq1_up_b","e1"); W("down-button-feed","cl3","sb4_a");
  W("down-limit-feed","sb4_b","sq1_down_a"); W("down-request","sq1_down_b","e2");
  W("timer-feed","e0","kt_coil_a"); W("timer-return","kt_coil_b","cr2");
  W("loose-permission-feed","e1","sq2_up_a",[[1286,750]]);
  W("loose-permission-out","sq2_up_b","d0");
  W("up-selector-feed","d0","sb4_nc_a"); W("up-interlock-feed","sb4_nc_b","km3_nc_a");
  W("up-coil-feed","km3_nc_b","km2_coil_a"); W("up-return","km2_coil_b","cr3");
  W("down-selector-feed","d1","sb3_nc_a"); W("down-interlock-feed","sb3_nc_b","km2_nc_a");
  W("down-coil-feed","km2_nc_b","km3_coil_a"); W("down-return","km3_coil_b","cr4");
  // Dashed mechanical links connect each NO button to its opposite NC.
  decorations.push({id:"sb4-link",kind:"mechanical",points:[[1081,819],[1081,695],[1478,695],[1478,722]]},
    {id:"sb3-link",kind:"mechanical",points:[[1125,724],[1125,785],[1478,785],[1478,819]]});
  // Hydraulic automatic path and manual SB5 bypass join before KM5 NC.
  contact("sq2_loose","sq2_nc","SQ2",1324,1380,918,"nc","!SQ2","limit",{action:"looseLimit",labelX:1372,labelY:905});
  contact("kt_no","kt_instant_no","KT",1470,1518,918,"no","KT","plain",{labelX:1450,labelY:902});
  contact("sb5","sb5_no","SB5",1095,1153,952,"no","SB5","button",{action:"loosen",labelX:1067,labelY:931,actuatorX:1120});
  contact("km5_nc","km5_nc","KM5",1565,1630,918,"nc","!KM5","interlock",{labelX:1652,labelY:902});
  coil("km4_coil","KM4",918);
  P("hydraulic_join",1550,918);
  W("automatic-loosen-feed","e3","sq2_loose_a"); W("automatic-loosen-kt","sq2_loose_b","kt_no_a");
  W("automatic-loosen-out","kt_no_b","hydraulic_join");
  W("manual-loosen-feed","cl4","sb5_a"); W("manual-loosen-out","sb5_b","hydraulic_join",[[1550,952]]);
  W("loosen-interlock-feed","hydraulic_join","km5_nc_a"); W("loosen-coil-feed","km5_nc_b","km4_coil_a");
  // SB6, SQ3 NC and off-delay NO are three parallel feeds to C.
  bus("c",1227,[1040,1110,1190]);
  contact("sb6","sb6_no","SB6",1100,1160,1040,"no","SB6","button",{action:"clamp",labelX:1190,labelY:1015,actuatorX:1120});
  contact("sq3_yv","sq3_nc","SQ3",1100,1180,1110,"nc","!SQ3","limit",{action:"clampLimit",labelX:1070,labelY:1094});
  contact("kt_delay_no","kt_delay_no","KT",1100,1180,1190,"no","KT_HOLD","timer-no",{labelX:1070,labelY:1160});
  contact("kt_delay_nc","kt_delay_nc","KT",1365,1418,1040,"nc","!KT_HOLD","timer-nc",{timerBelow:true,labelX:1405,labelY:1013});
  contact("km4_nc","km4_nc","KM4",1565,1630,1040,"nc","!KM4","interlock",{labelX:1652,labelY:1020});
  coil("km5_coil","KM5",1040);
  bus("f",1777,[918,969,1040]);
  contact("fr2_nc","fr2_nc","FR2",1843,1882,969,"nc","!FR2","thermal",{action:"fr2Trip",labelX:1872,labelY:950});
  W("manual-clamp-feed","cl5","sb6_a"); W("manual-clamp-out","sb6_b","c0");
  W("clamp-limit-feed","cl6","sq3_yv_a"); W("clamp-limit-out","sq3_yv_b","c1");
  W("delay-keep-feed","cl7","kt_delay_no_a"); W("delay-keep-out","kt_delay_no_b","c2");
  W("clamp-delay-feed","c0","kt_delay_nc_a"); W("clamp-interlock-feed","kt_delay_nc_b","km4_nc_a");
  W("clamp-coil-feed","km4_nc_b","km5_coil_a");
  W("loosen-common-return","km4_coil_b","f0"); W("clamp-common-return","km5_coil_b","f2");
  W("hydraulic-protection-feed","f1","fr2_nc_a"); W("hydraulic-return","fr2_nc_b","cr5");
  contact("sb5_nc","sb5_nc","SB5",1305,1410,1190,"nc","!SB5","button",{actuatorX:1351,labelX:1412,labelY:1174});
  contact("sb6_nc","sb6_nc","SB6",1514,1620,1190,"nc","!SB6","button",{actuatorX:1550,labelX:1640,labelY:1174});
  coil("yv","YV",1188);
  W("valve-feed","c2","sb5_nc_a"); W("valve-button-link","sb5_nc_b","sb6_nc_a");
  W("valve-coil-feed","sb6_nc_b","yv_a",[[1640,1188]]); W("valve-return","yv_b","cr6",[[1993,1188]]);
  decorations.push({id:"sb5-link",kind:"mechanical",points:[[1120,922],[1120,977],[1351,977],[1351,1157]]},
    {id:"sb6-link",kind:"mechanical",points:[[1120,1010],[1120,1088],[1550,1088],[1550,1157]]});
  // Indicator secondary supply is shown by arrows, not joined to unrelated wires.
  bus("il",1274,[1270,1390]); bus("ir",1658,[1265,1327,1390]);
  P("indicator_split",1350,1270);
  contact("sq4_1","sq4_nc","SQ4",1400,1462,1270,"nc","!SQ4","limit",{action:"indicator",labelX:1390,labelY:1244});
  contact("sq4_2","sq4_no","SQ4",1400,1482,1327,"no","SQ4","limit",{action:"indicator",labelX:1390,labelY:1369});
  contact("km1_lamp","km1_lamp","KM1",1400,1482,1390,"no","KM1","interlock",{labelX:1395,labelY:1434});
  function lamp(id,label,x,y) {
    P(id+"_a",x-20,y); P(id+"_b",x+20,y);
    b.device(id,"lamp",{x,y,r:20,labelX:x+62,labelY:y-16},
      [{id,from:id+"_a",to:id+"_b",condition:"always",kind:"load",domain:"auxiliary"}],label);
  }
  lamp("hl1","HL1",1543,1269); lamp("hl2","HL2",1547,1327); lamp("hl3","HL3",1547,1389);
  W("indicator-feed","il0","indicator_split",[],"auxiliary");
  W("indicator-nc-feed","indicator_split","sq4_1_a",[],"auxiliary");
  W("indicator-no-feed","indicator_split","sq4_2_a",[[1350,1327]],"auxiliary");
  W("indicator-run-feed","il1","km1_lamp_a",[],"auxiliary");
  W("hl1-feed","sq4_1_b","hl1_a",[],"auxiliary"); W("hl1-return","hl1_b","ir0",[],"auxiliary");
  W("hl2-feed","sq4_2_b","hl2_a",[],"auxiliary"); W("hl2-return","hl2_b","ir1",[],"auxiliary");
  W("hl3-feed","km1_lamp_b","hl3_a",[],"auxiliary"); W("hl3-return","hl3_b","ir2",[],"auxiliary");
  decorations.push({id:"indicator-source-arrow",kind:"arrow",points:[[1274,1270],[1274,1220]]},
    {id:"indicator-return-arrow",kind:"arrow",points:[[1658,1265],[1658,1220]]});
  // Every geometric branch has an explicit node, even where the textbook has no dot.
  const degree = new Map();
  [...wires,...deviceEdges].forEach(e=>[e.from,e.to].forEach(id=>degree.set(id,(degree.get(id)||0)+1)));
  ports.filter(p=>(degree.get(p.portId)||0)>=3).forEach(p=>{
    if (!junctions.some(j=>j.portId===p.portId)) b.junction("j-"+p.portId,p.portId,false);
  });
  function validateGeometry() {
    const errors = [], ids = new Set();
    [...wires.map(w=>w.wireId),...deviceEdges.map(e=>e.edgeId)].forEach(id=>{if(ids.has(id)) errors.push("duplicate edge "+id);ids.add(id);});
    [...wires,...deviceEdges].forEach(e=>{if(!lookup.has(e.from)||!lookup.has(e.to))errors.push("missing port "+(e.edgeId||e.wireId));});
    wires.forEach(w=>{if(w.points.length<2||w.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))errors.push("invalid points "+w.wireId);});
    return {valid:errors.length===0,errors,counts:{wires:wires.length,components:components.length,deviceEdges:deviceEdges.length,ports:ports.length,junctions:junctions.length,crossings:crossings.length}};
  }
  const scenes = [
    {id:"spindle",title:"主轴单向旋转",description:"SB2 启动，KM1 自锁；SB1 停止，FR1 过载保护。"},
    {id:"up",title:"摇臂上升",description:"按住 SB3，先松开；SQ2 到位后 KM2 驱动 M2 上升。"},
    {id:"down",title:"摇臂下降",description:"按住 SB4，先松开；SQ2 到位后 KM3 驱动 M2 下降。"},
    {id:"loosen",title:"主轴箱松开",description:"按住 SB5，KM4 驱动液压泵，联动 NC 切断 YV。"},
    {id:"clamp",title:"主轴箱夹紧",description:"按住 SB6，KM5 驱动液压泵；自动夹紧由 SQ3 到位停止。"},
    {id:"auxiliary",title:"辅助控制",description:"SA1 控制照明，SA2 控制冷却泵，SQ4 与 KM1 控制指示灯。"}
  ];
  platform.moduleCircuitData.ch02MachineToolCircuitsV2 = Object.freeze({
    geometryLockId:"z3040_native_trace_20260919",
    reference:{path:"C:/电路截图/屏幕截图 2026-09-19 050627.png",sha256:"EC7FA54785B237B2A9AD37F4A612C4B9D18AC92E74AD87568B1C855137A52CC0",sourceCrop:{left:76,top:180,right:2011,bottom:1460}},
    viewBox:{x:76,y:180,width:1935,height:1280},
    ports,wires,components,deviceEdges,labels,junctions,crossings,decorations,scenes,validateGeometry,
    supplies:{control:["t_secondary_a","t_secondary_b"],indicator:["il0","ir0"],lighting:["light_t_a","light_t_b"],phases:["src_l1","src_l2","src_l3"]}
  });
})(globalThis);
