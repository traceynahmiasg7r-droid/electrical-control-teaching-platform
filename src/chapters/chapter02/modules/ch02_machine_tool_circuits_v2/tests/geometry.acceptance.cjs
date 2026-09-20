"use strict";
const assert = require('node:assert/strict');
global.window = global;
require('../main.geometry.js');
require('../circuit.data.js');
const data=ECTPPlatform.moduleCircuitData.ch02MachineToolCircuitsV2;
const ports=new Map(data.ports.map(p=>[p.portId,p]));
const adjacency=new Map();
for(const wire of data.wires){
 for(const [a,b] of [[wire.from,wire.to],[wire.to,wire.from]]){
  if(!adjacency.has(a))adjacency.set(a,[]);
  adjacency.get(a).push(b);
 }
 assert.deepEqual([wire.points[0].x,wire.points[0].y],[ports.get(wire.from).x,ports.get(wire.from).y],wire.wireId+' start');
 const last=wire.points.at(-1);
 assert.deepEqual([last.x,last.y],[ports.get(wire.to).x,ports.get(wire.to).y],wire.wireId+' end');
}
function connected(a,b){const visited=new Set([a]),pending=[a];while(pending.length){const n=pending.pop();if(n===b)return true;for(const v of adjacency.get(n)||[])if(!visited.has(v)){visited.add(v);pending.push(v)}}return false}
assert.equal(data.validateGeometry().valid,true);
for(const list of Object.values(data.supplies))for(const id of list)assert(ports.has(id),'missing supply '+id);
for(const edge of data.deviceEdges)assert(!connected(edge.from,edge.to),'bare-wire bypass around '+edge.edgeId);
for(const [a,b] of [['src_l1','src_l2'],['src_l1','src_l3'],['src_l2','src_l3'],data.supplies.control,data.supplies.lighting])assert(!connected(a,b),'bare-wire source short');
const nodes={
 E:['sq1_up_b','sq1_down_b','kt_coil_a','sq2_up_a','sq2_loose_a'],
 D:['sq2_up_b','sb4_nc_a','sb3_nc_a'],
 H:['kt_no_b','sb5_b','km5_nc_a'],
 C:['sb6_b','sq3_yv_b','kt_delay_no_b','kt_delay_nc_a','sb5_nc_a'],
 F:['km4_coil_b','km5_coil_b','fr2_nc_a']
};
for(const [node,ids] of Object.entries(nodes))for(const id of ids)assert(connected(ids[0],id),'source junction '+node+' missing '+id);
assert(!connected('self_left','self_right'),'self hold/start branch must have a real open contact');
for(const motor of data.components.filter(c=>c.type==='motor')){
 const g=motor.geometry;
 assert.equal(g.phasePorts.length,3);
 for(const id of g.phasePorts){const p=ports.get(id);assert(Math.abs(Math.hypot(p.x-g.x,p.y-g.y)-g.r)<1e-8,id+' does not touch motor circle')}
}
for(const prefix of ['fr1','fr2']){
 const heaters=data.deviceEdges.filter(e=>e.edgeId.startsWith(prefix+'_main_'));
 assert.deepEqual(heaters.map(e=>e.edgeId).sort(),[prefix+'_main_l1',prefix+'_main_l3']);
 assert(heaters.every(e=>e.condition==='always'),'thermal heater is not a switch');
}
assert.equal(data.deviceEdges.find(e=>e.edgeId==='lighting_winding').kind,'source');
assert.equal(data.deviceEdges.find(e=>e.edgeId==='el').kind,'load');
assert.equal(data.deviceEdges.find(e=>e.edgeId==='transformer_primary').kind,'load');
assert(data.crossings.some(c=>c.x===906&&c.y===560),'transformer crossing is missing');
assert(!connected('tp_l2','tp_l3'),'transformer crossing joins two phases');
console.log(JSON.stringify({passed:true,checkGroups:['port endpoints','supply references','no bare-wire contact bypass','source isolation','five textbook branch nodes','self-hold contact gap','twelve motor circle terminals','thermal phase placement','source/load classification','transformer crossing'],geometry:data.validateGeometry()}));
