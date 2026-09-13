// Research interests as a drifting force-directed graph.
// Reads the <ul class="interests"> list for content, so the list stays the
// single source of truth and the no-JS / screen-reader fallback.
(function () {
  var list = document.querySelector('.interests');
  var wrap = document.getElementById('interests-graph');
  if (!list || !wrap) return;

  // Short on-canvas labels; the full wording shows on hover.
  var SHORT = {
    'Machine learning for perception': 'ML for perception',
    'Inverse problems and optimization': 'Inverse problems',
    'Applications': 'Applications',
    'Image processing and computer vision': 'Computer vision',
    'Multimodal LLMs': 'Multimodal LLMs',
    'World models, real2sim2real transfer, physical AI': 'World models',
    'Reinforcement learning for robot control and human modeling': 'Reinforcement learning',
    'Generative models': 'Generative models',
    'Non-smooth and non-convex optimization, proximal algorithms': 'Proximal algorithms',
    'Unrolled and physics-consistent deep architectures': 'Unrolled networks',
    'Mumford–Shah models, joint restoration and edge detection': 'Mumford–Shah',
    'Robotics and embodied agents': 'Robotics',
    'Computer-aided design, 3D reconstruction and scene understanding': '3D reconstruction',
    'Tomographic imaging, 3D CT reconstruction': 'Tomography / CT',
    'Large-scale physics-experiment and scientific imaging': 'Scientific imaging'
  };

  // Cross-links between topics in different groups.
  var BRIDGES = [
    ['Computer vision', 'Mumford–Shah'],
    ['Computer vision', '3D reconstruction'],
    ['Unrolled networks', 'Tomography / CT'],
    ['Proximal algorithms', 'Tomography / CT'],
    ['Unrolled networks', 'Generative models'],
    ['World models', 'Robotics'],
    ['Reinforcement learning', 'Robotics'],
    ['Multimodal LLMs', 'Robotics'],
    ['Multi-agent systems', 'Multimodal LLMs'],
    ['Multi-agent systems', 'Reinforcement learning'],
    ['Multi-agent systems', 'Robotics'],
    ['Generative models', '3D reconstruction'],
    ['Tomography / CT', 'Scientific imaging'],
    ['Mumford–Shah', 'Proximal algorithms']
  ];

  var nodes = [], edges = [], byLabel = {};
  function addNode(full, group, hub) {
    var n = {
      full: full, label: SHORT[full] || full, group: group, hub: hub,
      x: 0, y: 0, vx: 0, vy: 0, r: hub ? 9 : 5, fixed: false,
      phase: Math.random() * Math.PI * 2
    };
    nodes.push(n);
    byLabel[n.label] = n;
    return n;
  }

  Array.prototype.forEach.call(list.children, function (li, g) {
    var hubText = li.firstChild.textContent.trim();
    var hub = addNode(hubText, g, true);
    li.querySelectorAll('li').forEach(function (sub) {
      var leaf = addNode(sub.textContent.trim(), g, false);
      edges.push({ a: hub, b: leaf, bridge: false, len: 70 });
    });
  });
  // Hubs loosely tied together so the groups form one constellation.
  var hubs = nodes.filter(function (n) { return n.hub; });
  for (var i = 0; i < hubs.length; i++) {
    edges.push({ a: hubs[i], b: hubs[(i + 1) % hubs.length], bridge: true, len: 190 });
  }
  BRIDGES.forEach(function (p) {
    if (byLabel[p[0]] && byLabel[p[1]]) {
      edges.push({ a: byLabel[p[0]], b: byLabel[p[1]], bridge: true, len: 150 });
    }
  });
  nodes.forEach(function (n) {
    n.neighbors = edges.filter(function (e) { return e.a === n || e.b === n; })
      .map(function (e) { return e.a === n ? e.b : e.a; });
  });

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var tip = document.createElement('div');
  tip.className = 'ig-tip';
  tip.hidden = true;
  wrap.appendChild(canvas);
  wrap.appendChild(tip);
  // Swap before measuring: a hidden wrapper reports zero width.
  list.classList.add('visually-hidden');
  wrap.hidden = false;

  var W = 0, H = 0, dpr = 1;
  function resize() {
    W = wrap.clientWidth;
    H = W < 520 ? 380 : 440;
    dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }
  resize();

  // Seed groups around a circle so the layout settles quickly.
  nodes.forEach(function (n) {
    var a = (n.group / hubs.length) * Math.PI * 2 - Math.PI / 2;
    var spread = n.hub ? 90 : 150;
    n.x = W / 2 + Math.cos(a) * spread + (Math.random() - 0.5) * 60;
    n.y = H / 2 + Math.sin(a) * spread * 0.7 + (Math.random() - 0.5) * 60;
  });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t = 0;

  function step() {
    t += 0.01;
    var compact = W < 520 ? 0.7 : 1;
    // Repulsion
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d2 = dx * dx + dy * dy + 0.01;
        var f = 2600 * compact / d2;
        var d = Math.sqrt(d2);
        var fx = dx / d * f, fy = dy / d * f;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        // Keep label boxes (text sits just below each dot) from overlapping.
        var ox = (a.halfW || 30) + (b.halfW || 30) + 10 - Math.abs(dx);
        var oy = 26 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy * 3) {
            var sx = (dx < 0 ? -1 : 1) * ox * 0.04;
            a.vx -= sx; b.vx += sx;
          } else {
            var sy = (dy < 0 ? -1 : 1) * oy * 0.08;
            a.vy -= sy; b.vy += sy;
          }
        }
      }
    }
    // Springs
    edges.forEach(function (e) {
      var dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      var d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      var k = e.bridge ? 0.004 : 0.02;
      var f = (d - e.len * compact) * k;
      var fx = dx / d * f, fy = dy / d * f;
      e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
    });
    nodes.forEach(function (n) {
      // Pull toward centre (stretched horizontally for the wide section)
      n.vx += (W / 2 - n.x) * (compact < 1 ? 0.0012 : 0.0006);
      n.vy += (H / 2 - n.y) * 0.003;
      // Slow orbital drift
      if (!reduceMotion) {
        n.vx += Math.cos(t + n.phase) * 0.025;
        n.vy += Math.sin(t * 0.8 + n.phase) * 0.025;
      }
      if (n.fixed) { n.vx = 0; n.vy = 0; return; }
      n.vx *= 0.86; n.vy *= 0.86;
      n.x += n.vx; n.y += n.vy;
      var m = 24, mx = Math.max(m, (n.halfW || 0) + 4);
      n.x = Math.max(mx, Math.min(W - mx, n.x));
      n.y = Math.max(m, Math.min(H - m, n.y));
    });
  }

  function palette() {
    var s = getComputedStyle(document.documentElement);
    var dark = document.documentElement.classList.contains('dark');
    return {
      dark: dark,
      bg: s.getPropertyValue('--bg').trim(),
      text: s.getPropertyValue('--text').trim(),
      muted: s.getPropertyValue('--text-muted').trim(),
      border: s.getPropertyValue('--border').trim(),
      // Sapphire, Ballet Slipper, Pistachio (Sage on the dark ground)
      groups: dark ? ['#72B0AB', '#FE9179', '#CFB97E'] : ['#72B0AB', '#FE9179', '#B89D47']
    };
  }

  // Background stars, fixed per session.
  var stars = [];
  for (var s = 0; s < 70; s++) {
    stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.2, p: Math.random() * 6 });
  }

  var hover = null, drag = null;

  function draw() {
    var P = palette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    stars.forEach(function (st) {
      var tw = reduceMotion ? 0.5 : 0.35 + 0.35 * Math.sin(t * 2 + st.p);
      ctx.globalAlpha = (P.dark ? 0.6 : 0.35) * tw;
      ctx.fillStyle = P.muted;
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
      ctx.fill();
    });

    var focus = hover || drag;
    function lit(n) { return !focus || n === focus || focus.neighbors.indexOf(n) >= 0; }

    edges.forEach(function (e) {
      var on = focus && (e.a === focus || e.b === focus);
      ctx.globalAlpha = focus ? (on ? 0.9 : 0.08) : (e.bridge ? 0.35 : 0.6);
      ctx.strokeStyle = on ? P.groups[focus.group] : (e.bridge ? P.muted : P.groups[e.a.group]);
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.setLineDash(e.bridge ? [3, 4] : []);
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    nodes.forEach(function (n) {
      var on = lit(n);
      var c = P.groups[n.group];
      ctx.globalAlpha = on ? 1 : 0.18;
      if (n.hub || n === focus) {
        var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.2);
        g.addColorStop(0, c);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = on ? (P.dark ? 0.45 : 0.25) : 0.05;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = on ? 1 : 0.18;
      }
      ctx.fillStyle = n.hub ? c : P.bg;
      ctx.strokeStyle = c;
      ctx.lineWidth = n.hub ? 0 : 1.8;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n === focus ? n.r + 2 : n.r, 0, Math.PI * 2);
      ctx.fill();
      if (!n.hub) ctx.stroke();

      ctx.font = (n.hub ? '600 13px ' : '400 12px ') + "'Styrene B', 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      n.halfW = ctx.measureText(n.label).width / 2;
      // Background-coloured halo keeps labels legible over crossing edges.
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = P.bg;
      ctx.strokeText(n.label, n.x, n.y + n.r + 5);
      ctx.fillStyle = n.hub ? P.text : P.muted;
      ctx.fillText(n.label, n.x, n.y + n.r + 5);
    });
    ctx.globalAlpha = 1;
  }

  function pointer(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function hit(p) {
    var best = null, bd = 18 * 18;
    nodes.forEach(function (n) {
      var d = (n.x - p.x) * (n.x - p.x) + (n.y - p.y) * (n.y - p.y);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }
  function showTip(n) {
    if (!n) { tip.hidden = true; return; }
    tip.textContent = n.full;
    tip.hidden = false;
    var x = Math.min(Math.max(n.x, 90), W - 90);
    tip.style.left = x + 'px';
    tip.style.top = (n.y - n.r - 10) + 'px';
  }

  canvas.addEventListener('pointerdown', function (ev) {
    var n = hit(pointer(ev));
    if (!n) { hover = null; showTip(null); return; }
    drag = n; n.fixed = true;
    canvas.setPointerCapture(ev.pointerId);
    showTip(n);
  });
  canvas.addEventListener('pointermove', function (ev) {
    var p = pointer(ev);
    if (drag) {
      drag.x = Math.max(10, Math.min(W - 10, p.x));
      drag.y = Math.max(10, Math.min(H - 10, p.y));
      showTip(drag);
      return;
    }
    if (ev.pointerType !== 'mouse') return;
    hover = hit(p);
    canvas.style.cursor = hover ? 'grab' : 'default';
    showTip(hover);
  });
  function release() {
    if (!drag) return;
    drag.fixed = false;
    hover = drag;
    drag = null;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', function (ev) {
    if (drag || ev.pointerType !== 'mouse') return;
    hover = null; showTip(null);
  });

  // Only animate while on screen — the page already runs a fluid sim.
  var visible = true, running = false;
  function loop() {
    if (!visible) { running = false; return; }
    step();
    draw();
    if (hover || drag) showTip(hover || drag);
    requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(wrap);
  }
  draw(); // measures label widths for the collision pass
  for (var k = 0; k < 300; k++) step(); // pre-settle
  start();

  var lastW = W;
  window.addEventListener('resize', function () {
    resize();
    var sx = W / lastW;
    nodes.forEach(function (n) { n.x *= sx; n.y = Math.min(n.y, H - 24); });
    lastW = W;
    if (!running) draw();
  });
})();
