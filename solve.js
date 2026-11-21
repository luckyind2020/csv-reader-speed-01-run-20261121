// A fast drop-in for csv-reader 1.0.0.
//
// run({text, header}) returns {columns, rows, errors}: the reference reader's
// exact reading of the input, produced by scanning with bulk string searches
// (indexOf and slice) instead of a character at a time.
//
// The reading policy, from the competition rules:
// - a U+FEFF at the very start is dropped;
// - a record ends at LF or CRLF, and a line left with no characters is no record;
// - outside a quoted field a CR not followed by LF is dropped (stray_cr);
// - a field that opens with a quote runs to the next quote that is not doubled;
//   "" inside it is one quote, and each CRLF or lone CR inside it reads as LF;
//   what follows its closing quote, up to the next comma or line break, is
//   appended as it stands (quote_junk, when the field ends); a quote that never
//   closes is a literal character, and the text after it is read again as
//   unquoted (unterminated_quote); a quote inside an unquoted field is literal;
// - fields stay strings, never trimmed or converted;
// - columns is the first record when header is true, else null; rows holds the
//   records after it (every record when header is false), each padded with
//   empty strings (short_row, with fields: its field count) or cut (long_row,
//   with extra: the cut fields) to the first record's width;
// - each error is {code, line, row}, in the order met: line the 1-based line
//   its record starts on, row its record's index in rows (null for the header).

const COMMA = 0;
const BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // A quoted field's raw span, folded the way the reference reads it: every
  // CRLF and every lone CR becomes LF, and the line count advances by every
  // line break inside it.
  function foldRaw(raw) {
    if (raw.indexOf("\r") === -1) {
      let count = 0;
      let at = -1;
      while ((at = raw.indexOf("\n", at + 1)) !== -1) count += 1;
      line += count;
      return raw;
    }
    const breaks = raw.match(/\r\n?|\n/g);
    line += breaks ? breaks.length : 0;
    return raw.replace(/\r\n?/g, "\n");
  }

  // One unquoted field, starting at `start`, whose value begins as `init`.
  // Returns {value, ended, added}: added is how many characters this scan
  // kept (used to tell whether a junk tail added anything). Moves pos/line
  // forward and records stray_cr errors as they are met.
  //
  // The nearest comma or LF bounds each slice, and a CR is only ever looked
  // for inside that slice: a bare indexOf("\r") would run to the end of the
  // whole file on LF-only input, where CRs are sparse.
  function scanPlain(start, init) {
    let value = init;
    let added = 0;
    let p = start;
    for (;;) {
      const iC = text.indexOf(",", p);
      const iL = text.indexOf("\n", p);
      let m = -1;
      let isComma = false;
      if (iC !== -1 && (iL === -1 || iC < iL)) {
        m = iC;
        isComma = true;
      } else if (iL !== -1) {
        m = iL;
      }
      if (m === -1) {
        // No comma or LF ahead: the field runs to the end of the file.
        // No LF ahead means no CR here can be followed by one, so every
        // CR left is a stray one.
        const tail = text.slice(p, n);
        const crAt = tail.indexOf("\r");
        if (crAt === -1) {
          if (tail) {
            value += tail;
            added += tail.length;
          }
          pos = n;
          return { value, ended: END, added };
        }
        if (crAt > 0) {
          value += tail.slice(0, crAt);
          added += crAt;
        }
        errors.push({ code: "stray_cr", line: recordLine, row: recordRow });
        p = p + crAt + 1;
        continue;
      }
      const piece = text.slice(p, m);
      const crAt = piece.indexOf("\r");
      if (crAt === -1) {
        if (piece) {
          value += piece;
          added += piece.length;
        }
        pos = m + 1;
        if (!isComma) line += 1;
        return { value, ended: isComma ? COMMA : BREAK, added };
      }
      if (text.charCodeAt(p + crAt + 1) === 10) {
        // The CR is followed by LF: a line break, and the field ends here.
        if (crAt > 0) {
          value += piece.slice(0, crAt);
          added += crAt;
        }
        pos = p + crAt + 2;
        line += 1;
        return { value, ended: BREAK, added };
      }
      // A stray CR: dropped, recorded, and the field goes on.
      if (crAt > 0) {
        value += piece.slice(0, crAt);
        added += crAt;
      }
      errors.push({ code: "stray_cr", line: recordLine, row: recordRow });
      p = p + crAt + 1;
    }
  }

  // What follows a closing quote: comma, LF, CRLF, end of input, or a junk
  // tail read as unquoted from the quoted value.
  function afterQuote(value) {
    if (pos >= n) return { value, ended: END, added: 0 };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA, added: 0 };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: BREAK, added: 0 };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: BREAK, added: 0 };
    }
    const junk = scanPlain(pos, value);
    if (junk.added > 0) {
      errors.push({ code: "quote_junk", line: recordLine, row: recordRow });
    }
    return junk;
  }

  // One quoted field. pos is at the opening quote.
  function scanQuoted() {
    const open = pos;
    const openLine = line;
    const q = text.indexOf('"', pos + 1);
    if (q === -1) {
      // Never closes: the quote is literal, and the text after it is read
      // again as unquoted, from the line the field opened on.
      pos = open + 1;
      line = openLine;
      errors.push({ code: "unterminated_quote", line: recordLine, row: recordRow });
      return scanPlain(open + 1, '"');
    }
    if (text.charCodeAt(q + 1) !== 34) {
      // One closing quote at q, with no doubling in between.
      const raw = text.slice(pos + 1, q);
      const value =
        raw.indexOf("\r") === -1 && raw.indexOf("\n") === -1
          ? raw
          : foldRaw(raw);
      pos = q + 1;
      return afterQuote(value);
    }
    // Doubled quotes and/or line breaks inside: walk quote to quote, folding
    // each span as it is met.
    let value = "";
    let seg = pos + 1;
    let p = pos + 1;
    for (;;) {
      const qq = text.indexOf('"', p);
      if (qq === -1) {
        pos = open + 1;
        line = openLine;
        errors.push({ code: "unterminated_quote", line: recordLine, row: recordRow });
        return scanPlain(open + 1, '"');
      }
      if (text.charCodeAt(qq + 1) === 34) {
        value += foldRaw(text.slice(seg, qq));
        value += '"';
        p = qq + 2;
        seg = qq + 2;
        continue;
      }
      value += foldRaw(text.slice(seg, qq));
      pos = qq + 1;
      return afterQuote(value);
    }
  }

  for (;;) {
    // Lines left with no characters are no record.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      const f = quoted ? scanQuoted() : scanPlain(pos, "");
      fields.push(f.value);
      ended = f.ended;
    } while (ended === COMMA);

    // A line that held only stray CRs is no record; its errors stay.
    if (fields.length === 1 && fields[0] === "" && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({
        code: "short_row",
        line: recordLine,
        row: recordRow,
        fields: fields.length,
      });
      while (fields.length < width) fields.push("");
    } else if (fields.length > width) {
      errors.push({
        code: "long_row",
        line: recordLine,
        row: recordRow,
        extra: fields.splice(width),
      });
    }
    rows.push(fields);
  }

  return { columns: header ? columns ?? [] : null, rows, errors };
}
