// Turns an Arduino .ino sketch into the C++ the compiler sees, the way the Arduino IDE does:
// adds #include <Arduino.h> and declares every function before it is used, with #line markers
// so errors point at the lines in the sketch.
(function (root) {
  const KEYWORDS = new Set(['if', 'else', 'for', 'while', 'switch', 'do', 'return', 'sizeof', 'catch', 'case']);

  // Same length as the source, with comments, strings and character literals blanked out.
  function blank(src) {
    let out = '', i = 0;
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
      if (c === '/' && n === '*') { out += '  '; i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } if (i < src.length) { out += '  '; i += 2; } continue; }
      if (c === '"' || c === "'") {
        out += c; i++;
        while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { out += ' '; i++; } out += ' '; i++; }
        if (i < src.length) { out += src[i]; i++; }
        continue;
      }
      if (c === '#') {   // preprocessor line, with continuations
        const start = i;
        while (i < src.length && src[i] !== '\n') { if (src[i] === '\\' && src[i + 1] === '\n') { out += ' \n'; i += 2; continue; } out += ' '; i++; }
        if (start === i) out += ' ';
        continue;
      }
      out += c; i++;
    }
    return out;
  }

  const lineAt = (src, pos) => { let l = 1; for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) l++; return l; };

  function prototypes(src) {
    const b = blank(src);
    // positions at brace depth 0 (outside any function, class or namespace body)
    const depth = new Int16Array(b.length + 1);
    let d = 0, paren = 0;
    for (let i = 0; i < b.length; i++) {
      depth[i] = d;
      if (b[i] === '{') d++; else if (b[i] === '}') d = Math.max(0, d - 1);
    }
    const defs = [], declared = new Set();
    const re = /([A-Za-z_][\w:<>,\s\*&]*?[\s\*&])([A-Za-z_]\w*)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*(const\s*)?(\{|;)/g;
    let m;
    while ((m = re.exec(b))) {
      if (depth[m.index] !== 0) continue;
      const name = m[2];
      let ret = m[1].replace(/\s+/g, ' ').trim();
      const lead = ret.split(' ')[0];
      if (KEYWORDS.has(name) || KEYWORDS.has(lead) || /^(return|else|new|delete|typedef|using)\b/.test(ret)) continue;
      if (/[=]/.test(m[1])) continue;
      // the text before must start a statement: beginning, ;, } or a newline after those
      const before = b.slice(0, m.index).replace(/\s+$/, '');
      const prev = before[before.length - 1];
      if (prev && !/[;}{]/.test(prev) && !/\n/.test(b.slice(before.length, m.index + 1))) continue;
      if (/template\s*<[^>]*>\s*$/.test(before)) continue;
      const params = src.slice(m.index + m[0].indexOf('(', m[1].length + m[2].length) + 1, m.index + m[0].lastIndexOf(')')).replace(/\s+/g, ' ').trim();
      if (m[5] === ';') { declared.add(name); continue; }
      const start = m.index + (m[1].length - m[1].trimStart().length);
      defs.push({ name, sig: `${ret} ${name}(${params.replace(/=[^,]*/g, '')})${m[4] ? ' const' : ''};`, line: lineAt(src, start), pos: start });
    }
    return { defs: defs.filter(f => !declared.has(f.name) && !f.name.includes('::') && !m?.[1]?.includes('::') && f.name !== 'main'), all: defs };
  }

  // Line of the first function definition: prototypes go just before it
  function preprocess(src, file) {
    const { defs, all } = prototypes(src);
    const at = all.length ? all[0].line : null;
    const lines = src.split('\n');
    let out = `#include <Arduino.h>\n#line 1 "${file}"\n`;
    if (at && defs.length) {
      out += lines.slice(0, at - 1).join('\n') + (at > 1 ? '\n' : '');
      const seen = new Set();
      for (const f of defs) { if (seen.has(f.sig)) continue; seen.add(f.sig); out += `#line ${f.line} "${file}"\n${f.sig}\n`; }
      out += `#line ${at} "${file}"\n` + lines.slice(at - 1).join('\n');
    } else out += src;
    return out + '\n';
  }

  // Header files the sketch includes, to decide which libraries to link
  function includes(src) {
    return [...src.matchAll(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm)].map(m => m[1]);
  }

  root.InoPrep = { preprocess, includes, prototypes, blank };
})(typeof self !== 'undefined' ? self : globalThis);
