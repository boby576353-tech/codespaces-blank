(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const ui = {
    speed: $("speed"), wheelie: $("wheelie"), score: $("score"), best: $("best"),
    balanceMarker: $("balance-marker"), balanceLabel: $("balance-label"),
    trickText: $("trick-text"), longest: $("longest"), crashes: $("crashes"),
    startScreen: $("start-screen"), pauseScreen: $("pause-screen"),
    crashFlash: $("crash-flash")
  };

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize); resize();

  const keys = Object.create(null);
  let running = false, paused = false, lastTime = 0, elapsed = 0;
  let cameraX = 0, score = 0, best = Number(localStorage.getItem("dirtline-best") || 0);
  let crashes = 0, longest = 0, wheelieTime = 0, currentTrail = "pine", combo = 1, comboTimer = 0;
  ui.best.textContent = formatScore(best);

  const trails = {
    pine: { sky1:"#8bc7d1", sky2:"#d6e4bd", far:"#718f7a", mid:"#466b4d", ground:"#604d35", dirt:"#b58a53", accent:"#d7ff38", sun:"#f7f1c2" },
    desert: { sky1:"#edb77e", sky2:"#f8d9a5", far:"#c88c5c", mid:"#966345", ground:"#67452e", dirt:"#d3a062", accent:"#ffcf68", sun:"#fff0c4" },
    night: { sky1:"#111b39", sky2:"#344d6c", far:"#394761", mid:"#263a3b", ground:"#252c2a", dirt:"#6e695a", accent:"#b9c9ff", sun:"#e1e8ff" }
  };
  const bike = { x: 150, y: 0, vx: 0, vy: 0, angle: 0, angVel: 0, wheelie: 0, grounded: true, airTime: 0, crashed: false, crashTimer: 0, jumpLock: 0 };
  const wheelR = 15;
  const terrain = [];
  const particles = [];
  let terrainSeed = 42;
  function rand() { terrainSeed = (terrainSeed * 1664525 + 1013904223) >>> 0; return terrainSeed / 4294967296; }
  function baseHeight(x) {
    const wave = Math.sin(x * .0031) * 25 + Math.sin(x * .0077 + 2) * 13 + Math.sin(x * .0011) * 34;
    const jump = Math.pow(Math.max(0, Math.sin(x * .0064 + 1.3)), 8) * -60;
    const small = Math.sin(x * .022) * 2.5;
    return H * .74 + wave + jump + small;
  }
  function terrainY(x) {
    const y = baseHeight(x);
    // Smooth dirt rollers with deliberately shaped lips.
    const jumpCycle = ((x + 180) % 720 + 720) % 720;
    if (jumpCycle < 180) {
      const t = jumpCycle / 180;
      return y - Math.sin(t * Math.PI) * 4;
    }
    return y;
  }
  function groundY(x) { return terrainY(x); }
  function getTerrainPoint(x) { return {x, y: groundY(x)}; }

  function resetBike(full = false) {
    bike.x = cameraX + Math.min(150, W * .22);
    bike.y = groundY(bike.x) - wheelR - 2;
    bike.vx = 0; bike.vy = 0; bike.angle = 0; bike.angVel = 0; bike.wheelie = 0;
    bike.grounded = true; bike.airTime = 0; bike.crashed = false; bike.crashTimer = 0; bike.jumpLock = 0;
    wheelieTime = 0; combo = 1; comboTimer = 0;
    if (full) { score = 0; elapsed = 0; cameraX = 0; longest = 0; }
  }
  function formatScore(n) { return Math.floor(n).toString().padStart(6, "0"); }
  function startGame() {
    ui.startScreen.classList.add("hidden"); ui.pauseScreen.classList.add("hidden");
    running = true; paused = false; lastTime = performance.now();
    resetBike(true); requestAnimationFrame(loop);
  }
  function pauseGame() {
    if (!running) return;
    paused = !paused;
    ui.pauseScreen.classList.toggle("hidden", !paused);
    if (!paused) { lastTime = performance.now(); requestAnimationFrame(loop); }
  }
  function crash() {
    if (bike.crashed) return;
    bike.crashed = true; bike.crashTimer = 1.1; crashes++;
    ui.crashes.textContent = crashes;
    ui.crashFlash.classList.remove("hit"); void ui.crashFlash.offsetWidth; ui.crashFlash.classList.add("hit");
    ui.trickText.textContent = "Wipeout! Resetting…";
    bike.vx *= .35; bike.vy = -120;
    if (score > best) { best = Math.floor(score); localStorage.setItem("dirtline-best", best); ui.best.textContent = formatScore(best); }
  }
  function jump() {
    if (!running || paused || bike.crashed) return;
    if (bike.grounded && bike.jumpLock <= 0) {
      bike.vy = -390 - Math.min(100, bike.vx * .12);
      bike.grounded = false; bike.airTime = 0; bike.jumpLock = .28;
      emitParticles(bike.x, groundY(bike.x), 9, "#d8b078", 100);
      ui.trickText.textContent = "Boosted off the lip!";
    } else if (bike.grounded) {
      bike.vy -= 40;
    }
  }
  function emitParticles(x, y, count, color, power) {
    for (let i = 0; i < count; i++) particles.push({x, y, vx:(rand()-.5)*power, vy:-rand()*power*.65, life:.3+rand()*.6, max:.9, r:1+rand()*3, color});
  }

  window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) e.preventDefault();
    if (!keys[key]) {
      if (key === " " || key === "arrowup") jump();
      if (key === "escape" || key === "p") pauseGame();
      if (key === "r") resetBike(false);
      if (key === "enter" && !running) startGame();
    }
    keys[key] = true;
  });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
  $("start-btn").addEventListener("click", startGame);
  $("pause-btn").addEventListener("click", pauseGame);
  $("resume-btn").addEventListener("click", pauseGame);
  $("restart-btn").addEventListener("click", () => { resetBike(true); paused = false; ui.pauseScreen.classList.add("hidden"); lastTime = performance.now(); requestAnimationFrame(loop); });
  document.querySelectorAll(".trail-option").forEach(btn => btn.addEventListener("click", () => {
    currentTrail = btn.dataset.trail;
    document.querySelectorAll(".trail-option").forEach(b => b.classList.toggle("selected", b === btn));
  }));
  document.querySelectorAll("[data-hold]").forEach(btn => {
    const k = btn.dataset.hold;
    btn.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; btn.setPointerCapture?.(e.pointerId); });
    ["pointerup","pointercancel","lostpointercapture"].forEach(ev => btn.addEventListener(ev, () => keys[k] = false));
  });
  document.querySelectorAll("[data-tap]").forEach(btn => btn.addEventListener("pointerdown", e => { e.preventDefault(); jump(); }));

  function update(dt) {
    elapsed += dt;
    const speedInput = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
    const wheelieInput = keys["w"] || keys["arrowup"];
    if (bike.crashed) {
      bike.crashTimer -= dt; bike.x += bike.vx * dt; bike.y += bike.vy * dt; bike.vy += 650 * dt;
      if (bike.crashTimer <= 0) resetBike(false);
      return;
    }
    bike.jumpLock = Math.max(0, bike.jumpLock - dt);
    // Pedaling speed builds up gradually and rolling resistance keeps it controlled.
    bike.vx += (keys["d"] ? 115 : 38) * dt;
    bike.vx -= bike.vx * .075 * dt;
    bike.vx = Math.max(0, Math.min(520, bike.vx));
    if (keys["s"] || keys["arrowdown"]) bike.vx = Math.max(0, bike.vx - 280 * dt);

    // Wheelie angle control: W lifts, A leans back, D corrects forward.
    const lift = wheelieInput ? 2.5 : 0;
    const balance = (keys["a"] ? 1.8 : 0) - (keys["d"] ? 1.35 : 0);
    bike.angVel += (lift + balance - Math.sin(bike.angle) * (bike.grounded ? 2.0 : .35)) * dt;
    bike.angVel *= Math.pow(bike.grounded ? .90 : .985, dt * 60);
    bike.angle += bike.angVel * dt;
    bike.angle = Math.max(-.65, Math.min(1.32, bike.angle));
    if (bike.grounded && bike.angle > .2 && bike.angle < 1.12 && bike.vx > 65) {
      wheelieTime += dt;
      longest = Math.max(longest, wheelieTime);
      score += dt * (45 + bike.vx * .10) * combo;
      comboTimer = 1.1;
      ui.trickText.textContent = wheelieTime > 2 ? `Clean wheelie ×${combo.toFixed(1)}` : "Wheelie started!";
    } else if (bike.grounded) {
      wheelieTime = Math.max(0, wheelieTime - dt * 1.8);
      if (wheelieTime === 0) ui.trickText.textContent = "Find your flow";
    }
    if (comboTimer > 0) comboTimer -= dt;
    else combo = Math.max(1, combo - dt * .3);
    if (wheelieTime > 1.8) combo = Math.min(4, 1 + wheelieTime * .15);

    const oldY = bike.y;
    bike.x += bike.vx * dt;
    bike.y += bike.vy * dt;
    if (!bike.grounded) {
      bike.airTime += dt;
      bike.vy += 790 * dt;
      // Air control is intentionally slower than ground control.
      bike.angle += speedInput * dt * .85;
    }
    const gY = groundY(bike.x);
    if (bike.y + wheelR >= gY && bike.vy >= 0) {
      if (!bike.grounded && bike.airTime > .12) {
        const impact = bike.vy;
        const angleErr = Math.abs(bike.angle - Math.atan2(groundY(bike.x+20)-groundY(bike.x-20), 40));
        if (impact > 440 || angleErr > 1.0) { crash(); return; }
        emitParticles(bike.x, gY, 7, "#c59b63", 85);
        score += Math.max(0, 150 - impact * .15);
      }
      bike.y = gY - wheelR;
      bike.vy = 0; bike.grounded = true; bike.airTime = 0;
    } else {
      bike.grounded = false;
    }
    if (bike.grounded && bike.angle < -0.5 && bike.vx > 90) crash();
    if (bike.angle > 1.28 && bike.grounded) crash();
    cameraX = Math.max(0, bike.x - W * .35);
    particles.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 180*dt; p.life -= dt; });
    for (let i=particles.length-1;i>=0;i--) if (particles[i].life<=0) particles.splice(i,1);
    ui.speed.innerHTML = `${Math.round(bike.vx * .11)} <small>MPH</small>`;
    ui.wheelie.innerHTML = `${wheelieTime.toFixed(1)} <small>S</small>`;
    ui.score.textContent = formatScore(score);
    ui.longest.textContent = `${longest.toFixed(1)}s`;
    const bal = Math.max(-1, Math.min(1, (bike.angle - .55) / .8));
    ui.balanceMarker.style.left = `${50 + bal*45}%`;
    ui.balanceLabel.textContent = bal < -.35 ? "TOO LOW" : bal > .45 ? "TOO HIGH" : "CENTERED";
    ui.balanceLabel.style.color = Math.abs(bal) > .65 ? "#ff766c" : "var(--lime)";
  }

  function drawSky(t) {
    const tr = trails[currentTrail];
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,tr.sky1); grad.addColorStop(1,tr.sky2);
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
    // Sun/moon and soft atmospheric rings
    ctx.globalAlpha = currentTrail === "night" ? .75 : .9;
    ctx.fillStyle = tr.sun; ctx.beginPath(); ctx.arc(W*.72,H*.2,currentTrail==="night"?22:32,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = .12; ctx.beginPath(); ctx.arc(W*.72,H*.2,57,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    if(currentTrail==="night"){
      for(let i=0;i<65;i++){const x=((i*193-cameraX*.08)%W+W)%W;const y=(i*71)%Math.floor(H*.43);ctx.fillStyle=`rgba(255,255,255,${.35+(i%4)*.12})`;ctx.fillRect(x,y,1.5,1.5);}
    }
    drawHills(tr.far,H*.52,.10,120);
    drawHills(tr.mid,H*.63,.20,78);
    // Far trees / cacti silhouettes
    const shift = cameraX*.28;
    for(let i=-2;i<Math.ceil(W/80)+3;i++){
      const x=((i*100-shift)% (W+180)+W+180)%(W+180)-60;
      const y=H*.62 + Math.sin(i*3)*9;
      if(currentTrail==="desert"){
        ctx.fillStyle="#73513c";ctx.fillRect(x,y-25,5,27);ctx.fillRect(x-8,y-18,9,4);ctx.fillRect(x+3,y-12,8,4);
      }else{
        ctx.fillStyle=currentTrail==="night"?"#1b3030":"#31513e";
        ctx.beginPath();ctx.moveTo(x,y-45);ctx.lineTo(x-21,y-7);ctx.lineTo(x+19,y-7);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(x,y-31);ctx.lineTo(x-17,y+3);ctx.lineTo(x+16,y+3);ctx.closePath();ctx.fill();
        ctx.fillRect(x-3,y,6,13);
      }
    }
  }
  function drawHills(color, base, parallax, amp) {
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);
    for(let x=0;x<=W+10;x+=10){const wx=x+cameraX*parallax;const y=base+Math.sin(wx*.004)*amp+Math.sin(wx*.009+2)*amp*.28;ctx.lineTo(x,y);}
    ctx.lineTo(W,H);ctx.closePath();ctx.fill();
  }
  function drawGround() {
    const tr=trails[currentTrail];
    ctx.beginPath();ctx.moveTo(0,H);
    for(let sx=-10;sx<=W+10;sx+=5)ctx.lineTo(sx,groundY(sx+cameraX));
    ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=tr.ground;ctx.fill();
    ctx.beginPath();
    for(let sx=-10;sx<=W+10;sx+=5){const sy=groundY(sx+cameraX);if(sx===-10)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);}
    ctx.strokeStyle=tr.dirt;ctx.lineWidth=5;ctx.stroke();
    // Trail texture streaks
    for(let i=0;i<95;i++){
      const wx=(i*113+Math.floor(cameraX/90)*37)%Math.max(1,W+500)-100+cameraX;
      const sx=wx-cameraX, sy=groundY(wx);
      if(sx>-5&&sx<W+5){ctx.strokeStyle=i%3===0?"#d1aa71":"#342e25";ctx.globalAlpha=.22;ctx.lineWidth=i%3===0?2:1;ctx.beginPath();ctx.moveTo(sx,sy+8+i%17);ctx.lineTo(sx+8+i%22,sy+9+i%17);ctx.stroke();}
    }ctx.globalAlpha=1;
  }
  function drawBike() {
    const sx=bike.x-cameraX, sy=bike.y;
    ctx.save();ctx.translate(sx,sy);ctx.rotate(bike.angle);
    const rear={x:-36,y:3},front={x:36,y:3},bb={x:-8,y:-2},seat={x:-22,y:-24},head={x:20,y:-22},stem={x:24,y:-31},handle={x:31,y:-33};
    // Wheel shadows and tires
    for(const p of [rear,front]){
      ctx.beginPath();ctx.arc(p.x,p.y,wheelR,0,Math.PI*2);ctx.fillStyle="#121815";ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,wheelR-4,0,Math.PI*2);ctx.strokeStyle="#87918a";ctx.lineWidth=1.2;ctx.stroke();
      ctx.beginPath();ctx.arc(p.x,p.y,2.2,0,Math.PI*2);ctx.fillStyle="#c8d0c7";ctx.fill();
      for(let a=0;a<8;a++){const an=a*Math.PI/4;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(an)*(wheelR-4),p.y+Math.sin(an)*(wheelR-4));ctx.strokeStyle="#68746b";ctx.lineWidth=.7;ctx.stroke();}
    }
    // Frame
    ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=4;ctx.strokeStyle=trails[currentTrail].accent;
    ctx.beginPath();ctx.moveTo(rear.x,rear.y);ctx.lineTo(bb.x,bb.y);ctx.lineTo(head.x,head.y);ctx.lineTo(rear.x,rear.y);ctx.moveTo(bb.x,bb.y);ctx.lineTo(seat.x,seat.y);ctx.lineTo(head.x,head.y);ctx.moveTo(head.x,head.y);ctx.lineTo(front.x,front.y);ctx.stroke();
    ctx.strokeStyle="#e0e7de";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(seat.x,seat.y);ctx.lineTo(seat.x-7,seat.y-2);ctx.moveTo(stem.x,stem.y);ctx.lineTo(handle.x+7,handle.y);ctx.stroke();
    // Rider torso, arms and legs
    const riderLean = Math.max(-.25,Math.min(.3,bike.angle*.22));
    ctx.strokeStyle="#202b25";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(seat.x+2,seat.y-2);ctx.lineTo(-13,-43);ctx.lineTo(8,-37);ctx.stroke();
    ctx.strokeStyle="#e4ece1";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-13,-43);ctx.lineTo(4,-30);ctx.lineTo(handle.x,handle.y+1);ctx.stroke();
    ctx.strokeStyle="#d7ff38";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-13,-43);ctx.lineTo(-23,-29);ctx.lineTo(bb.x,bb.y);ctx.moveTo(-23,-29);ctx.lineTo(-4,-20);ctx.lineTo(front.x-5,front.y-3);ctx.stroke();
    // Helmet and goggles
    ctx.fillStyle="#d7ff38";ctx.beginPath();ctx.ellipse(-16,-53,10,8,-.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#1a211c";ctx.beginPath();ctx.ellipse(-8,-52,7,3,.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#e8eee7";ctx.fillRect(-8,-54,5,3);
    ctx.restore();
  }
  function drawParticles() {
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x-cameraX,p.y,p.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
  }
  function drawWorld() {
    drawSky(elapsed); drawGround();
    // Jump markers and small rocks
    for(let i=0;i<22;i++){
      const wx=Math.floor((cameraX-200)/180)*180+i*180+90;const sx=wx-cameraX;
      if(sx<0||sx>W)continue;
      const gy=groundY(wx);ctx.fillStyle="#493d2c";ctx.beginPath();ctx.ellipse(sx,gy-2,7,3,0,0,Math.PI*2);ctx.fill();
    }
    drawParticles();drawBike();
    // Speed streaks at higher velocity
    if(bike.vx>300){ctx.globalAlpha=Math.min(.22,(bike.vx-300)/900);ctx.strokeStyle="#fff";ctx.lineWidth=1;for(let i=0;i<8;i++){const y=H*.45+i*22;ctx.beginPath();ctx.moveTo(W-100-(i*31),y);ctx.lineTo(W-50-(i*31),y);ctx.stroke();}ctx.globalAlpha=1;}
    // Subtle vignette
    const v=ctx.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.8);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,.24)");ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
  }
  function loop(now) {
    if(!running||paused)return;
    const dt=Math.min(.032,(now-lastTime)/1000||.016);lastTime=now;
    update(dt);drawWorld();
    requestAnimationFrame(loop);
  }
  // Keep the background animated behind the intro screen.
  function idleLoop(now){ if(!running){elapsed=now/1000;cameraX=0;drawWorld();requestAnimationFrame(idleLoop);} }
  resetBike(true); drawWorld(); requestAnimationFrame(idleLoop);
})();
