/*
 * Model-based 1D barcode decoder ("decode by synthesis"): EAN-13 / UPC-A,
 * EAN-8, UPC-E (+ EAN-2 / EAN-5 add-ons), Code 128 / GS1-128 and Code 93.
 * Port of the Python prototype in
 * prototypes/barcode-decoder/decoder.py (see there for the design notes).
 *
 * Input: grayscale image {data: Float32Array (0..1), width, height} and a
 * rough user bounding box [x0, y0, x1, y1] with bars roughly vertical.
 *
 * 1. Sampling frame: the barcode region is where across-bar gradients are
 *    strong; its major axis is the scan direction and the structure tensor of
 *    the left / right halves gives the (converging) bar directions.
 * 2. Resample the frame and average along the bars in several bands
 *    -> 1D "darkness" profiles (in both scan directions).
 * 3. For each symbology, find the barcode extent, local module widths at both
 *    ends and fit a module grid (1D homography = perspective) by minimizing the
 *    residual between the profile and blurred templates of the best symbol in
 *    every slot. Blur and ink spread are model parameters too.
 * 4. Decode with a DP that finds the minimum-residual symbol sequence that
 *    satisfies the checksum (and EAN parity), then apply acceptance tests.
 */
(function () {
  'use strict';

  const R = 4; // samples per module in model space

  // ------------------------------------------------------------ symbologies

  const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011',
    '0110001', '0101111', '0111011', '0110111', '0001011'];
  const EAN_R = EAN_L.map(p => p.split('').map(c => c === '0' ? '1' : '0').join(''));
  const EAN_G = EAN_R.map(p => p.split('').reverse().join(''));
  const EAN_PARITY = ['000000', '001011', '001101', '001110', '010011',
    '011001', '011100', '010101', '010110', '011010'];
  const complement = p => p.split('').map(c => c === '0' ? '1' : '0').join('');

  // UPC-E: parity of the 6 digits (1 = G) by check digit, for number system 0
  // (number system 1 uses the complement)
  const UPCE_PARITY = ['111000', '110100', '110010', '110001', '101100',
    '100110', '100011', '101010', '101001', '100101'];
  const UPCE_PARITY_TO_NS_CHECK = new Map();
  UPCE_PARITY.forEach((p, c) => {
    UPCE_PARITY_TO_NS_CHECK.set(parseInt(p, 2), [0, c]);
    UPCE_PARITY_TO_NS_CHECK.set(parseInt(complement(p), 2), [1, c]);
  });
  // EAN-5 add-on: parity by checksum
  const EAN5_PARITY = ['11000', '10100', '10010', '10001', '01100',
    '00110', '00011', '01010', '01001', '00101'];

  const CODE128_WIDTHS = (
    '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
    '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
    '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
    '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
    '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
    '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
    '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
    '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
    '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
    '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
    '114131 311141 411131 211412 211214 211232 2331112').split(' ');

  function widthsToModules(widths) {
    let s = '', bar = true;
    for (const w of widths) {
      s += (bar ? '1' : '0').repeat(+w);
      bar = !bar;
    }
    return s;
  }

  const CODE128_PATTERNS = CODE128_WIDTHS.map(widthsToModules);
  const C128_STARTS = [103, 104, 105].map(v => CODE128_PATTERNS[v]);
  const C128_DATA = CODE128_PATTERNS.slice(0, 103);
  const C128_STOP_PATTERN = CODE128_PATTERNS[106];
  const GS = '\x1d'; // FNC1 is represented as the ASCII group separator in decoded text

  function code128ValuesToText(values) {
    // values: start, data... (no checksum). Returns null if invalid.
    const sets = { 103: 'A', 104: 'B', 105: 'C' };
    if (!(values[0] in sets)) return null;
    let cur = sets[values[0]];
    let shift = null;
    let out = '';
    for (const v of values.slice(1)) {
      const cs = shift || cur;
      shift = null;
      if (cs === 'C') {
        if (v < 100) out += String(v).padStart(2, '0');
        else if (v === 100) cur = 'B';
        else if (v === 101) cur = 'A';
        else if (v === 102) out += GS; // FNC1
        else return null;
        continue;
      }
      if (v < 96) {
        if (cs === 'A') out += String.fromCharCode(v < 64 ? v + 32 : v - 64);
        else out += String.fromCharCode(v + 32);
      } else if (v === 98) {
        shift = cs === 'A' ? 'B' : 'A';
      } else if (v === 99) {
        cur = 'C';
      } else if (v === 100) {
        if (cs === 'A') cur = 'B'; // in B: FNC4, ignored
      } else if (v === 101) {
        if (cs === 'B') cur = 'A'; // in A: FNC4, ignored
      } else if (v === 102) {
        out += GS; // FNC1
      } else if (v === 96 || v === 97) {
        // FNC3, FNC2
      } else {
        return null;
      }
    }
    return out;
  }

  // GS1-128: total length (AI + data) of the AIs with a predefined length, by
  // the first two digits. Other AIs have variable length, terminated by FNC1
  const GS1_FIXED = {
    '00': 20, '01': 16, '02': 16, '03': 16, '04': 18, '11': 8, '12': 8, '13': 8, '14': 8,
    '15': 8, '16': 8, '17': 8, '18': 8, '19': 8, '20': 4, '31': 10, '32': 10, '33': 10,
    '34': 10, '35': 10, '36': 10, '41': 16,
  };

  function gs1AiLength(p) {
    // number of digits in an AI, by its first two digits
    if (['23', '24', '25', '40', '41', '42', '71'].includes(p)) return 3;
    if (['31', '32', '33', '34', '35', '36', '39', '43'].includes(p) || '78'.includes(p[0])) return 4;
    return 2;
  }

  function gs1ToText(raw) {
    // GS1 element string (leading FNC1 removed) -> "(01)12345678901231(10)ABC" or null
    const isDigits = s => /^[0-9]+$/.test(s);
    let out = '', i = 0;
    while (i < raw.length) {
      const p = raw.slice(i, i + 2);
      if (p.length < 2 || !isDigits(p)) return null;
      const n = gs1AiLength(p);
      const ai = raw.slice(i, i + n);
      if (ai.length < n || !isDigits(ai)) return null;
      let j;
      if (p in GS1_FIXED) {
        j = i + GS1_FIXED[p];
        if (j > raw.length || raw.slice(i + n, j).includes(GS)) return null;
      } else {
        j = raw.indexOf(GS, i + n);
        if (j < 0) j = raw.length;
      }
      out += '(' + ai + ')' + raw.slice(i + n, j);
      i = j + (j < raw.length && raw[j] === GS ? 1 : 0);
    }
    return out || null;
  }

  // Code 93: 43 characters + 4 shift characters (43..46)
  const CODE93_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
  const CODE93_PATTERNS = (
    '131112 111213 111312 111411 121113 121212 121311 111114 131211 141111 ' +
    '211113 211212 211311 221112 221211 231111 112113 112212 112311 122112 ' +
    '132111 111123 111222 111321 121122 131121 212112 212211 211122 211221 ' +
    '221121 222111 112122 112221 122121 123111 121131 311112 311211 321111 ' +
    '112131 113121 211131 121221 312111 311121 122211').split(' ').map(widthsToModules);
  const CODE93_START = widthsToModules('111141');
  const CODE93_STOP = CODE93_START + '1'; // termination bar

  function code93ValuesToText(values) {
    // data values (no checks) -> text with the full ASCII shifts decoded, or null
    let out = '';
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v < 43) { out += CODE93_CHARS[v]; continue; }
      const n = values[i + 1];
      if (n === undefined || n < 10 || n > 35) return null;
      i++;
      const c = CODE93_CHARS[n], o = n - 10; // A = 0
      if (v === 46) out += String.fromCharCode(97 + o); // (+): lower case
      else if (v === 43) out += String.fromCharCode(1 + o); // ($): control
      else if (v === 45) { // (/)
        if (c <= 'O') out += String.fromCharCode(33 + o);
        else if (c === 'Z') out += ':';
        else return null;
      } else { // (%)
        if (c <= 'E') out += String.fromCharCode(27 + o);
        else if (c <= 'J') out += String.fromCharCode(59 + o - 5);
        else if (c <= 'O') out += String.fromCharCode(91 + o - 10);
        else if (c <= 'T') out += String.fromCharCode(123 + o - 15);
        else out += { U: '\0', V: '@', W: '`' }[c] || '\x7f';
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ utils

  function erf(x) {
    // Abramowitz & Stegun 7.1.26, |error| < 1.5e-7
    const s = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  const normCdf = x => 0.5 * (1 + erf(x / Math.SQRT2));
  const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

  function bilinear(img, x, y) {
    const w = img.width, h = img.height, d = img.data;
    x = clamp(x, 0, w - 1.001);
    y = clamp(y, 0, h - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const i = y0 * w + x0;
    return d[i] * (1 - fx) * (1 - fy) + d[i + 1] * fx * (1 - fy) +
      d[i + w] * (1 - fx) * fy + d[i + w + 1] * fx * fy;
  }

  function interp1(p, x) {
    x = clamp(x, 0, p.length - 1.001);
    const i = Math.floor(x), f = x - i;
    return p[i] * (1 - f) + p[i + 1] * f;
  }

  function boxSmooth(p, width) {
    // same alignment as numpy.convolve(..., mode="same") with edge padding
    const k = Math.round(width);
    if (k <= 1) return p;
    const n = p.length, out = new Float64Array(n);
    const lo = Math.floor(k / 2);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = i - lo; j < i - lo + k; j++) s += p[clamp(j, 0, n - 1)];
      out[i] = s / k;
    }
    return out;
  }

  function percentile(arr, q) {
    // linear interpolation, like numpy.percentile
    const s = Float64Array.from(arr).sort();
    const idx = q / 100 * (s.length - 1);
    const i = Math.floor(idx), f = idx - i;
    return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i];
  }

  // ------------------------------------------------------------ sampling frame

  function tensorAngle(gx, gy, idx) {
    // dominant gradient direction (radians); 0 = vertical bars
    let sxx = 0, syy = 0, sxy = 0;
    const n = idx ? idx.length : gx.length;
    for (let j = 0; j < n; j++) {
      const i = idx ? idx[j] : j;
      sxx += gx[i] * gx[i]; syy += gy[i] * gy[i]; sxy += gx[i] * gy[i];
    }
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }

  function box2d(a, w, h, r) {
    // box filter with radius r (edge padded), via an integral image
    const k = 2 * r + 1, pw = w + 2 * (r + 1), ph = h + 2 * (r + 1);
    const c = new Float64Array((pw + 1) * (ph + 1));
    for (let y = 0; y < ph; y++) {
      const sy = clamp(y - r - 1, 0, h - 1);
      let row = 0;
      for (let x = 0; x < pw; x++) {
        row += a[sy * w + clamp(x - r - 1, 0, w - 1)];
        c[(y + 1) * (pw + 1) + x + 1] = c[y * (pw + 1) + x + 1] + row;
      }
    }
    // c[(Y + 1) * (pw + 1) + X + 1] = sum of padded[0..Y][0..X]; output (x, y)
    // is the sum of padded rows y + 1 .. y + k, columns x + 1 .. x + k
    const out = new Float64Array(w * h);
    const C = (Y, X) => c[Y * (pw + 1) + X];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        out[y * w + x] = (C(y + k + 1, x + k + 1) - C(y + 1, x + k + 1) -
          C(y + k + 1, x + 1) + C(y + 1, x + 1)) / (k * k);
      }
    }
    return out;
  }

  const barDir = theta => [-Math.sin(theta), Math.cos(theta)];

  function findFrame(img, bbox) {
    const [x0, y0, x1, y1] = bbox;
    const w = x1 - x0, h = y1 - y0;
    const crop = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) crop[y * w + x] = img.data[(y + y0) * img.width + x + x0];
    }
    const gx = new Float64Array(w * h), gy = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x > 0 && x < w - 1) gx[i] = crop[i + 1] - crop[i - 1];
        if (y > 0 && y < h - 1) gy[i] = crop[i + w] - crop[i - w];
      }
    }
    const theta0 = clamp(tensorAngle(gx, gy), -0.6, 0.6);
    let a = [Math.cos(theta0), Math.sin(theta0)]; // across bars
    const fallback = {
      c: [(x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2], A: a,
      B0: barDir(theta0), B1: barDir(theta0),
      W: Math.floor(w * 1.15) + 1, H: Math.floor(h / Math.max(Math.cos(theta0), 0.8)),
    };

    const proj = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) proj[i] = (gx[i] * a[0] + gy[i] * a[1]) ** 2;
    const e = box2d(proj, w, h, Math.max(2, Math.floor(Math.min(h, w) / 15)));
    const thr = 0.25 * percentile(e, 95);
    const idx = [];
    for (let i = 0; i < w * h; i++) if (e[i] > thr) idx.push(i);
    if (idx.length < 50) return { frame: fallback, theta: theta0 };

    // the bar direction from the barcode region only (no label edges etc.)
    const theta = clamp(tensorAngle(gx, gy, idx), -0.6, 0.6);
    a = [Math.cos(theta), Math.sin(theta)];
    const B = barDir(theta);
    const n = idx.length;
    const px = new Float64Array(n), py = new Float64Array(n);
    let mx = 0, my = 0;
    for (let j = 0; j < n; j++) {
      px[j] = (idx[j] % w) + x0; py[j] = Math.floor(idx[j] / w) + y0;
      mx += px[j]; my += py[j];
    }
    mx /= n; my /= n;
    // major axis of the region (principal component)
    let cxx = 0, cyy = 0, cxy = 0;
    for (let j = 0; j < n; j++) {
      const dx = px[j] - mx, dy = py[j] - my;
      cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
    }
    const phi = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    let A = [Math.cos(phi), Math.sin(phi)];
    if (A[0] * a[0] + A[1] * a[1] < 0) A = [-A[0], -A[1]];
    if (A[0] * a[0] + A[1] * a[1] < Math.cos(40 * Math.PI / 180)) A = a; // implausible shear

    // region extent in the (A, B) frame
    const det = A[0] * B[1] - B[0] * A[1];
    const us = new Float64Array(n), vs = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const dx = px[j] - mx, dy = py[j] - my;
      us[j] = (B[1] * dx - B[0] * dy) / det;
      vs[j] = (-A[1] * dx + A[0] * dy) / det;
    }
    const ulo = percentile(us, 1), uhi = percentile(us, 99);
    const vlo = percentile(vs, 2), vhi = percentile(vs, 98);
    const span = uhi - ulo;
    if (span < 0.3 * w) return { frame: fallback, theta: theta0 };
    const cu = (ulo + uhi) / 2, cv = (vlo + vhi) / 2;
    const c = [mx + A[0] * cu + B[0] * cv, my + A[1] * cu + B[1] * cv];
    const W = Math.floor(span * 1.3 + 8); // leave room for the quiet zones

    // converging bars: bar angle at the centers of the left and right halves,
    // linearly inter/extrapolated to the patch ends
    const umed = percentile(us, 50);
    const halves = [[], []];
    for (let j = 0; j < n; j++) halves[us[j] < umed ? 0 : 1].push(j);
    const th = halves.map(hs => tensorAngle(gx, gy, hs.map(j => idx[j])));
    const uc = halves.map(hs => hs.reduce((s, j) => s + us[j], 0) / hs.length - cu + (W - 1) / 2);
    const dth = clamp(th[1] - th[0], -0.35, 0.35);
    const thAt = u => theta + dth * ((u - uc[0]) / Math.max(uc[1] - uc[0], 1) - 0.5);
    return {
      frame: { c, A, B0: barDir(thAt(0)), B1: barDir(thAt(W - 1)), W, H: Math.max(Math.floor(vhi - vlo), 3) },
      theta: theta0,
    };
  }

  function rectToImage(f, u, v) {
    // bar direction varies linearly along the axis (bars converge in perspective)
    const t = u / Math.max(f.W - 1, 1);
    const bx = f.B0[0] + t * (f.B1[0] - f.B0[0]);
    const by = f.B0[1] + t * (f.B1[1] - f.B0[1]);
    const uu = u - (f.W - 1) / 2, vv = v - (f.H - 1) / 2;
    return [f.c[0] + uu * f.A[0] + vv * bx, f.c[1] + uu * f.A[1] + vv * by];
  }

  function rectify(img, f) {
    const out = new Float32Array(f.W * f.H);
    for (let v = 0; v < f.H; v++) {
      for (let u = 0; u < f.W; u++) {
        const [x, y] = rectToImage(f, u, v);
        out[v * f.W + u] = bilinear(img, x, y);
      }
    }
    return out;
  }

  const BANDS = [[0, 1], [0.2, 0.8], [0, 0.5], [0.5, 1], [0.25, 0.75],
    [0, 0.33], [0.33, 0.67], [0.67, 1], [0.1, 0.4], [0.6, 0.9]];

  function getProfiles(img, bbox) {
    const { frame, theta } = findFrame(img, bbox);
    const { W, H } = frame;
    const rect = rectify(img, frame);
    const profiles = [], bandRows = [];
    for (const [f0, f1] of BANDS) {
      const r0 = Math.floor(f0 * H), r1 = Math.max(Math.floor(f1 * H), r0 + 1);
      const p = new Float64Array(W);
      for (let v = r0; v < r1; v++) for (let u = 0; u < W; u++) p[u] += rect[v * W + u];
      for (let u = 0; u < W; u++) p[u] = 1 - p[u] / (r1 - r0); // darkness
      profiles.push(p);
      bandRows.push([r0, r1]);
    }
    const B = [(frame.B0[0] + frame.B1[0]) / 2, (frame.B0[1] + frame.B1[1]) / 2];
    const info = Object.assign({}, frame, {
      angle: Math.atan2(-B[0], B[1]), angleRaw: theta,
      axisAngle: Math.atan2(frame.A[1], frame.A[0]), rect, bandRows,
    });
    return { profiles, info };
  }

  // ---------------------------------------------------------------- layouts

  function slot(start, patterns, ctx) {
    return { start, n: patterns[0].length, patterns, ctx, key: patterns.join(',') + '|' + ctx };
  }

  function ean13Layout() {
    const slots = [slot(0, ['101'], '00')];
    for (let i = 0; i < 6; i++) slots.push(slot(3 + 7 * i, EAN_L.concat(EAN_G), '10'));
    slots.push(slot(45, ['01010'], '11'));
    for (let i = 0; i < 6; i++) slots.push(slot(50 + 7 * i, EAN_R, '01'));
    slots.push(slot(92, ['101'], '00'));
    return { slots, U: 95 };
  }

  function ean8Layout() {
    const slots = [slot(0, ['101'], '00')];
    for (let i = 0; i < 4; i++) slots.push(slot(3 + 7 * i, EAN_L, '10'));
    slots.push(slot(31, ['01010'], '11'));
    for (let i = 0; i < 4; i++) slots.push(slot(36 + 7 * i, EAN_R, '01'));
    slots.push(slot(64, ['101'], '00'));
    return { slots, U: 67 };
  }

  function upceLayout() {
    const slots = [slot(0, ['101'], '00')];
    for (let i = 0; i < 6; i++) slots.push(slot(3 + 7 * i, EAN_L.concat(EAN_G), '10'));
    slots.push(slot(45, ['010101'], '10'));
    return { slots, U: 51 };
  }

  function addonLayout(n) {
    // EAN-2 / EAN-5 add-on: start 1011, digits separated by 01
    const slots = [slot(0, ['1011'], '00')];
    for (let i = 0; i < n; i++) {
      if (i > 0) slots.push(slot(2 + 9 * i, ['01'], '10'));
      slots.push(slot(4 + 9 * i, EAN_L.concat(EAN_G), '10'));
    }
    return { slots, U: 9 * n + 2 };
  }

  function code128Layout(m) {
    // m = number of 11-module symbols (start + data + checksum)
    const slots = [slot(0, C128_STARTS, '01')];
    for (let i = 1; i < m; i++) slots.push(slot(11 * i, C128_DATA, '01'));
    slots.push(slot(11 * m, [C128_STOP_PATTERN], '00'));
    return { slots, U: 11 * m + 13 };
  }

  function code93Layout(m) {
    // m = number of 9-module symbols (start + data + 2 checks)
    const slots = [slot(0, [CODE93_START], '01')];
    for (let i = 1; i < m; i++) slots.push(slot(9 * i, CODE93_PATTERNS, '01'));
    slots.push(slot(9 * m, [CODE93_STOP], '00'));
    return { slots, U: 9 * m + 10 };
  }

  // fixed-length symbologies: layout and start / stop patterns (+ the
  // adjacent digit) with their widths
  const FIXED = {
    ean13: {
      layout: ean13Layout, nl: 10, nr: 10,
      ends: [[slot(0, ['101'], '00'), slot(3, EAN_L.concat(EAN_G), '10')],
        [slot(0, EAN_R, '01'), slot(7, ['101'], '00')]],
    },
    ean8: {
      layout: ean8Layout, nl: 10, nr: 10,
      ends: [[slot(0, ['101'], '00'), slot(3, EAN_L, '10')],
        [slot(0, EAN_R, '01'), slot(7, ['101'], '00')]],
    },
    upce: {
      layout: upceLayout, nl: 10, nr: 13,
      ends: [[slot(0, ['101'], '00'), slot(3, EAN_L.concat(EAN_G), '10')],
        [slot(0, EAN_L.concat(EAN_G), '10'), slot(7, ['010101'], '10')]],
    },
  };
  // variable-length symbologies: symbol width n, start / stop patterns with
  // their widths, minimum number of symbols
  const VARIABLE = {
    code128: {
      layout: code128Layout, n: 11, nl: 11, nr: 13, mMin: 3,
      ends: [[slot(0, C128_STARTS, '01')], [slot(0, [C128_STOP_PATTERN], '00')]],
    },
    code93: {
      layout: code93Layout, n: 9, nl: 9, nr: 10, mMin: 4,
      ends: [[slot(0, [CODE93_START], '01')], [slot(0, [CODE93_STOP], '00')]],
    },
  };
  const KINDS = ['ean13', 'ean8', 'upce', 'code128', 'code93'];

  // -------------------------------------------------------------- templates

  let templateCache = new Map();

  function detrend(q) {
    // project off {constant, linear ramp}, so that a smooth brightness
    // gradient cannot be "explained" by blurred templates
    const L = q.length, mid = (L - 1) / 2;
    let s0 = 0, s1 = 0, n1 = 0;
    for (let k = 0; k < L; k++) { s0 += q[k]; s1 += q[k] * (k - mid); n1 += (k - mid) ** 2; }
    const m = s0 / L, b = s1 / n1;
    for (let k = 0; k < L; k++) q[k] -= m + b * (k - mid);
    return q;
  }

  function renderTemplates(s, sigma, spread) {
    // blurred templates sampled at u = -0.5 + (k + 0.5) / R, k < (n + 1) R
    const key = s.key + '|' + sigma.toFixed(4) + '|' + spread.toFixed(4);
    let res = templateCache.get(key);
    if (res) return res;
    const L = (s.n + 1) * R, C = s.patterns.length;
    const T = new Float64Array(C * L), Stt = new Float64Array(C);
    // bar edges are at integer module positions -/+ spread / 2, so a bar
    // [a, b) contributes rise[k - R a] - fall[k - R b] (a, b integers) with
    // rise[m] = Phi(((m + 0.5) / R - 0.5 + spread / 2) / sigma) and fall
    // the same with -spread / 2. Tabulate m in [-M, M)
    const M = (s.n + 6) * R;
    const rise = new Float64Array(2 * M), fall = new Float64Array(2 * M);
    for (let m = -M; m < M; m++) {
      rise[m + M] = normCdf(((m + 0.5) / R - 0.5 + spread / 2) / sigma);
      fall[m + M] = normCdf(((m + 0.5) / R - 0.5 - spread / 2) / sigma);
    }
    for (let ci = 0; ci < C; ci++) {
      const str = s.ctx[0] + s.patterns[ci] + s.ctx[1];
      const t = new Float64Array(L);
      let i = 0;
      while (i < str.length) {
        if (str[i] !== '1') { i++; continue; }
        let j = i;
        while (j < str.length && str[j] === '1') j++;
        let a = i - 1, b = j - 1;
        // context runs: assume they continue beyond the window
        if (i === 0) a -= 2;
        if (j === str.length) b += 2;
        for (let k = 0; k < L; k++) t[k] += rise[k - R * a + M] - fall[k - R * b + M];
        i = j;
      }
      detrend(t);
      let ss = 0;
      for (let k = 0; k < L; k++) { T[ci * L + k] = t[k]; ss += t[k] * t[k]; }
      Stt[ci] = ss;
    }
    res = { T, Stt, L, C };
    templateCache.set(key, res);
    return res;
  }

  // ---------------------------------------------------------------- fitting

  const PARAMS = ['x0', 'x1', 'sigma', 'spread', 'persp'];

  class Model {
    constructor(profile, slots, U) {
      this.p = profile;
      this.slots = slots;
      this.U = U;
      this.smoothK = null;
      this.ps = null;
    }

    smoothed(w) {
      const k = w / R > 1.5 ? Math.round(w / R) : 1;
      if (k !== this.smoothK) {
        this.smoothK = k;
        this.ps = k > 1 ? boxSmooth(this.p, w / R) : this.p;
      }
      return this.ps;
    }

    /*
     * For every slot: SSE per candidate (if full) and Sqq. Module coordinate
     * u maps to profile position x by a 1D homography (perspective) that
     * fixes the ends: t = u / U, x = x0 + (x1 - x0) t (1 + persp) / (1 + persp t).
     * shift: move all slots by this many modules (for local alignment)
     */
    slotCosts(x0, x1, sigma, spread, persp, full, shift = 0) {
      const U = this.U, p = this.smoothed((x1 - x0) / U);
      const out = [];
      let sumMin = 0, sumSqq = 0;
      for (const s of this.slots) {
        const { T, Stt, L, C } = renderTemplates(s, sigma, spread);
        const q = new Float64Array(L);
        for (let k = 0; k < L; k++) {
          const t = (s.start - 0.5 + (k + 0.5) / R + shift) / U;
          q[k] = interp1(p, x0 + (x1 - x0) * t * (1 + persp) / (1 + persp * t));
        }
        detrend(q);
        let sqq = 0;
        for (let k = 0; k < L; k++) sqq += q[k] * q[k];
        const sse = full ? new Float64Array(C) : null;
        let best = Infinity;
        for (let ci = 0; ci < C; ci++) {
          let stq = 0;
          const off = ci * L;
          for (let k = 0; k < L; k++) stq += q[k] * T[off + k];
          const v = sqq - (stq > 0 ? stq * stq / Stt[ci] : 0);
          if (full) sse[ci] = v;
          if (v < best) best = v;
        }
        sumMin += best; sumSqq += sqq;
        if (full) out.push({ sse, sqq });
      }
      return full ? out : sumMin / Math.max(sumSqq, 1e-12);
    }

    cost(prm) {
      return this.slotCosts(prm.x0, prm.x1, prm.sigma, prm.spread, prm.persp, false);
    }

    fit(x0, x1, persp0, searchModules = 1.0) {
      return this.refine(this.coarse(x0, x1, persp0, searchModules));
    }

    coarse(x0, x1, persp0, searchModules = 1.0) {
      // returns {c, prm} of the best grid point
      const w0 = (x1 - x0) / this.U;
      // coarse grid over both ends and perspective. A perspective change dk
      // moves the middle of the code by ~U dk / 4 modules: step <= 0.5 module
      const kStep = 2.0 / this.U;
      const kRange = Math.max(0.06, 4 * kStep);
      const nk = Math.ceil((2 * kRange + 1e-9) / kStep);
      const no = Math.ceil((2 * searchModules + 1e-9) / 0.5);
      let best = null;
      for (let ik = 0; ik < nk; ik++) {
        const k = persp0 - kRange + ik * kStep;
        for (let ia = 0; ia < no; ia++) {
          for (let ib = 0; ib < no; ib++) {
            const prm = {
              x0: x0 + (-searchModules + 0.5 * ia) * w0, x1: x1 + (-searchModules + 0.5 * ib) * w0,
              sigma: 0.5, spread: 0.0, persp: k,
            };
            const c = this.cost(prm);
            if (best === null || c < best.c) best = { c, prm };
          }
        }
      }
      return best;
    }

    refine({ c, prm }) {
      const w0 = (prm.x1 - prm.x0) / this.U;
      const kStep = 2.0 / this.U;
      // coordinate descent with shrinking steps.
      // End-to-end module width ratio is (1 + persp)^2, up to ~2.5x
      const lim = { sigma: [0.2, 1.2], spread: [-0.5, 0.5], persp: [-0.37, 0.6] };
      for (const scale of [1.0, 0.4, 0.15]) {
        const steps = {
          x0: 0.25 * w0 * scale, x1: 0.25 * w0 * scale, sigma: 0.15 * scale,
          spread: 0.15 * scale, persp: kStep * scale,
        };
        let improved = true;
        while (improved) {
          improved = false;
          for (const name of PARAMS) {
            for (const sgn of [1, -1]) {
              for (;;) {
                const v = prm[name] + sgn * steps[name];
                if (lim[name] && !(lim[name][0] <= v && v <= lim[name][1])) break;
                const trial = Object.assign({}, prm, { [name]: v });
                const nc = this.cost(trial);
                if (nc < c - 1e-9) {
                  c = nc; prm = trial; improved = true;
                } else {
                  break;
                }
              }
            }
          }
        }
      }
      return Object.assign({ cost: c }, prm);
    }

    /*
     * Slot costs after local alignment: each slot may shift by up to 0.3
     * modules (paper curvature, lens distortion: not exactly a homography).
     * Per slot, the shift where the best candidate fits best is used for all
     * candidates.
     */
    alignedSlotCosts(fit) {
      const shifts = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
      const perShift = shifts.map(sh =>
        this.slotCosts(fit.x0, fit.x1, fit.sigma, fit.spread, fit.persp, true, sh));
      const sc = [], chosen = [];
      for (let i = 0; i < this.slots.length; i++) {
        let bj = 0, bv = Infinity;
        perShift.forEach((ps, j) => {
          const v = Math.min(...ps[i].sse) / Math.max(ps[i].sqq, 1e-12);
          if (v < bv) { bv = v; bj = j; }
        });
        sc.push(perShift[bj][i]);
        chosen.push(shifts[bj]);
      }
      return { sc, shifts: chosen };
    }

    gridX(fit, u) {
      const t = u / this.U;
      return fit.x0 + (fit.x1 - fit.x0) * t * (1 + fit.persp) / (1 + fit.persp * t);
    }
  }

  // ---------------------------------------------------------------- extent

  function splitAddon(peaks, U) {
    // With blur, an EAN-2 / EAN-5 add-on 7-12 modules right of the main code
    // can merge into the same edge cluster. If the cluster has a gap that is
    // too wide to be inside a code of U modules, and the part right of it is
    // add-on sized, returns the extent of the main code. Else null.
    let j = 0;
    for (let i = 1; i < peaks.length - 1; i++) {
      if (peaks[i + 1] - peaks[i] > peaks[j + 1] - peaks[j]) j = i;
    }
    if (j < 5) return null;
    const w = (peaks[j] - peaks[0]) / U;
    const right = peaks[peaks.length - 1] - peaks[j + 1];
    if (peaks[j + 1] - peaks[j] >= 5.5 * w && right >= 12 * w && right <= 60 * w) {
      return [peaks[0] + 0.5, peaks[j] + 0.5];
    }
    return null;
  }

  function findExtent(d) {
    // first & last edge of the main edge cluster (the barcode), and its edges
    const s = boxSmooth(d, 2);
    const g = new Float64Array(s.length - 1);
    for (let i = 0; i < g.length; i++) g[i] = s[i + 1] - s[i];
    const a = g.map(Math.abs);
    const thr = 0.2 * percentile(a, 99);
    const peaks = [];
    for (let i = 1; i < a.length - 1; i++) {
      if (a[i] > thr && a[i] >= a[i - 1] && a[i] >= a[i + 1]) peaks.push(i);
    }
    if (peaks.length < 6) return null;
    const gaps = [];
    for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
    // element widths are >= 1 module, so a low percentile of the edge gaps
    // estimates the module width. Wider elements are at most 4 modules, while
    // quiet zones are >= 7-10 modules
    const limit = 6.5 * Math.max(percentile(gaps, 15), 1.0);
    const clusters = [];
    let cur = [peaks[0]];
    for (let i = 1; i < peaks.length; i++) {
      if (gaps[i - 1] > limit) { clusters.push(cur); cur = []; }
      cur.push(peaks[i]);
    }
    clusters.push(cur);
    let best = clusters[0];
    for (const cl of clusters) if (cl.length > best.length) best = cl;
    // the barcode starts with a light -> dark edge and ends dark -> light
    // (this drops e.g. dark background -> white label edges)
    let i0 = 0, i1 = best.length - 1;
    while (i0 <= i1 && g[best[i0]] < 0) i0++;
    while (i1 >= i0 && g[best[i1]] > 0) i1--;
    if (i1 - i0 + 1 < 6) return null;
    return { ext: [best[i0] + 0.5, best[i1] + 0.5], peaks: best.slice(i0, i1 + 1) };
  }

  function endWidth(d, e, slots, n, side, wLo, wHi) {
    // local module width at one end of the barcode by fitting the known
    // start / stop patterns: slots span modules [0, n), anchored at edge e
    const model = new Model(d, slots, n);
    let best = Infinity, bestW = null;
    for (let i = 0; i < 40; i++) {
      const w = wLo * Math.pow(wHi / wLo, i / 39);
      for (const shift of [-0.3, 0.0, 0.3]) {
        let x0, x1;
        if (side === 'left') { x0 = e + shift * w; x1 = x0 + n * w; }
        else { x1 = e + shift * w; x0 = x1 - n * w; }
        const c = model.cost({ x0, x1, sigma: 0.5, spread: 0.0, persp: 0.0 });
        if (c < best) { best = c; bestW = w; }
      }
    }
    return bestW;
  }

  // ---------------------------------------------------------------- decoding

  function decodeEan(sc, kind) {
    // DP over digit slots: min total SSE subject to parity & checksum
    const nd = kind === 'ean13' ? 6 : 4;
    const left = sc.slice(1, 1 + nd), right = sc.slice(2 + nd, 2 + 2 * nd);
    // weights of the digits in the slots (1-indexed over the full code)
    const wl = [], wr = [];
    for (let j = 0; j < nd; j++) {
      if (kind === 'ean13') {
        wl.push((j + 2) % 2 === 0 ? 3 : 1); wr.push((j + 8) % 2 === 0 ? 3 : 1);
      } else {
        wl.push(j % 2 === 0 ? 3 : 1); wr.push((j + 4) % 2 === 0 ? 3 : 1);
      }
    }
    // left half: state (parity bits, sum mod 10)
    let states = new Map([[0, { c: 0, ch: [] }]]); // key = par * 10 + sum
    left.forEach(({ sse }, j) => {
      const ns = new Map();
      for (const [key, { c, ch }] of states) {
        const par = Math.floor(key / 10), s = key % 10;
        for (let ci = 0; ci < sse.length; ci++) {
          const d = ci % 10, g = Math.floor(ci / 10);
          const nk = ((par << 1) | g) * 10 + (s + wl[j] * d) % 10;
          const v = c + sse[ci];
          const old = ns.get(nk);
          if (!old || v < old.c) ns.set(nk, { c: v, ch: ch.concat([ci]) });
        }
      }
      states = ns;
    });
    let rstates = new Map([[0, { c: 0, ch: [] }]]);
    right.forEach(({ sse }, j) => {
      const ns = new Map();
      for (const [s, { c, ch }] of rstates) {
        for (let d = 0; d < sse.length; d++) {
          const nk = (s + wr[j] * d) % 10;
          const v = c + sse[d];
          const old = ns.get(nk);
          if (!old || v < old.c) ns.set(nk, { c: v, ch: ch.concat([d]) });
        }
      }
      rstates = ns;
    });
    let best = null;
    for (const [key, { c, ch }] of states) {
      const par = Math.floor(key / 10), s = key % 10;
      let first = null;
      if (kind === 'ean13') {
        first = EAN_PARITY.indexOf(par.toString(2).padStart(6, '0'));
        if (first < 0) continue;
      } else if (par !== 0) {
        continue;
      }
      for (const [rs, r] of rstates) {
        if ((s + rs + (first || 0)) % 10 !== 0) continue;
        if (best === null || c + r.c < best.c) best = { c: c + r.c, first, ch, rch: r.ch };
      }
    }
    if (best === null) return null;
    const digits = (best.first !== null ? [best.first] : [])
      .concat(best.ch.map(c => c % 10), best.rch);
    return { text: digits.join(''), choices: [0].concat(best.ch, [0], best.rch, [0]) };
  }

  // checksum weight of UPC-A digit k (0-based, 11 data digits)
  const upcaWeight = k => (k % 2 === 0 ? 3 : 1);

  function upcePositions(d6) {
    // UPC-A position of the UPC-E digits d1..d6 (null: not present), by d6
    if (d6 <= 2) return [1, 2, 8, 9, 10, 3];
    if (d6 === 3) return [1, 2, 3, 9, 10, null];
    if (d6 === 4) return [1, 2, 3, 4, 10, null];
    return [1, 2, 3, 4, 5, 10];
  }

  // DP over digit slots with state (parity bits, weighted digit sum mod
  // `mod`): returns Map(par * mod + sum -> {c, ch})
  function parityDp(slots, weights, mod) {
    let states = new Map([[0, { c: 0, ch: [] }]]);
    slots.forEach(({ sse }, j) => {
      const ns = new Map();
      for (const [key, { c, ch }] of states) {
        const par = Math.floor(key / mod), s = key % mod;
        for (let ci = 0; ci < sse.length; ci++) {
          const d = ci % 10, g = Math.floor(ci / 10);
          const nk = ((par << 1) | g) * mod + (s + weights[j] * d) % mod;
          const v = c + sse[ci];
          const old = ns.get(nk);
          if (!old || v < old.c) ns.set(nk, { c: v, ch: ch.concat([ci]) });
        }
      }
      states = ns;
    });
    return states;
  }

  function decodeUpce(sc) {
    // The parity pattern of the 6 digits encodes the number system and the
    // check digit of the expanded UPC-A. For every value of the last digit
    // (which decides the expansion), DP over the other digits.
    let best = null;
    for (let d6 = 0; d6 < 10; d6++) {
      const pos = upcePositions(d6);
      const states = parityDp(sc.slice(1, 6), pos.slice(0, 5).map(upcaWeight), 10);
      const last = sc[6].sse;
      for (const [key, { c, ch }] of states) {
        const par = Math.floor(key / 10), s = key % 10;
        for (const g of [0, 1]) {
          const nsCheck = UPCE_PARITY_TO_NS_CHECK.get((par << 1) | g);
          if (!nsCheck) continue;
          const [numSys, check] = nsCheck;
          const tot = 3 * numSys + s + (pos[5] !== null ? upcaWeight(pos[5]) * d6 : 0);
          if ((10 - tot % 10) % 10 !== check) continue;
          const v = c + last[g * 10 + d6];
          if (best === null || v < best.c) best = { c: v, numSys, check, ch: ch.concat([g * 10 + d6]) };
        }
      }
    }
    if (best === null) return null;
    return {
      text: String(best.numSys) + best.ch.map(c => c % 10).join('') + best.check,
      choices: [0].concat(best.ch, [0]),
    };
  }

  function decodeAddon(sc, n) {
    // EAN-2 / EAN-5 add-on: the parity pattern encodes a checksum
    // (EAN-2: value mod 4; EAN-5: (3, 9, 3, 9, 3) weighted sum mod 10)
    const digitSlots = Array.from({ length: n }, (_, i) => sc[1 + 2 * i]);
    const [weights, mod] = n === 2 ? [[2, 1], 4] : [[3, 9, 3, 9, 3], 10];
    let best = null;
    for (const [key, { c, ch }] of parityDp(digitSlots, weights, mod)) {
      const par = Math.floor(key / mod), s = key % mod;
      const want = n === 2 ? s : parseInt(EAN5_PARITY[s], 2);
      if (par === want && (best === null || c < best.c)) best = { c, ch };
    }
    if (best === null) return null;
    const choices = [0];
    best.ch.forEach((c, i) => { if (i > 0) choices.push(0); choices.push(c); });
    return { text: best.ch.map(c => c % 10).join(''), choices };
  }

  function decodeCode93(sc) {
    // DP over the two check values (state: C sum, K sum mod 47)
    const m = sc.length - 1, n = m - 3; // n data symbols
    let cost = new Float64Array(47 * 47).fill(Infinity);
    cost[0] = 0;
    const back = [];
    for (let i = 0; i < n; i++) {
      const wc = (n - 1 - i) % 20 + 1, wk = (n - i) % 15 + 1;
      const c = sc[1 + i].sse;
      const nw = new Float64Array(47 * 47).fill(Infinity);
      const bv = new Int32Array(47 * 47);
      for (let a = 0; a < 47; a++) {
        for (let b = 0; b < 47; b++) {
          const c0 = cost[a * 47 + b];
          if (c0 === Infinity) continue;
          for (let v = 0; v < 47; v++) {
            const k = ((a + wc * v) % 47) * 47 + (b + wk * v) % 47;
            const cand = c0 + c[v];
            if (cand < nw[k]) { nw[k] = cand; bv[k] = v; }
          }
        }
      }
      back.push({ bv, wc, wk });
      cost = nw;
    }
    // the C check symbol must equal the C sum; K includes C with weight 1
    const cc = sc[m - 2].sse, ck = sc[m - 1].sse;
    let best = Infinity, ba = -1, bb = -1;
    for (let a = 0; a < 47; a++) {
      for (let b = 0; b < 47; b++) {
        const t = cost[a * 47 + b] + cc[a] + ck[(a + b) % 47];
        if (t < best) { best = t; ba = a; bb = b; }
      }
    }
    if (ba < 0) return null;
    const vals = [];
    let a = ba, b = bb;
    for (let i = back.length - 1; i >= 0; i--) {
      const { bv, wc, wk } = back[i];
      const v = bv[a * 47 + b];
      vals.push(v);
      a = ((a - wc * v) % 47 + 47) % 47;
      b = ((b - wk * v) % 47 + 47) % 47;
    }
    vals.reverse();
    const text = code93ValuesToText(vals);
    if (text === null) return null;
    return { text, choices: [0].concat(vals, [ba, (ba + bb) % 47, 0]) };
  }

  function decodeKind(kind, sc) {
    if (kind === 'code128') {
      const dec = decodeCode128(sc);
      if (dec && dec.text[0] === GS) {
        const hri = gs1ToText(dec.text.slice(1));
        if (hri !== null) return Object.assign(dec, { text: hri, kind: 'gs1-128' });
      }
      return dec && Object.assign(dec, { kind });
    }
    const dec = kind === 'code93' ? decodeCode93(sc) : kind === 'upce' ? decodeUpce(sc) :
      decodeEan(sc, kind);
    return dec && Object.assign(dec, { kind });
  }

  function decodeCode128(sc) {
    const m = sc.length - 1;
    // DP over checksum state mod 103
    let cost = new Float64Array(103).fill(Infinity);
    const startChoice = new Int32Array(103).fill(-1);
    for (let ci = 0; ci < 3; ci++) {
      const s = (103 + ci) % 103;
      if (sc[0].sse[ci] <= cost[s]) { cost[s] = sc[0].sse[ci]; startChoice[s] = ci; }
    }
    const back = [];
    for (let i = 1; i < m - 1; i++) {
      const c = sc[i].sse;
      const nw = new Float64Array(103).fill(Infinity);
      const bv = new Int32Array(103), bs = new Int32Array(103);
      for (let v = 0; v < 103; v++) {
        for (let s = 0; s < 103; s++) {
          const ns = (s + i * v) % 103;
          const cand = cost[s] + c[v];
          if (cand < nw[ns]) { nw[ns] = cand; bv[ns] = v; bs[ns] = s; }
        }
      }
      back.push([bv, bs]);
      cost = nw;
    }
    let s = -1, best = Infinity;
    for (let k = 0; k < 103; k++) {
      const t = cost[k] + sc[m - 1].sse[k];
      if (t < best) { best = t; s = k; }
    }
    if (s < 0) return null;
    const vals = [s];
    let st = s;
    for (let i = back.length - 1; i >= 0; i--) {
      vals.push(back[i][0][st]);
      st = back[i][1][st];
    }
    vals.push(103 + startChoice[st]);
    vals.reverse(); // start, data..., checksum
    const text = code128ValuesToText(vals.slice(0, -1));
    if (text === null) return null;
    return { text, choices: [vals[0] - 103].concat(vals.slice(1), [0]) };
  }

  function evaluate(sc, choices, lengths) {
    let sse = 0, sseFree = 0, sqq = 0, slotPenMax = 0;
    const margins = [];
    sc.forEach(({ sse: c, sqq: q }, i) => {
      const ch = choices[i];
      let mn = Infinity, other = Infinity;
      for (let k = 0; k < c.length; k++) {
        mn = Math.min(mn, c[k]);
        if (k !== ch) other = Math.min(other, c[k]);
      }
      sse += c[ch]; sseFree += mn; sqq += q;
      // correction cost of each symbol the checksum forced to change,
      // relative to the slot's own variance
      slotPenMax = Math.max(slotPenMax, (c[ch] - mn) / Math.max(q, 1e-12));
      if (c.length > 1) margins.push(Math.max(other - c[ch], 0));
    });
    // confidence: a different checksum-valid decode needs >= 2 changed
    // symbols, so sum the two smallest per-slot margins (runner-up SSE minus
    // chosen SSE), in units of the per-sample residual variance
    margins.sort((a, b) => a - b);
    const noiseVar = sse / lengths.reduce((a, b) => a + b, 0);
    return {
      frac: sse / Math.max(sqq, 1e-12),
      penalty: (sse - sseFree) / Math.max(sqq, 1e-12), // checksum-valid vs free decode
      slotPenMax,
      margin2: (margins[0] + margins[1]) / Math.max(noiseVar, 1e-12),
    };
  }

  function fittedCurve(model, fit, choices, shifts) {
    // the synthesized signal for the chosen symbols (for visualization)
    const p = model.p, xs = [], ys = [];
    model.slots.forEach((s, si) => {
      const { T, Stt, L } = renderTemplates(s, fit.sigma, fit.spread);
      const ch = choices[si];
      const x = new Float64Array(L), q = new Float64Array(L);
      for (let k = 0; k < L; k++) {
        x[k] = model.gridX(fit, s.start - 0.5 + (k + 0.5) / R + shifts[si]);
        q[k] = interp1(p, x[k]);
      }
      const qc = detrend(Float64Array.from(q));
      let stq = 0;
      for (let k = 0; k < L; k++) stq += qc[k] * T[ch * L + k];
      const b = Math.max(stq / Stt[ch], 0);
      // only draw the slot's own modules (skip the half-module margins)
      for (let k = R / 2; k < (s.n + 0.5) * R; k++) {
        xs.push(x[k]); ys.push(q[k] - qc[k] + b * T[ch * L + k]);
      }
    });
    return { xs, ys };
  }

  function tryKind(d, kind, e0, e1) {
    const span = e1 - e0;
    let wl, wr, layouts;
    if (kind in VARIABLE) {
      const v = VARIABLE[kind];
      const uMin = v.layout(v.mMin).U;
      // local module widths at both ends: under a 1D homography,
      // sqrt(w_left * w_right) = span / U exactly -> number of symbols
      wl = endWidth(d, e0, v.ends[0], v.nl, 'left', 0.7, span / uMin);
      wr = endWidth(d, e1, v.ends[1], v.nr, 'right', 0.7, span / uMin);
      const m0 = Math.round((span / Math.sqrt(wl * wr) - v.nr) / v.n);
      layouts = [m0, m0 - 1, m0 + 1].filter(m => m >= v.mMin).map(v.layout);
    } else {
      const f = FIXED[kind];
      const layout = f.layout();
      const w = span / layout.U;
      wl = endWidth(d, e0, f.ends[0], f.nl, 'left', 0.75 * w, 1.33 * w);
      wr = endWidth(d, e1, f.ends[1], f.nr, 'right', 0.75 * w, 1.33 * w);
      layouts = [layout];
    }
    // local widths at the ends are (1 + k) w and w / (1 + k)
    const persp0 = clamp(Math.sqrt(wl / wr) - 1, -0.35, 0.55);
    // if the symbol count is ambiguous, refine the layout that fits best on the grid
    let best = null;
    for (const { slots, U } of layouts) {
      const model = new Model(d, slots, U);
      const coarse = model.coarse(e0, e1, persp0);
      if (best === null || coarse.c < best.coarse.c) best = { coarse, model, U };
    }
    const { model, U } = best;
    const fit = model.refine(best.coarse);
    const { sc, shifts } = model.alignedSlotCosts(fit);
    const dec = decodeKind(kind, sc);
    const att = {
      kind, e0, e1, wLeft: wl, wRight: wr, U, fit, shifts,
      modulePx: (fit.x1 - fit.x0) / U, text: null, accepted: false,
    };
    if (dec !== null) {
      Object.assign(att, dec, evaluate(sc, dec.choices, model.slots.map(s => (s.n + 1) * R)));
      att.accepted = accept(att);
      att.model = model;
    }
    return att;
  }

  function findAddon(d, x1, w) {
    // EAN-2 / EAN-5 add-on right of a main code ending at x1 (module width
    // w): the edge cluster starting 7-12 modules after it. Returns attempts.
    const s = boxSmooth(d, 2);
    const g = new Float64Array(s.length - 1);
    for (let i = 0; i < g.length; i++) g[i] = s[i + 1] - s[i];
    const a = g.map(Math.abs);
    const lo = Math.floor(x1 + 4 * w), hi = Math.min(Math.floor(x1 + 15 * w), a.length - 2);
    if (hi <= lo) return [];
    const thr = 0.2 * percentile(a, 99);
    const peaks = [];
    for (let i = lo; i < a.length - 1; i++) {
      if (a[i] > thr && a[i] >= a[i - 1] && a[i] >= a[i + 1]) peaks.push(i);
    }
    if (!peaks.length || peaks[0] > hi || g[peaks[0]] < 0) return [];
    const cl = [peaks[0]];
    for (const p of peaks.slice(1)) {
      if (p - cl[cl.length - 1] > 7 * w) break; // elements are <= 4 modules, but blur can hide edges
      cl.push(p);
    }
    while (cl.length && g[cl[cl.length - 1]] > 0) cl.pop();
    if (cl.length < 6) return [];
    const e0 = cl[0] + 0.5, e1 = cl[cl.length - 1] + 0.5;
    const out = [];
    for (const n of [2, 5]) {
      const { slots, U } = addonLayout(n);
      const r = (e1 - e0) / (U * w);
      if (!(r > 0.75 && r < 1.33)) continue;
      const model = new Model(d, slots, U);
      const fit = model.fit(e0, e1, 0.0);
      const { sc, shifts } = model.alignedSlotCosts(fit);
      const dec = decodeAddon(sc, n);
      const att = {
        kind: 'ean' + n, e0, e1, U, fit, shifts, modulePx: (fit.x1 - fit.x0) / U,
        text: null, accepted: false,
      };
      if (dec !== null) {
        Object.assign(att, dec, evaluate(sc, dec.choices, slots.map(s => (s.n + 1) * R)));
        att.accepted = accept(att);
        att.model = model;
      }
      out.push(att);
    }
    return out;
  }

  // thresholds calibrated with calibrate.py / analyze_calib.py on synthetic data
  function accept(a) {
    // the fit must be good overall, any symbol the checksum forced to change
    // must have been a near-tie relative to that slot's own variance, and the
    // decode must be well separated from alternatives relative to the noise
    return a.text !== null && a.frac < 0.15 && a.slotPenMax < 0.05 && a.margin2 > 128;
  }

  function strong(a) {
    return accept(a) && a.frac < 0.07 && a.margin2 > 300;
  }

  // early give-up: after the first GATE_BANDS bands, only symbologies with
  // some decode whose confidence margin reached GATE_MARGIN are tried further.
  // Fit cost does not work for this: random bars fit as well as barcodes.
  // Calibrated on synthetic data: the true symbology has a median margin
  // ~1300, wrong ones and non-barcodes < 35 (95th percentile)
  const GATE_BANDS = 2, GATE_MARGIN = 40;

  function bestVote(votes) {
    // rank by number of supporting profiles, then by fit quality
    let bestKey = null, bestScore = null;
    for (const [key, as] of votes) {
      const score = [as.length, -Math.min(...as.map(a => a.frac))];
      if (bestScore === null || score[0] > bestScore[0] ||
        (score[0] === bestScore[0] && score[1] > bestScore[1])) {
        bestKey = key; bestScore = score;
      }
    }
    return votes.get(bestKey);
  }

  /*
   * img: {data: Float32Array (0..1 gray), width, height}, bbox: [x0, y0, x1, y1]
   * Returns {kind, text, votes[, addon]} or null. With opts.trace: {result, trace}.
   * opts.kinds: symbologies to try (default KINDS; Code 128 includes GS1-128).
   * opts.timeLimitMs: give up (after the current attempt) when exceeded.
   */
  function decode(img, bbox, opts = {}) {
    const kinds = opts.kinds || KINDS;
    const deadline = opts.timeLimitMs ? Date.now() + opts.timeLimitMs : Infinity;
    templateCache = new Map();
    bbox = [
      clamp(Math.round(Math.min(bbox[0], bbox[2])), 0, img.width - 1),
      clamp(Math.round(Math.min(bbox[1], bbox[3])), 0, img.height - 1),
      clamp(Math.round(Math.max(bbox[0], bbox[2])), 1, img.width),
      clamp(Math.round(Math.max(bbox[1], bbox[3])), 1, img.height),
    ];
    if (bbox[2] - bbox[0] < 8 || bbox[3] - bbox[1] < 3) {
      return opts.trace ? { result: null, trace: null } : null;
    }
    const { profiles, info } = getProfiles(img, bbox);
    const trace = Object.assign({ bbox }, info, { attempts: [] });
    const oriented = (pi, direction) =>
      direction > 0 ? profiles[pi] : Float64Array.from(profiles[pi]).reverse();
    const timeUp = () => {
      if (Date.now() <= deadline) return false;
      trace.timedOut = true;
      return true;
    };
    const record = (a, d, pi, direction) => {
      a.band = pi;
      a.direction = direction;
      if (opts.trace) {
        if (a.model) {
          a.curve = fittedCurve(a.model, a.fit, a.choices, a.shifts);
          a.moduleEdges = Array.from({ length: a.U + 1 }, (_, u) => a.model.gridX(a.fit, u));
        }
        a.profile = d;
      }
      delete a.model;
      trace.attempts.push(a);
    };
    const vote = (votes, a) => {
      // true when the decode is settled
      if (!a.accepted) return false;
      const key = a.kind + ':' + a.text;
      if (!votes.has(key)) votes.set(key, []);
      votes.get(key).push(a);
      return !opts.exhaustive && (strong(a) || votes.get(key).length >= 2);
    };

    const votes = new Map();
    let active = kinds.slice();
    const bestMargin = {};
    let done = false;
    for (let pi = 0; pi < profiles.length && !done; pi++) {
      if (pi === GATE_BANDS && !opts.exhaustive) {
        // give up on symbologies without any promising decode so far
        active = active.filter(k => (bestMargin[k] || 0) >= GATE_MARGIN);
        if (!active.length) {
          trace.gaveUp = true;
          break;
        }
      }
      for (const direction of [1, -1]) {
        if (done) break;
        const d = oriented(pi, direction);
        const found = findExtent(d);
        if (found === null) continue;
        for (const kind of active) {
          const exts = [found.ext];
          if (kind === 'ean13') {
            // fallback: the main code merged with an add-on. (Not for UPC-E:
            // the left half of an EAN-13 looks like a UPC-E)
            const split = splitAddon(found.peaks, 95);
            if (split) exts.push(split);
          }
          for (const ext of exts) {
            const a = tryKind(d, kind, ext[0], ext[1]);
            if (a.text !== null) bestMargin[kind] = Math.max(bestMargin[kind] || 0, a.margin2);
            record(a, d, pi, direction);
            if (vote(votes, a) || timeUp()) done = true;
            if (done || a.accepted) break;
          }
          if (done) break;
        }
      }
    }
    let result = null;
    if (votes.size) {
      const as = bestVote(votes), a = as[0];
      result = { kind: a.kind, text: a.text, votes: as.length };
      if (a.kind === 'ean13' || a.kind === 'upce') {
        // EAN-2 / EAN-5 add-on after the main code. The add-on checksums are
        // weak (EAN-2: 2 bits), so 2 agreeing bands are required
        const f = a.fit;
        const w = (f.x1 - f.x0) / ((1 + f.persp) * a.U); // module width at the right end
        const addonVotes = new Map();
        for (let pi = 0; pi < profiles.length && !result.addon && !timeUp(); pi++) {
          const d = oriented(pi, a.direction);
          for (const att of findAddon(d, f.x1, w)) {
            record(att, d, pi, a.direction);
            if (!att.accepted) continue;
            const n = (addonVotes.get(att.text) || 0) + 1;
            addonVotes.set(att.text, n);
            if (n >= 2) result.addon = att.text;
          }
        }
      }
    }
    if (opts.trace) {
      trace.result = result;
      return { result, trace };
    }
    return result;
  }

  // RGBA (e.g. canvas ImageData) -> gray image for decode()
  function toGray(rgba, width, height) {
    const data = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      data[i] = (0.299 * rgba[4 * i] + 0.587 * rgba[4 * i + 1] + 0.114 * rgba[4 * i + 2]) / 255;
    }
    return { data, width, height };
  }

  function upceToUpca(code) {
    // 8-digit UPC-E -> the equivalent 12-digit UPC-A
    const d = code.split('').map(Number);
    const [d1, d2, d3, d4, d5, d6] = d.slice(1, 7);
    const body = d6 <= 2 ? [d1, d2, d6, 0, 0, 0, 0, d3, d4, d5] :
      d6 === 3 ? [d1, d2, d3, 0, 0, 0, 0, 0, d4, d5] :
        d6 === 4 ? [d1, d2, d3, d4, 0, 0, 0, 0, 0, d5] : [d1, d2, d3, d4, d5, 0, 0, 0, 0, d6];
    return [d[0]].concat(body, [d[7]]).join('');
  }

  const api = { decode, toGray, rectToImage, upceToUpca, BANDS, KINDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.BarcodeDecoder = api;
})();
