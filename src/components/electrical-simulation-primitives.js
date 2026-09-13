(function installElectricalSimulationPrimitives(global) {
  "use strict";

  const platform = global.ECTPPlatform = global.ECTPPlatform || {};
  const escapeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const referenceBase = new URL("./reference-skin/", document.currentScript.src).href;
  const stateClass = (active) => active ? " is-active is-live" : "";

  function terminal(x, y, radius = 3.5) {
    const outer = Math.min(radius, 3.8);
    return `<g class="sim-terminal"><circle class="sim-terminal-outer" cx="${x}" cy="${y}" r="${outer}"/><circle class="sim-terminal-inner" cx="${x}" cy="${y}" r="${Math.max(1.55, outer - 1.55)}"/><line class="sim-terminal-slot" x1="${x - 1.25}" y1="${y}" x2="${x + 1.25}" y2="${y}"/></g>`;
  }

  function fixedContact(x, y) {
    return `<circle class="sim-contact-fixed" cx="${x}" cy="${y}" r="2.75"/>`;
  }

  function label(x, y, text, anchor = "middle", className = "sim-piece-label") {
    if (!text) return "";
    return `<text class="${className}" x="${x}" y="${y}" text-anchor="${anchor}">${escapeText(text)}</text>`;
  }

  function qf({x,y,on=false,labelText="QF1",formal=true,poleSpacing=28}) {
    const port=poleSpacing>=40?23:30,cart=poleSpacing<40;
    const poles=[-poleSpacing,0,poleSpacing].map((dx,i)=>{
      const px=x+dx;
      const body=cart
        ? referenceSlice(1,[87,59,15,33],px-7.5,y-16.5,15,33,on?'<rect x="91" y="64" width="8" height="21" fill="#edf0f3"/><path d="M94 64V85" stroke="#23976f" stroke-width="2"/>':"")
        : referenceSlice(2,[155,145,15,36],px-5,y-18,15,36,on?'<rect x="156" y="146" width="13" height="34" fill="white"/><path d="M160 148V177" stroke="#23976f" stroke-width="2"/>':"");
      return `<path class="sim-detail" d="M${px} ${y-port}V${y-16} M${px} ${y+16}V${y+port}"/>${body}${terminal(px,y-port)}${terminal(px,y+port)}${cart&&i===1?`<path class="sim-qf-handle" d="M${px+3} ${y-12}l7-8"/>`:""}`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-qf${stateClass(on)}" data-component-kind="qf">${poles}${label(x,y-port-10,labelText)}</g>`;
}

  function fuse({x,y,labelText="FU1",poleCount=3,poleSpacing=28}) {
    const port=poleSpacing>=40?22:24;
    const poles=Array.from({length:poleCount},(_,i)=>{
      const px=x+(i-(poleCount-1)/2)*poleSpacing;
      return `<path class="sim-detail" d="M${px} ${y-port}V${y+port}"/>${referenceSlice(1,[82,114,25,48],px-11.25,y-21.6,22.5,43.2)}<path class="sim-detail" d="M${px} ${y-port}V${y-17} M${px} ${y+20}V${y+port}"/>`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-fuse" data-component-kind="fuse">${poles}${label(x,y-port-9,labelText)}</g>`;
}

  function contactBank({x,y,on=false,labelText="KM1",poleCount=3,poleSpacing=28,labelAbove=true}) {
    const port=poleSpacing>=40?25:24,scale=(2*port)/65;
    const poles=Array.from({length:poleCount},(_,i)=>{
      const px=x+(i-(poleCount-1)/2)*poleSpacing;
      const overlay=on?'<rect x="155" y="308" width="13" height="39" fill="white"/><path d="M160 304V347" stroke="#23976f" stroke-width="2"/><path d="M156 327l2-2 2 4 2-2" fill="none" stroke="#89929d" stroke-width=".8"/>':"";
      return `${referenceSlice(2,[147,291,26,65],px-13*scale,y-port,26*scale,65*scale,overlay)}<path class="sim-detail" d="M${px} ${y-port}v${4*scale} M${px} ${y+port-5*scale}v${5*scale}"/>`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-contact-bank${stateClass(on)}" data-component-kind="contactor">${poles}${label(x,labelAbove?y-port-10:y+port+14,labelText)}</g>`;
}

  function inlineContact({x,y,closed=false,labelText="",normalClosed=false,active=false,width=76}) {
    const isClosed=normalClosed?!closed:closed;
    const crop=normalClosed?[694,230,56,43]:[570,264,94,33];
    const visualWidth=Math.min(width+4,crop[2]),scale=visualWidth/crop[2];
    const axis=normalClosed?245:279,center=normalClosed?722:617;
    let overlay="";
    if(normalClosed&&!isClosed)overlay='<rect x="714" y="241" width="16" height="8" fill="white"/><path d="M714 245l14-6" stroke="#ef4149" stroke-width="2"/>';
    if(!normalClosed&&isClosed)overlay='<rect x="588" y="270" width="60" height="11" fill="white"/><path d="M591 279h51" stroke="#23976f" stroke-width="2"/>';
    return `<g class="ectp-sim-piece ectp-inline-contact${stateClass(active)}" data-component-kind="contact">${portLeads(x,y,width,visualWidth-12*scale)}${referenceSlice(1,crop,x-(center-crop[0])*scale,y-(axis-crop[1])*scale,crop[2]*scale,crop[3]*scale,overlay)}${label(x,y-(axis-crop[1])*scale-5,labelText)}</g>`;
}

  function pushButton({x,y,labelText,color="forward",pressed=false,contactClosed=false,active=false,normalClosed=false,width=52}) {
    const isClosed=normalClosed?!pressed:contactClosed,stop=color==="stop";
    // Caps and contact strips are separate crops so pressing retains the original travel.
    const cap=stop?[512,213,28,26]:[624,213,28,26];
    const strip=stop?[497,237,58,16]:[607,237,57,16];
    const center=stop?526:636, scale=Math.min(1,width/40);
    const axis=245;
    let overlay="";
    if(stop&&!isClosed)overlay='<rect x="513" y="240" width="27" height="8" fill="white"/><path d="M515 245l24-6" stroke="#ef4149" stroke-width="2"/>';
    if(!stop&&isClosed)overlay='<rect x="623" y="239" width="27" height="8" fill="white"/><path d="M625 245h24" stroke="#23976f" stroke-width="2"/>';
    const capOverlay=color==="reverse"?'<circle cx="638" cy="224" r="10.4" fill="#bfd1ea" stroke="#809fc2" stroke-width="1"/>':"";
    return `<g class="ectp-sim-piece ectp-push-button${pressed?" is-pressed":""}${stateClass(active)}" data-component-kind="push-button">${portLeads(x,y,width,40*scale)}${referenceSlice(1,strip,x-(center-strip[0])*scale,y-(axis-strip[1])*scale,strip[2]*scale,strip[3]*scale,overlay)}${referenceSlice(1,cap,x-14*scale,y-32*scale+(pressed?2:0),28*scale,26*scale,capOverlay)}${label(x,y-38*scale,labelText)}</g>`;
}

  function coil({x,y,labelText,on=false,width=70,height=46,timer=false}) {
    const scale=Math.min(1,width/50);
    return `<g class="ectp-sim-piece ectp-coil${stateClass(on)}" data-component-kind="${timer?"timer":"coil"}">${portLeads(x,y,width,48*scale)}${referenceSlice(1,[754,220,63,51],x-26*scale,y-25*scale,63*scale,51*scale)}${on?`<rect class="sim-coil-highlight" x="${x-21*scale}" y="${y-21*scale}" width="${43*scale}" height="${43*scale}" rx="5"/>`:""}${timer?`<circle class="sim-timer-dial" cx="${x+18*scale}" cy="${y-18*scale}" r="4"/><path class="sim-timer-hand" d="M${x+18*scale} ${y-18*scale}l2-2"/>`:""}${label(x,y-30*scale,labelText)}</g>`;
}

  function thermalRelay({x,y,labelText="FR1",tripped=false,poleSpacing=28}) {
    const port=poleSpacing>=40?21:20;
    const poles=[-poleSpacing,0,poleSpacing].map(dx=>{
      const px=x+dx;
      return `<path class="sim-detail" d="M${px} ${y-port}V${y+port}"/>${referenceSlice(2,[151,381,18,31],px-9,y-15.5,18,31)}${tripped?`<rect x="${px-5}" y="${y-11}" width="10" height="23" rx="2" fill="#ef4444" opacity=".32"/>`:""}${terminal(px,y-port)}${terminal(px,y+port)}`;
    }).join("");
    return `<g class="ectp-sim-piece ectp-fr${tripped?" is-tripped":""}" data-component-kind="thermal-relay">${poles}${label(x,y-port-9,labelText)}</g>`;
}

  function motor({x,y,labelText="M",running=false,direction="forward",subtitle="三相异步电动机"}) {
    const directionClass=running?(direction==="reverse"?" reverse":" forward"):"";
    return `<g class="ectp-sim-piece ectp-motor${stateClass(running)}" data-component-kind="motor">${terminal(x-28,y-43)}${terminal(x,y-43)}${terminal(x+28,y-43)}${referenceSlice(2,[178,442,64,73],x-29,y-42,64,73)}<path class="sim-motor-lead" d="M${x-28} ${y-43}L${x-21} ${y-22}L${x-12} ${y-28} M${x} ${y-43}v15 M${x+28} ${y-43}L${x+21} ${y-22}L${x+12} ${y-28}"/><g class="motor-rotor-assembly${directionClass}${stateClass(running)}" style="transform-origin:${x}px ${y}px"><circle class="sim-motor-rotor-hub" cx="${x}" cy="${y}" r="3"/><path class="sim-motor-rotor-spoke" d="M${x-6} ${y}h12 M${x} ${y-6}v12"/></g>${label(x,y+52,labelText,"middle","sim-motor-name")}${subtitle?label(x,y+64,subtitle,"middle","sim-small-label"):""}</g>`;
}

  function selectorSwitch({ x, y, labelText = "SA", mode = "jog" }) {
    const continuous = mode === "continuous";
    const left = x - 28;
    const right = x + 28;
    return `<g class="ectp-sim-piece ectp-selector${continuous ? " is-continuous" : " is-jog"}" data-component-kind="selector-switch"><rect class="sim-selector-contactblock" x="${left - 2}" y="${y - 7}" width="60" height="14" rx="5"/>${terminal(left, y)}${terminal(right, y)}${fixedContact(left + 10, y)}${fixedContact(right - 10, y)}<line class="sim-detail" x1="${left}" y1="${y}" x2="${left + 8}" y2="${y}"/><line class="sim-detail" x1="${right - 8}" y1="${y}" x2="${right}" y2="${y}"/><line class="sim-contact-bridge-live" x1="${left + 12}" y1="${y}" x2="${right - 12}" y2="${y}"/><line class="sim-button-stem" x1="${x}" y1="${y - 7}" x2="${x}" y2="${y - 12}"/><circle class="sim-selector-ring" cx="${x}" cy="${y - 22}" r="14"/><line class="sim-selector-handle" x1="${x}" y1="${y - 22}" x2="${x + (continuous ? 9 : -9)}" y2="${y - 31}"/><text class="sim-selector-state" x="${x}" y="${y + 19}" text-anchor="middle">${continuous ? "长动" : "点动"}</text>${label(x, y - 40, labelText)}</g>`;
  }

  function referenceSlice(sheet,crop,x,y,width,height,overlay="") {
    const [sx,sy,sw,sh]=crop;
    const imageSize=sheet===1?[901,587]:[902,624];
    return `<svg class="sim-reference-slice" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${sx} ${sy} ${sw} ${sh}" overflow="hidden" aria-hidden="true"><image href="${referenceBase}reference-${sheet}.jpg" x="0" y="0" width="${imageSize[0]}" height="${imageSize[1]}"/>${overlay}</svg>`;
}

  function portLeads(x,y,portWidth,bodyWidth) {
    if(portWidth<=bodyWidth) return "";
    return `<path class="sim-port-lead" d="M${x-portWidth/2} ${y}H${x-bodyWidth/2} M${x+bodyWidth/2} ${y}H${x+portWidth/2}"/>`;
}

  function controlGeometry(component,wires) {
    const id=component.componentId.split("__").pop();
    const aliases=[id,id.replace(/^(one|two|three)_/,"")];
    let input,output;
    for(const wire of wires){
      const from=wire.fromPort.split("__").pop(), to=wire.toPort.split("__").pop();
      if(aliases.some(a=>to===a+"_in")) input=wire.routePoints[wire.routePoints.length-1];
      if(aliases.some(a=>from===a+"_out")) output=wire.routePoints[0];
    }
    if(input&&output&&input.y===output.y) return {...component.geometry,x:(input.x+output.x)/2,width:Math.abs(output.x-input.x)};
    return component.geometry;
}

  platform.electricalPrimitives = Object.freeze({ terminal, label, qf, fuse, contactBank, inlineContact, pushButton, coil, thermalRelay, motor, selectorSwitch, controlGeometry });
})(globalThis);
