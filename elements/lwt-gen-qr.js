(function () {
  'use strict';

  if (!window.LWT || !window.LWT.Element) {
    throw new Error('lwt-gen-qr.js requires lwt-core.js to be loaded first.');
  }

  // ---- Spec tables (ISO/IEC 18004) ----
  //
  // These are the standard's own published capacity/block/format/alignment
  // tables -- factual, spec-mandated numbers (every QR implementation
  // reproduces the same values), not anyone's original expression.

  // QR_BLOCK_TABLE[version-1][levelIndex 0=L,1=M,2=Q,3=H]
  //   = [eccCodewordsPerBlock, group1BlockCount, group1BlockSize, group2BlockCount, group2BlockSize]
  var QR_BLOCK_TABLE = [[[7,1,19,0,0],[10,1,16,0,0],[13,1,13,0,0],[17,1,9,0,0]],[[10,1,34,0,0],[16,1,28,0,0],[22,1,22,0,0],[28,1,16,0,0]],[[15,1,55,0,0],[26,1,44,0,0],[18,2,17,0,0],[22,2,13,0,0]],[[20,1,80,0,0],[18,2,32,0,0],[26,2,24,0,0],[16,4,9,0,0]],[[26,1,108,0,0],[24,2,43,0,0],[18,2,15,2,16],[22,2,11,2,12]],[[18,2,68,0,0],[16,4,27,0,0],[24,4,19,0,0],[28,4,15,0,0]],[[20,2,78,0,0],[18,4,31,0,0],[18,2,14,4,15],[26,4,13,1,14]],[[24,2,97,0,0],[22,2,38,2,39],[22,4,18,2,19],[26,4,14,2,15]],[[30,2,116,0,0],[22,3,36,2,37],[20,4,16,4,17],[24,4,12,4,13]],[[18,2,68,2,69],[26,4,43,1,44],[24,6,19,2,20],[28,6,15,2,16]],[[20,4,81,0,0],[30,1,50,4,51],[28,4,22,4,23],[24,3,12,8,13]],[[24,2,92,2,93],[22,6,36,2,37],[26,4,20,6,21],[28,7,14,4,15]],[[26,4,107,0,0],[22,8,37,1,38],[24,8,20,4,21],[22,12,11,4,12]],[[30,3,115,1,116],[24,4,40,5,41],[20,11,16,5,17],[24,11,12,5,13]],[[22,5,87,1,88],[24,5,41,5,42],[30,5,24,7,25],[24,11,12,7,13]],[[24,5,98,1,99],[28,7,45,3,46],[24,15,19,2,20],[30,3,15,13,16]],[[28,1,107,5,108],[28,10,46,1,47],[28,1,22,15,23],[28,2,14,17,15]],[[30,5,120,1,121],[26,9,43,4,44],[28,17,22,1,23],[28,2,14,19,15]],[[28,3,113,4,114],[26,3,44,11,45],[26,17,21,4,22],[26,9,13,16,14]],[[28,3,107,5,108],[26,3,41,13,42],[30,15,24,5,25],[28,15,15,10,16]],[[28,4,116,4,117],[26,17,42,0,0],[28,17,22,6,23],[30,19,16,6,17]],[[28,2,111,7,112],[28,17,46,0,0],[30,7,24,16,25],[24,34,13,0,0]],[[30,4,121,5,122],[28,4,47,14,48],[30,11,24,14,25],[30,16,15,14,16]],[[30,6,117,4,118],[28,6,45,14,46],[30,11,24,16,25],[30,30,16,2,17]],[[26,8,106,4,107],[28,8,47,13,48],[30,7,24,22,25],[30,22,15,13,16]],[[28,10,114,2,115],[28,19,46,4,47],[28,28,22,6,23],[30,33,16,4,17]],[[30,8,122,4,123],[28,22,45,3,46],[30,8,23,26,24],[30,12,15,28,16]],[[30,3,117,10,118],[28,3,45,23,46],[30,4,24,31,25],[30,11,15,31,16]],[[30,7,116,7,117],[28,21,45,7,46],[30,1,23,37,24],[30,19,15,26,16]],[[30,5,115,10,116],[28,19,47,10,48],[30,15,24,25,25],[30,23,15,25,16]],[[30,13,115,3,116],[28,2,46,29,47],[30,42,24,1,25],[30,23,15,28,16]],[[30,17,115,0,0],[28,10,46,23,47],[30,10,24,35,25],[30,19,15,35,16]],[[30,17,115,1,116],[28,14,46,21,47],[30,29,24,19,25],[30,11,15,46,16]],[[30,13,115,6,116],[28,14,46,23,47],[30,44,24,7,25],[30,59,16,1,17]],[[30,12,121,7,122],[28,12,47,26,48],[30,39,24,14,25],[30,22,15,41,16]],[[30,6,121,14,122],[28,6,47,34,48],[30,46,24,10,25],[30,2,15,64,16]],[[30,17,122,4,123],[28,29,46,14,47],[30,49,24,10,25],[30,24,15,46,16]],[[30,4,122,18,123],[28,13,46,32,47],[30,48,24,14,25],[30,42,15,32,16]],[[30,20,117,4,118],[28,40,47,7,48],[30,43,24,22,25],[30,10,15,67,16]],[[30,19,118,6,119],[28,18,47,31,48],[30,34,24,34,25],[30,20,15,61,16]]];

  // ALIGN_POSITIONS[version-1] = alignment-pattern center coordinates (both row & col)
  var ALIGN_POSITIONS = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]];

  // FORMAT_INFO[levelIndex][maskPattern] = literal 15-bit format string
  var FORMAT_INFO = [[30660,29427,32170,30877,26159,25368,27713,26998],[21522,20773,24188,23371,17913,16590,20375,19104],[13663,12392,16177,14854,9396,8579,11994,11245],[5769,5054,7399,6608,1890,597,3340,2107]];

  // VERSION_INFO[version-7] = literal 18-bit version string (versions 7-40)
  var VERSION_INFO = [31892,34236,39577,42195,48118,51042,55367,58893,63784,68472,70749,76311,79154,84390,87683,92361,96236,102084,102881,110507,110734,117786,119615,126325,127568,133589,136944,141498,145311,150283,152622,158308,161089,167017];

  var LEVELS = ['L', 'M', 'Q', 'H'];

  // ---- GF(256) tables for Reed-Solomon, primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D) ----
  var GF_EXP = new Array(512);
  var GF_LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // Reed-Solomon generator polynomial of given degree (highest degree
  // first, monic). Built by multiplying (x + 2^i) in for i = 0..degree-1.
  function rsGeneratorPoly(degree) {
    var coefs = [1];
    for (var i = 0; i < degree; i++) {
      var r = GF_EXP[i];
      var n = coefs.length - 1;
      var next = new Array(n + 2).fill(0);
      next[0] = coefs[0];
      for (var j = 1; j <= n; j++) next[j] = coefs[j] ^ gfMul(coefs[j - 1], r);
      next[n + 1] = gfMul(coefs[n], r);
      coefs = next;
    }
    return coefs;
  }

  function rsEncode(dataBytes, eccLen) {
    var gen = rsGeneratorPoly(eccLen);
    var res = new Array(eccLen).fill(0);
    for (var i = 0; i < dataBytes.length; i++) {
      var factor = dataBytes[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < eccLen; j++) res[j] ^= gfMul(gen[j + 1], factor);
    }
    return res;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      if (code > 0xFFFF) i++;
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if (code < 0x10000) {
        bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      } else {
        bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      }
    }
    return bytes;
  }

  function blockInfo(version, levelIdx) {
    var row = QR_BLOCK_TABLE[version - 1][levelIdx];
    return { ecc: row[0], g1cnt: row[1], g1size: row[2], g2cnt: row[3], g2size: row[4] };
  }

  function totalDataCodewords(version, levelIdx) {
    var b = blockInfo(version, levelIdx);
    return b.g1cnt * b.g1size + b.g2cnt * b.g2size;
  }

  function getNumRawDataModules(version) {
    var result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      var numAlign = Math.floor(version / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function chooseVersion(byteLen, levelIdx) {
    for (var v = 1; v <= 40; v++) {
      var countBits = v < 10 ? 8 : 16;
      var headerBits = 4 + countBits;
      var capacityBits = totalDataCodewords(v, levelIdx) * 8;
      if (headerBits + byteLen * 8 <= capacityBits) return v;
    }
    return -1;
  }

  function appendBits(bitArr, val, len) {
    for (var i = len - 1; i >= 0; i--) bitArr.push((val >>> i) & 1);
  }

  function buildDataCodewords(bytes, version, levelIdx) {
    var bits = [];
    appendBits(bits, 4, 4); // byte-mode indicator
    var countBits = version < 10 ? 8 : 16;
    appendBits(bits, bytes.length, countBits);
    for (var i = 0; i < bytes.length; i++) appendBits(bits, bytes[i], 8);

    var capacityBits = totalDataCodewords(version, levelIdx) * 8;
    var termLen = Math.min(4, capacityBits - bits.length);
    for (i = 0; i < termLen; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var padBytes = [0xEC, 0x11];
    var p = 0;
    while (bits.length < capacityBits) {
      appendBits(bits, padBytes[p % 2], 8);
      p++;
    }

    var codewords = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    return codewords;
  }

  function buildFinalBits(dataCodewords, version, levelIdx) {
    var info = blockInfo(version, levelIdx);
    var blocks = [], eccBlocks = [], pos = 0;
    [[info.g1cnt, info.g1size], [info.g2cnt, info.g2size]].forEach(function (g) {
      var count = g[0], size = g[1];
      for (var i = 0; i < count; i++) {
        var block = dataCodewords.slice(pos, pos + size);
        pos += size;
        blocks.push(block);
        eccBlocks.push(rsEncode(block, info.ecc));
      }
    });

    var maxDataLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    var result = [];
    for (var i = 0; i < maxDataLen; i++) {
      blocks.forEach(function (b) { if (i < b.length) result.push(b[i]); });
    }
    for (i = 0; i < info.ecc; i++) {
      eccBlocks.forEach(function (b) { result.push(b[i]); });
    }

    var bits = [];
    result.forEach(function (byte) { appendBits(bits, byte, 8); });
    var remainder = getNumRawDataModules(version) - bits.length;
    for (i = 0; i < remainder; i++) bits.push(0);
    return bits;
  }

  function newMatrix(size, fill) {
    var m = [];
    for (var r = 0; r < size; r++) m.push(new Array(size).fill(fill));
    return m;
  }

  function maskFn(m, r, c) {
    switch (m) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  function penalty(m, size) {
    var total = 0, r, c;
    for (r = 0; r < size; r++) {
      var run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { if (run >= 5) total += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) total += 3 + (run - 5);
    }
    for (c = 0; c < size; c++) {
      var run2 = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) run2++;
        else { if (run2 >= 5) total += 3 + (run2 - 5); run2 = 1; }
      }
      if (run2 >= 5) total += 3 + (run2 - 5);
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) total += 3;
      }
    }
    var patt1 = [true, false, true, true, true, false, true, false, false, false, false];
    var patt2 = [false, false, false, false, true, false, true, true, true, false, true];
    function matchAt(arr, idx, patt) {
      for (var k = 0; k < patt.length; k++) if (arr[idx + k] !== patt[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        var rowArr = m[r];
        if (matchAt(rowArr, c, patt1) || matchAt(rowArr, c, patt2)) total += 40;
      }
    }
    for (c = 0; c < size; c++) {
      var colArr = [];
      for (r = 0; r < size; r++) colArr.push(m[r][c]);
      for (r = 0; r <= size - 11; r++) {
        if (matchAt(colArr, r, patt1) || matchAt(colArr, r, patt2)) total += 40;
      }
    }
    var darkCount = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) darkCount++;
    var percent = (darkCount * 100) / (size * size);
    var prevMultiple = Math.abs(Math.floor(percent / 5) * 5 - 50) / 5;
    var nextMultiple = Math.abs(Math.ceil(percent / 5) * 5 - 50) / 5;
    total += Math.min(prevMultiple, nextMultiple) * 10;
    return total;
  }

  function buildMatrix(version, levelIdx, finalBits) {
    var size = 17 + 4 * version;
    var dark = newMatrix(size, false);
    var isFn = newMatrix(size, false);
    var isFinder = newMatrix(size, false);

    function setFn(r, c, val, finder) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      dark[r][c] = val;
      isFn[r][c] = true;
      if (finder) isFinder[r][c] = val;
    }

    function drawFinder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var r = r0 + dr, c = c0 + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          var isBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
          var isRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
          var isCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFn(r, c, !isBorder && (isRing || isCenter), true);
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (var i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0);
      setFn(i, 6, i % 2 === 0);
    }

    var positions = ALIGN_POSITIONS[version - 1];
    positions.forEach(function (r) {
      positions.forEach(function (c) {
        if ((r < 9 && c < 9) || (r < 9 && c > size - 9) || (r > size - 9 && c < 9)) return;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var isRing = Math.max(Math.abs(dr), Math.abs(dc)) === 2;
            var isCenter = dr === 0 && dc === 0;
            setFn(r + dr, c + dc, isRing || isCenter);
          }
        }
      });
    });

    for (i = 0; i < 9; i++) {
      if (i !== 6) { setFn(8, i, false); setFn(i, 8, false); }
    }
    for (i = 0; i < 8; i++) {
      setFn(8, size - 1 - i, false);
      setFn(size - 1 - i, 8, false);
    }
    setFn(size - 8, 8, true);

    if (version >= 7) {
      for (var a = 0; a < 6; a++) {
        for (var b = 0; b < 3; b++) {
          setFn(a, size - 11 + b, false);
          setFn(size - 11 + b, a, false);
        }
      }
    }

    // ---- data placement: zigzag, two columns at a time from the
    // bottom-right, alternating scan direction, skipping the timing
    // column and any function module. ----
    var bitIndex = 0, upward = true;
    for (var col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col--;
      for (var rowStep = 0; rowStep < size; rowStep++) {
        var row = upward ? size - 1 - rowStep : rowStep;
        for (var cOff = 0; cOff < 2; cOff++) {
          var c2 = col - cOff;
          if (isFn[row][c2]) continue;
          var bit = bitIndex < finalBits.length ? finalBits[bitIndex] : 0;
          dark[row][c2] = bit === 1;
          bitIndex++;
        }
      }
      upward = !upward;
    }

    // ---- try all 8 masks, keep the one with the lowest penalty score ----
    var bestMask = 0, bestPenalty = Infinity, bestMatrix = null;
    for (var mask = 0; mask <= 7; mask++) {
      var copy = dark.map(function (row) { return row.slice(); });
      for (var r2 = 0; r2 < size; r2++) {
        for (var c3 = 0; c3 < size; c3++) {
          if (!isFn[r2][c3] && maskFn(mask, r2, c3)) copy[r2][c3] = !copy[r2][c3];
        }
      }
      var pen = penalty(copy, size);
      if (pen < bestPenalty) { bestPenalty = pen; bestMask = mask; bestMatrix = copy; }
    }

    // ---- format info (two copies around the top-left finder + split
    // across the other two) and version info (versions 7+) ----
    var fmtBits = FORMAT_INFO[levelIdx][bestMask];
    function fmtBit(i) { return (fmtBits >>> (14 - i)) & 1; }
    for (i = 0; i <= 5; i++) bestMatrix[8][i] = fmtBit(i) === 1;
    bestMatrix[8][7] = fmtBit(6) === 1;
    bestMatrix[8][8] = fmtBit(7) === 1;
    bestMatrix[7][8] = fmtBit(8) === 1;
    for (i = 9; i <= 14; i++) bestMatrix[14 - i][8] = fmtBit(i) === 1;
    for (i = 0; i <= 6; i++) bestMatrix[size - 1 - i][8] = fmtBit(i) === 1;
    for (i = 7; i <= 14; i++) bestMatrix[8][size - 15 + i] = fmtBit(i) === 1;
    bestMatrix[size - 8][8] = true;

    if (version >= 7) {
      var verBits = VERSION_INFO[version - 7];
      function verBit(i) { return (verBits >>> i) & 1; }
      for (i = 0; i < 18; i++) {
        var vr = Math.floor(i / 3), vc = i % 3;
        bestMatrix[vr][size - 11 + vc] = verBit(i) === 1;
        bestMatrix[size - 11 + vc][vr] = verBit(i) === 1;
      }
    }

    return { size: size, matrix: bestMatrix, isFinder: isFinder };
  }

  function generateQr(text, levelChar) {
    var levelIdx = LEVELS.indexOf((levelChar || 'M').toUpperCase());
    if (levelIdx === -1) levelIdx = 1;
    var bytes = utf8Bytes(text);
    var version = chooseVersion(bytes.length, levelIdx);
    if (version === -1) return null;
    var dataCodewords = buildDataCodewords(bytes, version, levelIdx);
    var finalBits = buildFinalBits(dataCodewords, version, levelIdx);
    var result = buildMatrix(version, levelIdx, finalBits);
    result.version = version;
    result.level = LEVELS[levelIdx];
    return result;
  }

  // ---- the custom element itself ----

  function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = ':host { display: inline-block; line-height: 0; }' +
    'svg { display: block; }';

  class LWTQr extends window.LWT.Element {
    static get observedAttributes() {
      return ['src', 'size', 'level', 'background-color', 'color', 'corner-color', 'radius', 'margin', 'label', 'aria-label'];
    }

    render() {
      var src = this._strAttr('src', '');
      var size = parseFloat(this._strAttr('size', '200')) || 200;
      var level = this._strAttr('level', 'M');
      var bg = this._strAttr('background-color', '') || 'var(--lwt-qr-bg, var(--lwt-color-surface, #ffffff))';
      var color = this._strAttr('color', '') || 'var(--lwt-qr-color, var(--lwt-color-text-strong, #000000))';
      var cornerColor = this._strAttr('corner-color', '') || 'var(--lwt-qr-corner-color, ' + color + ')';
      var radius = parseFloat(this._strAttr('radius', '')) ;
      if (isNaN(radius)) radius = 0;
      radius = Math.max(0, Math.min(0.5, radius));
      var margin = parseInt(this._strAttr('margin', '4'), 10);
      if (isNaN(margin) || margin < 0) margin = 4;

      if (!src) {
        this._renderShadow('', CSS);
        return;
      }

      var result = generateQr(src, level);
      if (!result) {
        this._renderShadow('', CSS);
        this.emit('error', { message: 'Content is too long to encode at error-correction level ' + level.toUpperCase() + ', even at the largest QR version (40).' });
        return;
      }

      // Fills go through style="fill:...;" rather than a bare fill="..."
      // attribute -- inline style is where CSS var() reliably resolves;
      // a plain SVG presentation attribute is not guaranteed to.
      var n = result.size + margin * 2;
      var rects = '<rect x="0" y="0" width="' + n + '" height="' + n + '" style="fill: ' + escapeXml(bg) + ';"></rect>';
      for (var r = 0; r < result.size; r++) {
        for (var c = 0; c < result.size; c++) {
          if (!result.matrix[r][c]) continue;
          var fill = result.isFinder[r][c] ? cornerColor : color;
          rects += '<rect x="' + (c + margin) + '" y="' + (r + margin) + '" width="1" height="1"' +
            (radius > 0 ? ' rx="' + radius + '" ry="' + radius + '"' : '') +
            ' style="fill: ' + escapeXml(fill) + ';"></rect>';
        }
      }

      // Name: the developer's label if given, else what the code encodes.
      var name = this._hostLabel() || this._strAttr('label', '') || ('QR code for: ' + src);
      var svg = '<svg viewBox="0 0 ' + n + ' ' + n + '" width="' + size + '" height="' + size + '"' +
        ' role="img" aria-label="' + escapeXml(name) + '">' + rects + '</svg>';

      this._renderShadow(svg, CSS);
      this.emit('render', { version: result.version, size: result.size, level: result.level });
    }
  }

  window.LWT.define('lwtg-qr', LWTQr);
})();
