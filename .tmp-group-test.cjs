var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to2, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to2, key) && key !== except)
        __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to2;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@neondatabase/serverless/index.mjs
var Po = Object.create;
var Ie = Object.defineProperty;
var Ro = Object.getOwnPropertyDescriptor;
var Lo = Object.getOwnPropertyNames;
var Bo = Object.getPrototypeOf;
var Fo = Object.prototype.hasOwnProperty;
var Mo = (r, e, t) => e in r ? Ie(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t;
var a = (r, e) => Ie(r, "name", { value: e, configurable: true });
var V = (r, e, t) => () => {
  if (t) throw t[0];
  try {
    return r && (e = r(r = 0)), e;
  } catch (n) {
    throw t = [n], n;
  }
};
var T = (r, e) => () => {
  try {
    return e || r((e = { exports: {} }).exports, e), e.exports;
  } catch (t) {
    throw e = 0, t;
  }
};
var se = (r, e) => {
  for (var t in e) Ie(r, t, { get: e[t], enumerable: true });
};
var Dn = (r, e, t, n) => {
  if (e && typeof e == "object" || typeof e == "function") for (let i of Lo(e)) !Fo.call(r, i) && i !== t && Ie(r, i, { get: () => e[i], enumerable: !(n = Ro(e, i)) || n.enumerable });
  return r;
};
var we = (r, e, t) => (t = r != null ? Po(Bo(r)) : {}, Dn(e || !r || !r.__esModule ? Ie(t, "default", { value: r, enumerable: true }) : t, r));
var O = (r) => Dn(Ie({}, "__esModule", { value: true }), r);
var E = (r, e, t) => Mo(r, typeof e != "symbol" ? e + "" : e, t);
var Wn = T((lt) => {
  "use strict";
  h();
  lt.byteLength = Oo;
  lt.toByteArray = Qo;
  lt.fromByteArray = No;
  var le = [], X = [], ko = typeof Uint8Array < "u" ? Uint8Array : Array, qt = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (Ae = 0, qn = qt.length; Ae < qn; ++Ae) le[Ae] = qt[Ae], X[qt.charCodeAt(Ae)] = Ae;
  var Ae, qn;
  X[45] = 62;
  X[95] = 63;
  function Nn(r) {
    var e = r.length;
    if (e % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
    var t = r.indexOf("=");
    t === -1 && (t = e);
    var n = t === e ? 0 : 4 - t % 4;
    return [t, n];
  }
  a(Nn, "getLens");
  function Oo(r) {
    var e = Nn(r), t = e[0], n = e[1];
    return (t + n) * 3 / 4 - n;
  }
  a(Oo, "byteLength");
  function Uo(r, e, t) {
    return (e + t) * 3 / 4 - t;
  }
  a(Uo, "_byteLength");
  function Qo(r) {
    var e, t = Nn(r), n = t[0], i = t[1], s = new ko(Uo(r, n, i)), o = 0, u = i > 0 ? n - 4 : n, c;
    for (c = 0; c < u; c += 4) e = X[r.charCodeAt(c)] << 18 | X[r.charCodeAt(c + 1)] << 12 | X[r.charCodeAt(c + 2)] << 6 | X[r.charCodeAt(
      c + 3
    )], s[o++] = e >> 16 & 255, s[o++] = e >> 8 & 255, s[o++] = e & 255;
    return i === 2 && (e = X[r.charCodeAt(c)] << 2 | X[r.charCodeAt(
      c + 1
    )] >> 4, s[o++] = e & 255), i === 1 && (e = X[r.charCodeAt(c)] << 10 | X[r.charCodeAt(c + 1)] << 4 | X[r.charCodeAt(c + 2)] >> 2, s[o++] = e >> 8 & 255, s[o++] = e & 255), s;
  }
  a(Qo, "toByteArray");
  function Do(r) {
    return le[r >> 18 & 63] + le[r >> 12 & 63] + le[r >> 6 & 63] + le[r & 63];
  }
  a(Do, "tripletToBase64");
  function qo(r, e, t) {
    for (var n, i = [], s = e; s < t; s += 3) n = (r[s] << 16 & 16711680) + (r[s + 1] << 8 & 65280) + (r[s + 2] & 255), i.push(Do(n));
    return i.join("");
  }
  a(qo, "encodeChunk");
  function No(r) {
    for (var e, t = r.length, n = t % 3, i = [], s = 16383, o = 0, u = t - n; o < u; o += s) i.push(qo(r, o, o + s > u ? u : o + s));
    return n === 1 ? (e = r[t - 1], i.push(le[e >> 2] + le[e << 4 & 63] + "==")) : n === 2 && (e = (r[t - 2] << 8) + r[t - 1], i.push(le[e >> 10] + le[e >> 4 & 63] + le[e << 2 & 63] + "=")), i.join("");
  }
  a(No, "fromByteArray");
});
var jn = T((Nt) => {
  h();
  Nt.read = function(r, e, t, n, i) {
    var s, o, u = i * 8 - n - 1, c = (1 << u) - 1, l = c >> 1, f = -7, m = t ? i - 1 : 0, g = t ? -1 : 1, w = r[e + m];
    for (m += g, s = w & (1 << -f) - 1, w >>= -f, f += u; f > 0; s = s * 256 + r[e + m], m += g, f -= 8) ;
    for (o = s & (1 << -f) - 1, s >>= -f, f += n; f > 0; o = o * 256 + r[e + m], m += g, f -= 8) ;
    if (s === 0) s = 1 - l;
    else {
      if (s === c) return o ? NaN : (w ? -1 : 1) * (1 / 0);
      o = o + Math.pow(2, n), s = s - l;
    }
    return (w ? -1 : 1) * o * Math.pow(2, s - n);
  };
  Nt.write = function(r, e, t, n, i, s) {
    var o, u, c, l = s * 8 - i - 1, f = (1 << l) - 1, m = f >> 1, g = i === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, w = n ? 0 : s - 1, S = n ? 1 : -1, k = e < 0 || e === 0 && 1 / e < 0 ? 1 : 0;
    for (e = Math.abs(e), isNaN(e) || e === 1 / 0 ? (u = isNaN(e) ? 1 : 0, o = f) : (o = Math.floor(Math.log(e) / Math.LN2), e * (c = Math.pow(2, -o)) < 1 && (o--, c *= 2), o + m >= 1 ? e += g / c : e += g * Math.pow(2, 1 - m), e * c >= 2 && (o++, c /= 2), o + m >= f ? (u = 0, o = f) : o + m >= 1 ? (u = (e * c - 1) * Math.pow(2, i), o = o + m) : (u = e * Math.pow(2, m - 1) * Math.pow(2, i), o = 0)); i >= 8; r[t + w] = u & 255, w += S, u /= 256, i -= 8) ;
    for (o = o << i | u, l += i; l > 0; r[t + w] = o & 255, w += S, o /= 256, l -= 8) ;
    r[t + w - S] |= k * 128;
  };
});
var oi = T((Be) => {
  "use strict";
  h();
  var Wt = Wn(), Re = jn(), Hn = typeof Symbol == "function" && typeof Symbol.for == "function" ? Symbol.for("nodejs.util.inspect.custom") : null;
  Be.Buffer = d;
  Be.SlowBuffer = Vo;
  Be.INSPECT_MAX_BYTES = 50;
  var ft = 2147483647;
  Be.kMaxLength = ft;
  d.TYPED_ARRAY_SUPPORT = Wo();
  !d.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support.");
  function Wo() {
    try {
      let r = new Uint8Array(1), e = { foo: a(function() {
        return 42;
      }, "foo") };
      return Object.setPrototypeOf(e, Uint8Array.prototype), Object.setPrototypeOf(r, e), r.foo() === 42;
    } catch {
      return false;
    }
  }
  a(Wo, "typedArraySupport");
  Object.defineProperty(d.prototype, "parent", { enumerable: true, get: a(function() {
    if (d.isBuffer(this)) return this.buffer;
  }, "get") });
  Object.defineProperty(d.prototype, "offset", { enumerable: true, get: a(function() {
    if (d.isBuffer(
      this
    )) return this.byteOffset;
  }, "get") });
  function de(r) {
    if (r > ft) throw new RangeError('The value "' + r + '" is invalid for option "size"');
    let e = new Uint8Array(r);
    return Object.setPrototypeOf(e, d.prototype), e;
  }
  a(de, "createBuffer");
  function d(r, e, t) {
    if (typeof r == "number") {
      if (typeof e == "string") throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      );
      return Gt(r);
    }
    return zn(r, e, t);
  }
  a(d, "Buffer");
  d.poolSize = 8192;
  function zn(r, e, t) {
    if (typeof r == "string") return Ho(r, e);
    if (ArrayBuffer.isView(r)) return $o(r);
    if (r == null) throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof r);
    if (fe(r, ArrayBuffer) || r && fe(r.buffer, ArrayBuffer) || typeof SharedArrayBuffer < "u" && (fe(r, SharedArrayBuffer) || r && fe(
      r.buffer,
      SharedArrayBuffer
    ))) return Ht(r, e, t);
    if (typeof r == "number") throw new TypeError('The "value" argument must not be of type number. Received type number');
    let n = r.valueOf && r.valueOf();
    if (n != null && n !== r) return d.from(n, e, t);
    let i = Go(r);
    if (i) return i;
    if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof r[Symbol.toPrimitive] == "function") return d.from(r[Symbol.toPrimitive]("string"), e, t);
    throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof r);
  }
  a(zn, "from");
  d.from = function(r, e, t) {
    return zn(r, e, t);
  };
  Object.setPrototypeOf(
    d.prototype,
    Uint8Array.prototype
  );
  Object.setPrototypeOf(d, Uint8Array);
  function Kn(r) {
    if (typeof r != "number") throw new TypeError(
      '"size" argument must be of type number'
    );
    if (r < 0) throw new RangeError('The value "' + r + '" is invalid for option "size"');
  }
  a(Kn, "assertSize");
  function jo(r, e, t) {
    return Kn(r), r <= 0 ? de(r) : e !== void 0 ? typeof t == "string" ? de(r).fill(e, t) : de(r).fill(e) : de(r);
  }
  a(jo, "alloc");
  d.alloc = function(r, e, t) {
    return jo(r, e, t);
  };
  function Gt(r) {
    return Kn(r), de(r < 0 ? 0 : Vt(r) | 0);
  }
  a(Gt, "allocUnsafe");
  d.allocUnsafe = function(r) {
    return Gt(
      r
    );
  };
  d.allocUnsafeSlow = function(r) {
    return Gt(r);
  };
  function Ho(r, e) {
    if ((typeof e != "string" || e === "") && (e = "utf8"), !d.isEncoding(e)) throw new TypeError("Unknown encoding: " + e);
    let t = Yn(r, e) | 0, n = de(t), i = n.write(
      r,
      e
    );
    return i !== t && (n = n.slice(0, i)), n;
  }
  a(Ho, "fromString");
  function jt(r) {
    let e = r.length < 0 ? 0 : Vt(r.length) | 0, t = de(e);
    for (let n = 0; n < e; n += 1) t[n] = r[n] & 255;
    return t;
  }
  a(jt, "fromArrayLike");
  function $o(r) {
    if (fe(r, Uint8Array)) {
      let e = new Uint8Array(r);
      return Ht(e.buffer, e.byteOffset, e.byteLength);
    }
    return jt(r);
  }
  a($o, "fromArrayView");
  function Ht(r, e, t) {
    if (e < 0 || r.byteLength < e) throw new RangeError('"offset" is outside of buffer bounds');
    if (r.byteLength < e + (t || 0)) throw new RangeError('"length" is outside of buffer bounds');
    let n;
    return e === void 0 && t === void 0 ? n = new Uint8Array(r) : t === void 0 ? n = new Uint8Array(r, e) : n = new Uint8Array(
      r,
      e,
      t
    ), Object.setPrototypeOf(n, d.prototype), n;
  }
  a(Ht, "fromArrayBuffer");
  function Go(r) {
    if (d.isBuffer(r)) {
      let e = Vt(r.length) | 0, t = de(e);
      return t.length === 0 || r.copy(t, 0, 0, e), t;
    }
    if (r.length !== void 0) return typeof r.length != "number" || Kt(r.length) ? de(0) : jt(r);
    if (r.type === "Buffer" && Array.isArray(r.data)) return jt(r.data);
  }
  a(Go, "fromObject");
  function Vt(r) {
    if (r >= ft) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + ft.toString(16) + " bytes");
    return r | 0;
  }
  a(Vt, "checked");
  function Vo(r) {
    return +r != r && (r = 0), d.alloc(+r);
  }
  a(Vo, "SlowBuffer");
  d.isBuffer = a(function(e) {
    return e != null && e._isBuffer === true && e !== d.prototype;
  }, "isBuffer");
  d.compare = a(function(e, t) {
    if (fe(e, Uint8Array) && (e = d.from(e, e.offset, e.byteLength)), fe(t, Uint8Array) && (t = d.from(t, t.offset, t.byteLength)), !d.isBuffer(e) || !d.isBuffer(t)) throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    );
    if (e === t) return 0;
    let n = e.length, i = t.length;
    for (let s = 0, o = Math.min(n, i); s < o; ++s) if (e[s] !== t[s]) {
      n = e[s], i = t[s];
      break;
    }
    return n < i ? -1 : i < n ? 1 : 0;
  }, "compare");
  d.isEncoding = a(function(e) {
    switch (String(e).toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "latin1":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return true;
      default:
        return false;
    }
  }, "isEncoding");
  d.concat = a(function(e, t) {
    if (!Array.isArray(e)) throw new TypeError(
      '"list" argument must be an Array of Buffers'
    );
    if (e.length === 0) return d.alloc(0);
    let n;
    if (t === void 0)
      for (t = 0, n = 0; n < e.length; ++n) t += e[n].length;
    let i = d.allocUnsafe(t), s = 0;
    for (n = 0; n < e.length; ++n) {
      let o = e[n];
      if (fe(o, Uint8Array)) s + o.length > i.length ? (d.isBuffer(o) || (o = d.from(o)), o.copy(i, s)) : Uint8Array.prototype.set.call(i, o, s);
      else if (d.isBuffer(o)) o.copy(i, s);
      else throw new TypeError('"list" argument must be an Array of Buffers');
      s += o.length;
    }
    return i;
  }, "concat");
  function Yn(r, e) {
    if (d.isBuffer(r)) return r.length;
    if (ArrayBuffer.isView(r) || fe(r, ArrayBuffer)) return r.byteLength;
    if (typeof r != "string") throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof r
    );
    let t = r.length, n = arguments.length > 2 && arguments[2] === true;
    if (!n && t === 0) return 0;
    let i = false;
    for (; ; ) switch (e) {
      case "ascii":
      case "latin1":
      case "binary":
        return t;
      case "utf8":
      case "utf-8":
        return $t(r).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return t * 2;
      case "hex":
        return t >>> 1;
      case "base64":
        return si(r).length;
      default:
        if (i) return n ? -1 : $t(r).length;
        e = ("" + e).toLowerCase(), i = true;
    }
  }
  a(Yn, "byteLength");
  d.byteLength = Yn;
  function zo(r, e, t) {
    let n = false;
    if ((e === void 0 || e < 0) && (e = 0), e > this.length || ((t === void 0 || t > this.length) && (t = this.length), t <= 0) || (t >>>= 0, e >>>= 0, t <= e)) return "";
    for (r || (r = "utf8"); ; ) switch (r) {
      case "hex":
        return ia(this, e, t);
      case "utf8":
      case "utf-8":
        return Jn(this, e, t);
      case "ascii":
        return ra(this, e, t);
      case "latin1":
      case "binary":
        return na(
          this,
          e,
          t
        );
      case "base64":
        return ea(this, e, t);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return sa(
          this,
          e,
          t
        );
      default:
        if (n) throw new TypeError("Unknown encoding: " + r);
        r = (r + "").toLowerCase(), n = true;
    }
  }
  a(
    zo,
    "slowToString"
  );
  d.prototype._isBuffer = true;
  function Ce(r, e, t) {
    let n = r[e];
    r[e] = r[t], r[t] = n;
  }
  a(Ce, "swap");
  d.prototype.swap16 = a(function() {
    let e = this.length;
    if (e % 2 !== 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
    for (let t = 0; t < e; t += 2) Ce(this, t, t + 1);
    return this;
  }, "swap16");
  d.prototype.swap32 = a(function() {
    let e = this.length;
    if (e % 4 !== 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
    for (let t = 0; t < e; t += 4) Ce(this, t, t + 3), Ce(this, t + 1, t + 2);
    return this;
  }, "swap32");
  d.prototype.swap64 = a(
    function() {
      let e = this.length;
      if (e % 8 !== 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
      for (let t = 0; t < e; t += 8) Ce(this, t, t + 7), Ce(this, t + 1, t + 6), Ce(this, t + 2, t + 5), Ce(this, t + 3, t + 4);
      return this;
    },
    "swap64"
  );
  d.prototype.toString = a(function() {
    let e = this.length;
    return e === 0 ? "" : arguments.length === 0 ? Jn(
      this,
      0,
      e
    ) : zo.apply(this, arguments);
  }, "toString");
  d.prototype.toLocaleString = d.prototype.toString;
  d.prototype.equals = a(function(e) {
    if (!d.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
    return this === e ? true : d.compare(this, e) === 0;
  }, "equals");
  d.prototype.inspect = a(function() {
    let e = "", t = Be.INSPECT_MAX_BYTES;
    return e = this.toString("hex", 0, t).replace(/(.{2})/g, "$1 ").trim(), this.length > t && (e += " ... "), "<Buffer " + e + ">";
  }, "inspect");
  Hn && (d.prototype[Hn] = d.prototype.inspect);
  d.prototype.compare = a(function(e, t, n, i, s) {
    if (fe(e, Uint8Array) && (e = d.from(e, e.offset, e.byteLength)), !d.isBuffer(e)) throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof e);
    if (t === void 0 && (t = 0), n === void 0 && (n = e ? e.length : 0), i === void 0 && (i = 0), s === void 0 && (s = this.length), t < 0 || n > e.length || i < 0 || s > this.length) throw new RangeError("out of range index");
    if (i >= s && t >= n) return 0;
    if (i >= s) return -1;
    if (t >= n) return 1;
    if (t >>>= 0, n >>>= 0, i >>>= 0, s >>>= 0, this === e) return 0;
    let o = s - i, u = n - t, c = Math.min(o, u), l = this.slice(
      i,
      s
    ), f = e.slice(t, n);
    for (let m = 0; m < c; ++m) if (l[m] !== f[m]) {
      o = l[m], u = f[m];
      break;
    }
    return o < u ? -1 : u < o ? 1 : 0;
  }, "compare");
  function Zn(r, e, t, n, i) {
    if (r.length === 0) return -1;
    if (typeof t == "string" ? (n = t, t = 0) : t > 2147483647 ? t = 2147483647 : t < -2147483648 && (t = -2147483648), t = +t, Kt(t) && (t = i ? 0 : r.length - 1), t < 0 && (t = r.length + t), t >= r.length) {
      if (i) return -1;
      t = r.length - 1;
    } else if (t < 0) if (i) t = 0;
    else return -1;
    if (typeof e == "string" && (e = d.from(
      e,
      n
    )), d.isBuffer(e)) return e.length === 0 ? -1 : $n(r, e, t, n, i);
    if (typeof e == "number") return e = e & 255, typeof Uint8Array.prototype.indexOf == "function" ? i ? Uint8Array.prototype.indexOf.call(r, e, t) : Uint8Array.prototype.lastIndexOf.call(r, e, t) : $n(r, [e], t, n, i);
    throw new TypeError("val must be string, number or Buffer");
  }
  a(Zn, "bidirectionalIndexOf");
  function $n(r, e, t, n, i) {
    let s = 1, o = r.length, u = e.length;
    if (n !== void 0 && (n = String(n).toLowerCase(), n === "ucs2" || n === "ucs-2" || n === "utf16le" || n === "utf-16le")) {
      if (r.length < 2 || e.length < 2) return -1;
      s = 2, o /= 2, u /= 2, t /= 2;
    }
    function c(f, m) {
      return s === 1 ? f[m] : f.readUInt16BE(m * s);
    }
    a(c, "read");
    let l;
    if (i) {
      let f = -1;
      for (l = t; l < o; l++) if (c(r, l) === c(e, f === -1 ? 0 : l - f)) {
        if (f === -1 && (f = l), l - f + 1 === u) return f * s;
      } else f !== -1 && (l -= l - f), f = -1;
    } else for (t + u > o && (t = o - u), l = t; l >= 0; l--) {
      let f = true;
      for (let m = 0; m < u; m++) if (c(r, l + m) !== c(e, m)) {
        f = false;
        break;
      }
      if (f) return l;
    }
    return -1;
  }
  a($n, "arrayIndexOf");
  d.prototype.includes = a(function(e, t, n) {
    return this.indexOf(
      e,
      t,
      n
    ) !== -1;
  }, "includes");
  d.prototype.indexOf = a(function(e, t, n) {
    return Zn(this, e, t, n, true);
  }, "indexOf");
  d.prototype.lastIndexOf = a(function(e, t, n) {
    return Zn(this, e, t, n, false);
  }, "lastIndexOf");
  function Ko(r, e, t, n) {
    t = Number(t) || 0;
    let i = r.length - t;
    n ? (n = Number(n), n > i && (n = i)) : n = i;
    let s = e.length;
    n > s / 2 && (n = s / 2);
    let o;
    for (o = 0; o < n; ++o) {
      let u = parseInt(e.substr(o * 2, 2), 16);
      if (Kt(u)) return o;
      r[t + o] = u;
    }
    return o;
  }
  a(Ko, "hexWrite");
  function Yo(r, e, t, n) {
    return ht($t(e, r.length - t), r, t, n);
  }
  a(Yo, "utf8Write");
  function Zo(r, e, t, n) {
    return ht(ca(e), r, t, n);
  }
  a(
    Zo,
    "asciiWrite"
  );
  function Jo(r, e, t, n) {
    return ht(si(e), r, t, n);
  }
  a(Jo, "base64Write");
  function Xo(r, e, t, n) {
    return ht(
      la(e, r.length - t),
      r,
      t,
      n
    );
  }
  a(Xo, "ucs2Write");
  d.prototype.write = a(function(e, t, n, i) {
    if (t === void 0) i = "utf8", n = this.length, t = 0;
    else if (n === void 0 && typeof t == "string") i = t, n = this.length, t = 0;
    else if (isFinite(t))
      t = t >>> 0, isFinite(n) ? (n = n >>> 0, i === void 0 && (i = "utf8")) : (i = n, n = void 0);
    else throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
    let s = this.length - t;
    if ((n === void 0 || n > s) && (n = s), e.length > 0 && (n < 0 || t < 0) || t > this.length) throw new RangeError("Attempt to write outside buffer bounds");
    i || (i = "utf8");
    let o = false;
    for (; ; ) switch (i) {
      case "hex":
        return Ko(this, e, t, n);
      case "utf8":
      case "utf-8":
        return Yo(this, e, t, n);
      case "ascii":
      case "latin1":
      case "binary":
        return Zo(this, e, t, n);
      case "base64":
        return Jo(this, e, t, n);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return Xo(this, e, t, n);
      default:
        if (o) throw new TypeError("Unknown encoding: " + i);
        i = ("" + i).toLowerCase(), o = true;
    }
  }, "write");
  d.prototype.toJSON = a(function() {
    return { type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0) };
  }, "toJSON");
  function ea(r, e, t) {
    return e === 0 && t === r.length ? Wt.fromByteArray(r) : Wt.fromByteArray(r.slice(e, t));
  }
  a(ea, "base64Slice");
  function Jn(r, e, t) {
    t = Math.min(r.length, t);
    let n = [], i = e;
    for (; i < t; ) {
      let s = r[i], o = null, u = s > 239 ? 4 : s > 223 ? 3 : s > 191 ? 2 : 1;
      if (i + u <= t) {
        let c, l, f, m;
        switch (u) {
          case 1:
            s < 128 && (o = s);
            break;
          case 2:
            c = r[i + 1], (c & 192) === 128 && (m = (s & 31) << 6 | c & 63, m > 127 && (o = m));
            break;
          case 3:
            c = r[i + 1], l = r[i + 2], (c & 192) === 128 && (l & 192) === 128 && (m = (s & 15) << 12 | (c & 63) << 6 | l & 63, m > 2047 && (m < 55296 || m > 57343) && (o = m));
            break;
          case 4:
            c = r[i + 1], l = r[i + 2], f = r[i + 3], (c & 192) === 128 && (l & 192) === 128 && (f & 192) === 128 && (m = (s & 15) << 18 | (c & 63) << 12 | (l & 63) << 6 | f & 63, m > 65535 && m < 1114112 && (o = m));
        }
      }
      o === null ? (o = 65533, u = 1) : o > 65535 && (o -= 65536, n.push(o >>> 10 & 1023 | 55296), o = 56320 | o & 1023), n.push(o), i += u;
    }
    return ta(n);
  }
  a(Jn, "utf8Slice");
  var Gn = 4096;
  function ta(r) {
    let e = r.length;
    if (e <= Gn) return String.fromCharCode.apply(String, r);
    let t = "", n = 0;
    for (; n < e; ) t += String.fromCharCode.apply(String, r.slice(n, n += Gn));
    return t;
  }
  a(ta, "decodeCodePointsArray");
  function ra(r, e, t) {
    let n = "";
    t = Math.min(r.length, t);
    for (let i = e; i < t; ++i) n += String.fromCharCode(r[i] & 127);
    return n;
  }
  a(ra, "asciiSlice");
  function na(r, e, t) {
    let n = "";
    t = Math.min(r.length, t);
    for (let i = e; i < t; ++i) n += String.fromCharCode(r[i]);
    return n;
  }
  a(na, "latin1Slice");
  function ia(r, e, t) {
    let n = r.length;
    (!e || e < 0) && (e = 0), (!t || t < 0 || t > n) && (t = n);
    let i = "";
    for (let s = e; s < t; ++s) i += fa[r[s]];
    return i;
  }
  a(ia, "hexSlice");
  function sa(r, e, t) {
    let n = r.slice(e, t), i = "";
    for (let s = 0; s < n.length - 1; s += 2) i += String.fromCharCode(n[s] + n[s + 1] * 256);
    return i;
  }
  a(sa, "utf16leSlice");
  d.prototype.slice = a(function(e, t) {
    let n = this.length;
    e = ~~e, t = t === void 0 ? n : ~~t, e < 0 ? (e += n, e < 0 && (e = 0)) : e > n && (e = n), t < 0 ? (t += n, t < 0 && (t = 0)) : t > n && (t = n), t < e && (t = e);
    let i = this.subarray(e, t);
    return Object.setPrototypeOf(i, d.prototype), i;
  }, "slice");
  function U(r, e, t) {
    if (r % 1 !== 0 || r < 0) throw new RangeError("offset is not uint");
    if (r + e > t) throw new RangeError("Trying to access beyond buffer length");
  }
  a(U, "checkOffset");
  d.prototype.readUintLE = d.prototype.readUIntLE = a(
    function(e, t, n) {
      e = e >>> 0, t = t >>> 0, n || U(e, t, this.length);
      let i = this[e], s = 1, o = 0;
      for (; ++o < t && (s *= 256); ) i += this[e + o] * s;
      return i;
    },
    "readUIntLE"
  );
  d.prototype.readUintBE = d.prototype.readUIntBE = a(function(e, t, n) {
    e = e >>> 0, t = t >>> 0, n || U(
      e,
      t,
      this.length
    );
    let i = this[e + --t], s = 1;
    for (; t > 0 && (s *= 256); ) i += this[e + --t] * s;
    return i;
  }, "readUIntBE");
  d.prototype.readUint8 = d.prototype.readUInt8 = a(
    function(e, t) {
      return e = e >>> 0, t || U(e, 1, this.length), this[e];
    },
    "readUInt8"
  );
  d.prototype.readUint16LE = d.prototype.readUInt16LE = a(function(e, t) {
    return e = e >>> 0, t || U(
      e,
      2,
      this.length
    ), this[e] | this[e + 1] << 8;
  }, "readUInt16LE");
  d.prototype.readUint16BE = d.prototype.readUInt16BE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 2, this.length), this[e] << 8 | this[e + 1];
  }, "readUInt16BE");
  d.prototype.readUint32LE = d.prototype.readUInt32LE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 4, this.length), (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + this[e + 3] * 16777216;
  }, "readUInt32LE");
  d.prototype.readUint32BE = d.prototype.readUInt32BE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 4, this.length), this[e] * 16777216 + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]);
  }, "readUInt32BE");
  d.prototype.readBigUInt64LE = be(a(function(e) {
    e = e >>> 0, Le(e, "offset");
    let t = this[e], n = this[e + 7];
    (t === void 0 || n === void 0) && We(e, this.length - 8);
    let i = t + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + this[++e] * 2 ** 24, s = this[++e] + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + n * 2 ** 24;
    return BigInt(i) + (BigInt(s) << BigInt(32));
  }, "readBigUInt64LE"));
  d.prototype.readBigUInt64BE = be(a(function(e) {
    e = e >>> 0, Le(e, "offset");
    let t = this[e], n = this[e + 7];
    (t === void 0 || n === void 0) && We(e, this.length - 8);
    let i = t * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + this[++e], s = this[++e] * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + n;
    return (BigInt(i) << BigInt(
      32
    )) + BigInt(s);
  }, "readBigUInt64BE"));
  d.prototype.readIntLE = a(function(e, t, n) {
    e = e >>> 0, t = t >>> 0, n || U(
      e,
      t,
      this.length
    );
    let i = this[e], s = 1, o = 0;
    for (; ++o < t && (s *= 256); ) i += this[e + o] * s;
    return s *= 128, i >= s && (i -= Math.pow(2, 8 * t)), i;
  }, "readIntLE");
  d.prototype.readIntBE = a(function(e, t, n) {
    e = e >>> 0, t = t >>> 0, n || U(e, t, this.length);
    let i = t, s = 1, o = this[e + --i];
    for (; i > 0 && (s *= 256); ) o += this[e + --i] * s;
    return s *= 128, o >= s && (o -= Math.pow(2, 8 * t)), o;
  }, "readIntBE");
  d.prototype.readInt8 = a(function(e, t) {
    return e = e >>> 0, t || U(e, 1, this.length), this[e] & 128 ? (255 - this[e] + 1) * -1 : this[e];
  }, "readInt8");
  d.prototype.readInt16LE = a(function(e, t) {
    e = e >>> 0, t || U(
      e,
      2,
      this.length
    );
    let n = this[e] | this[e + 1] << 8;
    return n & 32768 ? n | 4294901760 : n;
  }, "readInt16LE");
  d.prototype.readInt16BE = a(function(e, t) {
    e = e >>> 0, t || U(e, 2, this.length);
    let n = this[e + 1] | this[e] << 8;
    return n & 32768 ? n | 4294901760 : n;
  }, "readInt16BE");
  d.prototype.readInt32LE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 4, this.length), this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24;
  }, "readInt32LE");
  d.prototype.readInt32BE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 4, this.length), this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3];
  }, "readInt32BE");
  d.prototype.readBigInt64LE = be(a(function(e) {
    e = e >>> 0, Le(e, "offset");
    let t = this[e], n = this[e + 7];
    (t === void 0 || n === void 0) && We(e, this.length - 8);
    let i = this[e + 4] + this[e + 5] * 2 ** 8 + this[e + 6] * 2 ** 16 + (n << 24);
    return (BigInt(i) << BigInt(
      32
    )) + BigInt(t + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + this[++e] * 2 ** 24);
  }, "readBigInt64LE"));
  d.prototype.readBigInt64BE = be(a(function(e) {
    e = e >>> 0, Le(e, "offset");
    let t = this[e], n = this[e + 7];
    (t === void 0 || n === void 0) && We(e, this.length - 8);
    let i = (t << 24) + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + this[++e];
    return (BigInt(i) << BigInt(32)) + BigInt(
      this[++e] * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + n
    );
  }, "readBigInt64BE"));
  d.prototype.readFloatLE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 4, this.length), Re.read(this, e, true, 23, 4);
  }, "readFloatLE");
  d.prototype.readFloatBE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 4, this.length), Re.read(this, e, false, 23, 4);
  }, "readFloatBE");
  d.prototype.readDoubleLE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 8, this.length), Re.read(this, e, true, 52, 8);
  }, "readDoubleLE");
  d.prototype.readDoubleBE = a(function(e, t) {
    return e = e >>> 0, t || U(e, 8, this.length), Re.read(
      this,
      e,
      false,
      52,
      8
    );
  }, "readDoubleBE");
  function z(r, e, t, n, i, s) {
    if (!d.isBuffer(r)) throw new TypeError('"buffer" argument must be a Buffer instance');
    if (e > i || e < s) throw new RangeError('"value" argument is out of bounds');
    if (t + n > r.length) throw new RangeError("Index out of range");
  }
  a(z, "checkInt");
  d.prototype.writeUintLE = d.prototype.writeUIntLE = a(function(e, t, n, i) {
    if (e = +e, t = t >>> 0, n = n >>> 0, !i) {
      let u = Math.pow(2, 8 * n) - 1;
      z(
        this,
        e,
        t,
        n,
        u,
        0
      );
    }
    let s = 1, o = 0;
    for (this[t] = e & 255; ++o < n && (s *= 256); ) this[t + o] = e / s & 255;
    return t + n;
  }, "writeUIntLE");
  d.prototype.writeUintBE = d.prototype.writeUIntBE = a(function(e, t, n, i) {
    if (e = +e, t = t >>> 0, n = n >>> 0, !i) {
      let u = Math.pow(2, 8 * n) - 1;
      z(this, e, t, n, u, 0);
    }
    let s = n - 1, o = 1;
    for (this[t + s] = e & 255; --s >= 0 && (o *= 256); ) this[t + s] = e / o & 255;
    return t + n;
  }, "writeUIntBE");
  d.prototype.writeUint8 = d.prototype.writeUInt8 = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(this, e, t, 1, 255, 0), this[t] = e & 255, t + 1;
  }, "writeUInt8");
  d.prototype.writeUint16LE = d.prototype.writeUInt16LE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(this, e, t, 2, 65535, 0), this[t] = e & 255, this[t + 1] = e >>> 8, t + 2;
  }, "writeUInt16LE");
  d.prototype.writeUint16BE = d.prototype.writeUInt16BE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(this, e, t, 2, 65535, 0), this[t] = e >>> 8, this[t + 1] = e & 255, t + 2;
  }, "writeUInt16BE");
  d.prototype.writeUint32LE = d.prototype.writeUInt32LE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(
      this,
      e,
      t,
      4,
      4294967295,
      0
    ), this[t + 3] = e >>> 24, this[t + 2] = e >>> 16, this[t + 1] = e >>> 8, this[t] = e & 255, t + 4;
  }, "writeUInt32LE");
  d.prototype.writeUint32BE = d.prototype.writeUInt32BE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(
      this,
      e,
      t,
      4,
      4294967295,
      0
    ), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = e & 255, t + 4;
  }, "writeUInt32BE");
  function Xn(r, e, t, n, i) {
    ii(e, n, i, r, t, 7);
    let s = Number(e & BigInt(4294967295));
    r[t++] = s, s = s >> 8, r[t++] = s, s = s >> 8, r[t++] = s, s = s >> 8, r[t++] = s;
    let o = Number(e >> BigInt(32) & BigInt(4294967295));
    return r[t++] = o, o = o >> 8, r[t++] = o, o = o >> 8, r[t++] = o, o = o >> 8, r[t++] = o, t;
  }
  a(Xn, "wrtBigUInt64LE");
  function ei(r, e, t, n, i) {
    ii(e, n, i, r, t, 7);
    let s = Number(e & BigInt(4294967295));
    r[t + 7] = s, s = s >> 8, r[t + 6] = s, s = s >> 8, r[t + 5] = s, s = s >> 8, r[t + 4] = s;
    let o = Number(e >> BigInt(32) & BigInt(4294967295));
    return r[t + 3] = o, o = o >> 8, r[t + 2] = o, o = o >> 8, r[t + 1] = o, o = o >> 8, r[t] = o, t + 8;
  }
  a(ei, "wrtBigUInt64BE");
  d.prototype.writeBigUInt64LE = be(a(function(e, t = 0) {
    return Xn(this, e, t, BigInt(0), BigInt("0xffffffffffffffff"));
  }, "writeBigUInt64LE"));
  d.prototype.writeBigUInt64BE = be(a(function(e, t = 0) {
    return ei(this, e, t, BigInt(0), BigInt(
      "0xffffffffffffffff"
    ));
  }, "writeBigUInt64BE"));
  d.prototype.writeIntLE = a(function(e, t, n, i) {
    if (e = +e, t = t >>> 0, !i) {
      let c = Math.pow(2, 8 * n - 1);
      z(this, e, t, n, c - 1, -c);
    }
    let s = 0, o = 1, u = 0;
    for (this[t] = e & 255; ++s < n && (o *= 256); )
      e < 0 && u === 0 && this[t + s - 1] !== 0 && (u = 1), this[t + s] = (e / o >> 0) - u & 255;
    return t + n;
  }, "writeIntLE");
  d.prototype.writeIntBE = a(function(e, t, n, i) {
    if (e = +e, t = t >>> 0, !i) {
      let c = Math.pow(2, 8 * n - 1);
      z(this, e, t, n, c - 1, -c);
    }
    let s = n - 1, o = 1, u = 0;
    for (this[t + s] = e & 255; --s >= 0 && (o *= 256); ) e < 0 && u === 0 && this[t + s + 1] !== 0 && (u = 1), this[t + s] = (e / o >> 0) - u & 255;
    return t + n;
  }, "writeIntBE");
  d.prototype.writeInt8 = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(this, e, t, 1, 127, -128), e < 0 && (e = 255 + e + 1), this[t] = e & 255, t + 1;
  }, "writeInt8");
  d.prototype.writeInt16LE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(this, e, t, 2, 32767, -32768), this[t] = e & 255, this[t + 1] = e >>> 8, t + 2;
  }, "writeInt16LE");
  d.prototype.writeInt16BE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(this, e, t, 2, 32767, -32768), this[t] = e >>> 8, this[t + 1] = e & 255, t + 2;
  }, "writeInt16BE");
  d.prototype.writeInt32LE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(
      this,
      e,
      t,
      4,
      2147483647,
      -2147483648
    ), this[t] = e & 255, this[t + 1] = e >>> 8, this[t + 2] = e >>> 16, this[t + 3] = e >>> 24, t + 4;
  }, "writeInt32LE");
  d.prototype.writeInt32BE = a(function(e, t, n) {
    return e = +e, t = t >>> 0, n || z(
      this,
      e,
      t,
      4,
      2147483647,
      -2147483648
    ), e < 0 && (e = 4294967295 + e + 1), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = e & 255, t + 4;
  }, "writeInt32BE");
  d.prototype.writeBigInt64LE = be(a(function(e, t = 0) {
    return Xn(this, e, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  }, "writeBigInt64LE"));
  d.prototype.writeBigInt64BE = be(
    a(function(e, t = 0) {
      return ei(this, e, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    }, "writeBigInt64BE")
  );
  function ti(r, e, t, n, i, s) {
    if (t + n > r.length) throw new RangeError("Index out of range");
    if (t < 0) throw new RangeError("Index out of range");
  }
  a(ti, "checkIEEE754");
  function ri(r, e, t, n, i) {
    return e = +e, t = t >>> 0, i || ti(r, e, t, 4, 34028234663852886e22, -34028234663852886e22), Re.write(r, e, t, n, 23, 4), t + 4;
  }
  a(
    ri,
    "writeFloat"
  );
  d.prototype.writeFloatLE = a(function(e, t, n) {
    return ri(this, e, t, true, n);
  }, "writeFloatLE");
  d.prototype.writeFloatBE = a(function(e, t, n) {
    return ri(this, e, t, false, n);
  }, "writeFloatBE");
  function ni(r, e, t, n, i) {
    return e = +e, t = t >>> 0, i || ti(r, e, t, 8, 17976931348623157e292, -17976931348623157e292), Re.write(
      r,
      e,
      t,
      n,
      52,
      8
    ), t + 8;
  }
  a(ni, "writeDouble");
  d.prototype.writeDoubleLE = a(function(e, t, n) {
    return ni(this, e, t, true, n);
  }, "writeDoubleLE");
  d.prototype.writeDoubleBE = a(function(e, t, n) {
    return ni(this, e, t, false, n);
  }, "writeDoubleBE");
  d.prototype.copy = a(function(e, t, n, i) {
    if (!d.isBuffer(e)) throw new TypeError("argument should be a Buffer");
    if (n || (n = 0), !i && i !== 0 && (i = this.length), t >= e.length && (t = e.length), t || (t = 0), i > 0 && i < n && (i = n), i === n || e.length === 0 || this.length === 0) return 0;
    if (t < 0) throw new RangeError("targetStart out of bounds");
    if (n < 0 || n >= this.length) throw new RangeError("Index out of range");
    if (i < 0) throw new RangeError("sourceEnd out of bounds");
    i > this.length && (i = this.length), e.length - t < i - n && (i = e.length - t + n);
    let s = i - n;
    return this === e && typeof Uint8Array.prototype.copyWithin == "function" ? this.copyWithin(t, n, i) : Uint8Array.prototype.set.call(e, this.subarray(n, i), t), s;
  }, "copy");
  d.prototype.fill = a(function(e, t, n, i) {
    if (typeof e == "string") {
      if (typeof t == "string" ? (i = t, t = 0, n = this.length) : typeof n == "string" && (i = n, n = this.length), i !== void 0 && typeof i != "string") throw new TypeError("encoding must be a string");
      if (typeof i == "string" && !d.isEncoding(i)) throw new TypeError(
        "Unknown encoding: " + i
      );
      if (e.length === 1) {
        let o = e.charCodeAt(0);
        (i === "utf8" && o < 128 || i === "latin1") && (e = o);
      }
    } else typeof e == "number" ? e = e & 255 : typeof e == "boolean" && (e = Number(e));
    if (t < 0 || this.length < t || this.length < n) throw new RangeError("Out of range index");
    if (n <= t) return this;
    t = t >>> 0, n = n === void 0 ? this.length : n >>> 0, e || (e = 0);
    let s;
    if (typeof e == "number") for (s = t; s < n; ++s) this[s] = e;
    else {
      let o = d.isBuffer(e) ? e : d.from(
        e,
        i
      ), u = o.length;
      if (u === 0) throw new TypeError('The value "' + e + '" is invalid for argument "value"');
      for (s = 0; s < n - t; ++s) this[s + t] = o[s % u];
    }
    return this;
  }, "fill");
  var Pe = {};
  function zt(r, e, t) {
    var n;
    Pe[r] = (n = class extends t {
      constructor() {
        super(), Object.defineProperty(this, "message", { value: e.apply(this, arguments), writable: true, configurable: true }), this.name = `${this.name} [${r}]`, this.stack, delete this.name;
      }
      get code() {
        return r;
      }
      set code(s) {
        Object.defineProperty(
          this,
          "code",
          { configurable: true, enumerable: true, value: s, writable: true }
        );
      }
      toString() {
        return `${this.name} [${r}]: ${this.message}`;
      }
    }, a(n, "NodeError"), n);
  }
  a(zt, "E");
  zt("ERR_BUFFER_OUT_OF_BOUNDS", function(r) {
    return r ? `${r} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
  }, RangeError);
  zt(
    "ERR_INVALID_ARG_TYPE",
    function(r, e) {
      return `The "${r}" argument must be of type number. Received type ${typeof e}`;
    },
    TypeError
  );
  zt("ERR_OUT_OF_RANGE", function(r, e, t) {
    let n = `The value of "${r}" is out of range.`, i = t;
    return Number.isInteger(t) && Math.abs(t) > 2 ** 32 ? i = Vn(String(t)) : typeof t == "bigint" && (i = String(
      t
    ), (t > BigInt(2) ** BigInt(32) || t < -(BigInt(2) ** BigInt(32))) && (i = Vn(i)), i += "n"), n += ` It must be ${e}. Received ${i}`, n;
  }, RangeError);
  function Vn(r) {
    let e = "", t = r.length, n = r[0] === "-" ? 1 : 0;
    for (; t >= n + 4; t -= 3) e = `_${r.slice(t - 3, t)}${e}`;
    return `${r.slice(0, t)}${e}`;
  }
  a(Vn, "addNumericalSeparator");
  function oa(r, e, t) {
    Le(e, "offset"), (r[e] === void 0 || r[e + t] === void 0) && We(e, r.length - (t + 1));
  }
  a(oa, "checkBounds");
  function ii(r, e, t, n, i, s) {
    if (r > t || r < e) {
      let o = typeof e == "bigint" ? "n" : "", u;
      throw s > 3 ? e === 0 || e === BigInt(0) ? u = `>= 0${o} and < 2${o} ** ${(s + 1) * 8}${o}` : u = `>= -(2${o} ** ${(s + 1) * 8 - 1}${o}) and < 2 ** ${(s + 1) * 8 - 1}${o}` : u = `>= ${e}${o} and <= ${t}${o}`, new Pe.ERR_OUT_OF_RANGE("value", u, r);
    }
    oa(n, i, s);
  }
  a(ii, "checkIntBI");
  function Le(r, e) {
    if (typeof r != "number") throw new Pe.ERR_INVALID_ARG_TYPE(e, "number", r);
  }
  a(Le, "validateNumber");
  function We(r, e, t) {
    throw Math.floor(r) !== r ? (Le(r, t), new Pe.ERR_OUT_OF_RANGE(t || "offset", "an integer", r)) : e < 0 ? new Pe.ERR_BUFFER_OUT_OF_BOUNDS() : new Pe.ERR_OUT_OF_RANGE(t || "offset", `>= ${t ? 1 : 0} and <= ${e}`, r);
  }
  a(We, "boundsError");
  var aa = /[^+/0-9A-Za-z-_]/g;
  function ua(r) {
    if (r = r.split("=")[0], r = r.trim().replace(aa, ""), r.length < 2) return "";
    for (; r.length % 4 !== 0; ) r = r + "=";
    return r;
  }
  a(ua, "base64clean");
  function $t(r, e) {
    e = e || 1 / 0;
    let t, n = r.length, i = null, s = [];
    for (let o = 0; o < n; ++o) {
      if (t = r.charCodeAt(o), t > 55295 && t < 57344) {
        if (!i) {
          if (t > 56319) {
            (e -= 3) > -1 && s.push(239, 191, 189);
            continue;
          } else if (o + 1 === n) {
            (e -= 3) > -1 && s.push(239, 191, 189);
            continue;
          }
          i = t;
          continue;
        }
        if (t < 56320) {
          (e -= 3) > -1 && s.push(239, 191, 189), i = t;
          continue;
        }
        t = (i - 55296 << 10 | t - 56320) + 65536;
      } else i && (e -= 3) > -1 && s.push(239, 191, 189);
      if (i = null, t < 128) {
        if ((e -= 1) < 0) break;
        s.push(t);
      } else if (t < 2048) {
        if ((e -= 2) < 0) break;
        s.push(t >> 6 | 192, t & 63 | 128);
      } else if (t < 65536) {
        if ((e -= 3) < 0) break;
        s.push(t >> 12 | 224, t >> 6 & 63 | 128, t & 63 | 128);
      } else if (t < 1114112) {
        if ((e -= 4) < 0) break;
        s.push(t >> 18 | 240, t >> 12 & 63 | 128, t >> 6 & 63 | 128, t & 63 | 128);
      } else throw new Error("Invalid code point");
    }
    return s;
  }
  a($t, "utf8ToBytes");
  function ca(r) {
    let e = [];
    for (let t = 0; t < r.length; ++t) e.push(r.charCodeAt(t) & 255);
    return e;
  }
  a(
    ca,
    "asciiToBytes"
  );
  function la(r, e) {
    let t, n, i, s = [];
    for (let o = 0; o < r.length && !((e -= 2) < 0); ++o) t = r.charCodeAt(
      o
    ), n = t >> 8, i = t % 256, s.push(i), s.push(n);
    return s;
  }
  a(la, "utf16leToBytes");
  function si(r) {
    return Wt.toByteArray(
      ua(r)
    );
  }
  a(si, "base64ToBytes");
  function ht(r, e, t, n) {
    let i;
    for (i = 0; i < n && !(i + t >= e.length || i >= r.length); ++i)
      e[i + t] = r[i];
    return i;
  }
  a(ht, "blitBuffer");
  function fe(r, e) {
    return r instanceof e || r != null && r.constructor != null && r.constructor.name != null && r.constructor.name === e.name;
  }
  a(fe, "isInstance");
  function Kt(r) {
    return r !== r;
  }
  a(Kt, "numberIsNaN");
  var fa = function() {
    let r = "0123456789abcdef", e = new Array(256);
    for (let t = 0; t < 16; ++t) {
      let n = t * 16;
      for (let i = 0; i < 16; ++i) e[n + i] = r[t] + r[i];
    }
    return e;
  }();
  function be(r) {
    return typeof BigInt > "u" ? ha : r;
  }
  a(be, "defineBigIntMethod");
  function ha() {
    throw new Error("BigInt not supported");
  }
  a(ha, "BufferBigIntNotDefined");
});
var b;
var x;
var v;
var p;
var y;
var h = V(() => {
  "use strict";
  b = globalThis, x = globalThis.setImmediate ?? ((r) => setTimeout(r, 0)), v = globalThis.clearImmediate ?? ((r) => clearTimeout(r)), p = typeof globalThis.Buffer == "function" && typeof globalThis.Buffer.allocUnsafe == "function" ? globalThis.Buffer : oi().Buffer, y = globalThis.process ?? {};
  y.env ?? (y.env = {});
  try {
    y.nextTick(() => {
    });
  } catch {
    let e = Promise.resolve();
    y.nextTick = e.then.bind(e);
  }
});
var ve = T((Ef, Xt) => {
  "use strict";
  h();
  var Fe = typeof Reflect == "object" ? Reflect : null, mi = Fe && typeof Fe.apply == "function" ? Fe.apply : a(function(e, t, n) {
    return Function.prototype.apply.call(e, t, n);
  }, "ReflectApply"), bt;
  Fe && typeof Fe.ownKeys == "function" ? bt = Fe.ownKeys : Object.getOwnPropertySymbols ? bt = a(function(e) {
    return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
  }, "ReflectOwnKeys") : bt = a(function(e) {
    return Object.getOwnPropertyNames(e);
  }, "ReflectOwnKeys");
  function Ia(r) {
    console && console.warn && console.warn(r);
  }
  a(
    Ia,
    "ProcessEmitWarning"
  );
  var wi = Number.isNaN || a(function(e) {
    return e !== e;
  }, "NumberIsNaN");
  function P() {
    P.init.call(this);
  }
  a(P, "EventEmitter");
  Xt.exports = P;
  Xt.exports.once = Ba;
  P.EventEmitter = P;
  P.prototype._events = void 0;
  P.prototype._eventsCount = 0;
  P.prototype._maxListeners = void 0;
  var gi = 10;
  function xt(r) {
    if (typeof r != "function") throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof r);
  }
  a(xt, "checkListener");
  Object.defineProperty(P, "defaultMaxListeners", { enumerable: true, get: a(function() {
    return gi;
  }, "get"), set: a(
    function(r) {
      if (typeof r != "number" || r < 0 || wi(r)) throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + r + ".");
      gi = r;
    },
    "set"
  ) });
  P.init = function() {
    (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
  };
  P.prototype.setMaxListeners = a(function(e) {
    if (typeof e != "number" || e < 0 || wi(e)) throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + e + ".");
    return this._maxListeners = e, this;
  }, "setMaxListeners");
  function bi(r) {
    return r._maxListeners === void 0 ? P.defaultMaxListeners : r._maxListeners;
  }
  a(bi, "_getMaxListeners");
  P.prototype.getMaxListeners = a(function() {
    return bi(this);
  }, "getMaxListeners");
  P.prototype.emit = a(function(e) {
    for (var t = [], n = 1; n < arguments.length; n++) t.push(arguments[n]);
    var i = e === "error", s = this._events;
    if (s !== void 0) i = i && s.error === void 0;
    else if (!i) return false;
    if (i) {
      var o;
      if (t.length > 0 && (o = t[0]), o instanceof Error) throw o;
      var u = new Error("Unhandled error." + (o ? " (" + o.message + ")" : ""));
      throw u.context = o, u;
    }
    var c = s[e];
    if (c === void 0) return false;
    if (typeof c == "function") mi(c, this, t);
    else for (var l = c.length, f = Ai(c, l), n = 0; n < l; ++n) mi(f[n], this, t);
    return true;
  }, "emit");
  function xi(r, e, t, n) {
    var i, s, o;
    if (xt(
      t
    ), s = r._events, s === void 0 ? (s = r._events = /* @__PURE__ */ Object.create(null), r._eventsCount = 0) : (s.newListener !== void 0 && (r.emit("newListener", e, t.listener ? t.listener : t), s = r._events), o = s[e]), o === void 0) o = s[e] = t, ++r._eventsCount;
    else if (typeof o == "function" ? o = s[e] = n ? [t, o] : [o, t] : n ? o.unshift(t) : o.push(t), i = bi(r), i > 0 && o.length > i && !o.warned) {
      o.warned = true;
      var u = new Error("Possible EventEmitter memory leak detected. " + o.length + " " + String(e) + " listeners added. Use emitter.setMaxListeners() to increase limit");
      u.name = "MaxListenersExceededWarning", u.emitter = r, u.type = e, u.count = o.length, Ia(u);
    }
    return r;
  }
  a(xi, "_addListener");
  P.prototype.addListener = a(function(e, t) {
    return xi(this, e, t, false);
  }, "addListener");
  P.prototype.on = P.prototype.addListener;
  P.prototype.prependListener = a(function(e, t) {
    return xi(this, e, t, true);
  }, "prependListener");
  function Pa() {
    if (!this.fired) return this.target.removeListener(this.type, this.wrapFn), this.fired = true, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
  }
  a(Pa, "onceWrapper");
  function vi(r, e, t) {
    var n = {
      fired: false,
      wrapFn: void 0,
      target: r,
      type: e,
      listener: t
    }, i = Pa.bind(n);
    return i.listener = t, n.wrapFn = i, i;
  }
  a(vi, "_onceWrap");
  P.prototype.once = a(function(e, t) {
    return xt(t), this.on(e, vi(this, e, t)), this;
  }, "once");
  P.prototype.prependOnceListener = a(function(e, t) {
    return xt(t), this.prependListener(e, vi(this, e, t)), this;
  }, "prependOnceListener");
  P.prototype.removeListener = a(function(e, t) {
    var n, i, s, o, u;
    if (xt(t), i = this._events, i === void 0) return this;
    if (n = i[e], n === void 0) return this;
    if (n === t || n.listener === t) --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete i[e], i.removeListener && this.emit("removeListener", e, n.listener || t));
    else if (typeof n != "function") {
      for (s = -1, o = n.length - 1; o >= 0; o--) if (n[o] === t || n[o].listener === t) {
        u = n[o].listener, s = o;
        break;
      }
      if (s < 0) return this;
      s === 0 ? n.shift() : Ra(n, s), n.length === 1 && (i[e] = n[0]), i.removeListener !== void 0 && this.emit("removeListener", e, u || t);
    }
    return this;
  }, "removeListener");
  P.prototype.off = P.prototype.removeListener;
  P.prototype.removeAllListeners = a(function(e) {
    var t, n, i;
    if (n = this._events, n === void 0) return this;
    if (n.removeListener === void 0) return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : n[e] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete n[e]), this;
    if (arguments.length === 0) {
      var s = Object.keys(n), o;
      for (i = 0; i < s.length; ++i) o = s[i], o !== "removeListener" && this.removeAllListeners(
        o
      );
      return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
    }
    if (t = n[e], typeof t == "function") this.removeListener(e, t);
    else if (t !== void 0) for (i = t.length - 1; i >= 0; i--) this.removeListener(e, t[i]);
    return this;
  }, "removeAllListeners");
  function Si(r, e, t) {
    var n = r._events;
    if (n === void 0) return [];
    var i = n[e];
    return i === void 0 ? [] : typeof i == "function" ? t ? [i.listener || i] : [i] : t ? La(i) : Ai(i, i.length);
  }
  a(Si, "_listeners");
  P.prototype.listeners = a(function(e) {
    return Si(this, e, true);
  }, "listeners");
  P.prototype.rawListeners = a(function(e) {
    return Si(this, e, false);
  }, "rawListeners");
  P.listenerCount = function(r, e) {
    return typeof r.listenerCount == "function" ? r.listenerCount(e) : Ei.call(r, e);
  };
  P.prototype.listenerCount = Ei;
  function Ei(r) {
    var e = this._events;
    if (e !== void 0) {
      var t = e[r];
      if (typeof t == "function")
        return 1;
      if (t !== void 0) return t.length;
    }
    return 0;
  }
  a(Ei, "listenerCount");
  P.prototype.eventNames = a(function() {
    return this._eventsCount > 0 ? bt(this._events) : [];
  }, "eventNames");
  function Ai(r, e) {
    for (var t = new Array(e), n = 0; n < e; ++n) t[n] = r[n];
    return t;
  }
  a(Ai, "arrayClone");
  function Ra(r, e) {
    for (; e + 1 < r.length; e++) r[e] = r[e + 1];
    r.pop();
  }
  a(Ra, "spliceOne");
  function La(r) {
    for (var e = new Array(r.length), t = 0; t < e.length; ++t) e[t] = r[t].listener || r[t];
    return e;
  }
  a(La, "unwrapListeners");
  function Ba(r, e) {
    return new Promise(function(t, n) {
      function i(o) {
        r.removeListener(e, s), n(o);
      }
      a(i, "errorListener");
      function s() {
        typeof r.removeListener == "function" && r.removeListener("error", i), t([].slice.call(arguments));
      }
      a(s, "resolver"), Ci(r, e, s, { once: true }), e !== "error" && Fa(r, i, { once: true });
    });
  }
  a(Ba, "once");
  function Fa(r, e, t) {
    typeof r.on == "function" && Ci(r, "error", e, t);
  }
  a(
    Fa,
    "addErrorHandlerIfEventEmitter"
  );
  function Ci(r, e, t, n) {
    if (typeof r.on == "function") n.once ? r.once(e, t) : r.on(e, t);
    else if (typeof r.addEventListener == "function") r.addEventListener(e, a(function i(s) {
      n.once && r.removeEventListener(e, i), t(s);
    }, "wrapListener"));
    else throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof r);
  }
  a(Ci, "eventTargetAgnosticAddListener");
});
var Ii = {};
se(Ii, { Socket: () => pe, isIP: () => Ma });
function Ma(r) {
  return 0;
}
var Ti;
var _i;
var A;
var pe;
var Ge = V(() => {
  "use strict";
  h();
  Ti = we(ve(), 1);
  a(Ma, "isIP");
  _i = /^[^.]+\./, A = class A2 extends Ti.EventEmitter {
    constructor() {
      super(...arguments);
      E(this, "opts", {});
      E(this, "connecting", false);
      E(this, "pending", true);
      E(
        this,
        "writable",
        true
      );
      E(this, "encrypted", false);
      E(this, "authorized", false);
      E(this, "destroyed", false);
      E(this, "ws", null);
      E(this, "writeBuffer");
      E(this, "tlsState", 0);
      E(this, "tlsRead");
      E(this, "tlsWrite");
    }
    static get poolQueryViaFetch() {
      return A2.opts.poolQueryViaFetch ?? A2.defaults.poolQueryViaFetch;
    }
    static set poolQueryViaFetch(t) {
      A2.opts.poolQueryViaFetch = t;
    }
    static get fetchEndpoint() {
      return A2.opts.fetchEndpoint ?? A2.defaults.fetchEndpoint;
    }
    static set fetchEndpoint(t) {
      A2.opts.fetchEndpoint = t;
    }
    static get fetchConnectionCache() {
      return true;
    }
    static set fetchConnectionCache(t) {
      console.warn("The `fetchConnectionCache` option is deprecated (now always `true`)");
    }
    static get fetchFunction() {
      return A2.opts.fetchFunction ?? A2.defaults.fetchFunction;
    }
    static set fetchFunction(t) {
      A2.opts.fetchFunction = t;
    }
    static get webSocketConstructor() {
      return A2.opts.webSocketConstructor ?? A2.defaults.webSocketConstructor;
    }
    static set webSocketConstructor(t) {
      A2.opts.webSocketConstructor = t;
    }
    get webSocketConstructor() {
      return this.opts.webSocketConstructor ?? A2.webSocketConstructor;
    }
    set webSocketConstructor(t) {
      this.opts.webSocketConstructor = t;
    }
    static get wsProxy() {
      return A2.opts.wsProxy ?? A2.defaults.wsProxy;
    }
    static set wsProxy(t) {
      A2.opts.wsProxy = t;
    }
    get wsProxy() {
      return this.opts.wsProxy ?? A2.wsProxy;
    }
    set wsProxy(t) {
      this.opts.wsProxy = t;
    }
    static get coalesceWrites() {
      return A2.opts.coalesceWrites ?? A2.defaults.coalesceWrites;
    }
    static set coalesceWrites(t) {
      A2.opts.coalesceWrites = t;
    }
    get coalesceWrites() {
      return this.opts.coalesceWrites ?? A2.coalesceWrites;
    }
    set coalesceWrites(t) {
      this.opts.coalesceWrites = t;
    }
    static get useSecureWebSocket() {
      return A2.opts.useSecureWebSocket ?? A2.defaults.useSecureWebSocket;
    }
    static set useSecureWebSocket(t) {
      A2.opts.useSecureWebSocket = t;
    }
    get useSecureWebSocket() {
      return this.opts.useSecureWebSocket ?? A2.useSecureWebSocket;
    }
    set useSecureWebSocket(t) {
      this.opts.useSecureWebSocket = t;
    }
    static get forceDisablePgSSL() {
      return A2.opts.forceDisablePgSSL ?? A2.defaults.forceDisablePgSSL;
    }
    static set forceDisablePgSSL(t) {
      A2.opts.forceDisablePgSSL = t;
    }
    get forceDisablePgSSL() {
      return this.opts.forceDisablePgSSL ?? A2.forceDisablePgSSL;
    }
    set forceDisablePgSSL(t) {
      this.opts.forceDisablePgSSL = t;
    }
    static get disableSNI() {
      return A2.opts.disableSNI ?? A2.defaults.disableSNI;
    }
    static set disableSNI(t) {
      A2.opts.disableSNI = t;
    }
    get disableSNI() {
      return this.opts.disableSNI ?? A2.disableSNI;
    }
    set disableSNI(t) {
      this.opts.disableSNI = t;
    }
    static get disableWarningInBrowsers() {
      return A2.opts.disableWarningInBrowsers ?? A2.defaults.disableWarningInBrowsers;
    }
    static set disableWarningInBrowsers(t) {
      A2.opts.disableWarningInBrowsers = t;
    }
    get disableWarningInBrowsers() {
      return this.opts.disableWarningInBrowsers ?? A2.disableWarningInBrowsers;
    }
    set disableWarningInBrowsers(t) {
      this.opts.disableWarningInBrowsers = t;
    }
    static get pipelineConnect() {
      return A2.opts.pipelineConnect ?? A2.defaults.pipelineConnect;
    }
    static set pipelineConnect(t) {
      A2.opts.pipelineConnect = t;
    }
    get pipelineConnect() {
      return this.opts.pipelineConnect ?? A2.pipelineConnect;
    }
    set pipelineConnect(t) {
      this.opts.pipelineConnect = t;
    }
    static get subtls() {
      return A2.opts.subtls ?? A2.defaults.subtls;
    }
    static set subtls(t) {
      A2.opts.subtls = t;
    }
    get subtls() {
      return this.opts.subtls ?? A2.subtls;
    }
    set subtls(t) {
      this.opts.subtls = t;
    }
    static get pipelineTLS() {
      return A2.opts.pipelineTLS ?? A2.defaults.pipelineTLS;
    }
    static set pipelineTLS(t) {
      A2.opts.pipelineTLS = t;
    }
    get pipelineTLS() {
      return this.opts.pipelineTLS ?? A2.pipelineTLS;
    }
    set pipelineTLS(t) {
      this.opts.pipelineTLS = t;
    }
    static get rootCerts() {
      return A2.opts.rootCerts ?? A2.defaults.rootCerts;
    }
    static set rootCerts(t) {
      A2.opts.rootCerts = t;
    }
    get rootCerts() {
      return this.opts.rootCerts ?? A2.rootCerts;
    }
    set rootCerts(t) {
      this.opts.rootCerts = t;
    }
    wsProxyAddrForHost(t, n) {
      let i = this.wsProxy;
      if (i === void 0) throw new Error("No WebSocket proxy is configured. Please see https://github.com/neondatabase/serverless/blob/main/CONFIG.md#wsproxy-string--host-string-port-number--string--string");
      return typeof i == "function" ? i(t, n) : `${i}?address=${t}:${n}`;
    }
    setNoDelay() {
      return this;
    }
    setKeepAlive() {
      return this;
    }
    ref() {
      return this;
    }
    unref() {
      return this;
    }
    connect(t, n, i) {
      this.connecting = true, i && this.once("connect", i);
      let s = a(() => {
        this.connecting = false, this.pending = false, this.emit("connect"), this.emit("ready");
      }, "handleWebSocketOpen"), o = a((c, l = false) => {
        c.binaryType = "arraybuffer", c.addEventListener("error", (f) => {
          this.emit("error", f), this.emit("close");
        }), c.addEventListener("message", (f) => {
          if (this.tlsState === 0) {
            let m = p.from(f.data);
            this.emit("data", m);
          }
        }), c.addEventListener("close", () => {
          this.destroyed = true, this.emit("close");
        }), l ? s() : c.addEventListener("open", s);
      }, "configureWebSocket"), u;
      try {
        u = this.wsProxyAddrForHost(n, typeof t == "string" ? parseInt(t, 10) : t);
      } catch (c) {
        this.emit("error", c), this.emit("close");
        return;
      }
      try {
        let l = (this.useSecureWebSocket ? "wss:" : "ws:") + "//" + u;
        if (this.webSocketConstructor !== void 0) this.ws = new this.webSocketConstructor(l), o(this.ws);
        else try {
          this.ws = new WebSocket(l), o(this.ws);
        } catch {
          this.ws = new __unstable_WebSocket(l), o(
            this.ws
          );
        }
      } catch (c) {
        let f = (this.useSecureWebSocket ? "https:" : "http:") + "//" + u;
        fetch(f, { headers: { Upgrade: "websocket" } }).then((m) => {
          if (this.ws = m.webSocket, this.ws == null) throw c;
          this.ws.accept(), o(this.ws, true);
        }).catch((m) => {
          this.emit("error", new Error(`All attempts to open a WebSocket to connect to the database failed. Please refer to https://github.com/neondatabase/serverless/blob/main/CONFIG.md#websocketconstructor-typeof-websocket--undefined. Details: ${m}`)), this.emit("close");
        });
      }
    }
    async startTls(t) {
      if (this.subtls === void 0) throw new Error("For Postgres SSL connections, you must set `neonConfig.subtls` to the subtls library. See https://github.com/neondatabase/serverless/blob/main/CONFIG.md for more information.");
      this.tlsState = 1;
      let n = await this.subtls.TrustedCert.databaseFromPEM(this.rootCerts), i = new this.subtls.WebSocketReadQueue(this.ws), s = i.read.bind(i), o = this.rawWrite.bind(this), { read: u, write: c } = await this.subtls.startTls(t, n, s, o, { useSNI: !this.disableSNI, expectPreData: this.pipelineTLS ? new Uint8Array([83]) : void 0 });
      this.tlsRead = u, this.tlsWrite = c, this.tlsState = 2, this.encrypted = true, this.authorized = true, this.emit(
        "secureConnection",
        this
      ), this.tlsReadLoop().catch((l) => {
        this.destroyed || (this.destroyed = true, this.emit("error", l), this.ws?.close());
      });
    }
    async tlsReadLoop() {
      for (; ; ) {
        let t = await this.tlsRead();
        if (t === void 0) break;
        {
          let n = p.from(t);
          this.emit("data", n);
        }
      }
    }
    rawWrite(t) {
      if (!this.coalesceWrites) {
        this.ws && this.ws.send(t);
        return;
      }
      if (this.writeBuffer === void 0) this.writeBuffer = t, setTimeout(() => {
        this.ws && this.ws.send(this.writeBuffer), this.writeBuffer = void 0;
      }, 0);
      else {
        let n = new Uint8Array(this.writeBuffer.length + t.length);
        n.set(this.writeBuffer), n.set(t, this.writeBuffer.length), this.writeBuffer = n;
      }
    }
    write(t, n = "utf8", i = (s) => {
    }) {
      return t.length === 0 ? (i(), true) : (typeof t == "string" && (t = p.from(t, n)), this.tlsState === 0 ? (this.rawWrite(t), i()) : this.tlsState === 1 ? this.once("secureConnection", () => {
        this.write(t, n, i);
      }) : (this.tlsWrite(t), i()), true);
    }
    end(t = p.alloc(0), n = "utf8", i = () => {
    }) {
      return this.write(t, n, () => {
        this.ws?.close(), i();
      }), this;
    }
    destroy() {
      return this.destroyed = true, this.end();
    }
  };
  a(A, "Socket"), E(A, "defaults", {
    poolQueryViaFetch: false,
    fetchEndpoint: a((t, n, i) => {
      let s;
      return i?.jwtAuth ? s = t.replace(_i, "apiauth.") : s = t.replace(_i, "api."), "https://" + s + "/sql";
    }, "fetchEndpoint"),
    fetchConnectionCache: true,
    fetchFunction: void 0,
    webSocketConstructor: void 0,
    wsProxy: a((t) => t + "/v2", "wsProxy"),
    useSecureWebSocket: true,
    forceDisablePgSSL: true,
    coalesceWrites: true,
    pipelineConnect: "password",
    subtls: void 0,
    rootCerts: "",
    pipelineTLS: false,
    disableSNI: false,
    disableWarningInBrowsers: false
  }), E(A, "opts", {});
  pe = A;
});
var tr = T((Pi) => {
  "use strict";
  h();
  Pi.parse = function(r, e) {
    return new er(r, e).parse();
  };
  var St = class St2 {
    constructor(e, t) {
      this.source = e, this.transform = t || ka, this.position = 0, this.entries = [], this.recorded = [], this.dimension = 0;
    }
    isEof() {
      return this.position >= this.source.length;
    }
    nextCharacter() {
      var e = this.source[this.position++];
      return e === "\\" ? { value: this.source[this.position++], escaped: true } : { value: e, escaped: false };
    }
    record(e) {
      this.recorded.push(
        e
      );
    }
    newEntry(e) {
      var t;
      (this.recorded.length > 0 || e) && (t = this.recorded.join(""), t === "NULL" && !e && (t = null), t !== null && (t = this.transform(t)), this.entries.push(t), this.recorded = []);
    }
    consumeDimensions() {
      if (this.source[0] === "[") for (; !this.isEof(); ) {
        var e = this.nextCharacter();
        if (e.value === "=") break;
      }
    }
    parse(e) {
      var t, n, i;
      for (this.consumeDimensions(); !this.isEof(); ) if (t = this.nextCharacter(), t.value === "{" && !i) this.dimension++, this.dimension > 1 && (n = new St2(this.source.substr(this.position - 1), this.transform), this.entries.push(n.parse(
        true
      )), this.position += n.position - 2);
      else if (t.value === "}" && !i) {
        if (this.dimension--, !this.dimension && (this.newEntry(), e)) return this.entries;
      } else t.value === '"' && !t.escaped ? (i && this.newEntry(true), i = !i) : t.value === "," && !i ? this.newEntry() : this.record(t.value);
      if (this.dimension !== 0) throw new Error("array dimension not balanced");
      return this.entries;
    }
  };
  a(St, "ArrayParser");
  var er = St;
  function ka(r) {
    return r;
  }
  a(ka, "identity");
});
var rr = T((Ff, Ri) => {
  h();
  var Oa = tr();
  Ri.exports = { create: a(function(r, e) {
    return { parse: a(function() {
      return Oa.parse(r, e);
    }, "parse") };
  }, "create") };
});
var Fi = T((Of, Bi) => {
  "use strict";
  h();
  var Ua = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/, Qa = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/, Da = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/, qa = /^-?infinity$/;
  Bi.exports = a(function(e) {
    if (qa.test(e)) return Number(e.replace("i", "I"));
    var t = Ua.exec(e);
    if (!t) return Na(
      e
    ) || null;
    var n = !!t[8], i = parseInt(t[1], 10);
    n && (i = Li(i));
    var s = parseInt(t[2], 10) - 1, o = t[3], u = parseInt(
      t[4],
      10
    ), c = parseInt(t[5], 10), l = parseInt(t[6], 10), f = t[7];
    f = f ? 1e3 * parseFloat(f) : 0;
    var m, g = Wa(e);
    return g != null ? (m = new Date(Date.UTC(i, s, o, u, c, l, f)), nr(i) && m.setUTCFullYear(i), g !== 0 && m.setTime(m.getTime() - g)) : (m = new Date(i, s, o, u, c, l, f), nr(i) && m.setFullYear(i)), m;
  }, "parseDate");
  function Na(r) {
    var e = Qa.exec(r);
    if (e) {
      var t = parseInt(e[1], 10), n = !!e[4];
      n && (t = Li(t));
      var i = parseInt(e[2], 10) - 1, s = e[3], o = new Date(t, i, s);
      return nr(
        t
      ) && o.setFullYear(t), o;
    }
  }
  a(Na, "getDate");
  function Wa(r) {
    if (r.endsWith("+00")) return 0;
    var e = Da.exec(r.split(" ")[1]);
    if (e) {
      var t = e[1];
      if (t === "Z") return 0;
      var n = t === "-" ? -1 : 1, i = parseInt(e[2], 10) * 3600 + parseInt(
        e[3] || 0,
        10
      ) * 60 + parseInt(e[4] || 0, 10);
      return i * n * 1e3;
    }
  }
  a(Wa, "timeZoneOffset");
  function Li(r) {
    return -(r - 1);
  }
  a(Li, "bcYearToNegativeYear");
  function nr(r) {
    return r >= 0 && r < 100;
  }
  a(nr, "is0To99");
});
var ki = T((Df, Mi) => {
  h();
  Mi.exports = Ha;
  var ja = Object.prototype.hasOwnProperty;
  function Ha(r) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var n in t) ja.call(t, n) && (r[n] = t[n]);
    }
    return r;
  }
  a(Ha, "extend");
});
var Qi = T((Wf, Ui) => {
  "use strict";
  h();
  var $a = ki();
  Ui.exports = Me;
  function Me(r) {
    if (!(this instanceof Me))
      return new Me(r);
    $a(this, nu(r));
  }
  a(Me, "PostgresInterval");
  var Ga = [
    "seconds",
    "minutes",
    "hours",
    "days",
    "months",
    "years"
  ];
  Me.prototype.toPostgres = function() {
    var r = Ga.filter(this.hasOwnProperty, this);
    return this.milliseconds && r.indexOf("seconds") < 0 && r.push("seconds"), r.length === 0 ? "0" : r.map(function(e) {
      var t = this[e] || 0;
      return e === "seconds" && this.milliseconds && (t = (t + this.milliseconds / 1e3).toFixed(6).replace(
        /\.?0+$/,
        ""
      )), t + " " + e;
    }, this).join(" ");
  };
  var Va = { years: "Y", months: "M", days: "D", hours: "H", minutes: "M", seconds: "S" }, za = ["years", "months", "days"], Ka = ["hours", "minutes", "seconds"];
  Me.prototype.toISOString = Me.prototype.toISO = function() {
    var r = za.map(t, this).join(""), e = Ka.map(t, this).join("");
    return "P" + r + "T" + e;
    function t(n) {
      var i = this[n] || 0;
      return n === "seconds" && this.milliseconds && (i = (i + this.milliseconds / 1e3).toFixed(6).replace(
        /0+$/,
        ""
      )), i + Va[n];
    }
  };
  var ir = "([+-]?\\d+)", Ya = ir + "\\s+years?", Za = ir + "\\s+mons?", Ja = ir + "\\s+days?", Xa = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?", eu = new RegExp([Ya, Za, Ja, Xa].map(function(r) {
    return "(" + r + ")?";
  }).join("\\s*")), Oi = { years: 2, months: 4, days: 6, hours: 9, minutes: 10, seconds: 11, milliseconds: 12 }, tu = ["hours", "minutes", "seconds", "milliseconds"];
  function ru(r) {
    var e = r + "000000".slice(r.length);
    return parseInt(
      e,
      10
    ) / 1e3;
  }
  a(ru, "parseMilliseconds");
  function nu(r) {
    if (!r) return {};
    var e = eu.exec(r), t = e[8] === "-";
    return Object.keys(Oi).reduce(function(n, i) {
      var s = Oi[i], o = e[s];
      return !o || (o = i === "milliseconds" ? ru(o) : parseInt(o, 10), !o) || (t && ~tu.indexOf(i) && (o *= -1), n[i] = o), n;
    }, {});
  }
  a(nu, "parse");
});
var Ni = T(($f, qi) => {
  "use strict";
  h();
  var Di = p.from || p;
  qi.exports = a(function(e) {
    if (/^\\x/.test(e)) return Di(
      e.substr(2),
      "hex"
    );
    for (var t = "", n = 0; n < e.length; ) if (e[n] !== "\\") t += e[n], ++n;
    else if (/[0-7]{3}/.test(e.substr(n + 1, 3))) t += String.fromCharCode(parseInt(e.substr(n + 1, 3), 8)), n += 4;
    else {
      for (var i = 1; n + i < e.length && e[n + i] === "\\"; ) i++;
      for (var s = 0; s < Math.floor(i / 2); ++s) t += "\\";
      n += Math.floor(i / 2) * 2;
    }
    return Di(t, "binary");
  }, "parseBytea");
});
var zi = T((zf, Vi) => {
  h();
  var Ve = tr(), ze = rr(), Et = Fi(), ji = Qi(), Hi = Ni();
  function At(r) {
    return a(function(t) {
      return t === null ? t : r(t);
    }, "nullAllowed");
  }
  a(At, "allowNull");
  function $i(r) {
    return r === null ? r : r === "TRUE" || r === "t" || r === "true" || r === "y" || r === "yes" || r === "on" || r === "1";
  }
  a($i, "parseBool");
  function iu(r) {
    return r ? Ve.parse(r, $i) : null;
  }
  a(iu, "parseBoolArray");
  function su(r) {
    return parseInt(r, 10);
  }
  a(su, "parseBaseTenInt");
  function sr(r) {
    return r ? Ve.parse(r, At(su)) : null;
  }
  a(sr, "parseIntegerArray");
  function ou(r) {
    return r ? Ve.parse(r, At(function(e) {
      return Gi(e).trim();
    })) : null;
  }
  a(ou, "parseBigIntegerArray");
  var au = a(function(r) {
    if (!r) return null;
    var e = ze.create(r, function(t) {
      return t !== null && (t = cr(t)), t;
    });
    return e.parse();
  }, "parsePointArray"), or = a(function(r) {
    if (!r) return null;
    var e = ze.create(r, function(t) {
      return t !== null && (t = parseFloat(t)), t;
    });
    return e.parse();
  }, "parseFloatArray"), ee = a(function(r) {
    if (!r) return null;
    var e = ze.create(r);
    return e.parse();
  }, "parseStringArray"), ar = a(function(r) {
    if (!r) return null;
    var e = ze.create(
      r,
      function(t) {
        return t !== null && (t = Et(t)), t;
      }
    );
    return e.parse();
  }, "parseDateArray"), uu = a(function(r) {
    if (!r)
      return null;
    var e = ze.create(r, function(t) {
      return t !== null && (t = ji(t)), t;
    });
    return e.parse();
  }, "parseIntervalArray"), cu = a(function(r) {
    return r ? Ve.parse(r, At(Hi)) : null;
  }, "parseByteAArray"), ur = a(function(r) {
    return parseInt(r, 10);
  }, "parseInteger"), Gi = a(function(r) {
    var e = String(r);
    return /^\d+$/.test(e) ? e : r;
  }, "parseBigInteger"), Wi = a(function(r) {
    return r ? Ve.parse(r, At(JSON.parse)) : null;
  }, "parseJsonArray"), cr = a(
    function(r) {
      return r[0] !== "(" ? null : (r = r.substring(1, r.length - 1).split(","), { x: parseFloat(r[0]), y: parseFloat(
        r[1]
      ) });
    },
    "parsePoint"
  ), lu = a(function(r) {
    if (r[0] !== "<" && r[1] !== "(") return null;
    for (var e = "(", t = "", n = false, i = 2; i < r.length - 1; i++) {
      if (n || (e += r[i]), r[i] === ")") {
        n = true;
        continue;
      } else if (!n) continue;
      r[i] !== "," && (t += r[i]);
    }
    var s = cr(e);
    return s.radius = parseFloat(t), s;
  }, "parseCircle"), fu = a(function(r) {
    r(20, Gi), r(21, ur), r(23, ur), r(26, ur), r(700, parseFloat), r(701, parseFloat), r(16, $i), r(1082, Et), r(1114, Et), r(1184, Et), r(
      600,
      cr
    ), r(651, ee), r(718, lu), r(1e3, iu), r(1001, cu), r(1005, sr), r(1007, sr), r(1028, sr), r(1016, ou), r(1017, au), r(1021, or), r(1022, or), r(1231, or), r(1014, ee), r(1015, ee), r(1008, ee), r(1009, ee), r(1040, ee), r(1041, ee), r(
      1115,
      ar
    ), r(1182, ar), r(1185, ar), r(1186, ji), r(1187, uu), r(17, Hi), r(114, JSON.parse.bind(JSON)), r(3802, JSON.parse.bind(JSON)), r(199, Wi), r(3807, Wi), r(3907, ee), r(2951, ee), r(791, ee), r(1183, ee), r(1270, ee);
  }, "init");
  Vi.exports = { init: fu };
});
var Yi = T((Zf, Ki) => {
  "use strict";
  h();
  var K = 1e6;
  function hu(r) {
    var e = r.readInt32BE(0), t = r.readUInt32BE(
      4
    ), n = "";
    e < 0 && (e = ~e + (t === 0), t = ~t + 1 >>> 0, n = "-");
    var i = "", s, o, u, c, l, f;
    {
      if (s = e % K, e = e / K >>> 0, o = 4294967296 * s + t, t = o / K >>> 0, u = "" + (o - K * t), t === 0 && e === 0) return n + u + i;
      for (c = "", l = 6 - u.length, f = 0; f < l; f++) c += "0";
      i = c + u + i;
    }
    {
      if (s = e % K, e = e / K >>> 0, o = 4294967296 * s + t, t = o / K >>> 0, u = "" + (o - K * t), t === 0 && e === 0) return n + u + i;
      for (c = "", l = 6 - u.length, f = 0; f < l; f++) c += "0";
      i = c + u + i;
    }
    {
      if (s = e % K, e = e / K >>> 0, o = 4294967296 * s + t, t = o / K >>> 0, u = "" + (o - K * t), t === 0 && e === 0) return n + u + i;
      for (c = "", l = 6 - u.length, f = 0; f < l; f++) c += "0";
      i = c + u + i;
    }
    return s = e % K, o = 4294967296 * s + t, u = "" + o % K, n + u + i;
  }
  a(hu, "readInt8");
  Ki.exports = hu;
});
var ts = T((eh, es) => {
  h();
  var du = Yi(), B = a(function(r, e, t, n, i) {
    t = t || 0, n = n || false, i = i || function(w, S, k) {
      return w * Math.pow(2, k) + S;
    };
    var s = t >> 3, o = a(function(w) {
      return n ? ~w & 255 : w;
    }, "inv"), u = 255, c = 8 - t % 8;
    e < c && (u = 255 << 8 - e & 255, c = e), t && (u = u >> t % 8);
    var l = 0;
    t % 8 + e >= 8 && (l = i(0, o(r[s]) & u, c));
    for (var f = e + t >> 3, m = s + 1; m < f; m++) l = i(l, o(
      r[m]
    ), 8);
    var g = (e + t) % 8;
    return g > 0 && (l = i(l, o(r[f]) >> 8 - g, g)), l;
  }, "parseBits"), Xi = a(function(r, e, t) {
    var n = Math.pow(2, t - 1) - 1, i = B(r, 1), s = B(r, t, 1);
    if (s === 0) return 0;
    var o = 1, u = a(function(l, f, m) {
      l === 0 && (l = 1);
      for (var g = 1; g <= m; g++) o /= 2, (f & 1 << m - g) > 0 && (l += o);
      return l;
    }, "parsePrecisionBits"), c = B(r, e, t + 1, false, u);
    return s == Math.pow(
      2,
      t + 1
    ) - 1 ? c === 0 ? i === 0 ? 1 / 0 : -1 / 0 : NaN : (i === 0 ? 1 : -1) * Math.pow(2, s - n) * c;
  }, "parseFloatFromBits"), pu = a(function(r) {
    return B(r, 1) == 1 ? -1 * (B(r, 15, 1, true) + 1) : B(r, 15, 1);
  }, "parseInt16"), Zi = a(function(r) {
    return B(r, 1) == 1 ? -1 * (B(
      r,
      31,
      1,
      true
    ) + 1) : B(r, 31, 1);
  }, "parseInt32"), yu = a(function(r) {
    return Xi(r, 23, 8);
  }, "parseFloat32"), mu = a(function(r) {
    return Xi(r, 52, 11);
  }, "parseFloat64"), gu = a(function(r) {
    var e = B(r, 16, 32);
    if (e == 49152) return NaN;
    for (var t = Math.pow(1e4, B(r, 16, 16)), n = 0, i = [], s = B(r, 16), o = 0; o < s; o++) n += B(r, 16, 64 + 16 * o) * t, t /= 1e4;
    var u = Math.pow(10, B(
      r,
      16,
      48
    ));
    return (e === 0 ? 1 : -1) * Math.round(n * u) / u;
  }, "parseNumeric"), Ji = a(function(r, e) {
    var t = B(e, 1), n = B(
      e,
      63,
      1
    ), i = new Date((t === 0 ? 1 : -1) * n / 1e3 + 9466848e5);
    return r || i.setTime(i.getTime() + i.getTimezoneOffset() * 6e4), i.usec = n % 1e3, i.getMicroSeconds = function() {
      return this.usec;
    }, i.setMicroSeconds = function(s) {
      this.usec = s;
    }, i.getUTCMicroSeconds = function() {
      return this.usec;
    }, i;
  }, "parseDate"), Ke = a(
    function(r) {
      for (var e = B(
        r,
        32
      ), t = B(r, 32, 32), n = B(r, 32, 64), i = 96, s = [], o = 0; o < e; o++) s[o] = B(r, 32, i), i += 32, i += 32;
      var u = a(function(l) {
        var f = B(r, 32, i);
        if (i += 32, f == 4294967295) return null;
        var m;
        if (l == 23 || l == 20) return m = B(r, f * 8, i), i += f * 8, m;
        if (l == 25) return m = r.toString(this.encoding, i >> 3, (i += f << 3) >> 3), m;
        console.log("ERROR: ElementType not implemented: " + l);
      }, "parseElement"), c = a(function(l, f) {
        var m = [], g;
        if (l.length > 1) {
          var w = l.shift();
          for (g = 0; g < w; g++) m[g] = c(l, f);
          l.unshift(w);
        } else for (g = 0; g < l[0]; g++) m[g] = u(f);
        return m;
      }, "parse");
      return c(s, n);
    },
    "parseArray"
  ), wu = a(function(r) {
    return r.toString("utf8");
  }, "parseText"), bu = a(function(r) {
    return r === null ? null : B(r, 8) > 0;
  }, "parseBool"), xu = a(function(r) {
    r(20, du), r(21, pu), r(23, Zi), r(26, Zi), r(1700, gu), r(700, yu), r(701, mu), r(16, bu), r(1114, Ji.bind(null, false)), r(1184, Ji.bind(null, true)), r(1e3, Ke), r(1007, Ke), r(1016, Ke), r(1008, Ke), r(1009, Ke), r(25, wu);
  }, "init");
  es.exports = { init: xu };
});
var ns = T((nh, rs) => {
  h();
  rs.exports = {
    BOOL: 16,
    BYTEA: 17,
    CHAR: 18,
    INT8: 20,
    INT2: 21,
    INT4: 23,
    REGPROC: 24,
    TEXT: 25,
    OID: 26,
    TID: 27,
    XID: 28,
    CID: 29,
    JSON: 114,
    XML: 142,
    PG_NODE_TREE: 194,
    SMGR: 210,
    PATH: 602,
    POLYGON: 604,
    CIDR: 650,
    FLOAT4: 700,
    FLOAT8: 701,
    ABSTIME: 702,
    RELTIME: 703,
    TINTERVAL: 704,
    CIRCLE: 718,
    MACADDR8: 774,
    MONEY: 790,
    MACADDR: 829,
    INET: 869,
    ACLITEM: 1033,
    BPCHAR: 1042,
    VARCHAR: 1043,
    DATE: 1082,
    TIME: 1083,
    TIMESTAMP: 1114,
    TIMESTAMPTZ: 1184,
    INTERVAL: 1186,
    TIMETZ: 1266,
    BIT: 1560,
    VARBIT: 1562,
    NUMERIC: 1700,
    REFCURSOR: 1790,
    REGPROCEDURE: 2202,
    REGOPER: 2203,
    REGOPERATOR: 2204,
    REGCLASS: 2205,
    REGTYPE: 2206,
    UUID: 2950,
    TXID_SNAPSHOT: 2970,
    PG_LSN: 3220,
    PG_NDISTINCT: 3361,
    PG_DEPENDENCIES: 3402,
    TSVECTOR: 3614,
    TSQUERY: 3615,
    GTSVECTOR: 3642,
    REGCONFIG: 3734,
    REGDICTIONARY: 3769,
    JSONB: 3802,
    REGNAMESPACE: 4089,
    REGROLE: 4096
  };
});
var Je = T((Ze) => {
  h();
  var vu = zi(), Su = ts(), Eu = rr(), Au = ns();
  Ze.getTypeParser = Cu;
  Ze.setTypeParser = _u;
  Ze.arrayParser = Eu;
  Ze.builtins = Au;
  var Ye = { text: {}, binary: {} };
  function is(r) {
    return String(r);
  }
  a(is, "noParse");
  function Cu(r, e) {
    return e = e || "text", Ye[e] && Ye[e][r] || is;
  }
  a(Cu, "getTypeParser");
  function _u(r, e, t) {
    typeof e == "function" && (t = e, e = "text"), Ye[e][r] = t;
  }
  a(_u, "setTypeParser");
  vu.init(function(r, e) {
    Ye.text[r] = e;
  });
  Su.init(function(r, e) {
    Ye.binary[r] = e;
  });
});
var _t = T((uh, ss) => {
  "use strict";
  h();
  var Tu = Je();
  function Ct(r) {
    this._types = r || Tu, this.text = {}, this.binary = {};
  }
  a(Ct, "TypeOverrides");
  Ct.prototype.getOverrides = function(r) {
    switch (r) {
      case "text":
        return this.text;
      case "binary":
        return this.binary;
      default:
        return {};
    }
  };
  Ct.prototype.setTypeParser = function(r, e, t) {
    typeof e == "function" && (t = e, e = "text"), this.getOverrides(e)[r] = t;
  };
  Ct.prototype.getTypeParser = function(r, e) {
    return e = e || "text", this.getOverrides(e)[r] || this._types.getTypeParser(r, e);
  };
  ss.exports = Ct;
});
function Xe(r) {
  let e = 1779033703, t = 3144134277, n = 1013904242, i = 2773480762, s = 1359893119, o = 2600822924, u = 528734635, c = 1541459225, l = 0, f = 0, m = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ], g = a((I, C) => I >>> C | I << 32 - C, "rrot"), w = new Uint32Array(64), S = new Uint8Array(64), k = a(() => {
    for (let R = 0, $ = 0; R < 16; R++, $ += 4) w[R] = S[$] << 24 | S[$ + 1] << 16 | S[$ + 2] << 8 | S[$ + 3];
    for (let R = 16; R < 64; R++) {
      let $ = g(w[R - 15], 7) ^ g(w[R - 15], 18) ^ w[R - 15] >>> 3, Ee = g(
        w[R - 2],
        17
      ) ^ g(w[R - 2], 19) ^ w[R - 2] >>> 10;
      w[R] = w[R - 16] + $ + w[R - 7] + Ee | 0;
    }
    let I = e, C = t, re = n, ne = i, H = s, oe = o, ae = u, me = c;
    for (let R = 0; R < 64; R++) {
      let $ = g(H, 6) ^ g(H, 11) ^ g(H, 25), Ee = H & oe ^ ~H & ae, ue = me + $ + Ee + m[R] + w[R] | 0, Te = g(I, 2) ^ g(
        I,
        13
      ) ^ g(I, 22), ce = I & C ^ I & re ^ C & re, G = Te + ce | 0;
      me = ae, ae = oe, oe = H, H = ne + ue | 0, ne = re, re = C, C = I, I = ue + G | 0;
    }
    e = e + I | 0, t = t + C | 0, n = n + re | 0, i = i + ne | 0, s = s + H | 0, o = o + oe | 0, u = u + ae | 0, c = c + me | 0, f = 0;
  }, "process"), D = a(
    (I) => {
      typeof I == "string" && (I = new TextEncoder().encode(I));
      for (let C = 0; C < I.length; C++) S[f++] = I[C], f === 64 && k();
      l += I.length;
    },
    "add"
  ), he = a(() => {
    if (S[f++] = 128, f == 64 && k(), f + 8 > 64) {
      for (; f < 64; ) S[f++] = 0;
      k();
    }
    for (; f < 58; ) S[f++] = 0;
    let I = l * 8;
    S[f++] = I / 1099511627776 & 255, S[f++] = I / 4294967296 & 255, S[f++] = I >>> 24, S[f++] = I >>> 16 & 255, S[f++] = I >>> 8 & 255, S[f++] = I & 255, k();
    let C = new Uint8Array(32);
    return C[0] = e >>> 24, C[1] = e >>> 16 & 255, C[2] = e >>> 8 & 255, C[3] = e & 255, C[4] = t >>> 24, C[5] = t >>> 16 & 255, C[6] = t >>> 8 & 255, C[7] = t & 255, C[8] = n >>> 24, C[9] = n >>> 16 & 255, C[10] = n >>> 8 & 255, C[11] = n & 255, C[12] = i >>> 24, C[13] = i >>> 16 & 255, C[14] = i >>> 8 & 255, C[15] = i & 255, C[16] = s >>> 24, C[17] = s >>> 16 & 255, C[18] = s >>> 8 & 255, C[19] = s & 255, C[20] = o >>> 24, C[21] = o >>> 16 & 255, C[22] = o >>> 8 & 255, C[23] = o & 255, C[24] = u >>> 24, C[25] = u >>> 16 & 255, C[26] = u >>> 8 & 255, C[27] = u & 255, C[28] = c >>> 24, C[29] = c >>> 16 & 255, C[30] = c >>> 8 & 255, C[31] = c & 255, C;
  }, "digest");
  return r === void 0 ? { add: D, digest: he } : (D(r), he());
}
var os = V(() => {
  "use strict";
  h();
  a(Xe, "sha256");
});
var M;
var et;
var as = V(() => {
  "use strict";
  h();
  M = class M2 {
    constructor() {
      E(this, "_dataLength", 0);
      E(this, "_bufferLength", 0);
      E(this, "_state", new Int32Array(4));
      E(this, "_buffer", new ArrayBuffer(68));
      E(this, "_buffer8");
      E(this, "_buffer32");
      this._buffer8 = new Uint8Array(this._buffer, 0, 68), this._buffer32 = new Uint32Array(this._buffer, 0, 17), this.start();
    }
    static hashByteArray(e, t = false) {
      return this.onePassHasher.start().appendByteArray(
        e
      ).end(t);
    }
    static hashStr(e, t = false) {
      return this.onePassHasher.start().appendStr(e).end(t);
    }
    static hashAsciiStr(e, t = false) {
      return this.onePassHasher.start().appendAsciiStr(e).end(t);
    }
    static _hex(e) {
      let t = M2.hexChars, n = M2.hexOut, i, s, o, u;
      for (u = 0; u < 4; u += 1) for (s = u * 8, i = e[u], o = 0; o < 8; o += 2) n[s + 1 + o] = t.charAt(i & 15), i >>>= 4, n[s + 0 + o] = t.charAt(
        i & 15
      ), i >>>= 4;
      return n.join("");
    }
    static _md5cycle(e, t) {
      let n = e[0], i = e[1], s = e[2], o = e[3];
      n += (i & s | ~i & o) + t[0] - 680876936 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[1] - 389564586 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[2] + 606105819 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[3] - 1044525330 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & s | ~i & o) + t[4] - 176418897 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[5] + 1200080426 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[6] - 1473231341 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[7] - 45705983 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & s | ~i & o) + t[8] + 1770035416 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[9] - 1958414417 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[10] - 42063 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[11] - 1990404162 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & s | ~i & o) + t[12] + 1804603682 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[13] - 40341101 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[14] - 1502002290 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[15] + 1236535329 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & o | s & ~o) + t[1] - 165796510 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[6] - 1069501632 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[11] + 643717713 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[0] - 373897302 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i & o | s & ~o) + t[5] - 701558691 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[10] + 38016083 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[15] - 660478335 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[4] - 405537848 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i & o | s & ~o) + t[9] + 568446438 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[14] - 1019803690 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[3] - 187363961 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[8] + 1163531501 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i & o | s & ~o) + t[13] - 1444681467 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[2] - 51403784 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[7] + 1735328473 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[12] - 1926607734 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i ^ s ^ o) + t[5] - 378558 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[8] - 2022574463 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[11] + 1839030562 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[14] - 35309556 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (i ^ s ^ o) + t[1] - 1530992060 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[4] + 1272893353 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[7] - 155497632 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[10] - 1094730640 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (i ^ s ^ o) + t[13] + 681279174 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[0] - 358537222 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[3] - 722521979 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[6] + 76029189 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (i ^ s ^ o) + t[9] - 640364487 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[12] - 421815835 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[15] + 530742520 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[2] - 995338651 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (s ^ (i | ~o)) + t[0] - 198630844 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[7] + 1126891415 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[14] - 1416354905 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[5] - 57434055 | 0, i = (i << 21 | i >>> 11) + s | 0, n += (s ^ (i | ~o)) + t[12] + 1700485571 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[3] - 1894986606 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[10] - 1051523 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[1] - 2054922799 | 0, i = (i << 21 | i >>> 11) + s | 0, n += (s ^ (i | ~o)) + t[8] + 1873313359 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[15] - 30611744 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[6] - 1560198380 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[13] + 1309151649 | 0, i = (i << 21 | i >>> 11) + s | 0, n += (s ^ (i | ~o)) + t[4] - 145523070 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[11] - 1120210379 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[2] + 718787259 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[9] - 343485551 | 0, i = (i << 21 | i >>> 11) + s | 0, e[0] = n + e[0] | 0, e[1] = i + e[1] | 0, e[2] = s + e[2] | 0, e[3] = o + e[3] | 0;
    }
    start() {
      return this._dataLength = 0, this._bufferLength = 0, this._state.set(M2.stateIdentity), this;
    }
    appendStr(e) {
      let t = this._buffer8, n = this._buffer32, i = this._bufferLength, s, o;
      for (o = 0; o < e.length; o += 1) {
        if (s = e.charCodeAt(o), s < 128) t[i++] = s;
        else if (s < 2048) t[i++] = (s >>> 6) + 192, t[i++] = s & 63 | 128;
        else if (s < 55296 || s > 56319) t[i++] = (s >>> 12) + 224, t[i++] = s >>> 6 & 63 | 128, t[i++] = s & 63 | 128;
        else {
          if (s = (s - 55296) * 1024 + (e.charCodeAt(++o) - 56320) + 65536, s > 1114111) throw new Error(
            "Unicode standard supports code points up to U+10FFFF"
          );
          t[i++] = (s >>> 18) + 240, t[i++] = s >>> 12 & 63 | 128, t[i++] = s >>> 6 & 63 | 128, t[i++] = s & 63 | 128;
        }
        i >= 64 && (this._dataLength += 64, M2._md5cycle(this._state, n), i -= 64, n[0] = n[16]);
      }
      return this._bufferLength = i, this;
    }
    appendAsciiStr(e) {
      let t = this._buffer8, n = this._buffer32, i = this._bufferLength, s, o = 0;
      for (; ; ) {
        for (s = Math.min(e.length - o, 64 - i); s--; ) t[i++] = e.charCodeAt(o++);
        if (i < 64) break;
        this._dataLength += 64, M2._md5cycle(this._state, n), i = 0;
      }
      return this._bufferLength = i, this;
    }
    appendByteArray(e) {
      let t = this._buffer8, n = this._buffer32, i = this._bufferLength, s, o = 0;
      for (; ; ) {
        for (s = Math.min(e.length - o, 64 - i); s--; ) t[i++] = e[o++];
        if (i < 64) break;
        this._dataLength += 64, M2._md5cycle(this._state, n), i = 0;
      }
      return this._bufferLength = i, this;
    }
    getState() {
      let e = this._state;
      return { buffer: String.fromCharCode.apply(null, Array.from(this._buffer8)), buflen: this._bufferLength, length: this._dataLength, state: [e[0], e[1], e[2], e[3]] };
    }
    setState(e) {
      let t = e.buffer, n = e.state, i = this._state, s;
      for (this._dataLength = e.length, this._bufferLength = e.buflen, i[0] = n[0], i[1] = n[1], i[2] = n[2], i[3] = n[3], s = 0; s < t.length; s += 1) this._buffer8[s] = t.charCodeAt(s);
    }
    end(e = false) {
      let t = this._bufferLength, n = this._buffer8, i = this._buffer32, s = (t >> 2) + 1;
      this._dataLength += t;
      let o = this._dataLength * 8;
      if (n[t] = 128, n[t + 1] = n[t + 2] = n[t + 3] = 0, i.set(M2.buffer32Identity.subarray(s), s), t > 55 && (M2._md5cycle(this._state, i), i.set(M2.buffer32Identity)), o <= 4294967295) i[14] = o;
      else {
        let u = o.toString(16).match(/(.*?)(.{0,8})$/);
        if (u === null) return;
        let c = parseInt(
          u[2],
          16
        ), l = parseInt(u[1], 16) || 0;
        i[14] = c, i[15] = l;
      }
      return M2._md5cycle(this._state, i), e ? this._state : M2._hex(
        this._state
      );
    }
  };
  a(M, "Md5"), E(M, "stateIdentity", new Int32Array([1732584193, -271733879, -1732584194, 271733878])), E(M, "buffer32Identity", new Int32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), E(M, "hexChars", "0123456789abcdef"), E(M, "hexOut", []), E(M, "onePassHasher", new M());
  et = M;
});
var lr = {};
se(lr, { createHash: () => Pu, createHmac: () => Ru, randomBytes: () => Iu });
function Iu(r) {
  return crypto.getRandomValues(p.alloc(r));
}
function Pu(r) {
  if (r === "sha256") return { update: a(function(e) {
    return { digest: a(
      function() {
        return p.from(Xe(e));
      },
      "digest"
    ) };
  }, "update") };
  if (r === "md5") return { update: a(function(e) {
    return {
      digest: a(function() {
        return typeof e == "string" ? et.hashStr(e) : et.hashByteArray(e);
      }, "digest")
    };
  }, "update") };
  throw new Error(`Hash type '${r}' not supported`);
}
function Ru(r, e) {
  if (r !== "sha256") throw new Error(`Only sha256 is supported (requested: '${r}')`);
  return { update: a(function(t) {
    return { digest: a(
      function() {
        typeof e == "string" && (e = new TextEncoder().encode(e)), typeof t == "string" && (t = new TextEncoder().encode(
          t
        ));
        let n = e.length;
        if (n > 64) e = Xe(e);
        else if (n < 64) {
          let c = new Uint8Array(64);
          c.set(e), e = c;
        }
        let i = new Uint8Array(
          64
        ), s = new Uint8Array(64);
        for (let c = 0; c < 64; c++) i[c] = 54 ^ e[c], s[c] = 92 ^ e[c];
        let o = new Uint8Array(t.length + 64);
        o.set(i, 0), o.set(t, 64);
        let u = new Uint8Array(96);
        return u.set(s, 0), u.set(Xe(o), 64), p.from(Xe(u));
      },
      "digest"
    ) };
  }, "update") };
}
var fr = V(() => {
  "use strict";
  h();
  os();
  as();
  a(Iu, "randomBytes");
  a(Pu, "createHash");
  a(Ru, "createHmac");
});
var tt = T((vh, hr) => {
  "use strict";
  h();
  hr.exports = {
    host: "localhost",
    user: y.platform === "win32" ? y.env.USERNAME : y.env.USER,
    database: void 0,
    password: null,
    connectionString: void 0,
    port: 5432,
    rows: 0,
    binary: false,
    max: 10,
    idleTimeoutMillis: 3e4,
    client_encoding: "",
    ssl: false,
    application_name: void 0,
    fallback_application_name: void 0,
    options: void 0,
    parseInputDatesAsUTC: false,
    statement_timeout: false,
    lock_timeout: false,
    idle_in_transaction_session_timeout: false,
    query_timeout: false,
    connect_timeout: 0,
    keepalives: 1,
    keepalives_idle: 0
  };
  var ke = Je(), Lu = ke.getTypeParser(20, "text"), Bu = ke.getTypeParser(
    1016,
    "text"
  );
  hr.exports.__defineSetter__("parseInt8", function(r) {
    ke.setTypeParser(20, "text", r ? ke.getTypeParser(
      23,
      "text"
    ) : Lu), ke.setTypeParser(1016, "text", r ? ke.getTypeParser(1007, "text") : Bu);
  });
});
var rt = T((Eh, cs) => {
  "use strict";
  h();
  var Fu = (fr(), O(lr)), Mu = tt();
  function ku(r) {
    var e = r.replace(
      /\\/g,
      "\\\\"
    ).replace(/"/g, '\\"');
    return '"' + e + '"';
  }
  a(ku, "escapeElement");
  function us(r) {
    for (var e = "{", t = 0; t < r.length; t++) t > 0 && (e = e + ","), r[t] === null || typeof r[t] > "u" ? e = e + "NULL" : Array.isArray(r[t]) ? e = e + us(r[t]) : r[t] instanceof p ? e += "\\\\x" + r[t].toString("hex") : e += ku(Tt(r[t]));
    return e = e + "}", e;
  }
  a(us, "arrayString");
  var Tt = a(function(r, e) {
    if (r == null) return null;
    if (r instanceof p) return r;
    if (ArrayBuffer.isView(r)) {
      var t = p.from(r.buffer, r.byteOffset, r.byteLength);
      return t.length === r.byteLength ? t : t.slice(r.byteOffset, r.byteOffset + r.byteLength);
    }
    return r instanceof Date ? Mu.parseInputDatesAsUTC ? Qu(r) : Uu(r) : Array.isArray(r) ? us(r) : typeof r == "object" ? Ou(r, e) : r.toString();
  }, "prepareValue");
  function Ou(r, e) {
    if (r && typeof r.toPostgres == "function") {
      if (e = e || [], e.indexOf(r) !== -1) throw new Error('circular reference detected while preparing "' + r + '" for query');
      return e.push(r), Tt(r.toPostgres(Tt), e);
    }
    return JSON.stringify(r);
  }
  a(Ou, "prepareObject");
  function W(r, e) {
    for (r = "" + r; r.length < e; ) r = "0" + r;
    return r;
  }
  a(W, "pad");
  function Uu(r) {
    var e = -r.getTimezoneOffset(), t = r.getFullYear(), n = t < 1;
    n && (t = Math.abs(t) + 1);
    var i = W(t, 4) + "-" + W(r.getMonth() + 1, 2) + "-" + W(r.getDate(), 2) + "T" + W(
      r.getHours(),
      2
    ) + ":" + W(r.getMinutes(), 2) + ":" + W(r.getSeconds(), 2) + "." + W(r.getMilliseconds(), 3);
    return e < 0 ? (i += "-", e *= -1) : i += "+", i += W(Math.floor(e / 60), 2) + ":" + W(e % 60, 2), n && (i += " BC"), i;
  }
  a(Uu, "dateToString");
  function Qu(r) {
    var e = r.getUTCFullYear(), t = e < 1;
    t && (e = Math.abs(e) + 1);
    var n = W(e, 4) + "-" + W(r.getUTCMonth() + 1, 2) + "-" + W(r.getUTCDate(), 2) + "T" + W(r.getUTCHours(), 2) + ":" + W(r.getUTCMinutes(), 2) + ":" + W(r.getUTCSeconds(), 2) + "." + W(
      r.getUTCMilliseconds(),
      3
    );
    return n += "+00:00", t && (n += " BC"), n;
  }
  a(Qu, "dateToStringUTC");
  function Du(r, e, t) {
    return r = typeof r == "string" ? { text: r } : r, e && (typeof e == "function" ? r.callback = e : r.values = e), t && (r.callback = t), r;
  }
  a(Du, "normalizeQueryConfig");
  var dr = a(function(r) {
    return Fu.createHash("md5").update(r, "utf-8").digest("hex");
  }, "md5"), qu = a(
    function(r, e, t) {
      var n = dr(e + r), i = dr(p.concat([p.from(n), t]));
      return "md5" + i;
    },
    "postgresMd5PasswordHash"
  );
  cs.exports = {
    prepareValue: a(function(e) {
      return Tt(e);
    }, "prepareValueWrapper"),
    normalizeQueryConfig: Du,
    postgresMd5PasswordHash: qu,
    md5: dr
  };
});
var nt = {};
se(nt, { default: () => ju });
var ju;
var it = V(() => {
  "use strict";
  h();
  ju = {};
});
var xs = T((Dh, bs) => {
  "use strict";
  h();
  var pr = (fr(), O(lr));
  function Hu(r) {
    if (r.indexOf("SCRAM-SHA-256") === -1) throw new Error("SASL: Only mechanism SCRAM-SHA-256 is currently supported");
    let e = pr.randomBytes(
      18
    ).toString("base64");
    return { mechanism: "SCRAM-SHA-256", clientNonce: e, response: "n,,n=*,r=" + e, message: "SASLInitialResponse" };
  }
  a(Hu, "startSession");
  function $u(r, e, t) {
    if (r.message !== "SASLInitialResponse") throw new Error(
      "SASL: Last message was not SASLInitialResponse"
    );
    if (typeof e != "string") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
    if (typeof t != "string") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
    let n = zu(t);
    if (n.nonce.startsWith(r.clientNonce)) {
      if (n.nonce.length === r.clientNonce.length) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
    } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
    var i = p.from(n.salt, "base64"), s = Zu(e, i, n.iteration), o = Oe(s, "Client Key"), u = Yu(
      o
    ), c = "n=*,r=" + r.clientNonce, l = "r=" + n.nonce + ",s=" + n.salt + ",i=" + n.iteration, f = "c=biws,r=" + n.nonce, m = c + "," + l + "," + f, g = Oe(u, m), w = ws(o, g), S = w.toString("base64"), k = Oe(s, "Server Key"), D = Oe(k, m);
    r.message = "SASLResponse", r.serverSignature = D.toString("base64"), r.response = f + ",p=" + S;
  }
  a($u, "continueSession");
  function Gu(r, e) {
    if (r.message !== "SASLResponse") throw new Error("SASL: Last message was not SASLResponse");
    if (typeof e != "string") throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
    let { serverSignature: t } = Ku(
      e
    );
    if (t !== r.serverSignature) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
  }
  a(Gu, "finalizeSession");
  function Vu(r) {
    if (typeof r != "string") throw new TypeError("SASL: text must be a string");
    return r.split("").map((e, t) => r.charCodeAt(t)).every((e) => e >= 33 && e <= 43 || e >= 45 && e <= 126);
  }
  a(Vu, "isPrintableChars");
  function ms(r) {
    return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(r);
  }
  a(ms, "isBase64");
  function gs(r) {
    if (typeof r != "string") throw new TypeError("SASL: attribute pairs text must be a string");
    return new Map(r.split(",").map((e) => {
      if (!/^.=/.test(e)) throw new Error("SASL: Invalid attribute pair entry");
      let t = e[0], n = e.substring(2);
      return [t, n];
    }));
  }
  a(gs, "parseAttributePairs");
  function zu(r) {
    let e = gs(r), t = e.get("r");
    if (t) {
      if (!Vu(t)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
    } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
    let n = e.get("s");
    if (n) {
      if (!ms(n)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
    } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
    let i = e.get("i");
    if (i) {
      if (!/^[1-9][0-9]*$/.test(i)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
    } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
    let s = parseInt(i, 10);
    return { nonce: t, salt: n, iteration: s };
  }
  a(zu, "parseServerFirstMessage");
  function Ku(r) {
    let t = gs(r).get("v");
    if (t) {
      if (!ms(t)) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
    } else throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
    return { serverSignature: t };
  }
  a(Ku, "parseServerFinalMessage");
  function ws(r, e) {
    if (!p.isBuffer(r)) throw new TypeError("first argument must be a Buffer");
    if (!p.isBuffer(e)) throw new TypeError(
      "second argument must be a Buffer"
    );
    if (r.length !== e.length) throw new Error("Buffer lengths must match");
    if (r.length === 0) throw new Error("Buffers cannot be empty");
    return p.from(r.map((t, n) => r[n] ^ e[n]));
  }
  a(ws, "xorBuffers");
  function Yu(r) {
    return pr.createHash("sha256").update(r).digest();
  }
  a(Yu, "sha256");
  function Oe(r, e) {
    return pr.createHmac("sha256", r).update(e).digest();
  }
  a(Oe, "hmacSha256");
  function Zu(r, e, t) {
    for (var n = Oe(
      r,
      p.concat([e, p.from([0, 0, 0, 1])])
    ), i = n, s = 0; s < t - 1; s++) n = Oe(r, n), i = ws(i, n);
    return i;
  }
  a(Zu, "Hi");
  bs.exports = { startSession: Hu, continueSession: $u, finalizeSession: Gu };
});
var yr = {};
se(yr, { join: () => Ju });
function Ju(...r) {
  return r.join("/");
}
var mr = V(() => {
  "use strict";
  h();
  a(
    Ju,
    "join"
  );
});
var gr = {};
se(gr, { stat: () => Xu });
function Xu(r, e) {
  e(new Error("No filesystem"));
}
var wr = V(() => {
  "use strict";
  h();
  a(Xu, "stat");
});
var br = {};
se(br, { default: () => ec });
var ec;
var xr = V(() => {
  "use strict";
  h();
  ec = {};
});
var vs = {};
se(vs, { StringDecoder: () => vr });
var Sr;
var vr;
var Ss = V(() => {
  "use strict";
  h();
  Sr = class Sr {
    constructor(e) {
      E(this, "td");
      this.td = new TextDecoder(e);
    }
    write(e) {
      return this.td.decode(e, { stream: true });
    }
    end(e) {
      return this.td.decode(e);
    }
  };
  a(Sr, "StringDecoder");
  vr = Sr;
});
var _s = T((Kh, Cs) => {
  "use strict";
  h();
  var { Transform: tc } = (xr(), O(br)), { StringDecoder: rc } = (Ss(), O(vs)), Se = Symbol(
    "last"
  ), It = Symbol("decoder");
  function nc(r, e, t) {
    let n;
    if (this.overflow) {
      if (n = this[It].write(r).split(
        this.matcher
      ), n.length === 1) return t();
      n.shift(), this.overflow = false;
    } else this[Se] += this[It].write(r), n = this[Se].split(this.matcher);
    this[Se] = n.pop();
    for (let i = 0; i < n.length; i++) try {
      As(this, this.mapper(n[i]));
    } catch (s) {
      return t(s);
    }
    if (this.overflow = this[Se].length > this.maxLength, this.overflow && !this.skipOverflow) {
      t(new Error(
        "maximum buffer reached"
      ));
      return;
    }
    t();
  }
  a(nc, "transform");
  function ic(r) {
    if (this[Se] += this[It].end(), this[Se])
      try {
        As(this, this.mapper(this[Se]));
      } catch (e) {
        return r(e);
      }
    r();
  }
  a(ic, "flush");
  function As(r, e) {
    e !== void 0 && r.push(e);
  }
  a(As, "push");
  function Es(r) {
    return r;
  }
  a(Es, "noop");
  function sc(r, e, t) {
    switch (r = r || /\r?\n/, e = e || Es, t = t || {}, arguments.length) {
      case 1:
        typeof r == "function" ? (e = r, r = /\r?\n/) : typeof r == "object" && !(r instanceof RegExp) && !r[Symbol.split] && (t = r, r = /\r?\n/);
        break;
      case 2:
        typeof r == "function" ? (t = e, e = r, r = /\r?\n/) : typeof e == "object" && (t = e, e = Es);
    }
    t = Object.assign({}, t), t.autoDestroy = true, t.transform = nc, t.flush = ic, t.readableObjectMode = true;
    let n = new tc(t);
    return n[Se] = "", n[It] = new rc("utf8"), n.matcher = r, n.mapper = e, n.maxLength = t.maxLength, n.skipOverflow = t.skipOverflow || false, n.overflow = false, n._destroy = function(i, s) {
      this._writableState.errorEmitted = false, s(i);
    }, n;
  }
  a(sc, "split");
  Cs.exports = sc;
});
var Ps = T((Jh, ye) => {
  "use strict";
  h();
  var Ts = (mr(), O(yr)), oc = (xr(), O(br)).Stream, ac = _s(), Is = (it(), O(nt)), uc = 5432, Pt = y.platform === "win32", st = y.stderr, cc = 56, lc = 7, fc = 61440, hc = 32768;
  function dc(r) {
    return (r & fc) == hc;
  }
  a(dc, "isRegFile");
  var Ue = ["host", "port", "database", "user", "password"], Er = Ue.length, pc = Ue[Er - 1];
  function Ar() {
    var r = st instanceof oc && st.writable === true;
    if (r) {
      var e = Array.prototype.slice.call(arguments).concat(`
`);
      st.write(Is.format.apply(Is, e));
    }
  }
  a(Ar, "warn");
  Object.defineProperty(ye.exports, "isWin", { get: a(function() {
    return Pt;
  }, "get"), set: a(function(r) {
    Pt = r;
  }, "set") });
  ye.exports.warnTo = function(r) {
    var e = st;
    return st = r, e;
  };
  ye.exports.getFileName = function(r) {
    var e = r || y.env, t = e.PGPASSFILE || (Pt ? Ts.join(e.APPDATA || "./", "postgresql", "pgpass.conf") : Ts.join(e.HOME || "./", ".pgpass"));
    return t;
  };
  ye.exports.usePgPass = function(r, e) {
    return Object.prototype.hasOwnProperty.call(y.env, "PGPASSWORD") ? false : Pt ? true : (e = e || "<unkn>", dc(r.mode) ? r.mode & (cc | lc) ? (Ar('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', e), false) : true : (Ar('WARNING: password file "%s" is not a plain file', e), false));
  };
  var yc = ye.exports.match = function(r, e) {
    return Ue.slice(0, -1).reduce(function(t, n, i) {
      return i == 1 && Number(r[n] || uc) === Number(
        e[n]
      ) ? t && true : t && (e[n] === "*" || e[n] === r[n]);
    }, true);
  };
  ye.exports.getPassword = function(r, e, t) {
    var n, i = e.pipe(
      ac()
    );
    function s(c) {
      var l = mc(c);
      l && gc(l) && yc(r, l) && (n = l[pc], i.end());
    }
    a(s, "onLine");
    var o = a(function() {
      e.destroy(), t(n);
    }, "onEnd"), u = a(function(c) {
      e.destroy(), Ar("WARNING: error on reading file: %s", c), t(
        void 0
      );
    }, "onErr");
    e.on("error", u), i.on("data", s).on("end", o).on("error", u);
  };
  var mc = ye.exports.parseLine = function(r) {
    if (r.length < 11 || r.match(/^\s+#/)) return null;
    for (var e = "", t = "", n = 0, i = 0, s = 0, o = {}, u = false, c = a(
      function(f, m, g) {
        var w = r.substring(m, g);
        Object.hasOwnProperty.call(y.env, "PGPASS_NO_DEESCAPE") || (w = w.replace(/\\([:\\])/g, "$1")), o[Ue[f]] = w;
      },
      "addToObj"
    ), l = 0; l < r.length - 1; l += 1) {
      if (e = r.charAt(l + 1), t = r.charAt(
        l
      ), u = n == Er - 1, u) {
        c(n, i);
        break;
      }
      l >= 0 && e == ":" && t !== "\\" && (c(n, i, l + 1), i = l + 2, n += 1);
    }
    return o = Object.keys(o).length === Er ? o : null, o;
  }, gc = ye.exports.isValidEntry = function(r) {
    for (var e = { 0: function(o) {
      return o.length > 0;
    }, 1: function(o) {
      return o === "*" ? true : (o = Number(o), isFinite(o) && o > 0 && o < 9007199254740992 && Math.floor(o) === o);
    }, 2: function(o) {
      return o.length > 0;
    }, 3: function(o) {
      return o.length > 0;
    }, 4: function(o) {
      return o.length > 0;
    } }, t = 0; t < Ue.length; t += 1) {
      var n = e[t], i = r[Ue[t]] || "", s = n(i);
      if (!s) return false;
    }
    return true;
  };
});
var Ls = T((rd, Cr) => {
  "use strict";
  h();
  var td = (mr(), O(yr)), Rs = (wr(), O(gr)), Rt = Ps();
  Cr.exports = function(r, e) {
    var t = Rt.getFileName();
    Rs.stat(t, function(n, i) {
      if (n || !Rt.usePgPass(i, t)) return e(void 0);
      var s = Rs.createReadStream(
        t
      );
      Rt.getPassword(r, s, e);
    });
  };
  Cr.exports.warnTo = Rt.warnTo;
});
var Bs = {};
se(Bs, { default: () => wc });
var wc;
var Fs = V(() => {
  "use strict";
  h();
  wc = {};
});
var Ms = {};
se(Ms, { parse: () => bc });
function bc(r, e = false) {
  let { protocol: t } = new URL(r), n = "http:" + r.substring(
    t.length
  ), { username: i, password: s, host: o, hostname: u, port: c, pathname: l, search: f, searchParams: m, hash: g } = new URL(
    n
  );
  s = decodeURIComponent(s), i = decodeURIComponent(i), l = decodeURIComponent(l);
  let w = i + ":" + s, S = e ? Object.fromEntries(m.entries()) : f;
  return {
    href: r,
    protocol: t,
    auth: w,
    username: i,
    password: s,
    host: o,
    hostname: u,
    port: c,
    pathname: l,
    search: f,
    query: S,
    hash: g
  };
}
var ks = V(() => {
  "use strict";
  h();
  a(bc, "parse");
});
var Ir = T((ad, Os) => {
  "use strict";
  h();
  var xc = (ks(), O(Ms)), _r = (wr(), O(gr));
  function Tr(r) {
    if (r.charAt(0) === "/") {
      var t = r.split(" ");
      return { host: t[0], database: t[1] };
    }
    var e = xc.parse(/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(r) ? encodeURI(r).replace(/\%25(\d\d)/g, "%$1") : r, true), t = e.query;
    for (var n in t) Array.isArray(t[n]) && (t[n] = t[n][t[n].length - 1]);
    var i = (e.auth || ":").split(":");
    if (t.user = i[0], t.password = i.splice(1).join(
      ":"
    ), t.port = e.port, e.protocol == "socket:") return t.host = decodeURI(e.pathname), t.database = e.query.db, t.client_encoding = e.query.encoding, t;
    t.host || (t.host = e.hostname);
    var s = e.pathname;
    if (!t.host && s && /^%2f/i.test(s)) {
      var o = s.split("/");
      t.host = decodeURIComponent(o[0]), s = o.splice(1).join("/");
    }
    switch (s && s.charAt(
      0
    ) === "/" && (s = s.slice(1) || null), t.database = s && decodeURI(s), (t.ssl === "true" || t.ssl === "1") && (t.ssl = true), t.ssl === "0" && (t.ssl = false), (t.sslcert || t.sslkey || t.sslrootcert || t.sslmode) && (t.ssl = {}), t.sslcert && (t.ssl.cert = _r.readFileSync(t.sslcert).toString()), t.sslkey && (t.ssl.key = _r.readFileSync(t.sslkey).toString()), t.sslrootcert && (t.ssl.ca = _r.readFileSync(t.sslrootcert).toString()), t.sslmode) {
      case "disable": {
        t.ssl = false;
        break;
      }
      case "prefer":
      case "require":
      case "verify-ca":
      case "verify-full":
        break;
      case "no-verify": {
        t.ssl.rejectUnauthorized = false;
        break;
      }
    }
    return t;
  }
  a(Tr, "parse");
  Os.exports = Tr;
  Tr.parse = Tr;
});
var Lt = T((ld, Ds) => {
  "use strict";
  h();
  var vc = (Fs(), O(Bs)), Qs = tt(), Us = Ir().parse, j = a(function(r, e, t) {
    return t === void 0 ? t = y.env["PG" + r.toUpperCase()] : t === false || (t = y.env[t]), e[r] || t || Qs[r];
  }, "val"), Sc = a(function() {
    switch (y.env.PGSSLMODE) {
      case "disable":
        return false;
      case "prefer":
      case "require":
      case "verify-ca":
      case "verify-full":
        return true;
      case "no-verify":
        return { rejectUnauthorized: false };
    }
    return Qs.ssl;
  }, "readSSLConfigFromEnvironment"), Qe = a(function(r) {
    return "'" + ("" + r).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }, "quoteParamValue"), te = a(function(r, e, t) {
    var n = e[t];
    n != null && r.push(t + "=" + Qe(n));
  }, "add"), Rr = class Rr {
    constructor(e) {
      e = typeof e == "string" ? Us(e) : e || {}, e.connectionString && (e = Object.assign({}, e, Us(e.connectionString))), this.user = j("user", e), this.database = j("database", e), this.database === void 0 && (this.database = this.user), this.port = parseInt(j("port", e), 10), this.host = j("host", e), Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: j("password", e)
      }), this.binary = j("binary", e), this.options = j("options", e), this.ssl = typeof e.ssl > "u" ? Sc() : e.ssl, typeof this.ssl == "string" && this.ssl === "true" && (this.ssl = true), this.ssl === "no-verify" && (this.ssl = { rejectUnauthorized: false }), this.ssl && this.ssl.key && Object.defineProperty(this.ssl, "key", { enumerable: false }), this.client_encoding = j("client_encoding", e), this.replication = j("replication", e), this.isDomainSocket = !(this.host || "").indexOf("/"), this.application_name = j("application_name", e, "PGAPPNAME"), this.fallback_application_name = j("fallback_application_name", e, false), this.statement_timeout = j("statement_timeout", e, false), this.lock_timeout = j("lock_timeout", e, false), this.idle_in_transaction_session_timeout = j("idle_in_transaction_session_timeout", e, false), this.query_timeout = j("query_timeout", e, false), e.connectionTimeoutMillis === void 0 ? this.connect_timeout = y.env.PGCONNECT_TIMEOUT || 0 : this.connect_timeout = Math.floor(e.connectionTimeoutMillis / 1e3), e.keepAlive === false ? this.keepalives = 0 : e.keepAlive === true && (this.keepalives = 1), typeof e.keepAliveInitialDelayMillis == "number" && (this.keepalives_idle = Math.floor(e.keepAliveInitialDelayMillis / 1e3));
    }
    getLibpqConnectionString(e) {
      var t = [];
      te(t, this, "user"), te(t, this, "password"), te(t, this, "port"), te(t, this, "application_name"), te(
        t,
        this,
        "fallback_application_name"
      ), te(t, this, "connect_timeout"), te(t, this, "options");
      var n = typeof this.ssl == "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
      if (te(t, n, "sslmode"), te(t, n, "sslca"), te(t, n, "sslkey"), te(t, n, "sslcert"), te(t, n, "sslrootcert"), this.database && t.push("dbname=" + Qe(this.database)), this.replication && t.push("replication=" + Qe(this.replication)), this.host && t.push("host=" + Qe(this.host)), this.isDomainSocket) return e(null, t.join(" "));
      this.client_encoding && t.push("client_encoding=" + Qe(this.client_encoding)), vc.lookup(this.host, function(i, s) {
        return i ? e(i, null) : (t.push("hostaddr=" + Qe(s)), e(null, t.join(" ")));
      });
    }
  };
  a(Rr, "ConnectionParameters");
  var Pr = Rr;
  Ds.exports = Pr;
});
var Ws = T((dd, Ns) => {
  "use strict";
  h();
  var Ec = Je(), qs = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/, Br = class Br {
    constructor(e, t) {
      this.command = null, this.rowCount = null, this.oid = null, this.rows = [], this.fields = [], this._parsers = void 0, this._types = t, this.RowCtor = null, this.rowAsArray = e === "array", this.rowAsArray && (this.parseRow = this._parseRowAsArray);
    }
    addCommandComplete(e) {
      var t;
      e.text ? t = qs.exec(e.text) : t = qs.exec(e.command), t && (this.command = t[1], t[3] ? (this.oid = parseInt(
        t[2],
        10
      ), this.rowCount = parseInt(t[3], 10)) : t[2] && (this.rowCount = parseInt(t[2], 10)));
    }
    _parseRowAsArray(e) {
      for (var t = new Array(
        e.length
      ), n = 0, i = e.length; n < i; n++) {
        var s = e[n];
        s !== null ? t[n] = this._parsers[n](s) : t[n] = null;
      }
      return t;
    }
    parseRow(e) {
      for (var t = {}, n = 0, i = e.length; n < i; n++) {
        var s = e[n], o = this.fields[n].name;
        s !== null ? t[o] = this._parsers[n](
          s
        ) : t[o] = null;
      }
      return t;
    }
    addRow(e) {
      this.rows.push(e);
    }
    addFields(e) {
      this.fields = e, this.fields.length && (this._parsers = new Array(e.length));
      for (var t = 0; t < e.length; t++) {
        var n = e[t];
        this._types ? this._parsers[t] = this._types.getTypeParser(n.dataTypeID, n.format || "text") : this._parsers[t] = Ec.getTypeParser(n.dataTypeID, n.format || "text");
      }
    }
  };
  a(Br, "Result");
  var Lr = Br;
  Ns.exports = Lr;
});
var Gs = T((md, $s) => {
  "use strict";
  h();
  var { EventEmitter: Ac } = ve(), js = Ws(), Hs = rt(), Mr = class Mr extends Ac {
    constructor(e, t, n) {
      super(), e = Hs.normalizeQueryConfig(e, t, n), this.text = e.text, this.values = e.values, this.rows = e.rows, this.types = e.types, this.name = e.name, this.binary = e.binary, this.portal = e.portal || "", this.callback = e.callback, this._rowMode = e.rowMode, y.domain && e.callback && (this.callback = y.domain.bind(e.callback)), this._result = new js(this._rowMode, this.types), this._results = this._result, this.isPreparedStatement = false, this._canceledDueToError = false, this._promise = null;
    }
    requiresPreparation() {
      return this.name || this.rows ? true : !this.text || !this.values ? false : this.values.length > 0;
    }
    _checkForMultirow() {
      this._result.command && (Array.isArray(this._results) || (this._results = [this._result]), this._result = new js(this._rowMode, this.types), this._results.push(this._result));
    }
    handleRowDescription(e) {
      this._checkForMultirow(), this._result.addFields(e.fields), this._accumulateRows = this.callback || !this.listeners("row").length;
    }
    handleDataRow(e) {
      let t;
      if (!this._canceledDueToError) {
        try {
          t = this._result.parseRow(
            e.fields
          );
        } catch (n) {
          this._canceledDueToError = n;
          return;
        }
        this.emit("row", t, this._result), this._accumulateRows && this._result.addRow(t);
      }
    }
    handleCommandComplete(e, t) {
      this._checkForMultirow(), this._result.addCommandComplete(
        e
      ), this.rows && t.sync();
    }
    handleEmptyQuery(e) {
      this.rows && e.sync();
    }
    handleError(e, t) {
      if (this._canceledDueToError && (e = this._canceledDueToError, this._canceledDueToError = false), this.callback) return this.callback(e);
      this.emit("error", e);
    }
    handleReadyForQuery(e) {
      if (this._canceledDueToError) return this.handleError(
        this._canceledDueToError,
        e
      );
      if (this.callback) try {
        this.callback(null, this._results);
      } catch (t) {
        y.nextTick(() => {
          throw t;
        });
      }
      this.emit(
        "end",
        this._results
      );
    }
    submit(e) {
      if (typeof this.text != "string" && typeof this.name != "string") return new Error(
        "A query must have either text or a name. Supplying neither is unsupported."
      );
      let t = e.parsedStatements[this.name];
      return this.text && t && this.text !== t ? new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`) : this.values && !Array.isArray(this.values) ? new Error("Query values must be an array") : (this.requiresPreparation() ? this.prepare(e) : e.query(this.text), null);
    }
    hasBeenParsed(e) {
      return this.name && e.parsedStatements[this.name];
    }
    handlePortalSuspended(e) {
      this._getRows(e, this.rows);
    }
    _getRows(e, t) {
      e.execute({ portal: this.portal, rows: t }), t ? e.flush() : e.sync();
    }
    prepare(e) {
      this.isPreparedStatement = true, this.hasBeenParsed(e) || e.parse({ text: this.text, name: this.name, types: this.types });
      try {
        e.bind({ portal: this.portal, statement: this.name, values: this.values, binary: this.binary, valueMapper: Hs.prepareValue });
      } catch (t) {
        this.handleError(t, e);
        return;
      }
      e.describe({ type: "P", name: this.portal || "" }), this._getRows(e, this.rows);
    }
    handleCopyInResponse(e) {
      e.sendCopyFail("No source stream defined");
    }
    handleCopyData(e, t) {
    }
  };
  a(Mr, "Query");
  var Fr = Mr;
  $s.exports = Fr;
});
var ln = T((_) => {
  "use strict";
  h();
  Object.defineProperty(_, "__esModule", { value: true });
  _.NoticeMessage = _.DataRowMessage = _.CommandCompleteMessage = _.ReadyForQueryMessage = _.NotificationResponseMessage = _.BackendKeyDataMessage = _.AuthenticationMD5Password = _.ParameterStatusMessage = _.ParameterDescriptionMessage = _.RowDescriptionMessage = _.Field = _.CopyResponse = _.CopyDataMessage = _.DatabaseError = _.copyDone = _.emptyQuery = _.replicationStart = _.portalSuspended = _.noData = _.closeComplete = _.bindComplete = _.parseComplete = void 0;
  _.parseComplete = { name: "parseComplete", length: 5 };
  _.bindComplete = { name: "bindComplete", length: 5 };
  _.closeComplete = { name: "closeComplete", length: 5 };
  _.noData = { name: "noData", length: 5 };
  _.portalSuspended = { name: "portalSuspended", length: 5 };
  _.replicationStart = { name: "replicationStart", length: 4 };
  _.emptyQuery = { name: "emptyQuery", length: 4 };
  _.copyDone = { name: "copyDone", length: 4 };
  var Kr = class Kr extends Error {
    constructor(e, t, n) {
      super(e), this.length = t, this.name = n;
    }
  };
  a(Kr, "DatabaseError");
  var kr = Kr;
  _.DatabaseError = kr;
  var Yr = class Yr {
    constructor(e, t) {
      this.length = e, this.chunk = t, this.name = "copyData";
    }
  };
  a(Yr, "CopyDataMessage");
  var Or = Yr;
  _.CopyDataMessage = Or;
  var Zr = class Zr {
    constructor(e, t, n, i) {
      this.length = e, this.name = t, this.binary = n, this.columnTypes = new Array(i);
    }
  };
  a(Zr, "CopyResponse");
  var Ur = Zr;
  _.CopyResponse = Ur;
  var Jr = class Jr {
    constructor(e, t, n, i, s, o, u) {
      this.name = e, this.tableID = t, this.columnID = n, this.dataTypeID = i, this.dataTypeSize = s, this.dataTypeModifier = o, this.format = u;
    }
  };
  a(Jr, "Field");
  var Qr = Jr;
  _.Field = Qr;
  var Xr = class Xr {
    constructor(e, t) {
      this.length = e, this.fieldCount = t, this.name = "rowDescription", this.fields = new Array(this.fieldCount);
    }
  };
  a(Xr, "RowDescriptionMessage");
  var Dr = Xr;
  _.RowDescriptionMessage = Dr;
  var en = class en {
    constructor(e, t) {
      this.length = e, this.parameterCount = t, this.name = "parameterDescription", this.dataTypeIDs = new Array(this.parameterCount);
    }
  };
  a(en, "ParameterDescriptionMessage");
  var qr = en;
  _.ParameterDescriptionMessage = qr;
  var tn = class tn {
    constructor(e, t, n) {
      this.length = e, this.parameterName = t, this.parameterValue = n, this.name = "parameterStatus";
    }
  };
  a(tn, "ParameterStatusMessage");
  var Nr = tn;
  _.ParameterStatusMessage = Nr;
  var rn = class rn {
    constructor(e, t) {
      this.length = e, this.salt = t, this.name = "authenticationMD5Password";
    }
  };
  a(rn, "AuthenticationMD5Password");
  var Wr = rn;
  _.AuthenticationMD5Password = Wr;
  var nn = class nn {
    constructor(e, t, n) {
      this.length = e, this.processID = t, this.secretKey = n, this.name = "backendKeyData";
    }
  };
  a(nn, "BackendKeyDataMessage");
  var jr = nn;
  _.BackendKeyDataMessage = jr;
  var sn = class sn {
    constructor(e, t, n, i) {
      this.length = e, this.processId = t, this.channel = n, this.payload = i, this.name = "notification";
    }
  };
  a(sn, "NotificationResponseMessage");
  var Hr = sn;
  _.NotificationResponseMessage = Hr;
  var on = class on {
    constructor(e, t) {
      this.length = e, this.status = t, this.name = "readyForQuery";
    }
  };
  a(on, "ReadyForQueryMessage");
  var $r = on;
  _.ReadyForQueryMessage = $r;
  var an = class an {
    constructor(e, t) {
      this.length = e, this.text = t, this.name = "commandComplete";
    }
  };
  a(an, "CommandCompleteMessage");
  var Gr = an;
  _.CommandCompleteMessage = Gr;
  var un = class un {
    constructor(e, t) {
      this.length = e, this.fields = t, this.name = "dataRow", this.fieldCount = t.length;
    }
  };
  a(un, "DataRowMessage");
  var Vr = un;
  _.DataRowMessage = Vr;
  var cn = class cn {
    constructor(e, t) {
      this.length = e, this.message = t, this.name = "notice";
    }
  };
  a(cn, "NoticeMessage");
  var zr = cn;
  _.NoticeMessage = zr;
});
var Vs = T((Bt) => {
  "use strict";
  h();
  Object.defineProperty(Bt, "__esModule", { value: true });
  Bt.Writer = void 0;
  var hn = class hn {
    constructor(e = 256) {
      this.size = e, this.offset = 5, this.headerPosition = 0, this.buffer = p.allocUnsafe(e);
    }
    ensure(e) {
      if (this.buffer.length - this.offset < e) {
        let n = this.buffer, i = n.length + (n.length >> 1) + e;
        this.buffer = p.allocUnsafe(i), n.copy(
          this.buffer
        );
      }
    }
    addInt32(e) {
      return this.ensure(4), this.buffer[this.offset++] = e >>> 24 & 255, this.buffer[this.offset++] = e >>> 16 & 255, this.buffer[this.offset++] = e >>> 8 & 255, this.buffer[this.offset++] = e >>> 0 & 255, this;
    }
    addInt16(e) {
      return this.ensure(2), this.buffer[this.offset++] = e >>> 8 & 255, this.buffer[this.offset++] = e >>> 0 & 255, this;
    }
    addCString(e) {
      if (!e) this.ensure(1);
      else {
        let t = p.byteLength(e);
        this.ensure(t + 1), this.buffer.write(e, this.offset, "utf-8"), this.offset += t;
      }
      return this.buffer[this.offset++] = 0, this;
    }
    addString(e = "") {
      let t = p.byteLength(e);
      return this.ensure(t), this.buffer.write(e, this.offset), this.offset += t, this;
    }
    addInt32PrefixedString(e) {
      let t = p.byteLength(e);
      this.ensure(4 + t);
      let n = this.buffer, i = this.offset;
      return n[i++] = t >>> 24 & 255, n[i++] = t >>> 16 & 255, n[i++] = t >>> 8 & 255, n[i++] = t >>> 0 & 255, n.write(e, i, "utf-8"), this.offset = i + t, this;
    }
    add(e) {
      return this.ensure(e.length), e.copy(this.buffer, this.offset), this.offset += e.length, this;
    }
    join(e) {
      if (e) {
        this.buffer[this.headerPosition] = e;
        let t = this.offset - (this.headerPosition + 1);
        this.buffer.writeInt32BE(t, this.headerPosition + 1);
      }
      return this.buffer.slice(e ? 0 : 5, this.offset);
    }
    flush(e) {
      let t = this.join(e);
      return this.offset = 5, this.headerPosition = 0, this.buffer = p.allocUnsafe(this.size), t;
    }
    clear() {
      this.offset = 5, this.headerPosition = 0;
    }
  };
  a(hn, "Writer");
  var fn = hn;
  Bt.Writer = fn;
});
var Ks = T((Mt) => {
  "use strict";
  h();
  Object.defineProperty(Mt, "__esModule", { value: true });
  Mt.serialize = void 0;
  var dn = Vs(), L = new dn.Writer(), Cc = a((r) => {
    L.addInt16(3).addInt16(0);
    for (let n of Object.keys(r)) L.addCString(
      n
    ).addCString(r[n]);
    L.addCString("client_encoding").addCString("UTF8");
    let e = L.addCString("").flush(), t = e.length + 4;
    return new dn.Writer().addInt32(t).add(e).flush();
  }, "startup"), _c = a(() => {
    let r = p.allocUnsafe(
      8
    );
    return r.writeInt32BE(8, 0), r.writeInt32BE(80877103, 4), r;
  }, "requestSsl"), Tc = a((r) => L.addCString(r).flush(
    112
  ), "password"), Ic = a(function(r, e) {
    return L.addCString(r).addInt32PrefixedString(e), L.flush(112);
  }, "sendSASLInitialResponseMessage"), Pc = a(function(r) {
    return L.addString(r).flush(112);
  }, "sendSCRAMClientFinalMessage"), Rc = a((r) => L.addCString(r).flush(81), "query"), zs = [], Lc = a((r) => {
    let e = r.name || "";
    e.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", e, e.length), console.error("This can cause conflicts and silent errors executing queries"));
    let t = r.types || zs, n = t.length, i = L.addCString(e).addCString(r.text).addInt16(n);
    for (let s = 0; s < n; s++) i.addInt32(t[s]);
    return L.flush(80);
  }, "parse"), De = new dn.Writer(), Bc = a(function(r, e) {
    for (let t = 0; t < r.length; t++) {
      let n = e ? e(r[t], t) : r[t];
      n == null ? (L.addInt16(0), De.addInt32(-1)) : n instanceof p ? (L.addInt16(
        1
      ), De.addInt32(n.length), De.add(n)) : (L.addInt16(0), De.addInt32PrefixedString(n));
    }
  }, "writeValues"), Fc = a(
    (r = {}) => {
      let e = r.portal || "", t = r.statement || "", n = r.binary || false, i = r.values || zs, s = i.length;
      L.addCString(
        e
      ).addCString(t), L.addInt16(s);
      try {
        Bc(i, r.valueMapper);
      } catch (o) {
        throw L.clear(), De.clear(), o;
      }
      return L.addInt16(s), L.add(De.flush()), L.addInt16(1), L.addInt16(n ? 1 : 0), L.flush(66);
    },
    "bind"
  ), Mc = p.from([
    69,
    0,
    0,
    0,
    9,
    0,
    0,
    0,
    0,
    0
  ]), kc = a((r) => {
    if (!r || !r.portal && !r.rows) return Mc;
    let e = r.portal || "", t = r.rows || 0, n = p.byteLength(
      e
    ), i = 4 + n + 1 + 4, s = p.allocUnsafe(1 + i);
    return s[0] = 69, s.writeInt32BE(i, 1), s.write(e, 5, "utf-8"), s[n + 5] = 0, s.writeUInt32BE(t, s.length - 4), s;
  }, "execute"), Oc = a((r, e) => {
    let t = p.allocUnsafe(16);
    return t.writeInt32BE(
      16,
      0
    ), t.writeInt16BE(1234, 4), t.writeInt16BE(5678, 6), t.writeInt32BE(r, 8), t.writeInt32BE(e, 12), t;
  }, "cancel"), pn = a((r, e) => {
    let n = 4 + p.byteLength(e) + 1, i = p.allocUnsafe(1 + n);
    return i[0] = r, i.writeInt32BE(n, 1), i.write(e, 5, "utf-8"), i[n] = 0, i;
  }, "cstringMessage"), Uc = L.addCString("P").flush(68), Qc = L.addCString("S").flush(68), Dc = a((r) => r.name ? pn(68, `${r.type}${r.name || ""}`) : r.type === "P" ? Uc : Qc, "describe"), qc = a((r) => {
    let e = `${r.type}${r.name || ""}`;
    return pn(67, e);
  }, "close"), Nc = a((r) => L.add(r).flush(100), "copyData"), Wc = a((r) => pn(
    102,
    r
  ), "copyFail"), Ft = a((r) => p.from([r, 0, 0, 0, 4]), "codeOnlyBuffer"), jc = Ft(72), Hc = Ft(83), $c = Ft(88), Gc = Ft(99), Vc = {
    startup: Cc,
    password: Tc,
    requestSsl: _c,
    sendSASLInitialResponseMessage: Ic,
    sendSCRAMClientFinalMessage: Pc,
    query: Rc,
    parse: Lc,
    bind: Fc,
    execute: kc,
    describe: Dc,
    close: qc,
    flush: a(() => jc, "flush"),
    sync: a(() => Hc, "sync"),
    end: a(() => $c, "end"),
    copyData: Nc,
    copyDone: a(() => Gc, "copyDone"),
    copyFail: Wc,
    cancel: Oc
  };
  Mt.serialize = Vc;
});
var Ys = T((kt) => {
  "use strict";
  h();
  Object.defineProperty(kt, "__esModule", { value: true });
  kt.BufferReader = void 0;
  var mn = class mn {
    constructor(e = 0) {
      this.offset = e, this.buffer = p.allocUnsafe(0), this.encoding = "utf-8";
    }
    setBuffer(e, t) {
      this.offset = e, this.buffer = t;
    }
    int16() {
      let e = this.buffer.readInt16BE(this.offset);
      return this.offset += 2, e;
    }
    byte() {
      let e = this.buffer[this.offset];
      return this.offset++, e;
    }
    int32() {
      let e = this.buffer.readInt32BE(
        this.offset
      );
      return this.offset += 4, e;
    }
    uint32() {
      let e = this.buffer.readUInt32BE(this.offset);
      return this.offset += 4, e;
    }
    string(e) {
      let t = this.buffer.toString(this.encoding, this.offset, this.offset + e);
      return this.offset += e, t;
    }
    cstring() {
      let e = this.offset, t = e;
      for (; this.buffer[t++]; ) ;
      return this.offset = t, this.buffer.toString(this.encoding, e, t - 1);
    }
    bytes(e) {
      let t = this.buffer.slice(this.offset, this.offset + e);
      return this.offset += e, t;
    }
  };
  a(mn, "BufferReader");
  var yn = mn;
  kt.BufferReader = yn;
});
var eo = T((Ot) => {
  "use strict";
  h();
  Object.defineProperty(Ot, "__esModule", { value: true });
  Ot.Parser = void 0;
  var F = ln(), zc = Ys(), wn = 1, Kc = 4, Zs = wn + Kc, Z = -1, gn = p.allocUnsafe(0), xn = class xn {
    constructor(e) {
      if (this.buffer = gn, this.bufferLength = 0, this.bufferOffset = 0, this.reader = new zc.BufferReader(), e?.mode === "binary") throw new Error(
        "Binary mode not supported yet"
      );
      this.mode = e?.mode || "text";
    }
    parse(e, t) {
      this.mergeBuffer(e);
      let n = this.bufferOffset + this.bufferLength, i = this.bufferOffset;
      for (; i + Zs <= n; ) {
        let s = this.buffer[i], o = this.buffer.readUInt32BE(i + wn), u = wn + o;
        if (u + i <= n) {
          let c = this.handlePacket(i + Zs, s, o, this.buffer);
          t(c), i += u;
        } else break;
      }
      i === n ? (this.buffer = gn, this.bufferLength = 0, this.bufferOffset = 0) : (this.bufferLength = n - i, this.bufferOffset = i);
    }
    mergeBuffer(e) {
      if (this.bufferLength > 0) {
        let t = this.bufferLength + e.byteLength;
        if (t + this.bufferOffset > this.buffer.byteLength) {
          let i;
          if (t <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) i = this.buffer;
          else {
            let s = this.buffer.byteLength * 2;
            for (; t >= s; ) s *= 2;
            i = p.allocUnsafe(s);
          }
          this.buffer.copy(i, 0, this.bufferOffset, this.bufferOffset + this.bufferLength), this.buffer = i, this.bufferOffset = 0;
        }
        e.copy(
          this.buffer,
          this.bufferOffset + this.bufferLength
        ), this.bufferLength = t;
      } else this.buffer = e, this.bufferOffset = 0, this.bufferLength = e.byteLength;
    }
    handlePacket(e, t, n, i) {
      let { reader: s } = this;
      s.setBuffer(e, i);
      let o;
      switch (t) {
        case 50:
          o = F.bindComplete;
          break;
        case 49:
          o = F.parseComplete;
          break;
        case 51:
          o = F.closeComplete;
          break;
        case 110:
          o = F.noData;
          break;
        case 115:
          o = F.portalSuspended;
          break;
        case 99:
          o = F.copyDone;
          break;
        case 87:
          o = F.replicationStart;
          break;
        case 73:
          o = F.emptyQuery;
          break;
        case 68:
          o = sl(s);
          break;
        case 67:
          o = Zc(s);
          break;
        case 90:
          o = Yc(s);
          break;
        case 65:
          o = tl(s);
          break;
        case 82:
          o = ul(s, n);
          break;
        case 83:
          o = ol(s);
          break;
        case 75:
          o = al(s);
          break;
        case 69:
          o = Js(s, "error");
          break;
        case 78:
          o = Js(s, "notice");
          break;
        case 84:
          o = rl(s);
          break;
        case 116:
          o = il(s);
          break;
        case 71:
          o = Xc(
            s
          );
          break;
        case 72:
          o = el(s);
          break;
        case 100:
          o = Jc(s, n);
          break;
        default:
          return new F.DatabaseError("received invalid response: " + t.toString(16), n, "error");
      }
      return s.setBuffer(0, gn), o.length = n, o;
    }
  };
  a(xn, "Parser");
  var bn = xn;
  Ot.Parser = bn;
  var Yc = a((r) => {
    let e = r.string(1);
    return new F.ReadyForQueryMessage(Z, e);
  }, "parseReadyForQueryMessage"), Zc = a((r) => {
    let e = r.cstring();
    return new F.CommandCompleteMessage(Z, e);
  }, "parseCommandCompleteMessage"), Jc = a((r, e) => {
    let t = r.bytes(e - 4);
    return new F.CopyDataMessage(Z, t);
  }, "parseCopyData"), Xc = a((r) => Xs(r, "copyInResponse"), "parseCopyInMessage"), el = a((r) => Xs(r, "copyOutResponse"), "parseCopyOutMessage"), Xs = a((r, e) => {
    let t = r.byte() !== 0, n = r.int16(), i = new F.CopyResponse(Z, e, t, n);
    for (let s = 0; s < n; s++) i.columnTypes[s] = r.int16();
    return i;
  }, "parseCopyMessage"), tl = a((r) => {
    let e = r.int32(), t = r.cstring(), n = r.cstring();
    return new F.NotificationResponseMessage(Z, e, t, n);
  }, "parseNotificationMessage"), rl = a((r) => {
    let e = r.int16(), t = new F.RowDescriptionMessage(Z, e);
    for (let n = 0; n < e; n++) t.fields[n] = nl(r);
    return t;
  }, "parseRowDescriptionMessage"), nl = a((r) => {
    let e = r.cstring(), t = r.uint32(), n = r.int16(), i = r.uint32(), s = r.int16(), o = r.int32(), u = r.int16() === 0 ? "text" : "binary";
    return new F.Field(e, t, n, i, s, o, u);
  }, "parseField"), il = a((r) => {
    let e = r.int16(), t = new F.ParameterDescriptionMessage(Z, e);
    for (let n = 0; n < e; n++) t.dataTypeIDs[n] = r.uint32();
    return t;
  }, "parseParameterDescriptionMessage"), sl = a((r) => {
    let e = r.int16(), t = new Array(e);
    for (let n = 0; n < e; n++) {
      let i = r.int32();
      t[n] = i === -1 ? null : r.string(i);
    }
    return new F.DataRowMessage(Z, t);
  }, "parseDataRowMessage"), ol = a((r) => {
    let e = r.cstring(), t = r.cstring();
    return new F.ParameterStatusMessage(Z, e, t);
  }, "parseParameterStatusMessage"), al = a((r) => {
    let e = r.int32(), t = r.int32();
    return new F.BackendKeyDataMessage(
      Z,
      e,
      t
    );
  }, "parseBackendKeyData"), ul = a((r, e) => {
    let t = r.int32(), n = { name: "authenticationOk", length: e };
    switch (t) {
      case 0:
        break;
      case 3:
        n.length === 8 && (n.name = "authenticationCleartextPassword");
        break;
      case 5:
        if (n.length === 12) {
          n.name = "authenticationMD5Password";
          let i = r.bytes(4);
          return new F.AuthenticationMD5Password(Z, i);
        }
        break;
      case 10:
        {
          n.name = "authenticationSASL", n.mechanisms = [];
          let i;
          do
            i = r.cstring(), i && n.mechanisms.push(i);
          while (i);
        }
        break;
      case 11:
        n.name = "authenticationSASLContinue", n.data = r.string(e - 8);
        break;
      case 12:
        n.name = "authenticationSASLFinal", n.data = r.string(e - 8);
        break;
      default:
        throw new Error("Unknown authenticationOk message type " + t);
    }
    return n;
  }, "parseAuthenticationResponse"), Js = a((r, e) => {
    let t = {}, n = r.string(1);
    for (; n !== "\0"; ) t[n] = r.cstring(), n = r.string(1);
    let i = t.M, s = e === "notice" ? new F.NoticeMessage(Z, i) : new F.DatabaseError(
      i,
      Z,
      e
    );
    return s.severity = t.S, s.code = t.C, s.detail = t.D, s.hint = t.H, s.position = t.P, s.internalPosition = t.p, s.internalQuery = t.q, s.where = t.W, s.schema = t.s, s.table = t.t, s.column = t.c, s.dataType = t.d, s.constraint = t.n, s.file = t.F, s.line = t.L, s.routine = t.R, s;
  }, "parseErrorMessage");
});
var vn = T((_e) => {
  "use strict";
  h();
  Object.defineProperty(_e, "__esModule", { value: true });
  _e.DatabaseError = _e.serialize = void 0;
  _e.parse = hl;
  var cl = ln();
  Object.defineProperty(_e, "DatabaseError", { enumerable: true, get: a(
    function() {
      return cl.DatabaseError;
    },
    "get"
  ) });
  var ll = Ks();
  Object.defineProperty(_e, "serialize", {
    enumerable: true,
    get: a(function() {
      return ll.serialize;
    }, "get")
  });
  var fl = eo();
  function hl(r, e) {
    let t = new fl.Parser();
    return r.on("data", (n) => t.parse(n, e)), new Promise((n) => r.on("end", () => n()));
  }
  a(hl, "parse");
});
var to = {};
se(to, { connect: () => dl });
function dl({ socket: r, servername: e }) {
  return r.startTls(e), r;
}
var ro = V(
  () => {
    "use strict";
    h();
    a(dl, "connect");
  }
);
var An = T((Dd, so) => {
  "use strict";
  h();
  var no = (Ge(), O(Ii)), pl = ve().EventEmitter, { parse: yl, serialize: Q } = vn(), io = Q.flush(), ml = Q.sync(), gl = Q.end(), En = class En extends pl {
    constructor(e) {
      super(), e = e || {}, this.stream = e.stream || new no.Socket(), this._keepAlive = e.keepAlive, this._keepAliveInitialDelayMillis = e.keepAliveInitialDelayMillis, this.lastBuffer = false, this.parsedStatements = {}, this.ssl = e.ssl || false, this._ending = false, this._emitMessage = false;
      var t = this;
      this.on("newListener", function(n) {
        n === "message" && (t._emitMessage = true);
      });
    }
    connect(e, t) {
      var n = this;
      this._connecting = true, this.stream.setNoDelay(true), this.stream.connect(e, t), this.stream.once("connect", function() {
        n._keepAlive && n.stream.setKeepAlive(true, n._keepAliveInitialDelayMillis), n.emit("connect");
      });
      let i = a(function(s) {
        n._ending && (s.code === "ECONNRESET" || s.code === "EPIPE") || n.emit("error", s);
      }, "reportStreamError");
      if (this.stream.on("error", i), this.stream.on("close", function() {
        n.emit("end");
      }), !this.ssl) return this.attachListeners(
        this.stream
      );
      this.stream.once("data", function(s) {
        var o = s.toString("utf8");
        switch (o) {
          case "S":
            break;
          case "N":
            return n.stream.end(), n.emit("error", new Error("The server does not support SSL connections"));
          default:
            return n.stream.end(), n.emit("error", new Error("There was an error establishing an SSL connection"));
        }
        var u = (ro(), O(to));
        let c = { socket: n.stream };
        n.ssl !== true && (Object.assign(c, n.ssl), "key" in n.ssl && (c.key = n.ssl.key)), no.isIP(t) === 0 && (c.servername = t);
        try {
          n.stream = u.connect(c);
        } catch (l) {
          return n.emit(
            "error",
            l
          );
        }
        n.attachListeners(n.stream), n.stream.on("error", i), n.emit("sslconnect");
      });
    }
    attachListeners(e) {
      e.on(
        "end",
        () => {
          this.emit("end");
        }
      ), yl(e, (t) => {
        var n = t.name === "error" ? "errorMessage" : t.name;
        this._emitMessage && this.emit("message", t), this.emit(n, t);
      });
    }
    requestSsl() {
      this.stream.write(Q.requestSsl());
    }
    startup(e) {
      this.stream.write(Q.startup(e));
    }
    cancel(e, t) {
      this._send(Q.cancel(e, t));
    }
    password(e) {
      this._send(Q.password(e));
    }
    sendSASLInitialResponseMessage(e, t) {
      this._send(Q.sendSASLInitialResponseMessage(e, t));
    }
    sendSCRAMClientFinalMessage(e) {
      this._send(Q.sendSCRAMClientFinalMessage(
        e
      ));
    }
    _send(e) {
      return this.stream.writable ? this.stream.write(e) : false;
    }
    query(e) {
      this._send(Q.query(e));
    }
    parse(e) {
      this._send(Q.parse(e));
    }
    bind(e) {
      this._send(Q.bind(e));
    }
    execute(e) {
      this._send(Q.execute(e));
    }
    flush() {
      this.stream.writable && this.stream.write(io);
    }
    sync() {
      this._ending = true, this._send(io), this._send(ml);
    }
    ref() {
      this.stream.ref();
    }
    unref() {
      this.stream.unref();
    }
    end() {
      if (this._ending = true, !this._connecting || !this.stream.writable) {
        this.stream.end();
        return;
      }
      return this.stream.write(gl, () => {
        this.stream.end();
      });
    }
    close(e) {
      this._send(Q.close(e));
    }
    describe(e) {
      this._send(Q.describe(e));
    }
    sendCopyFromChunk(e) {
      this._send(Q.copyData(e));
    }
    endCopyFrom() {
      this._send(Q.copyDone());
    }
    sendCopyFail(e) {
      this._send(Q.copyFail(e));
    }
  };
  a(En, "Connection");
  var Sn = En;
  so.exports = Sn;
});
var uo = T((jd, ao) => {
  "use strict";
  h();
  var wl = ve().EventEmitter, Wd = (it(), O(nt)), bl = rt(), Cn = xs(), xl = Ls(), vl = _t(), Sl = Lt(), oo = Gs(), El = tt(), Al = An(), _n = class _n extends wl {
    constructor(e) {
      super(), this.connectionParameters = new Sl(e), this.user = this.connectionParameters.user, this.database = this.connectionParameters.database, this.port = this.connectionParameters.port, this.host = this.connectionParameters.host, Object.defineProperty(
        this,
        "password",
        { configurable: true, enumerable: false, writable: true, value: this.connectionParameters.password }
      ), this.replication = this.connectionParameters.replication;
      var t = e || {};
      this._Promise = t.Promise || b.Promise, this._types = new vl(t.types), this._ending = false, this._connecting = false, this._connected = false, this._connectionError = false, this._queryable = true, this.connection = t.connection || new Al({ stream: t.stream, ssl: this.connectionParameters.ssl, keepAlive: t.keepAlive || false, keepAliveInitialDelayMillis: t.keepAliveInitialDelayMillis || 0, encoding: this.connectionParameters.client_encoding || "utf8" }), this.queryQueue = [], this.binary = t.binary || El.binary, this.processID = null, this.secretKey = null, this.ssl = this.connectionParameters.ssl || false, this.ssl && this.ssl.key && Object.defineProperty(this.ssl, "key", { enumerable: false }), this._connectionTimeoutMillis = t.connectionTimeoutMillis || 0;
    }
    _errorAllQueries(e) {
      let t = a((n) => {
        y.nextTick(() => {
          n.handleError(e, this.connection);
        });
      }, "enqueueError");
      this.activeQuery && (t(this.activeQuery), this.activeQuery = null), this.queryQueue.forEach(t), this.queryQueue.length = 0;
    }
    _connect(e) {
      var t = this, n = this.connection;
      if (this._connectionCallback = e, this._connecting || this._connected) {
        let i = new Error("Client has already been connected. You cannot reuse a client.");
        y.nextTick(
          () => {
            e(i);
          }
        );
        return;
      }
      this._connecting = true, this.connectionTimeoutHandle, this._connectionTimeoutMillis > 0 && (this.connectionTimeoutHandle = setTimeout(() => {
        n._ending = true, n.stream.destroy(new Error("timeout expired"));
      }, this._connectionTimeoutMillis)), this.host && this.host.indexOf("/") === 0 ? n.connect(this.host + "/.s.PGSQL." + this.port) : n.connect(this.port, this.host), n.on("connect", function() {
        t.ssl ? n.requestSsl() : n.startup(t.getStartupConf());
      }), n.on("sslconnect", function() {
        n.startup(t.getStartupConf());
      }), this._attachListeners(
        n
      ), n.once("end", () => {
        let i = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
        clearTimeout(this.connectionTimeoutHandle), this._errorAllQueries(i), this._ending || (this._connecting && !this._connectionError ? this._connectionCallback ? this._connectionCallback(i) : this._handleErrorEvent(i) : this._connectionError || this._handleErrorEvent(i)), y.nextTick(() => {
          this.emit("end");
        });
      });
    }
    connect(e) {
      if (e) {
        this._connect(e);
        return;
      }
      return new this._Promise((t, n) => {
        this._connect((i) => {
          i ? n(i) : t();
        });
      });
    }
    _attachListeners(e) {
      e.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this)), e.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this)), e.on("authenticationSASL", this._handleAuthSASL.bind(this)), e.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this)), e.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this)), e.on("backendKeyData", this._handleBackendKeyData.bind(this)), e.on("error", this._handleErrorEvent.bind(this)), e.on("errorMessage", this._handleErrorMessage.bind(this)), e.on("readyForQuery", this._handleReadyForQuery.bind(this)), e.on("notice", this._handleNotice.bind(this)), e.on("rowDescription", this._handleRowDescription.bind(this)), e.on("dataRow", this._handleDataRow.bind(this)), e.on("portalSuspended", this._handlePortalSuspended.bind(
        this
      )), e.on("emptyQuery", this._handleEmptyQuery.bind(this)), e.on("commandComplete", this._handleCommandComplete.bind(this)), e.on("parseComplete", this._handleParseComplete.bind(this)), e.on("copyInResponse", this._handleCopyInResponse.bind(this)), e.on("copyData", this._handleCopyData.bind(this)), e.on("notification", this._handleNotification.bind(this));
    }
    _checkPgPass(e) {
      let t = this.connection;
      typeof this.password == "function" ? this._Promise.resolve().then(() => this.password()).then((n) => {
        if (n !== void 0) {
          if (typeof n != "string") {
            t.emit("error", new TypeError(
              "Password must be a string"
            ));
            return;
          }
          this.connectionParameters.password = this.password = n;
        } else this.connectionParameters.password = this.password = null;
        e();
      }).catch((n) => {
        t.emit("error", n);
      }) : this.password !== null ? e() : xl(
        this.connectionParameters,
        (n) => {
          n !== void 0 && (this.connectionParameters.password = this.password = n), e();
        }
      );
    }
    _handleAuthCleartextPassword(e) {
      this._checkPgPass(() => {
        this.connection.password(this.password);
      });
    }
    _handleAuthMD5Password(e) {
      this._checkPgPass(
        () => {
          let t = bl.postgresMd5PasswordHash(this.user, this.password, e.salt);
          this.connection.password(t);
        }
      );
    }
    _handleAuthSASL(e) {
      this._checkPgPass(() => {
        this.saslSession = Cn.startSession(e.mechanisms), this.connection.sendSASLInitialResponseMessage(
          this.saslSession.mechanism,
          this.saslSession.response
        );
      });
    }
    _handleAuthSASLContinue(e) {
      Cn.continueSession(
        this.saslSession,
        this.password,
        e.data
      ), this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
    }
    _handleAuthSASLFinal(e) {
      Cn.finalizeSession(this.saslSession, e.data), this.saslSession = null;
    }
    _handleBackendKeyData(e) {
      this.processID = e.processID, this.secretKey = e.secretKey;
    }
    _handleReadyForQuery(e) {
      this._connecting && (this._connecting = false, this._connected = true, clearTimeout(this.connectionTimeoutHandle), this._connectionCallback && (this._connectionCallback(null, this), this._connectionCallback = null), this.emit("connect"));
      let { activeQuery: t } = this;
      this.activeQuery = null, this.readyForQuery = true, t && t.handleReadyForQuery(this.connection), this._pulseQueryQueue();
    }
    _handleErrorWhileConnecting(e) {
      if (!this._connectionError) {
        if (this._connectionError = true, clearTimeout(this.connectionTimeoutHandle), this._connectionCallback) return this._connectionCallback(e);
        this.emit("error", e);
      }
    }
    _handleErrorEvent(e) {
      if (this._connecting) return this._handleErrorWhileConnecting(e);
      this._queryable = false, this._errorAllQueries(e), this.emit("error", e);
    }
    _handleErrorMessage(e) {
      if (this._connecting) return this._handleErrorWhileConnecting(e);
      let t = this.activeQuery;
      if (!t) {
        this._handleErrorEvent(e);
        return;
      }
      this.activeQuery = null, t.handleError(
        e,
        this.connection
      );
    }
    _handleRowDescription(e) {
      this.activeQuery.handleRowDescription(e);
    }
    _handleDataRow(e) {
      this.activeQuery.handleDataRow(e);
    }
    _handlePortalSuspended(e) {
      this.activeQuery.handlePortalSuspended(this.connection);
    }
    _handleEmptyQuery(e) {
      this.activeQuery.handleEmptyQuery(this.connection);
    }
    _handleCommandComplete(e) {
      this.activeQuery.handleCommandComplete(e, this.connection);
    }
    _handleParseComplete(e) {
      this.activeQuery.name && (this.connection.parsedStatements[this.activeQuery.name] = this.activeQuery.text);
    }
    _handleCopyInResponse(e) {
      this.activeQuery.handleCopyInResponse(this.connection);
    }
    _handleCopyData(e) {
      this.activeQuery.handleCopyData(
        e,
        this.connection
      );
    }
    _handleNotification(e) {
      this.emit("notification", e);
    }
    _handleNotice(e) {
      this.emit("notice", e);
    }
    getStartupConf() {
      var e = this.connectionParameters, t = { user: e.user, database: e.database }, n = e.application_name || e.fallback_application_name;
      return n && (t.application_name = n), e.replication && (t.replication = "" + e.replication), e.statement_timeout && (t.statement_timeout = String(parseInt(e.statement_timeout, 10))), e.lock_timeout && (t.lock_timeout = String(parseInt(e.lock_timeout, 10))), e.idle_in_transaction_session_timeout && (t.idle_in_transaction_session_timeout = String(parseInt(e.idle_in_transaction_session_timeout, 10))), e.options && (t.options = e.options), t;
    }
    cancel(e, t) {
      if (e.activeQuery === t) {
        var n = this.connection;
        this.host && this.host.indexOf("/") === 0 ? n.connect(this.host + "/.s.PGSQL." + this.port) : n.connect(this.port, this.host), n.on("connect", function() {
          n.cancel(
            e.processID,
            e.secretKey
          );
        });
      } else e.queryQueue.indexOf(t) !== -1 && e.queryQueue.splice(e.queryQueue.indexOf(t), 1);
    }
    setTypeParser(e, t, n) {
      return this._types.setTypeParser(e, t, n);
    }
    getTypeParser(e, t) {
      return this._types.getTypeParser(e, t);
    }
    escapeIdentifier(e) {
      return '"' + e.replace(/"/g, '""') + '"';
    }
    escapeLiteral(e) {
      for (var t = false, n = "'", i = 0; i < e.length; i++) {
        var s = e[i];
        s === "'" ? n += s + s : s === "\\" ? (n += s + s, t = true) : n += s;
      }
      return n += "'", t === true && (n = " E" + n), n;
    }
    _pulseQueryQueue() {
      if (this.readyForQuery === true) if (this.activeQuery = this.queryQueue.shift(), this.activeQuery) {
        this.readyForQuery = false, this.hasExecuted = true;
        let e = this.activeQuery.submit(this.connection);
        e && y.nextTick(() => {
          this.activeQuery.handleError(e, this.connection), this.readyForQuery = true, this._pulseQueryQueue();
        });
      } else this.hasExecuted && (this.activeQuery = null, this.emit("drain"));
    }
    query(e, t, n) {
      var i, s, o, u, c;
      if (e == null) throw new TypeError(
        "Client was passed a null or undefined query"
      );
      return typeof e.submit == "function" ? (o = e.query_timeout || this.connectionParameters.query_timeout, s = i = e, typeof t == "function" && (i.callback = i.callback || t)) : (o = this.connectionParameters.query_timeout, i = new oo(e, t, n), i.callback || (s = new this._Promise((l, f) => {
        i.callback = (m, g) => m ? f(m) : l(g);
      }))), o && (c = i.callback, u = setTimeout(() => {
        var l = new Error("Query read timeout");
        y.nextTick(
          () => {
            i.handleError(l, this.connection);
          }
        ), c(l), i.callback = () => {
        };
        var f = this.queryQueue.indexOf(i);
        f > -1 && this.queryQueue.splice(f, 1), this._pulseQueryQueue();
      }, o), i.callback = (l, f) => {
        clearTimeout(u), c(l, f);
      }), this.binary && !i.binary && (i.binary = true), i._result && !i._result._types && (i._result._types = this._types), this._queryable ? this._ending ? (y.nextTick(() => {
        i.handleError(new Error("Client was closed and is not queryable"), this.connection);
      }), s) : (this.queryQueue.push(i), this._pulseQueryQueue(), s) : (y.nextTick(() => {
        i.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
      }), s);
    }
    ref() {
      this.connection.ref();
    }
    unref() {
      this.connection.unref();
    }
    end(e) {
      if (this._ending = true, !this.connection._connecting) if (e) e();
      else return this._Promise.resolve();
      if (this.activeQuery || !this._queryable ? this.connection.stream.destroy() : this.connection.end(), e) this.connection.once("end", e);
      else return new this._Promise((t) => {
        this.connection.once("end", t);
      });
    }
  };
  a(_n, "Client");
  var Ut = _n;
  Ut.Query = oo;
  ao.exports = Ut;
});
var fo = T((Gd, lo) => {
  "use strict";
  h();
  var Cl = ve().EventEmitter, Tn = a(function() {
  }, "NOOP"), co = a((r, e) => {
    let t = r.findIndex(e);
    return t === -1 ? void 0 : r.splice(t, 1)[0];
  }, "removeWhere"), Rn = class Rn {
    constructor(e, t, n) {
      this.client = e, this.idleListener = t, this.timeoutId = n;
    }
  };
  a(Rn, "IdleItem");
  var In = Rn, Ln = class Ln {
    constructor(e) {
      this.callback = e;
    }
  };
  a(Ln, "PendingItem");
  var qe = Ln;
  function _l() {
    throw new Error("Release called on client which has already been released to the pool.");
  }
  a(_l, "throwOnDoubleRelease");
  function Qt(r, e) {
    if (e)
      return { callback: e, result: void 0 };
    let t, n, i = a(function(o, u) {
      o ? t(o) : n(u);
    }, "cb"), s = new r(function(o, u) {
      n = o, t = u;
    }).catch((o) => {
      throw Error.captureStackTrace(o), o;
    });
    return { callback: i, result: s };
  }
  a(Qt, "promisify");
  function Tl(r, e) {
    return a(function t(n) {
      n.client = e, e.removeListener("error", t), e.on("error", () => {
        r.log(
          "additional client error after disconnection due to error",
          n
        );
      }), r._remove(e), r.emit("error", n, e);
    }, "idleListener");
  }
  a(Tl, "makeIdleListener");
  var Bn = class Bn extends Cl {
    constructor(e, t) {
      super(), this.options = Object.assign({}, e), e != null && "password" in e && Object.defineProperty(this.options, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: e.password
      }), e != null && e.ssl && e.ssl.key && Object.defineProperty(this.options.ssl, "key", { enumerable: false }), this.options.max = this.options.max || this.options.poolSize || 10, this.options.min = this.options.min || 0, this.options.maxUses = this.options.maxUses || 1 / 0, this.options.allowExitOnIdle = this.options.allowExitOnIdle || false, this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0, this.log = this.options.log || function() {
      }, this.Client = this.options.Client || t || ot().Client, this.Promise = this.options.Promise || b.Promise, typeof this.options.idleTimeoutMillis > "u" && (this.options.idleTimeoutMillis = 1e4), this._clients = [], this._idle = [], this._expired = /* @__PURE__ */ new WeakSet(), this._pendingQueue = [], this._endCallback = void 0, this.ending = false, this.ended = false;
    }
    _promiseTry(e) {
      let t = this.Promise;
      return typeof t.try == "function" ? t.try(e) : new t((n) => n(e()));
    }
    _isFull() {
      return this._clients.length >= this.options.max;
    }
    _isAboveMin() {
      return this._clients.length > this.options.min;
    }
    _pulseQueue() {
      if (this.log("pulse queue"), this.ended) {
        this.log("pulse queue ended");
        return;
      }
      if (this.ending) {
        this.log("pulse queue on ending"), this._idle.length && this._idle.slice().map((t) => {
          this._remove(t.client);
        }), this._clients.length || (this.ended = true, this._endCallback());
        return;
      }
      if (!this._pendingQueue.length) {
        this.log("no queued requests");
        return;
      }
      if (!this._idle.length && this._isFull())
        return;
      let e = this._pendingQueue.shift();
      if (this._idle.length) {
        let t = this._idle.pop();
        clearTimeout(t.timeoutId);
        let n = t.client;
        n.ref && n.ref();
        let i = t.idleListener;
        return this._acquireClient(n, e, i, false);
      }
      if (!this._isFull()) return this.newClient(e);
      throw new Error("unexpected condition");
    }
    _remove(e, t) {
      let n = co(this._idle, (s) => s.client === e);
      n !== void 0 && clearTimeout(n.timeoutId), this._clients = this._clients.filter((s) => s !== e);
      let i = this;
      e.end(() => {
        i.emit("remove", e), typeof t == "function" && t();
      });
    }
    connect(e) {
      if (this.ending) {
        let i = new Error(
          "Cannot use a pool after calling end on the pool"
        );
        return e ? e(i) : this.Promise.reject(i);
      }
      let t = Qt(this.Promise, e), n = t.result;
      if (this._isFull() || this._idle.length) {
        if (this._idle.length && y.nextTick(() => this._pulseQueue()), !this.options.connectionTimeoutMillis) return this._pendingQueue.push(new qe(t.callback)), n;
        let i = a((u, c, l) => {
          clearTimeout(o), t.callback(u, c, l);
        }, "queueCallback"), s = new qe(i), o = setTimeout(() => {
          co(this._pendingQueue, (u) => u.callback === i), s.timedOut = true, t.callback(new Error("timeout exceeded when trying to connect"));
        }, this.options.connectionTimeoutMillis);
        return o.unref && o.unref(), this._pendingQueue.push(s), n;
      }
      return this.newClient(new qe(t.callback)), n;
    }
    newClient(e) {
      let t = new this.Client(this.options);
      this._clients.push(t);
      let n = Tl(this, t);
      this.log("checking client timeout");
      let i, s = false;
      this.options.connectionTimeoutMillis && (i = setTimeout(() => {
        t.connection ? (this.log("ending client due to timeout"), s = true, t.connection.stream.destroy()) : t.isConnected() || (this.log("ending client due to timeout"), s = true, t.end());
      }, this.options.connectionTimeoutMillis)), this.log("connecting new client"), t.connect((o) => {
        if (i && clearTimeout(i), t.on("error", n), o) this.log("client failed to connect", o), this._clients = this._clients.filter((u) => u !== t), s && (o = new Error("Connection terminated due to connection timeout", { cause: o })), this._pulseQueue(), e.timedOut || e.callback(
          o,
          void 0,
          Tn
        );
        else {
          if (this.log("new client connected"), this.options.onConnect) {
            this._promiseTry(() => this.options.onConnect(t)).then(() => {
              this._afterConnect(t, e, n);
            }, (u) => {
              this._clients = this._clients.filter((c) => c !== t), t.end(() => {
                this._pulseQueue(), e.timedOut || e.callback(u, void 0, Tn);
              });
            });
            return;
          }
          return this._afterConnect(
            t,
            e,
            n
          );
        }
      });
    }
    _afterConnect(e, t, n) {
      if (this.options.maxLifetimeSeconds !== 0) {
        let i = setTimeout(() => {
          this.log(
            "ending client due to expired lifetime"
          ), this._expired.add(e), this._idle.findIndex((o) => o.client === e) !== -1 && this._acquireClient(e, new qe((o, u, c) => c()), n, false);
        }, this.options.maxLifetimeSeconds * 1e3);
        i.unref(), e.once("end", () => clearTimeout(i));
      }
      return this._acquireClient(e, t, n, true);
    }
    _acquireClient(e, t, n, i) {
      i && this.emit("connect", e), this.emit("acquire", e), e.release = this._releaseOnce(e, n), e.removeListener("error", n), t.timedOut ? i && this.options.verify ? this.options.verify(e, e.release) : e.release() : i && this.options.verify ? this.options.verify(e, (s) => {
        if (s) return e.release(s), t.callback(s, void 0, Tn);
        t.callback(void 0, e, e.release);
      }) : t.callback(void 0, e, e.release);
    }
    _releaseOnce(e, t) {
      let n = false;
      return (i) => {
        n && _l(), n = true, this._release(
          e,
          t,
          i
        );
      };
    }
    _release(e, t, n) {
      if (e.on("error", t), e._poolUseCount = (e._poolUseCount || 0) + 1, this.emit(
        "release",
        n,
        e
      ), n || this.ending || !e._queryable || e._ending || e._poolUseCount >= this.options.maxUses) return e._poolUseCount >= this.options.maxUses && this.log("remove expended client"), this._remove(e, this._pulseQueue.bind(this));
      if (this._expired.has(e)) return this.log("remove expired client"), this._expired.delete(e), this._remove(
        e,
        this._pulseQueue.bind(this)
      );
      let s;
      this.options.idleTimeoutMillis && this._isAboveMin() && (s = setTimeout(
        () => {
          this._isAboveMin() && (this.log("remove idle client"), this._remove(e, this._pulseQueue.bind(this)));
        },
        this.options.idleTimeoutMillis
      ), this.options.allowExitOnIdle && s.unref()), this.options.allowExitOnIdle && e.unref(), this._idle.push(new In(e, t, s)), this._pulseQueue();
    }
    query(e, t, n) {
      if (typeof e == "function") {
        let s = Qt(
          this.Promise,
          e
        );
        return x(function() {
          return s.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
        }), s.result;
      }
      typeof t == "function" && (n = t, t = void 0);
      let i = Qt(this.Promise, n);
      return n = i.callback, this.connect((s, o) => {
        if (s) return n(s);
        let u = false, c = a((l) => {
          u || (u = true, o.release(
            l
          ), n(l));
        }, "onError");
        o.once("error", c), this.log("dispatching query");
        try {
          o.query(e, t, (l, f) => {
            if (this.log("query dispatched"), o.removeListener("error", c), !u) return u = true, o.release(l), l ? n(l) : n(void 0, f);
          });
        } catch (l) {
          return o.release(l), n(l);
        }
      }), i.result;
    }
    end(e) {
      if (this.log("ending"), this.ending) {
        let n = new Error("Called end on pool more than once");
        return e ? e(n) : this.Promise.reject(n);
      }
      this.ending = true;
      let t = Qt(
        this.Promise,
        e
      );
      return this._endCallback = t.callback, this._pulseQueue(), t.result;
    }
    get waitingCount() {
      return this._pendingQueue.length;
    }
    get idleCount() {
      return this._idle.length;
    }
    get expiredCount() {
      return this._clients.reduce((e, t) => e + (this._expired.has(t) ? 1 : 0), 0);
    }
    get totalCount() {
      return this._clients.length;
    }
  };
  a(Bn, "Pool");
  var Pn = Bn;
  lo.exports = Pn;
});
var ho = {};
se(ho, { default: () => Il });
var Il;
var po = V(() => {
  "use strict";
  h();
  Il = {};
});
var yo = T((Yd, Pl) => {
  Pl.exports = { name: "pg", version: "8.8.0", description: "PostgreSQL client - pure javascript & libpq with the same API", keywords: [
    "database",
    "libpq",
    "pg",
    "postgre",
    "postgres",
    "postgresql",
    "rdbms"
  ], homepage: "https://github.com/brianc/node-postgres", repository: { type: "git", url: "git://github.com/brianc/node-postgres.git", directory: "packages/pg" }, author: "Brian Carlson <brian.m.carlson@gmail.com>", main: "./lib", dependencies: { "buffer-writer": "2.0.0", "packet-reader": "1.0.0", "pg-connection-string": "^2.5.0", "pg-pool": "^3.5.2", "pg-protocol": "^1.5.0", "pg-types": "^2.1.0", pgpass: "1.x" }, devDependencies: {
    async: "2.6.4",
    bluebird: "3.5.2",
    co: "4.6.0",
    "pg-copy-streams": "0.3.0"
  }, peerDependencies: { "pg-native": ">=3.0.1" }, peerDependenciesMeta: { "pg-native": { optional: true } }, scripts: { test: "make test-all" }, files: ["lib", "SPONSORS.md"], license: "MIT", engines: { node: ">= 8.0.0" }, gitHead: "c99fb2c127ddf8d712500db2c7b9a5491a178655" };
});
var wo = T((Zd, go) => {
  "use strict";
  h();
  var mo = ve().EventEmitter, Rl = (it(), O(nt)), Fn = rt(), Ne = go.exports = function(r, e, t) {
    mo.call(this), r = Fn.normalizeQueryConfig(r, e, t), this.text = r.text, this.values = r.values, this.name = r.name, this.callback = r.callback, this.state = "new", this._arrayMode = r.rowMode === "array", this._emitRowEvents = false, this.on("newListener", function(n) {
      n === "row" && (this._emitRowEvents = true);
    }.bind(this));
  };
  Rl.inherits(Ne, mo);
  var Ll = { sqlState: "code", statementPosition: "position", messagePrimary: "message", context: "where", schemaName: "schema", tableName: "table", columnName: "column", dataTypeName: "dataType", constraintName: "constraint", sourceFile: "file", sourceLine: "line", sourceFunction: "routine" };
  Ne.prototype.handleError = function(r) {
    var e = this.native.pq.resultErrorFields();
    if (e) for (var t in e) {
      var n = Ll[t] || t;
      r[n] = e[t];
    }
    this.callback ? this.callback(r) : this.emit("error", r), this.state = "error";
  };
  Ne.prototype.then = function(r, e) {
    return this._getPromise().then(
      r,
      e
    );
  };
  Ne.prototype.catch = function(r) {
    return this._getPromise().catch(r);
  };
  Ne.prototype._getPromise = function() {
    return this._promise ? this._promise : (this._promise = new Promise(function(r, e) {
      this._once("end", r), this._once("error", e);
    }.bind(this)), this._promise);
  };
  Ne.prototype.submit = function(r) {
    this.state = "running";
    var e = this;
    this.native = r.native, r.native.arrayMode = this._arrayMode;
    var t = a(function(s, o, u) {
      if (r.native.arrayMode = false, x(function() {
        e.emit("_done");
      }), s) return e.handleError(s);
      e._emitRowEvents && (u.length > 1 ? o.forEach(
        (c, l) => {
          c.forEach((f) => {
            e.emit("row", f, u[l]);
          });
        }
      ) : o.forEach(function(c) {
        e.emit("row", c, u);
      })), e.state = "end", e.emit("end", u), e.callback && e.callback(null, u);
    }, "after");
    if (y.domain && (t = y.domain.bind(t)), this.name) {
      this.name.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", this.name, this.name.length), console.error("This can cause conflicts and silent errors executing queries"));
      var n = (this.values || []).map(Fn.prepareValue);
      if (r.namedQueries[this.name]) {
        if (this.text && r.namedQueries[this.name] !== this.text) {
          let s = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
          return t(s);
        }
        return r.native.execute(this.name, n, t);
      }
      return r.native.prepare(this.name, this.text, n.length, function(s) {
        return s ? t(s) : (r.namedQueries[e.name] = e.text, e.native.execute(e.name, n, t));
      });
    } else if (this.values) {
      if (!Array.isArray(
        this.values
      )) {
        let s = new Error("Query values must be an array");
        return t(s);
      }
      var i = this.values.map(Fn.prepareValue);
      r.native.query(this.text, i, t);
    } else r.native.query(this.text, t);
  };
});
var So = T((tp, vo) => {
  "use strict";
  h();
  var Bl = (po(), O(ho)), Fl = _t(), ep = yo(), bo = ve().EventEmitter, Ml = (it(), O(nt)), kl = Lt(), xo = wo(), Y = vo.exports = function(r) {
    bo.call(this), r = r || {}, this._Promise = r.Promise || b.Promise, this._types = new Fl(r.types), this.native = new Bl({ types: this._types }), this._queryQueue = [], this._ending = false, this._connecting = false, this._connected = false, this._queryable = true;
    var e = this.connectionParameters = new kl(r);
    this.user = e.user, Object.defineProperty(this, "password", { configurable: true, enumerable: false, writable: true, value: e.password }), this.database = e.database, this.host = e.host, this.port = e.port, this.namedQueries = {};
  };
  Y.Query = xo;
  Ml.inherits(Y, bo);
  Y.prototype._errorAllQueries = function(r) {
    let e = a((t) => {
      y.nextTick(() => {
        t.native = this.native, t.handleError(r);
      });
    }, "enqueueError");
    this._hasActiveQuery() && (e(this._activeQuery), this._activeQuery = null), this._queryQueue.forEach(e), this._queryQueue.length = 0;
  };
  Y.prototype._connect = function(r) {
    var e = this;
    if (this._connecting) {
      y.nextTick(() => r(new Error("Client has already been connected. You cannot reuse a client.")));
      return;
    }
    this._connecting = true, this.connectionParameters.getLibpqConnectionString(function(t, n) {
      if (t) return r(t);
      e.native.connect(n, function(i) {
        if (i) return e.native.end(), r(i);
        e._connected = true, e.native.on("error", function(s) {
          e._queryable = false, e._errorAllQueries(s), e.emit("error", s);
        }), e.native.on("notification", function(s) {
          e.emit("notification", { channel: s.relname, payload: s.extra });
        }), e.emit("connect"), e._pulseQueryQueue(true), r();
      });
    });
  };
  Y.prototype.connect = function(r) {
    if (r) {
      this._connect(r);
      return;
    }
    return new this._Promise((e, t) => {
      this._connect((n) => {
        n ? t(n) : e();
      });
    });
  };
  Y.prototype.query = function(r, e, t) {
    var n, i, s, o, u;
    if (r == null) throw new TypeError("Client was passed a null or undefined query");
    if (typeof r.submit == "function") s = r.query_timeout || this.connectionParameters.query_timeout, i = n = r, typeof e == "function" && (r.callback = e);
    else if (s = this.connectionParameters.query_timeout, n = new xo(r, e, t), !n.callback) {
      let c, l;
      i = new this._Promise((f, m) => {
        c = f, l = m;
      }), n.callback = (f, m) => f ? l(f) : c(m);
    }
    return s && (u = n.callback, o = setTimeout(() => {
      var c = new Error(
        "Query read timeout"
      );
      y.nextTick(() => {
        n.handleError(c, this.connection);
      }), u(c), n.callback = () => {
      };
      var l = this._queryQueue.indexOf(n);
      l > -1 && this._queryQueue.splice(l, 1), this._pulseQueryQueue();
    }, s), n.callback = (c, l) => {
      clearTimeout(o), u(c, l);
    }), this._queryable ? this._ending ? (n.native = this.native, y.nextTick(() => {
      n.handleError(
        new Error("Client was closed and is not queryable")
      );
    }), i) : (this._queryQueue.push(n), this._pulseQueryQueue(), i) : (n.native = this.native, y.nextTick(() => {
      n.handleError(new Error("Client has encountered a connection error and is not queryable"));
    }), i);
  };
  Y.prototype.end = function(r) {
    var e = this;
    this._ending = true, this._connected || this.once("connect", this.end.bind(this, r));
    var t;
    return r || (t = new this._Promise(function(n, i) {
      r = a((s) => s ? i(s) : n(), "cb");
    })), this.native.end(function() {
      e._errorAllQueries(new Error("Connection terminated")), y.nextTick(() => {
        e.emit("end"), r && r();
      });
    }), t;
  };
  Y.prototype._hasActiveQuery = function() {
    return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
  };
  Y.prototype._pulseQueryQueue = function(r) {
    if (this._connected && !this._hasActiveQuery()) {
      var e = this._queryQueue.shift();
      if (!e) {
        r || this.emit("drain");
        return;
      }
      this._activeQuery = e, e.submit(this);
      var t = this;
      e.once("_done", function() {
        t._pulseQueryQueue();
      });
    }
  };
  Y.prototype.cancel = function(r) {
    this._activeQuery === r ? this.native.cancel(function() {
    }) : this._queryQueue.indexOf(r) !== -1 && this._queryQueue.splice(this._queryQueue.indexOf(r), 1);
  };
  Y.prototype.ref = function() {
  };
  Y.prototype.unref = function() {
  };
  Y.prototype.setTypeParser = function(r, e, t) {
    return this._types.setTypeParser(
      r,
      e,
      t
    );
  };
  Y.prototype.getTypeParser = function(r, e) {
    return this._types.getTypeParser(r, e);
  };
});
var Mn = T((ip, Eo) => {
  "use strict";
  h();
  Eo.exports = So();
});
var ot = T((op, at) => {
  "use strict";
  h();
  var Ol = uo(), Ul = tt(), Ql = An(), Dl = fo(), { DatabaseError: ql } = vn(), Nl = a(
    (r) => {
      var e;
      return e = class extends Dl {
        constructor(n) {
          super(n, r);
        }
      }, a(e, "BoundPool"), e;
    },
    "poolFactory"
  ), kn = a(
    function(r) {
      this.defaults = Ul, this.Client = r, this.Query = this.Client.Query, this.Pool = Nl(this.Client), this._pools = [], this.Connection = Ql, this.types = Je(), this.DatabaseError = ql;
    },
    "PG"
  );
  typeof y.env.NODE_PG_FORCE_NATIVE < "u" ? at.exports = new kn(Mn()) : (at.exports = new kn(Ol), Object.defineProperty(at.exports, "native", {
    configurable: true,
    enumerable: false,
    get() {
      var r = null;
      try {
        r = new kn(Mn());
      } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND") throw e;
      }
      return Object.defineProperty(at.exports, "native", { value: r }), r;
    }
  }));
});
h();
h();
h();
var da = Object.defineProperty;
var pa = Object.defineProperties;
var ya = Object.getOwnPropertyDescriptors;
var ai = Object.getOwnPropertySymbols;
var ma = Object.prototype.hasOwnProperty;
var ga = Object.prototype.propertyIsEnumerable;
var ui = a(
  (r, e, t) => e in r ? da(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t,
  "__defNormalProp"
);
var wa = a((r, e) => {
  for (var t in e || (e = {})) ma.call(e, t) && ui(r, t, e[t]);
  if (ai) for (var t of ai(e)) ga.call(e, t) && ui(r, t, e[t]);
  return r;
}, "__spreadValues");
var ba = a((r, e) => pa(r, ya(e)), "__spreadProps");
var xa = 1008e3;
var ci = new Uint8Array(
  new Uint16Array([258]).buffer
)[0] === 2;
var va = new TextDecoder();
var Yt = new TextEncoder();
var dt = Yt.encode("0123456789abcdef");
var pt = Yt.encode("0123456789ABCDEF");
var Sa = Yt.encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var li = Sa.slice();
li[62] = 45;
li[63] = 95;
var je;
var yt;
function Ea(r, { alphabet: e, scratchArr: t } = {}) {
  if (!je) if (je = new Uint16Array(256), yt = new Uint16Array(256), ci) for (let S = 0; S < 256; S++) je[S] = dt[S & 15] << 8 | dt[S >>> 4], yt[S] = pt[S & 15] << 8 | pt[S >>> 4];
  else for (let S = 0; S < 256; S++) je[S] = dt[S & 15] | dt[S >>> 4] << 8, yt[S] = pt[S & 15] | pt[S >>> 4] << 8;
  r.byteOffset % 4 !== 0 && (r = new Uint8Array(r));
  let n = r.length, i = n >>> 1, s = n >>> 2, o = t || new Uint16Array(n), u = new Uint32Array(
    r.buffer,
    r.byteOffset,
    s
  ), c = new Uint32Array(o.buffer, o.byteOffset, i), l = e === "upper" ? yt : je, f = 0, m = 0, g;
  if (ci)
    for (; f < s; ) g = u[f++], c[m++] = l[g >>> 8 & 255] << 16 | l[g & 255], c[m++] = l[g >>> 24] << 16 | l[g >>> 16 & 255];
  else for (; f < s; )
    g = u[f++], c[m++] = l[g >>> 24] << 16 | l[g >>> 16 & 255], c[m++] = l[g >>> 8 & 255] << 16 | l[g & 255];
  for (f <<= 2; f < n; ) o[f] = l[r[f++]];
  return va.decode(o.subarray(0, n));
}
a(Ea, "_toHex");
function Aa(r, e = {}) {
  let t = "", n = r.length, i = xa >>> 1, s = Math.ceil(n / i), o = new Uint16Array(s > 1 ? i : n), u = ba(wa({}, e), { scratchArr: o });
  for (let c = 0; c < s; c++) {
    let l = c * i, f = l + i;
    t += Ea(r.subarray(l, f), u);
  }
  return t;
}
a(Aa, "_toHexChunked");
function fi(r, e = {}) {
  return e.alphabet !== "upper" && typeof r.toHex == "function" ? r.toHex() : Aa(r, e);
}
a(fi, "toHex");
h();
h();
var Zt = class Zt2 {
  constructor(e, t, n) {
    E(this, "execute", e);
    E(this, "queryData", t);
    E(this, "opts", n);
  }
  then(e, t) {
    return this.execute(this.queryData, this.opts).then(e, t);
  }
  catch(e) {
    return this.execute(
      this.queryData,
      this.opts
    ).catch(e);
  }
  finally(e) {
    return this.execute(this.queryData, this.opts).finally(e);
  }
};
a(Zt, "NeonQueryPromise");
var xe = Zt;
var mt = class mt2 {
  constructor(e, t) {
    E(this, "strings", e);
    E(this, "values", t);
  }
  toParameterizedQuery(e = {
    query: "",
    params: []
  }) {
    let { strings: t, values: n } = this;
    for (let i = 0, s = t.length; i < s; i++) if (e.query += t[i], i < n.length) {
      let o = n[i];
      if (o instanceof $e) e.query += o.sql;
      else if (o instanceof xe) if (o.queryData instanceof mt2) o.queryData.toParameterizedQuery(e);
      else {
        if (o.queryData.params?.length) throw new Error("This query is not composable");
        e.query += o.queryData.query;
      }
      else {
        let { params: u } = e;
        u.push(o), e.query += "$" + u.length, (o instanceof p || ArrayBuffer.isView(o)) && (e.query += "::bytea");
      }
    }
    return e;
  }
};
a(mt, "SqlTemplate");
var He = mt;
var Jt = class Jt2 {
  constructor(e) {
    E(this, "sql", e);
  }
};
a(Jt, "UnsafeRawSql");
var $e = Jt;
h();
function gt() {
  typeof window < "u" && typeof document < "u" && typeof console < "u" && typeof console.warn == "function" && console.warn(`          
        ************************************************************
        *                                                          *
        *  WARNING: Running SQL directly from the browser can have *
        *  security implications. Even if your database is         *
        *  protected by Row-Level Security (RLS), use it at your   *
        *  own risk. This approach is great for fast prototyping,  *
        *  but ensure proper safeguards are in place to prevent    *
        *  misuse or execution of expensive SQL queries by your    *
        *  end users.                                              *
        *                                                          *
        *  If you've assessed the risks, suppress this message     *
        *  using the disableWarningInBrowsers configuration        *
        *  parameter.                                              *
        *                                                          *
        ************************************************************`);
}
a(gt, "warnIfBrowser");
h();
h();
var wt = class wt2 extends Error {
  constructor(t) {
    super(t);
    E(this, "name", "NeonDbError");
    E(this, "severity");
    E(this, "code");
    E(this, "detail");
    E(this, "hint");
    E(this, "position");
    E(this, "internalPosition");
    E(
      this,
      "internalQuery"
    );
    E(this, "where");
    E(this, "schema");
    E(this, "table");
    E(this, "column");
    E(this, "dataType");
    E(this, "constraint");
    E(this, "file");
    E(this, "line");
    E(this, "routine");
    E(this, "sourceError");
    "captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(this, wt2);
  }
};
a(
  wt,
  "NeonDbError"
);
var N = wt;
var hi = ["severity", "code", "detail", "hint", "position", "internalPosition", "internalQuery", "where", "schema", "table", "column", "dataType", "constraint", "file", "line", "routine"];
function di(r, e) {
  let t, n;
  try {
    t = new URL(r).protocol, n = new URL("http:" + r.slice(t.length));
  } catch {
    throw new N(
      `Database connection string provided to neon() is not a valid URL (connection string: ${r})`
    );
  }
  let {
    username: i,
    hostname: s,
    pathname: o
  } = n;
  if (t !== "postgres:" && t !== "postgresql:" || e && (!i || !s || s === "-" || !o || o === "/")) throw new N(
    "Wrong URL scheme or missing user, host or database in connection parameters"
  );
  return n;
}
a(di, "URLFromPgConnectionString");
function Ca(r) {
  return "postgresql:" + r.href.slice(r.protocol.length);
}
a(Ca, "pgConnectionStringFromURL");
var _a = ["connectionString", "user", "username", "password", "host", "hostname", "port", "database"];
var Ta = { database: "pathname", user: "username", host: "hostname" };
function pi(...r) {
  let e = {};
  for (let t of r) e = t.connectionString !== void 0 ? t : { ...e, ...t };
  return e;
}
a(pi, "mergeConnectionParams");
async function yi(r = "postgresql://-", e = {}, t = {}) {
  if (e.connectionString !== void 0 && (r = e.connectionString), typeof r == "function" && (r = await r()), typeof r != "string") throw new N("Connection string must be a string or a function resolving to one");
  if (e.user !== void 0 && e.username !== void 0) throw new N("Please specify one only of user and username");
  if (e.host !== void 0 && e.hostname !== void 0) throw new N("Please specify one only of host and hostname");
  let n = di(r, false);
  await Promise.all(_a.map(async (u) => {
    if (u === "connectionString") return;
    let c = e[u];
    if (typeof c == "function" && (c = await c()), c === void 0) return;
    if (typeof c != "string" && !(u === "port" && typeof c == "number")) {
      let f = u === "port" ? " or a number" : "";
      throw new N(`Connection parameter "${u}" must be a string${f} or a function resolving to one`);
    }
    let l = Ta[u] ?? u;
    n[l] = c;
  }));
  let { searchParams: i } = n;
  for (let u in t) i.has(u) || i.append(u, t[u]);
  let s = Ca(n), o = di(s, true);
  return { resolvedConnectionString: s, resolvedURL: o };
}
a(yi, "resolveConnectionParams");
Ge();
h();
var vt = "pkg:npm/%40neondatabase/serverless@1.2.0";
var ds = we(_t());
var ps = we(rt());
var ls = "transaction() expects an array of queries, or a function returning an array of queries";
function Nu(r) {
  return r instanceof p ? "\\x" + fi(r) : r;
}
a(Nu, "encodeBuffersAsBytea");
function fs(r) {
  let { query: e, params: t } = r instanceof He ? r.toParameterizedQuery() : r;
  return { query: e, params: t.map((n) => Nu((0, ps.prepareValue)(n))) };
}
a(fs, "prepareQuery");
function ys(r, e = {}) {
  typeof r != "string" && (e = r ?? {}, r = void 0);
  let {
    arrayMode: t,
    fullResults: n,
    fetchOptions: i,
    isolationLevel: s,
    readOnly: o,
    deferrable: u,
    authToken: c,
    disableWarningInBrowsers: l
  } = e;
  function f(g, ...w) {
    if (!(Array.isArray(g) && Array.isArray(g.raw) && Array.isArray(w))) throw new Error('This function can now be called only as a tagged-template function: sql`SELECT ${value}`, not sql("SELECT $1", [value], options). For a conventional function call with value placeholders ($1, $2, etc.), use sql.query("SELECT $1", [value], options).');
    return new xe(m, new He(g, w));
  }
  a(f, "templateFn"), f.query = (g, w, S) => new xe(
    m,
    { query: g, params: w ?? [] },
    S
  ), f.unsafe = (g) => new $e(g), f.transaction = async (g, w) => {
    if (typeof g == "function" && (g = g(f)), !Array.isArray(g)) throw new Error(ls);
    g.forEach((D) => {
      if (!(D instanceof xe)) throw new Error(ls);
    });
    let S = g.map((D) => D.queryData), k = g.map((D) => D.opts ?? {});
    return m(S, k, w);
  };
  async function m(g, w, S) {
    let {
      fetchEndpoint: k,
      fetchFunction: D
    } = pe, he = Array.isArray(g) ? { queries: g.map((G) => fs(G)) } : fs(g), I = i ?? {}, C = t ?? false, re = n ?? false, ne = s, H = o, oe = u;
    S !== void 0 && (S.fetchOptions !== void 0 && (I = { ...I, ...S.fetchOptions }), S.arrayMode !== void 0 && (C = S.arrayMode), S.fullResults !== void 0 && (re = S.fullResults), S.isolationLevel !== void 0 && (ne = S.isolationLevel), S.readOnly !== void 0 && (H = S.readOnly), S.deferrable !== void 0 && (oe = S.deferrable)), w !== void 0 && !Array.isArray(
      w
    ) && w.fetchOptions !== void 0 && (I = { ...I, ...w.fetchOptions });
    let ae = c;
    !Array.isArray(w) && w?.authToken !== void 0 && (ae = w.authToken);
    let me = pi(e, S ?? {}, Array.isArray(w) || !w ? {} : w), { resolvedConnectionString: R, resolvedURL: $ } = await yi(
      r,
      me,
      { application_name: vt }
    ), Ee = typeof k == "function" ? k($.hostname, $.port, { jwtAuth: ae !== void 0 }) : k, ue = {
      "Neon-Connection-String": R,
      "Neon-Raw-Text-Output": "true",
      "Neon-Array-Mode": "true"
    }, Te = await Wu(ae);
    Te && (ue.Authorization = `Bearer ${Te}`), Array.isArray(g) && (ne !== void 0 && (ue["Neon-Batch-Isolation-Level"] = ne), H !== void 0 && (ue["Neon-Batch-Read-Only"] = String(H)), oe !== void 0 && (ue["Neon-Batch-Deferrable"] = String(
      oe
    ))), l || pe.disableWarningInBrowsers || gt();
    let ce;
    try {
      ce = await (D ?? fetch)(Ee, { method: "POST", body: JSON.stringify(he), headers: ue, ...I });
    } catch (G) {
      let q = new N(`Error connecting to database: ${G}`);
      throw q.sourceError = G, q;
    }
    if (ce.ok) {
      let G = await ce.json();
      if (Array.isArray(g)) {
        let q = G.results;
        if (!Array.isArray(q)) throw new N(
          "Neon internal error: unexpected result format"
        );
        return q.map((ge, J) => {
          let ie = w[J] ?? {}, Dt = ie.arrayMode ?? C, Io = ie.fullResults ?? re;
          return hs(ge, { arrayMode: Dt, fullResults: Io, types: ie.types });
        });
      } else {
        let q = w ?? {}, ge = q.arrayMode ?? C, J = q.fullResults ?? re;
        return hs(G, { arrayMode: ge, fullResults: J, types: q.types });
      }
    } else {
      let { status: G } = ce;
      if (G === 400) {
        let q = await ce.json(), ge = new N(q.message);
        for (let J of hi) ge[J] = q[J] ?? void 0;
        throw ge;
      } else {
        let q = await ce.text();
        throw new N(`Server error (HTTP status ${G}): ${q}`);
      }
    }
  }
  return a(
    m,
    "execute"
  ), f;
}
a(ys, "neon");
function hs(r, { arrayMode: e, fullResults: t, types: n }) {
  let i = new ds.default(
    n
  ), s = r.fields.map((c) => c.name), o = r.fields.map((c) => i.getTypeParser(c.dataTypeID)), u = e === true ? r.rows.map((c) => c.map((l, f) => l === null ? null : o[f](l))) : r.rows.map((c) => Object.fromEntries(c.map((l, f) => [s[f], l === null ? null : o[f](l)])));
  return t ? (r.viaNeonFetch = true, r.rowAsArray = e, r.rows = u, r._parsers = o, r._types = i, r) : u;
}
a(hs, "processQueryResult");
async function Wu(r) {
  if (typeof r == "string") return r;
  if (typeof r == "function") try {
    return await Promise.resolve(r());
  } catch (e) {
    let t = new N("Error getting auth token.");
    throw e instanceof Error && (t = new N(`Error getting auth token: ${e.message}`)), t;
  }
}
a(Wu, "getAuthToken");
h();
h();
var Co = we(ot());
h();
var Ao = we(ot());
var On = class On2 extends Ao.Client {
  constructor(t) {
    let n = typeof t == "string" ? { connectionString: t } : {
      ...t,
      ...t && "password" in t ? { password: t.password } : {}
    };
    super({ fallback_application_name: vt, ...n });
    E(this, "config", t);
  }
  get neonConfig() {
    return this.connection.stream;
  }
  connect(t) {
    let { neonConfig: n } = this;
    n.forceDisablePgSSL && (this.ssl = this.connection.ssl = false), this.ssl && n.useSecureWebSocket && console.warn("SSL is enabled for both Postgres (e.g. ?sslmode=require in the connection string + forceDisablePgSSL = false) and the WebSocket tunnel (useSecureWebSocket = true). Double encryption will increase latency and CPU usage. It may be appropriate to disable SSL in the Postgres connection parameters or set forceDisablePgSSL = true.");
    let i = typeof this.config != "string" && this.config?.host !== void 0 || typeof this.config != "string" && this.config?.connectionString !== void 0 || y.env.PGHOST !== void 0, s = y.env.USER ?? y.env.USERNAME;
    if (!i && this.host === "localhost" && this.user === s && this.database === s && this.password === null) throw new Error(`No database host or connection string was set, and key parameters have default values (host: localhost, user: ${s}, db: ${s}, password: null). Is an environment variable missing? Alternatively, if you intended to connect with these parameters, please set the host to 'localhost' explicitly.`);
    let o = super.connect(
      t
    ), u = n.pipelineTLS && this.ssl, c = n.pipelineConnect === "password";
    if (!u && !n.pipelineConnect) return o;
    let l = this.connection;
    if (u && l.on("connect", () => l.stream.emit("data", "S")), c) {
      l.removeAllListeners("authenticationCleartextPassword"), l.removeAllListeners("readyForQuery"), l.once("readyForQuery", () => l.on("readyForQuery", this._handleReadyForQuery.bind(this)));
      let f = this.password, m = Promise.resolve(typeof f == "function" ? f() : f), g = this.ssl ? "sslconnect" : "connect";
      l.on(g, () => {
        this.neonConfig.disableWarningInBrowsers || gt(), m.then((w) => {
          this.password = w, this._handleAuthCleartextPassword(), this._handleReadyForQuery();
        }).catch(
          (w) => l.emit("error", w)
        );
      });
    }
    return o;
  }
  async _handleAuthSASLContinue(t) {
    if (typeof crypto > "u" || crypto.subtle === void 0 || crypto.subtle.importKey === void 0) throw new Error("Cannot use SASL auth when `crypto.subtle` is not defined");
    let n = crypto.subtle, i = this.saslSession, s = this.password, o = t.data;
    if (i.message !== "SASLInitialResponse" || typeof s != "string" || typeof o != "string") throw new Error("SASL: protocol error");
    let u = Object.fromEntries(o.split(",").map((J) => {
      if (!/^.=/.test(J)) throw new Error("SASL: Invalid attribute pair entry");
      let ie = J[0], Dt = J.substring(2);
      return [ie, Dt];
    })), c = u.r, l = u.s, f = u.i;
    if (!c || !/^[!-+--~]+$/.test(c))
      throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing/unprintable");
    if (!l || !/^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(l)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing/not base64");
    if (!f || !/^[1-9][0-9]*$/.test(f)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: missing/invalid iteration count");
    if (!c.startsWith(
      i.clientNonce
    )) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
    if (c.length === i.clientNonce.length) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
    let m = parseInt(f, 10), g = p.from(l, "base64"), w = new TextEncoder(), S = w.encode(s), k = await n.importKey("raw", S, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]), D = new Uint8Array(await n.sign("HMAC", k, p.concat([g, p.from([0, 0, 0, 1])]))), he = D;
    for (var I = 0; I < m - 1; I++) D = new Uint8Array(await n.sign("HMAC", k, D)), he = p.from(he.map((J, ie) => he[ie] ^ D[ie]));
    let C = he, re = await n.importKey("raw", C, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]), ne = new Uint8Array(await n.sign("HMAC", re, w.encode("Client Key"))), H = await n.digest("SHA-256", ne), oe = "n=*,r=" + i.clientNonce, ae = "r=" + c + ",s=" + l + ",i=" + m, me = "c=biws,r=" + c, R = oe + "," + ae + "," + me, $ = await n.importKey("raw", H, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
    var Ee = new Uint8Array(await n.sign("HMAC", $, w.encode(R))), ue = p.from(ne.map((J, ie) => ne[ie] ^ Ee[ie])), Te = ue.toString("base64");
    let ce = await n.importKey("raw", C, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]), G = await n.sign("HMAC", ce, w.encode("Server Key")), q = await n.importKey("raw", G, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
    var ge = p.from(await n.sign("HMAC", q, w.encode(R)));
    i.message = "SASLResponse", i.serverSignature = ge.toString("base64"), i.response = me + ",p=" + Te, this.connection.sendSCRAMClientFinalMessage(
      this.saslSession.response
    );
  }
};
a(On, "NeonClient");
var ut = On;
Ge();
var _o = we(Lt());
function Wl(r, e) {
  if (e) return { callback: e, result: void 0 };
  let t, n, i = a(function(o, u) {
    o ? t(o) : n(u);
  }, "cb"), s = new r(function(o, u) {
    n = o, t = u;
  });
  return { callback: i, result: s };
}
a(Wl, "promisify");
var Qn = class Qn2 extends Co.Pool {
  constructor() {
    super(...arguments);
    E(this, "Client", ut);
    E(this, "hasFetchUnsupportedListeners", false);
    E(this, "addListener", this.on);
  }
  on(t, n) {
    return t !== "error" && (this.hasFetchUnsupportedListeners = true), super.on(t, n);
  }
  query(t, n, i) {
    if (!pe.poolQueryViaFetch || this.hasFetchUnsupportedListeners || typeof t == "function") return super.query(
      t,
      n,
      i
    );
    typeof n == "function" && (i = n, n = void 0);
    let s = Wl(this.Promise, i);
    i = s.callback;
    try {
      let o = new _o.default(
        this.options
      ), u = encodeURIComponent, c = encodeURI, l = `postgresql://${u(o.user)}:${u(o.password)}@${u(o.host)}/${c(o.database)}`, f = typeof t == "string" ? t : t.text, m = n ?? t.values ?? [];
      ys(l, { fullResults: true, arrayMode: t.rowMode === "array" }).query(f, m, { types: t.types ?? this.options?.types }).then((w) => i(void 0, w)).catch((w) => i(
        w
      ));
    } catch (o) {
      i(o);
    }
    return s.result;
  }
};
a(Qn, "NeonPool");
Ge();
var ct = we(ot());
h();
var To = we(Ir());
function jl(r) {
  return Object.entries(r).reduce((t, [n, i]) => (i != null && (t[n] = i), t), /* @__PURE__ */ Object.create(null));
}
a(jl, "toConnectionOptions");
function Hl(r) {
  return Object.entries(r).reduce((t, [n, i]) => {
    if (n === "ssl") {
      let s = i;
      typeof s == "boolean" && (t[n] = s), typeof s == "object" && (t[n] = jl(s));
    } else if (i != null) if (n === "port") {
      if (i !== "") {
        let s = parseInt(i, 10);
        if (isNaN(s)) throw new Error(`Invalid ${n}: ${i}`);
        t[n] = s;
      }
    } else t[n] = i;
    return t;
  }, /* @__PURE__ */ Object.create(null));
}
a(Hl, "toClientConfig");
function $l(r) {
  return Hl((0, To.parse)(r));
}
a(
  $l,
  "parseIntoClientConfig"
);
var export_DatabaseError = ct.DatabaseError;
var export_defaults = ct.defaults;
var export_escapeIdentifier = ct.escapeIdentifier;
var export_escapeLiteral = ct.escapeLiteral;
var export_types = ct.types;

// api/_lib/neon.js
var _sql = null;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
    _sql = ys(url);
  }
  return _sql;
}
async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_journal (
      date text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_predictions (
      draw_id integer PRIMARY KEY,
      play integer NOT NULL DEFAULT 10,
      mode text NOT NULL DEFAULT 'mix',
      picks jsonb NOT NULL,
      dans jsonb DEFAULT '[]'::jsonb,
      tuos jsonb DEFAULT '[]'::jsonb,
      ai_picks jsonb DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_daily_reviews (
      date text PRIMARY KEY,
      draw_id integer NOT NULL,
      predicted jsonb,
      actual jsonb,
      hits integer NOT NULL DEFAULT 0,
      won boolean NOT NULL DEFAULT false,
      prize numeric NOT NULL DEFAULT 0,
      ai_summary text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS kl8_ai_deep_runs (
      draw_id integer NOT NULL,
      play integer NOT NULL DEFAULT 10,
      status text NOT NULL DEFAULT 'running',
      device_id text,
      result jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (draw_id, play)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS digit_ai_runs (
      game text NOT NULL,
      draw_id integer NOT NULL,
      status text NOT NULL DEFAULT 'running',
      device_id text,
      result jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (game, draw_id)
    )`;
}
async function readConfig(sql, key) {
  const rows = await sql`SELECT value FROM admin_config WHERE key = ${key}`;
  return rows[0]?.value || null;
}
async function writeConfig(sql, key, value) {
  await sql`
    INSERT INTO admin_config (key, value)
    VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// api/daily-push.js
var import_node_crypto = __toESM(require("node:crypto"), 1);

// api/_lib/xml.js
var ROW_RE = /<row\s+([^>]*?)\/?>/g;
var ATTR_RE = /(\w+)="([^"]*)"/g;
function parse500Rows(text) {
  const rows = [];
  let m;
  while (m = ROW_RE.exec(text)) {
    const attrs = {};
    let a2;
    while (a2 = ATTR_RE.exec(m[1])) attrs[a2[1]] = a2[2];
    const issue = Number(attrs.expect);
    if (Number.isInteger(issue) && attrs.opencode) {
      rows.push({
        issue,
        code: attrs.opencode,
        date: (attrs.opentime || "").slice(0, 10) || null
      });
    }
  }
  return rows.sort((x2, y2) => y2.issue - x2.issue);
}
var UA_500 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// api/_lib/kl8.js
var CWL_BASE = "https://www.cwl.gov.cn";
var API_PATH = "/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice";
var XML_KL8 = "https://kaijiang.500.com/static/info/kaijiang/xml/kl8/list.xml";
async function fromCwl(count) {
  const query = `name=kl8&issueCount=${count}&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`;
  const url = `${CWL_BASE}${API_PATH}?${query}`;
  const res = await fetch(url, {
    headers: {
      Referer: "https://www.cwl.gov.cn/ygkj/wqkjgg/kl8/",
      Accept: "application/json",
      "User-Agent": UA_500
    }
  });
  if (!res.ok) throw new Error(`\u798F\u5F69\u5B98\u7F51 HTTP ${res.status}`);
  const data = await res.json();
  if (data.state !== 0 || !Array.isArray(data.result)) {
    throw new Error(data.message || "\u798F\u5F69\u5B98\u7F51\u63A5\u53E3\u8FD4\u56DE\u5F02\u5E38");
  }
  return data.result.map((r) => ({
    id: Number(r.code),
    date: (r.date || "").replace(/\(.*\)$/, "") || null,
    nums: String(r.red || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 80).sort((a2, b2) => a2 - b2)
  })).filter((d) => Number.isInteger(d.id) && d.nums.length === 20).sort((a2, b2) => b2.id - a2.id);
}
async function from500(count) {
  const res = await fetch(XML_KL8, {
    headers: { "User-Agent": UA_500, Accept: "text/xml,application/xml,*/*" }
  });
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`);
  const rows = parse500Rows(await res.text());
  const draws = rows.map((r) => ({
    id: r.issue,
    date: r.date,
    nums: r.code.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 80).sort((a2, b2) => a2 - b2)
  })).filter((d) => d.nums.length === 20);
  if (!draws.length) throw new Error("500.com \u672A\u53D6\u5230\u5FEB\u4E508\u5F00\u5956\u6570\u636E");
  return draws.slice(0, count);
}
async function fetchKl8Draws(count = 10) {
  try {
    return await fromCwl(count);
  } catch (e) {
    const draws = await from500(count);
    console.warn(`[kl8] \u5B98\u7F51\u4E0D\u53EF\u7528\uFF08${e.message}\uFF09\uFF0C\u5DF2\u6539\u7528 500.com`);
    return draws;
  }
}

// api/_lib/fc3d.js
var CWL_BASE2 = "https://www.cwl.gov.cn";
var API_PATH2 = "/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice";
var REFERER_3D = "https://www.cwl.gov.cn/ygkj/wqkjgg/3d/";
var XML_3D = "https://kaijiang.500.com/static/info/kaijiang/xml/sd/list.xml";
async function fromCwl2(count) {
  const query = `name=3d&issueCount=${count}&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}`;
  const res = await fetch(`${CWL_BASE2}${API_PATH2}?${query}`, {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: REFERER_3D,
      "User-Agent": UA_500
    }
  });
  if (!res.ok) throw new Error(`\u798F\u5F69\u5B98\u7F51\u8FD4\u56DE ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.result) || !data.result.length) {
    throw new Error("\u672A\u53D6\u5230\u798F\u5F693D\u5F00\u5956\u6570\u636E");
  }
  return data.result.map((r) => {
    const raw = String(r.red || "").replace(/\s/g, "");
    let digits;
    if (raw.includes(",")) digits = raw.split(",").map(Number);
    else if (raw.length === 3) digits = raw.split("").map(Number);
    else digits = [];
    return {
      id: Number(r.code),
      date: (r.date || "").replace(/\(.*\)$/, "") || null,
      num: digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9)
    };
  }).filter((d) => Number.isInteger(d.id) && d.num.length === 3).sort((a2, b2) => b2.id - a2.id);
}
async function from5002(count) {
  const res = await fetch(XML_3D, {
    headers: { "User-Agent": UA_500, Accept: "text/xml,application/xml,*/*" }
  });
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`);
  const rows = parse500Rows(await res.text());
  const draws = rows.map((r) => ({
    id: r.issue,
    date: r.date,
    num: r.code.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 9)
  })).filter((d) => d.num.length === 3);
  if (!draws.length) throw new Error("500.com \u672A\u53D6\u5230\u798F\u5F693D\u5F00\u5956\u6570\u636E");
  return draws.slice(0, count);
}
async function fetchFc3dDraws(count = 100) {
  try {
    return await fromCwl2(count);
  } catch (e) {
    const draws = await from5002(count);
    console.warn(`[fc3d] \u5B98\u7F51\u4E0D\u53EF\u7528\uFF08${e.message}\uFF09\uFF0C\u5DF2\u6539\u7528 500.com`);
    return draws;
  }
}

// api/_lib/pl3.js
var SPORTTERY_API = "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry";
var XML_PL3 = "https://kaijiang.500.com/static/info/kaijiang/xml/pls/list.xml";
function parseResult(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s.split(/[\s,]+/).filter(Boolean);
  const digits = parts.length === 3 ? parts.map(Number) : s.replace(/\D/g, "").split("").map(Number);
  return digits.filter((n) => Number.isInteger(n) && n >= 0 && n <= 9);
}
async function fromSporttery(count) {
  const query = `?gameNo=35&provinceId=0&pageSize=${count}&isVerify=1&pageNo=1`;
  const res = await fetch(`${SPORTTERY_API}${query}`, {
    headers: {
      "User-Agent": UA_500,
      Referer: "https://static.sporttery.cn/",
      Accept: "application/json, text/plain, */*"
    }
  });
  if (!res.ok) throw new Error(`\u4F53\u5F69\u5B98\u7F51 HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.value?.list;
  if (!Array.isArray(list) || !list.length) {
    throw new Error(data?.errorMessage || "\u4F53\u5F69\u5B98\u7F51\u63A5\u53E3\u8FD4\u56DE\u5F02\u5E38");
  }
  return list.map((r) => ({
    id: Number(r.lotteryDrawNum),
    date: String(r.lotteryDrawTime || "").slice(0, 10) || null,
    num: parseResult(r.lotteryDrawResult)
  })).filter((d) => Number.isInteger(d.id) && d.num.length === 3).sort((a2, b2) => b2.id - a2.id);
}
async function from5003(count) {
  const res = await fetch(XML_PL3, {
    headers: { "User-Agent": UA_500, Accept: "text/xml,application/xml,*/*" }
  });
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`);
  const rows = parse500Rows(await res.text());
  const draws = rows.map((r) => ({
    id: r.issue,
    date: r.date,
    num: parseResult(r.code)
  })).filter((d) => Number.isInteger(d.id) && d.num.length === 3);
  if (!draws.length) throw new Error("500.com \u672A\u53D6\u5230\u6392\u5217\u4E09\u5F00\u5956\u6570\u636E");
  return draws.slice(0, count);
}
async function fetchPl3Draws(count = 100) {
  try {
    const draws = await fromSporttery(count);
    if (!draws.length) throw new Error("\u4F53\u5F69\u5B98\u7F51\u672A\u8FD4\u56DE\u6709\u6548\u6570\u636E");
    return { draws, source: "sporttery" };
  } catch (e) {
    const draws = await from5003(count);
    console.warn(`[pl3] \u4F53\u5F69\u63A5\u53E3\u4E0D\u53EF\u7528\uFF08${e.message}\uFF09\uFF0C\u5DF2\u6539\u7528 500.com`);
    return { draws, source: "500" };
  }
}

// api/_lib/ssq.js
var XML_SSQ = "https://kaijiang.500.com/static/info/kaijiang/xml/ssq/list.xml";
var CWL_API = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice";
function parseSsqCode(raw) {
  const [r, b2] = String(raw || "").split("|");
  const red2 = String(r || "").split(/[\s,]+/).filter(Boolean).map(Number);
  const blue = Number(String(b2 || "").trim());
  if (red2.length !== 6 || !red2.every((n) => Number.isInteger(n) && n >= 1 && n <= 33)) return null;
  if (!Number.isInteger(blue) || blue < 1 || blue > 16) return null;
  return { red: [...red2].sort((x2, y2) => x2 - y2), blue };
}
async function from5004(count) {
  const res = await fetch(XML_SSQ, {
    headers: { "User-Agent": UA_500, Accept: "text/xml,application/xml,*/*" }
  });
  if (!res.ok) throw new Error(`500.com HTTP ${res.status}`);
  const rows = parse500Rows(await res.text());
  const draws = rows.map((r) => {
    const parsed = parseSsqCode(r.code);
    return parsed ? { id: r.issue, date: r.date, ...parsed } : null;
  }).filter(Boolean);
  if (!draws.length) throw new Error("500.com \u672A\u53D6\u5230\u53CC\u8272\u7403\u5F00\u5956\u6570\u636E");
  return draws.slice(0, count);
}
async function fromCwl3(count) {
  const url = `${CWL_API}?name=ssq&issueCount=${count}&issueStart=&issueEnd=&dayStart=&dayEnd=&pageNo=1&pageSize=${count}&week=&systemType=PC`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA_500,
      Referer: "https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/",
      Accept: "application/json, text/plain, */*"
    }
  });
  if (!res.ok) throw new Error(`\u798F\u5F69\u5B98\u7F51 HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.result;
  if (!Array.isArray(list) || !list.length) throw new Error("\u798F\u5F69\u5B98\u7F51\u63A5\u53E3\u8FD4\u56DE\u5F02\u5E38");
  return list.map((r) => {
    const red2 = String(r.red || "").split(",").filter(Boolean).map(Number);
    const blue = Number(r.blue);
    if (red2.length !== 6 || !Number.isInteger(blue)) return null;
    return {
      id: Number(r.code),
      date: String(r.date || "").slice(0, 10) || null,
      red: [...red2].sort((x2, y2) => x2 - y2),
      blue
    };
  }).filter((d) => d && Number.isInteger(d.id)).sort((a2, b2) => b2.id - a2.id);
}
async function fetchSsqDraws(count = 100) {
  try {
    const draws = await from5004(count);
    return { draws, source: "500" };
  } catch (e) {
    const draws = await fromCwl3(count);
    console.warn(`[ssq] 500.com \u4E0D\u53EF\u7528\uFF08${e.message}\uFF09\uFF0C\u5DF2\u6539\u7528\u798F\u5F69\u5B98\u7F51`);
    return { draws, source: "cwl" };
  }
}

// api/_lib/ai.js
var DEFAULT_LLM = {
  llmBaseUrl: "https://3hdmx.com/v1",
  llmKey: "sk-MJ2pd89yHDkjYUo6jtJ5cskUPlnbMwhbaBkX7Pgm6G7k74W1",
  llmModel: "claude-sonnet-5"
};
async function resolveLlmSettings() {
  try {
    const sql = getSql();
    const raw = await readConfig(sql, "shared_llm_config");
    if (raw) {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (obj && obj.llmKey) {
        return {
          llmBaseUrl: obj.llmBaseUrl || DEFAULT_LLM.llmBaseUrl,
          llmKey: obj.llmKey,
          llmModel: obj.llmModel || DEFAULT_LLM.llmModel
        };
      }
    }
  } catch {
  }
  return { ...DEFAULT_LLM };
}
async function callAi(settings, messages, { maxTokens = 2e3, temperature = 0.3 } = {}) {
  const base = String(settings.llmBaseUrl).replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.llmKey}`
    },
    body: JSON.stringify({
      model: settings.llmModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`\u5927\u6A21\u578B\u63A5\u53E3 HTTP ${res.status}${detail ? `\uFF1A${detail.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("\u5927\u6A21\u578B\u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A");
  return String(text).trim();
}

// src/lib/stats.js
var BALL_MAX = 80;
var range = (n) => Array.from({ length: n }, (_, i) => i + 1);
function takeLatest(draws, n) {
  return draws.slice(0, Math.min(n, draws.length));
}
function ballMissing(draws, n = draws.length) {
  const window2 = takeLatest(draws, n);
  const out = {};
  for (const ball of range(BALL_MAX)) {
    let current = null;
    const gaps = [];
    let gap = 0;
    for (const d of window2) {
      const hit = d.nums.includes(ball);
      if (hit) {
        if (current === null) current = gap;
        gaps.push(gap);
        gap = 0;
      } else {
        gap++;
      }
    }
    if (current === null) current = gap;
    const appeared = gaps.length;
    out[ball] = {
      current,
      max: appeared ? Math.max(...gaps) : window2.length,
      avg: appeared ? +(gaps.reduce((s, v2) => s + v2, 0) / appeared).toFixed(1) : null,
      count: appeared
    };
  }
  return out;
}
var isOdd = (n) => n % 2 === 1;
function comb(n, k) {
  if (k < 0 || k > n || n < 0) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}
function scoreBalls(draws, { periods = 100, halfLife = 20, hotMode = "mix" } = {}) {
  const window2 = takeLatest(draws, periods).slice().reverse();
  const weighted = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]));
  window2.forEach((d, i) => {
    const w = Math.pow(0.5, (window2.length - 1 - i) / halfLife);
    for (const n of d.nums) weighted[n] += w;
  });
  const missing = ballMissing(draws, periods);
  if (hotMode === "multi") {
    const wins = [Math.min(window2.length, 100), 50, 20, 10];
    const ws = [0.25, 0.3, 0.3, 0.15];
    const scores2 = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]));
    const multiFreq = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]));
    wins.forEach((w, k) => {
      const win = window2.slice(-Math.min(w, window2.length));
      const c = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]));
      for (const d of win) for (const x2 of d.nums) c[x2]++;
      const mx = Math.max(...Object.values(c)) / win.length || 1;
      for (const n of range(BALL_MAX)) {
        const rate = c[n] / win.length;
        scores2[n] += ws[k] * (rate / mx);
        multiFreq[n] += ws[k] * rate * 100;
      }
    });
    return { scores: scores2, weighted: multiFreq, missing, window: window2.length };
  }
  const maxW = Math.max(...Object.values(weighted), 1);
  const maxMiss = Math.max(...Object.values(missing).map((m) => m.current), 1);
  const recipe = {
    hot: { freq: 1, miss: 0 },
    mix: { freq: 1, miss: 0.35 },
    cold: { freq: 0.35, miss: 1 }
  }[hotMode];
  const scores = {};
  for (const n of range(BALL_MAX)) {
    scores[n] = weighted[n] / maxW * recipe.freq + missing[n].current / maxMiss * recipe.miss;
  }
  return { scores, weighted, missing, window: window2.length };
}
function pickBalanced(ranked, count = 10) {
  const band = (n) => Math.min(3, Math.floor((n - 1) / 20));
  const picked = [];
  const used = /* @__PURE__ */ new Set();
  for (let b2 = 0; b2 < 4; b2++) {
    const x2 = ranked.find((r) => band(r.n) === b2);
    if (x2) {
      picked.push(x2);
      used.add(x2.n);
    }
  }
  const bandCount = [0, 0, 0, 0];
  picked.forEach((x2) => bandCount[band(x2.n)]++);
  let odd = picked.filter((x2) => isOdd(x2.n)).length;
  for (const x2 of ranked) {
    if (picked.length >= count) break;
    if (used.has(x2.n)) continue;
    const b2 = band(x2.n);
    if (bandCount[b2] >= 3) continue;
    if (isOdd(x2.n) && odd >= Math.ceil(count / 2) + 1) continue;
    if (!isOdd(x2.n) && picked.length - odd >= Math.ceil(count / 2) + 1) continue;
    picked.push(x2);
    used.add(x2.n);
    bandCount[b2]++;
    if (isOdd(x2.n)) odd++;
  }
  return picked.slice(0, count);
}

// src/lib/kl8Math.js
var LOG_FACT = [0];
function logFact(n) {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);
  return LOG_FACT[n];
}
function logC(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logFact(n) - logFact(k) - logFact(n - k);
}
function kl8Prob(k, m) {
  if (m < 0 || m > k || m > 20) return 0;
  return Math.exp(logC(k, m) + logC(80 - k, 20 - m) - logC(80, 20));
}
var KL8_PRIZES = {
  1: { 1: 4.6 },
  2: { 2: 19 },
  3: { 3: 53, 2: 3 },
  4: { 4: 100, 3: 5, 2: 3 },
  5: { 5: 1e3, 4: 21, 3: 3 },
  6: { 6: 3e3, 5: 30, 4: 5, 3: 3 },
  7: { 7: 1e4, 6: 288, 5: 28, 4: 4, 0: 2 },
  8: { 8: 5e4, 7: 800, 6: 88, 5: 10, 4: 3, 0: 2 },
  9: { 9: 3e5, 8: 2e3, 7: 200, 6: 20, 5: 5, 4: 3, 0: 2 },
  10: { 10: 5e6, 9: 8e3, 8: 800, 7: 80, 6: 5, 5: 3, 0: 2 }
};
var KL8_PLAY_LABEL = {
  1: "\u9009\u4E00",
  2: "\u9009\u4E8C",
  3: "\u9009\u4E09",
  4: "\u9009\u56DB",
  5: "\u9009\u4E94",
  6: "\u9009\u516D",
  7: "\u9009\u4E03",
  8: "\u9009\u516B",
  9: "\u9009\u4E5D",
  10: "\u9009\u5341"
};
function kl8PlayStats(k) {
  const table = KL8_PRIZES[k] || {};
  const dist = [];
  let anyWin = 0;
  let ev = 0;
  for (let m = 0; m <= k; m++) {
    const p2 = kl8Prob(k, m);
    const prize = table[m] || 0;
    dist.push({ m, p: p2, prize });
    if (prize > 0) anyWin += p2;
    ev += p2 * prize;
  }
  return {
    k,
    label: KL8_PLAY_LABEL[k],
    dist,
    anyWin,
    ev,
    returnRate: ev / 2,
    minHit: Math.min(...dist.filter((d) => d.prize > 0).map((d) => d.m))
  };
}

// src/lib/kl8Calib.js
var BASE = 0.25;
var BUCKETS = ["\u521A\u5F00", "\u6E29", "\u51B7", "\u6DF1\u51B7"];
function bucketOf(omission) {
  if (omission === 0) return "\u521A\u5F00";
  if (omission <= 3) return "\u6E29";
  if (omission <= 7) return "\u51B7";
  return "\u6DF1\u51B7";
}
function kl8Calibration(draws, window2 = 300) {
  const list = draws.filter((d) => Array.isArray(d.nums) && d.nums.length === 20).slice(0, window2);
  if (list.length < 20) return null;
  const chrono = [...list].reverse();
  const lastSeen = Array(81).fill(-1);
  const stat = Object.fromEntries(BUCKETS.map((b2) => [b2, { hit: 0, n: 0 }]));
  const hot = { hit: 0, n: 0 };
  let llDyn = 0;
  let llBase = 0;
  let count = 0;
  let dynWins = 0;
  chrono.forEach((d, i) => {
    const set = new Set(d.nums);
    const recent = chrono.slice(Math.max(0, i - 10), i);
    const freq = /* @__PURE__ */ new Map();
    for (const r of recent) for (const num of r.nums) freq.set(num, (freq.get(num) || 0) + 1);
    const hotPool = [...freq.entries()].sort((a2, b2) => b2[1] - a2[1]).slice(0, 20).map(([num]) => num);
    for (let num = 1; num <= 80; num++) {
      const om = lastSeen[num] < 0 ? 99 : i - 1 - lastSeen[num];
      const key = bucketOf(om);
      const hit = set.has(num) ? 1 : 0;
      const prior = stat[key];
      const rawFactor = prior.n >= 20 ? prior.hit / prior.n / BASE : 1;
      const factor = Math.min(1.85, Math.max(0.55, rawFactor));
      const shrink = 1 + (factor - 1) * (count / (count + 1500));
      const p2 = Math.min(0.98, Math.max(0.02, BASE * shrink));
      const pb = BASE;
      const lDyn = -(hit ? Math.log(p2) : Math.log(1 - p2));
      const lBase = -(hit ? Math.log(pb) : Math.log(1 - pb));
      llDyn += lDyn;
      llBase += lBase;
      if (lDyn < lBase) dynWins++;
      count++;
      stat[key].hit += hit;
      stat[key].n++;
    }
    for (const num of hotPool) {
      hot.hit += set.has(num) ? 1 : 0;
      hot.n++;
    }
    for (const num of d.nums) lastSeen[num] = i;
  });
  const buckets = BUCKETS.map((b2) => ({
    name: b2,
    n: stat[b2].n,
    rate: stat[b2].n ? stat[b2].hit / stat[b2].n : null
  }));
  return {
    periods: list.length,
    samples: count,
    buckets,
    hot: { n: hot.n, rate: hot.n ? hot.hit / hot.n : null },
    logLossDyn: llDyn / count,
    logLossBase: llBase / count,
    diff: (llDyn - llBase) / count,
    dynWinRate: dynWins / count
  };
}

// src/lib/kl8V7.js
var WINDOWS = [100, 50, 30, 20];
var POOL_SIZE = 30;
var BAND = (n) => Math.min(3, Math.floor((n - 1) / 20));
function mulberry32(seed) {
  let a2 = seed >>> 0;
  return function next() {
    a2 = a2 + 1831565813 >>> 0;
    let t = a2;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function windowWeights(nextId) {
  const primary = WINDOWS[Math.abs(nextId) % WINDOWS.length];
  return WINDOWS.map((w) => ({ w, weight: w === primary ? 0.55 : 0.15 }));
}
function bucketFactors(draws) {
  const calib = kl8Calibration(draws, 300);
  const factorOf = (om) => {
    if (!calib) return 1;
    const name = om === 0 ? "\u521A\u5F00" : om <= 3 ? "\u6E29" : om <= 7 ? "\u51B7" : "\u6DF1\u51B7";
    const b2 = calib.buckets.find((x2) => x2.name === name);
    if (!b2 || !b2.rate) return 1;
    return Math.min(1.1, Math.max(0.9, b2.rate / 0.25));
  };
  return { calib, factorOf };
}
function samplePicks(pool, play, rnd) {
  const sorted = [...pool].sort((a2, b2) => b2.weight - a2.weight);
  const bandLimit = Math.max(2, Math.ceil(play / 4) + 1);
  const oddLimit = Math.ceil(play / 2) + 1;
  const picked = [];
  const used = /* @__PURE__ */ new Set();
  const bandCount = [0, 0, 0, 0];
  let odd = 0;
  while (picked.length < play) {
    const cands = sorted.filter((x2) => {
      if (used.has(x2.n)) return false;
      const b2 = BAND(x2.n);
      if (bandCount[b2] >= bandLimit) return false;
      if (isOdd(x2.n) ? odd >= oddLimit : picked.length - odd >= oddLimit) return false;
      return true;
    });
    const list = cands.length ? cands : sorted.filter((x2) => !used.has(x2.n));
    if (!list.length) break;
    const total = list.reduce((s, x2) => s + x2.weight, 0);
    let r = rnd() * total;
    let chosen = list[list.length - 1];
    for (const x2 of list) {
      r -= x2.weight;
      if (r <= 0) {
        chosen = x2;
        break;
      }
    }
    picked.push(chosen);
    used.add(chosen.n);
    bandCount[BAND(chosen.n)]++;
    if (isOdd(chosen.n)) odd++;
  }
  return picked.map((x2) => x2.n).sort((a2, b2) => a2 - b2);
}
function v7Recommend(draws, { play = 10, nextId } = {}) {
  if (!Array.isArray(draws) || draws.length < 20) return null;
  const issue = Number(nextId || draws[0].id + 1);
  const rnd = mulberry32(issue * 7919 + play * 104729 >>> 0);
  const { calib, factorOf } = bucketFactors(draws);
  const weights = windowWeights(issue);
  const fused = Object.fromEntries(range(BALL_MAX).map((n) => [n, 0]));
  for (const { w, weight } of weights) {
    const { scores } = scoreBalls(draws, { periods: w, halfLife: 20, hotMode: "mix" });
    const max = Math.max(...Object.values(scores), 1e-9);
    for (const n of range(BALL_MAX)) fused[n] += weight * (scores[n] / max);
  }
  const missing = ballMissing(draws, 100);
  const lastNums = new Set(draws[0]?.nums || []);
  const all = range(BALL_MAX).map((n) => {
    const om = missing[n].current;
    const factor = factorOf(om);
    return {
      n,
      score: +(fused[n] * 100).toFixed(1),
      miss: om,
      weight: (0.2 + fused[n]) * factor
    };
  });
  const rankedDesc = [...all].sort((a2, b2) => b2.score - a2.score);
  const pool = rankedDesc.slice(0, POOL_SIZE);
  const kill = rankedDesc.slice(-POOL_SIZE).reverse();
  const picks = samplePicks(pool, play, rnd);
  const pickSet = new Set(picks);
  const backup = pool.filter((x2) => !pickSet.has(x2.n)).slice(0, 3).map((x2) => x2.n);
  const stats = kl8PlayStats(play);
  const primaryWindow = weights.find((x2) => x2.weight === 0.55)?.w || WINDOWS[0];
  return {
    nextId: issue,
    play,
    primaryWindow,
    windows: weights,
    pool,
    kill,
    picks,
    backup,
    stats,
    lastHitInPool: pool.filter((x2) => lastNums.has(x2.n)).length,
    lastHitInKill: kill.filter((x2) => lastNums.has(x2.n)).length,
    buckets: calib?.buckets || []
  };
}

// src/lib/digitAi.js
function summarizeDigit(draws, n = 100) {
  const picked = draws.slice(0, Math.min(n, draws.length)).filter((d) => Array.isArray(d.num) && d.num.length === 3);
  const total = picked.length;
  if (!total) return null;
  const chrono = [...picked].reverse();
  const latest = picked[0];
  const freq = [0, 1, 2].map(() => Array(10).fill(0));
  const freq30 = [0, 1, 2].map(() => Array(10).fill(0));
  const last = [0, 1, 2].map(() => Array(10).fill(-1));
  const trans = [0, 1, 2].map(() => Array.from({ length: 10 }, () => Array(10).fill(0)));
  const sums = [];
  const spans = [];
  const oddDist = [0, 0, 0, 0];
  const bigDist = [0, 0, 0, 0];
  const formDist = { \u8C79\u5B50: 0, \u7EC4\u4E09: 0, \u7EC4\u516D: 0 };
  let repeated = 0;
  chrono.forEach((d, i) => {
    d.num.forEach((v2, p2) => {
      freq[p2][v2]++;
      last[p2][v2] = i;
      if (i >= total - 30) freq30[p2][v2]++;
      if (i > 0) trans[p2][chrono[i - 1].num[p2]][v2]++;
    });
    const s = d.num[0] + d.num[1] + d.num[2];
    sums.push(s);
    spans.push(Math.max(...d.num) - Math.min(...d.num));
    const odd = d.num.filter((v2) => v2 % 2 === 1).length;
    oddDist[odd]++;
    bigDist[d.num.filter((v2) => v2 >= 5).length]++;
    const uniq = new Set(d.num).size;
    formDist[uniq === 1 ? "\u8C79\u5B50" : uniq === 2 ? "\u7EC4\u4E09" : "\u7EC4\u516D"]++;
    if (uniq < 3) repeated++;
  });
  const omit = [0, 1, 2].map((p2) => Array.from({ length: 10 }, (_, d) => total - 1 - last[p2][d]));
  const maxOmit = [0, 1, 2].map((p2) => Math.max(1, ...omit[p2]));
  const lastNum = latest.num;
  const score = [0, 1, 2].map(
    (p2) => Array.from({ length: 10 }, (_, d) => {
      const from = lastNum[p2];
      const transTotal = trans[p2][from].reduce((a2, b2) => a2 + b2, 0) || 1;
      return 0.35 * (freq[p2][d] / total) * 10 + 0.3 * (freq30[p2][d] / Math.min(30, total)) * 10 + 0.15 * (omit[p2][d] / maxOmit[p2]) + 0.2 * (trans[p2][from][d] / transTotal) * 10;
    })
  );
  const topDigits = score.map(
    (arr) => arr.map((v2, d) => ({ d, v: v2 })).sort((a2, b2) => b2.v - a2.v).slice(0, 3).map((x2) => x2.d)
  );
  const straight = [];
  for (const a2 of topDigits[0].slice(0, 2))
    for (const b2 of topDigits[1].slice(0, 2))
      for (const c of topDigits[2].slice(0, 2))
        straight.push({ num: [a2, b2, c], v: score[0][a2] + score[1][b2] + score[2][c] });
  straight.sort((x2, y2) => y2.v - x2.v);
  const digitScore = Array.from({ length: 10 }, (_, d) => (score[0][d] + score[1][d] + score[2][d]) / 3);
  const pool = digitScore.map((v2, d) => ({ d, v: v2 })).sort((a2, b2) => b2.v - a2.v).slice(0, 5).map((x2) => x2.d);
  const group = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++)
        group.push({
          num: [pool[i], pool[j], pool[k]].sort((a2, b2) => a2 - b2),
          v: digitScore[pool[i]] + digitScore[pool[j]] + digitScore[pool[k]]
        });
  group.sort((x2, y2) => y2.v - x2.v);
  const sortedSums = [...sums].sort((a2, b2) => a2 - b2);
  const q = (r) => sortedSums[Math.min(total - 1, Math.floor(total * r))];
  const sortedSpans = [...spans].sort((a2, b2) => a2 - b2);
  const qs = (r) => sortedSpans[Math.min(total - 1, Math.floor(total * r))];
  const avg = (arr) => arr.reduce((a2, b2) => a2 + b2, 0) / arr.length;
  const share = (arr) => arr.map((c) => Math.round(c / total * 100));
  return {
    total,
    latest,
    freq,
    freq30,
    omit,
    topDigits,
    sum: { min: Math.min(...sums), max: Math.max(...sums), avg: +avg(sums).toFixed(1), p30: q(0.3), p70: q(0.7) },
    span: { avg: +avg(spans).toFixed(1), p30: qs(0.3), p70: qs(0.7) },
    oddDist,
    bigDist,
    formDist,
    repeatRate: Math.round(repeated / total * 100),
    candidates: {
      straight: straight.slice(0, 5).map((x2) => x2.num),
      group: group.slice(0, 3).map((x2) => x2.num),
      group3: [[topDigits[0][0], topDigits[1][0], topDigits[2][0]]]
    },
    straightAll: straight,
    groupAll: group,
    posScore: score,
    digitScore,
    share
  };
}
function rankDigitCandidates(summary) {
  if (!summary?.posScore || !summary?.digitScore) return null;
  const ps2 = summary.posScore;
  const ds2 = summary.digitScore;
  const straight = [];
  for (let a2 = 0; a2 < 10; a2++)
    for (let b2 = 0; b2 < 10; b2++)
      for (let c = 0; c < 10; c++) straight.push({ num: `${a2}${b2}${c}`, v: ps2[0][a2] + ps2[1][b2] + ps2[2][c] });
  straight.sort((x2, y2) => y2.v - x2.v);
  const group = [];
  for (let a2 = 0; a2 < 10; a2++)
    for (let b2 = a2 + 1; b2 < 10; b2++)
      for (let c = b2 + 1; c < 10; c++) group.push({ num: `${a2}${b2}${c}`, v: ds2[a2] + ds2[b2] + ds2[c] });
  group.sort((x2, y2) => y2.v - x2.v);
  const group3 = [];
  for (let d = 0; d < 10; d++)
    for (let e = 0; e < 10; e++) {
      if (e === d) continue;
      group3.push({ num: `${d}${d}${e}`, v: 2 * ds2[d] + ds2[e] });
    }
  group3.sort((x2, y2) => y2.v - x2.v);
  return { straight, group, group3 };
}
function digitCandidatePool(summary, limits = { straight: 12, group: 8, group3: 5 }) {
  const rank = rankDigitCandidates(summary);
  if (!rank) return { straight: [], group: [], group3: [] };
  return {
    straight: rank.straight.slice(0, limits.straight).map((x2) => x2.num),
    group: rank.group.slice(0, limits.group).map((x2) => x2.num),
    group3: rank.group3.slice(0, limits.group3).map((x2) => x2.num)
  };
}
var SYSTEM_PROMPT = `\u4F60\u662F\u300C\u7814\u5F69\u5BA4\u300D\u7684\u5F69\u7968\u6570\u636E\u5206\u6790\u52A9\u624B\uFF0C\u670D\u52A1\u5BF9\u8C61\u662F\u7814\u7A76\u8005\u672C\u4EBA\u3002\u4F60\u53EA\u505A\u4E24\u4EF6\u4E8B\uFF1A\u89E3\u8BFB\u6700\u8FD1 100 \u671F\u7684\u5386\u53F2\u7EDF\u8BA1\uFF0C\u4EE5\u53CA\u7ED3\u5408\u5E95\u5C42\u7B97\u6CD5\u7684\u5168\u76D8\u8BC4\u5206\u590D\u6838\u53F7\u7801\u5E76\u8BF4\u660E\u4F9D\u636E\u3002

\u3010\u94C1\u5F8B\u3011
1. \u53EA\u80FD\u4F7F\u7528\u7528\u6237\u6D88\u606F\u91CC\u7ED9\u51FA\u7684\u7EDF\u8BA1\u6570\u636E\uFF0C\u4E0D\u5F97\u7F16\u9020\u7EDF\u8BA1\u6570\u5B57\uFF0C\u4E0D\u5F97\u5F15\u5165\u5916\u90E8\u8D44\u6599\u3002
2. \u798F\u5F693D/\u6392\u5217\u4E09\u6BCF\u671F\u4ECE 000\u2013999 \u7B49\u6982\u7387\u4EA7\u751F\uFF0C\u76F4\u9009\u5355\u6CE8\u4E2D\u5956\u6982\u7387\u6052\u4E3A 1/1000\uFF0C\u7EC4\u516D\u7EA6 1/167\uFF0C\u4E0E\u4F60\u9009\u4EC0\u4E48\u53F7\u65E0\u5173\u3002\u5F00\u5956\u76F8\u4E92\u72EC\u7ACB\uFF0C\u4E0D\u5B58\u5728\u53EF\u5229\u7528\u7684\u300C\u89C4\u5F8B\u300D\u300C\u8D8B\u52BF\u300D\u300C\u5FC5\u51FA\u80C6\u7801\u300D\u3002
3. \u4F60\u4E0D\u5F97\u58F0\u79F0\u4EFB\u4F55\u7EC4\u5408\u66F4\u5BB9\u6613\u4E2D\u5956\uFF0C\u4E0D\u5F97\u627F\u8BFA\u547D\u4E2D\uFF0C\u4E0D\u5F97\u9F13\u52B1\u52A0\u5927\u6295\u5165\u6216\u8FFD\u53F7\u3002
4. \u9009\u53F7\u6D41\u7A0B\u56FA\u5B9A\u4E3A\u300C\u7B97\u6CD5\u5148\u9009\u3001AI \u7EC8\u9009\u300D\uFF1A\u7A0B\u5E8F\u5DF2\u6309\u9891\u7387/\u9057\u6F0F/\u540C\u4F4D\u8F6C\u79FB\u5BF9\u5168\u76D8\u6253\u5206\uFF08\u76F4\u9009 1000 \u6CE8\u3001\u7EC4\u516D 120 \u7EC4\u3001\u7EC4\u4E09 90 \u7EC4\uFF09\uFF0C\u5E76\u7ED9\u51FA\u7B97\u6CD5\u5019\u9009\u6C60\uFF08\u76F4\u9009 12 \u6CE8\u3001\u7EC4\u516D 8 \u7EC4\u3001\u7EC4\u4E09 5 \u7EC4\uFF09\u3002\u4F60\u5FC5\u987B\u53EA\u5728\u8FD9\u4E2A\u5019\u9009\u6C60\u5185\u7EC8\u9009\uFF0C\u4E0D\u5F97\u81EA\u521B\u6C60\u5916\u53F7\u7801\u3002
5. \u5FC5\u987B\u660E\u786E\u8BF4\u660E\uFF1A\u4EE5\u4E0B\u662F\u5386\u53F2\u5206\u5E03\u4E0B\u7684\u53C2\u8003\u7EC4\u5408\uFF0C\u4E0D\u6539\u53D8\u4E2D\u5956\u6982\u7387\uFF0C\u5F69\u7968\u671F\u671B\u56DE\u62A5\u4E3A\u8D1F\u3002

\u3010\u8F93\u51FA\u7ED3\u6784\u3011\uFF08\u7B80\u4F53\u4E2D\u6587\uFF0C\u7EAF\u6587\u672C\uFF0C\u4E0D\u8981 Markdown \u8868\u683C\uFF09
1. \u7ED3\u6784\u6982\u89C8\uFF1A\u8FD1 100 \u671F\u548C\u503C/\u8DE8\u5EA6\u533A\u95F4\u3001\u5947\u5076\u4E0E\u5927\u5C0F\u5206\u5E03\u3001\u5F62\u6001\uFF08\u8C79\u5B50/\u7EC4\u4E09/\u7EC4\u516D\uFF09\u4E0E\u91CD\u53F7\u6BD4\u4F8B
2. \u4F4D\u7F6E\u89C2\u5BDF\uFF1A\u767E/\u5341/\u4E2A\u4F4D\u7684\u9AD8\u9891\u4E0E\u9057\u6F0F\u60C5\u51B5\uFF0C\u4E00\u53E5\u8BDD\u5373\u53EF\uFF0C\u4E0D\u505A\u9884\u6D4B
3. \u7EC4\u5408\u53C2\u8003\uFF1A\u7ED9\u51FA 3 \u6CE8\u76F4\u9009\u30012 \u6CE8\u7EC4\u516D\u30011 \u6CE8\u7EC4\u4E09\uFF0C\u9010\u6CE8\u5199\u660E\u300C\u7B97\u6CD5\u6392\u540D + \u7ED3\u6784\u4F9D\u636E\u300D
4. \u98CE\u9669\u63D0\u793A\uFF1A\u9884\u7B97\u4E0A\u9650\u4E0E\u7406\u6027\u8D2D\u5F69\u63D0\u9192`;
function buildDigitMessages(summary, label = "\u6392\u5217\u4E09") {
  if (!summary) return null;
  const s = summary;
  const fmtPos = (name, p2) => `- ${name}\uFF1A\u8FD1100\u671F ${s.freq[p2].map((c, d) => `${d}:${c}`).join(" ")}\uFF1B\u8FD130\u671F ${s.freq30[p2].map((c, d) => `${d}:${c}`).join(" ")}\uFF1B\u5F53\u524D\u9057\u6F0F ${s.omit[p2].map((c, d) => `${d}:${c}`).join(" ")}\uFF1B\u503E\u5411\u6570\u5B57 ${s.topDigits[p2].join(
    "\u3001"
  )}`;
  const rank = rankDigitCandidates(s);
  const fmtAlgo = (arr, n) => (arr || []).slice(0, n).map((x2) => `${x2.num}(${x2.v.toFixed(2)})`).join(" ");
  const lines = [
    `${label} \u8FD1 ${s.total} \u671F\u7EDF\u8BA1\uFF08\u7A0B\u5E8F\u8BA1\u7B97\uFF0C\u771F\u5B9E\u6570\u636E\uFF09\uFF1A`,
    `- \u6700\u65B0\u4E00\u671F\uFF1A\u7B2C ${s.latest.id} \u671F\uFF0C\u5F00\u5956 ${s.latest.num.join(" ")}`,
    `- \u548C\u503C\uFF1A\u5747\u503C ${s.sum.avg}\uFF0C30%\u201370% \u5206\u4F4D ${s.sum.p30}\u2013${s.sum.p70}\uFF0C\u533A\u95F4 ${s.sum.min}\u2013${s.sum.max}`,
    `- \u8DE8\u5EA6\uFF1A\u5747\u503C ${s.span.avg}\uFF0C30%\u201370% \u5206\u4F4D ${s.span.p30}\u2013${s.span.p70}`,
    `- \u5947\u6570\u4E2A\u6570\u5206\u5E03\uFF080/1/2/3 \u4E2A\uFF09\uFF1A${s.oddDist.join(" / ")} \u671F`,
    `- \u5927\u6570(5\u20139)\u4E2A\u6570\u5206\u5E03\uFF1A${s.bigDist.join(" / ")} \u671F`,
    `- \u5F62\u6001\uFF1A\u8C79\u5B50 ${s.formDist.\u8C79\u5B50} \u671F\u3001\u7EC4\u4E09 ${s.formDist.\u7EC4\u4E09} \u671F\u3001\u7EC4\u516D ${s.formDist.\u7EC4\u516D} \u671F\uFF1B\u542B\u91CD\u53F7 ${s.repeatRate}%`,
    "\u4F4D\u7F6E\u5206\u5E03\uFF1A",
    fmtPos("\u767E\u4F4D", 0),
    fmtPos("\u5341\u4F4D", 1),
    fmtPos("\u4E2A\u4F4D", 2),
    "",
    "\u5E95\u5C42\u7B97\u6CD5\u5168\u76D8\u8BC4\u5206\uFF08\u9891\u738735% + \u8FD130\u671F30% + \u9057\u6F0F15% + \u540C\u4F4D\u8F6C\u79FB20%\uFF09\uFF0C\u5DF2\u4ECE\u5168\u76D8 1000/120/90 \u91CC\u9009\u51FA\u5019\u9009\u6C60\uFF1A",
    `- \u76F4\u9009\u5019\u9009\u6C60 12 \u6CE8\uFF1A${fmtAlgo(rank?.straight, 12)}`,
    `- \u7EC4\u516D\u5019\u9009\u6C60 8 \u7EC4\uFF1A${fmtAlgo(rank?.group, 8)}`,
    `- \u7EC4\u4E09\u5019\u9009\u6C60 5 \u7EC4\uFF1A${fmtAlgo(rank?.group3, 5)}`,
    "",
    "\u8BF7\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u7684\u7ED3\u6784\u8F93\u51FA\uFF1A\u4ECE\u4E0A\u9762\u7684\u5019\u9009\u6C60\u91CC\u7EC8\u9009 3 \u6CE8\u76F4\u9009 + 2 \u6CE8\u7EC4\u516D + 1 \u6CE8\u7EC4\u4E09\uFF0C\u4E0D\u5F97\u81EA\u521B\u6C60\u5916\u53F7\u7801\u3002"
  ];
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: lines.join("\n") }
  ];
}

// src/lib/kline.js
var INDICATOR_PRESETS = {
  short: { key: "short", label: "\u77ED\u5468\u671F", boll: 10, kdj: 5, macd: { fast: 6, slow: 13, signal: 5 } },
  standard: { key: "standard", label: "\u6807\u51C6", boll: 20, kdj: 9, macd: { fast: 12, slow: 26, signal: 9 } },
  long: { key: "long", label: "\u957F\u5468\u671F", boll: 30, kdj: 18, macd: { fast: 24, slow: 52, signal: 18 } }
};
var DEFAULT_PRESET = INDICATOR_PRESETS.standard;

// src/lib/fc3dPredict.js
var PRIMES = /* @__PURE__ */ new Set([1, 2, 3, 5, 7]);
var SMALL = /* @__PURE__ */ new Set([0, 1, 2]);
var MID = /* @__PURE__ */ new Set([3, 4, 5, 6]);
var BIG = /* @__PURE__ */ new Set([7, 8, 9]);
function analyzeDraw(num) {
  const [a2, b2, c] = num;
  const sum = a2 + b2 + c;
  const span = Math.max(a2, b2, c) - Math.min(a2, b2, c);
  const sumTail = sum % 10;
  const oddCount = [a2, b2, c].filter((d) => d % 2 === 1).length;
  const oddPattern = [a2, b2, c].map((d) => d % 2 === 1 ? "\u5947" : "\u5076").join("");
  const smallCount = [a2, b2, c].filter((d) => SMALL.has(d)).length;
  const midCount = [a2, b2, c].filter((d) => MID.has(d)).length;
  const bigCount = [a2, b2, c].filter((d) => BIG.has(d)).length;
  const primeCount = [a2, b2, c].filter((d) => PRIMES.has(d)).length;
  const unique = (/* @__PURE__ */ new Set([a2, b2, c])).size;
  let form = "\u7EC4\u516D";
  if (unique === 1) form = "\u8C79\u5B50";
  else if (unique === 2) form = "\u7EC4\u4E09";
  else if (unique === 3) {
    const sorted = [...num].sort((x2, y2) => x2 - y2);
    if (sorted[2] - sorted[0] === 2 && sorted[1] - sorted[0] === 1) form = "\u987A\u5B50";
  }
  return { sum, span, sumTail, oddCount, oddPattern, smallCount, midCount, bigCount, primeCount, form };
}
var ODD_DIGITS = /* @__PURE__ */ new Set([1, 3, 5, 7, 9]);
var MACRO_PROB = { \u5168\u5947: 0.125, \u5168\u5076: 0.125, \u4E24\u5947\u4E00\u5076: 0.375, \u4E24\u5076\u4E00\u5947: 0.375 };
var MACRO_PATTERN_COUNT = { \u5168\u5947: 1, \u5168\u5076: 1, \u4E24\u5947\u4E00\u5076: 3, \u4E24\u5076\u4E00\u5947: 3 };
function bitsOfNum(num) {
  return num.map((d) => ODD_DIGITS.has(d) ? 1 : 0);
}
function patternOfBits(bits) {
  return bits.map((b2) => b2 ? "\u5947" : "\u5076").join("");
}
function macroOfBits(bits) {
  const k = bits[0] + bits[1] + bits[2];
  return k === 3 ? "\u5168\u5947" : k === 0 ? "\u5168\u5076" : k === 2 ? "\u4E24\u5947\u4E00\u5076" : "\u4E24\u5076\u4E00\u5947";
}
var ALL_OE = [];
for (let m = 0; m < 8; m++) {
  const bits = [m >> 2 & 1, m >> 1 & 1, m & 1];
  ALL_OE.push({ bits, pattern: patternOfBits(bits), macro: macroOfBits(bits) });
}
function buildOddEven(draws, windowN = 50) {
  if (!draws.length) return null;
  const N2 = Math.min(windowN, draws.length);
  const recent = draws.slice(0, N2);
  const count = {};
  ALL_OE.forEach((p2) => count[p2.pattern] = 0);
  recent.forEach((d) => {
    count[patternOfBits(bitsOfNum(d.num))]++;
  });
  const omit = {};
  ALL_OE.forEach((p2) => omit[p2.pattern] = draws.length);
  for (let i = 0; i < draws.length; i++) {
    const p2 = patternOfBits(bitsOfNum(draws[i].num));
    if (omit[p2] === draws.length) omit[p2] = i;
  }
  const lastP = patternOfBits(bitsOfNum(draws[0].num));
  const prevP = draws[1] ? patternOfBits(bitsOfNum(draws[1].num)) : null;
  const perPos = [0, 1, 2].map((pos) => {
    const oddRecent = recent.filter((d) => ODD_DIGITS.has(d.num[pos])).length;
    const evenRecent = N2 - oddRecent;
    const firstOdd = ODD_DIGITS.has(draws[0].num[pos]);
    let streak = 0;
    for (let i = 0; i < draws.length; i++) {
      if (ODD_DIGITS.has(draws[i].num[pos]) === firstOdd) streak++;
      else break;
    }
    let recommendBit;
    let reason;
    if (firstOdd && streak >= 2) {
      recommendBit = 0;
      reason = `\u8FDE\u5947 ${streak} \u671F\uFF0C\u770B\u5076\u56DE\u8865`;
    } else if (!firstOdd && streak >= 2) {
      recommendBit = 1;
      reason = `\u8FDE\u5076 ${streak} \u671F\uFF0C\u770B\u5947\u56DE\u8865`;
    } else if (oddRecent > evenRecent) {
      recommendBit = 1;
      reason = `\u8FD1${N2}\u671F\u5947 ${oddRecent} \u6B21\u504F\u591A`;
    } else if (oddRecent < evenRecent) {
      recommendBit = 0;
      reason = `\u8FD1${N2}\u671F\u5076 ${evenRecent} \u6B21\u504F\u591A`;
    } else {
      recommendBit = firstOdd ? 0 : 1;
      reason = "\u5947\u5076\u5747\u8861\uFF0C\u770B\u53CD\u8F6C";
    }
    return {
      pos,
      label: ["\u767E", "\u5341", "\u4E2A"][pos],
      oddRecent,
      evenRecent,
      streak,
      current: firstOdd ? "\u5947" : "\u5076",
      recommendBit,
      recommend: recommendBit ? "\u5947" : "\u5076",
      reason
    };
  });
  const recBits = perPos.map((p2) => p2.recommendBit);
  const ranked = ALL_OE.map((p2) => {
    const cnt = count[p2.pattern] || 0;
    const om = omit[p2.pattern];
    let score = 0;
    score += cnt / Math.max(N2, 1) / (1 / 8) * 25;
    score += Math.min(om / 8, 4) / 4 * 40;
    let match = 0;
    for (let i = 0; i < 3; i++) if (p2.bits[i] === recBits[i]) match++;
    score += match / 3 * 25;
    if (p2.pattern === lastP) score -= 18;
    if (p2.pattern === prevP) score -= 8;
    return { ...p2, count: cnt, omit: om, score: Math.round(score * 10) / 10 };
  }).sort((a2, b2) => b2.score - a2.score);
  const macroKeys = ["\u4E24\u5947\u4E00\u5076", "\u4E24\u5076\u4E00\u5947", "\u5168\u5947", "\u5168\u5076"];
  const macroCount = {};
  macroKeys.forEach((k) => macroCount[k] = 0);
  recent.forEach((d) => {
    macroCount[macroOfBits(bitsOfNum(d.num))]++;
  });
  const macroOmit = {};
  macroKeys.forEach((k) => macroOmit[k] = draws.length);
  for (let i = 0; i < draws.length; i++) {
    const mk = macroOfBits(bitsOfNum(draws[i].num));
    if (macroOmit[mk] === draws.length) macroOmit[mk] = i;
  }
  const macroScoreSum = {};
  macroKeys.forEach((k) => macroScoreSum[k] = 0);
  ranked.forEach((p2) => macroScoreSum[p2.macro] += p2.score);
  const macroRanked = macroKeys.map((k) => ({
    macro: k,
    count: macroCount[k],
    prob: MACRO_PROB[k],
    cycle: +(1 / MACRO_PROB[k]).toFixed(2),
    omit: macroOmit[k],
    score: Math.round(macroScoreSum[k] / MACRO_PATTERN_COUNT[k] * 10) / 10
  })).sort((a2, b2) => b2.score - a2.score);
  return {
    recentN: N2,
    perPos,
    ranked,
    recommendedPatterns: ranked.slice(0, 3).map((p2) => p2.pattern),
    recommendedBits: ranked[0].bits,
    macro: macroRanked,
    recommendedMacro: macroRanked[0].macro,
    lastPattern: lastP
  };
}
var ROAD_DIGITS = [
  [0, 3, 6, 9],
  [1, 4, 7],
  [2, 5, 8]
];
var ROAD_NAME = ["0\u8DEF", "1\u8DEF", "2\u8DEF"];
var roadOf = (d) => d % 3;
var ALL_ROAD_PATTERNS = [];
for (let m = 0; m < 27; m++) {
  const roads = [Math.floor(m / 9), Math.floor(m / 3) % 3, m % 3];
  ALL_ROAD_PATTERNS.push({ roads, pattern: roads.join("") });
}
function build012(draws, windowN = 50) {
  if (!draws.length) return null;
  const N2 = Math.min(windowN, draws.length);
  const recent = draws.slice(0, N2);
  const roadCount = [0, 0, 0];
  recent.forEach((d) => d.num.forEach((n) => roadCount[roadOf(n)]++));
  const roadOmit = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    let omit = draws.length;
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num.some((n) => roadOf(n) === r)) {
        omit = i;
        break;
      }
    }
    roadOmit[r] = omit;
  }
  const totalOcc = roadCount.reduce((s, v2) => s + v2, 0) || 1;
  const roadScore = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    roadScore[r] = roadCount[r] / totalOcc * 60 + Math.min(roadOmit[r] / 3, 4) / 4 * 40;
  }
  const recommendedRoads = [0, 1, 2].sort((a2, b2) => roadScore[b2] - roadScore[a2]);
  const killedRoad = recommendedRoads[recommendedRoads.length - 1];
  const perPosRoad = [0, 1, 2].map((pos) => {
    const counts = [0, 0, 0];
    recent.forEach((d) => counts[roadOf(d.num[pos])]++);
    const current = roadOf(draws[0].num[pos]);
    let recommend = 0;
    if (counts[1] > counts[recommend]) recommend = 1;
    if (counts[2] > counts[recommend]) recommend = 2;
    return { pos, label: ["\u767E", "\u5341", "\u4E2A"][pos], counts, current, recommend };
  });
  const patCount = {};
  ALL_ROAD_PATTERNS.forEach((p2) => patCount[p2.pattern] = 0);
  recent.forEach((d) => {
    const p2 = d.num.map(roadOf).join("");
    if (patCount[p2] !== void 0) patCount[p2]++;
  });
  const patOmit = {};
  ALL_ROAD_PATTERNS.forEach((p2) => patOmit[p2.pattern] = draws.length);
  for (let i = 0; i < draws.length; i++) {
    const p2 = draws[i].num.map(roadOf).join("");
    if (patOmit[p2] === draws.length) patOmit[p2] = i;
  }
  const patRanked = ALL_ROAD_PATTERNS.map((p2) => {
    const cnt = patCount[p2.pattern] || 0;
    const om = patOmit[p2.pattern];
    const score = cnt / Math.max(N2, 1) / (1 / 27) * 50 + Math.min(om / 27, 4) / 4 * 50;
    return { ...p2, count: cnt, omit: om, score: Math.round(score * 10) / 10 };
  }).sort((a2, b2) => b2.score - a2.score);
  return {
    recentN: N2,
    roadDigits: ROAD_DIGITS,
    roadName: ROAD_NAME,
    roadCount,
    roadOmit,
    roadScore: roadScore.map((s) => Math.round(s * 10) / 10),
    recommendedRoads,
    killedRoad,
    perPosRoad,
    patRanked,
    recommendedPatterns: patRanked.slice(0, 3).map((p2) => p2.pattern)
  };
}
function buildRepeatNeighbor(draws, windowN = 50) {
  if (draws.length < 2) return null;
  const last = draws[0].num;
  const lastSet = new Set(last);
  const N2 = Math.min(windowN, draws.length - 1);
  const repeatCounts = [0, 0, 0, 0];
  let neighborHit = 0;
  for (let i = 0; i < N2; i++) {
    const cur = draws[i].num;
    const prev = draws[i + 1].num;
    const prevSet = new Set(prev);
    const repeats = cur.filter((d) => prevSet.has(d)).length;
    repeatCounts[repeats]++;
    const neigh = /* @__PURE__ */ new Set();
    prev.forEach((d) => {
      if (d > 0) neigh.add(d - 1);
      if (d < 9) neigh.add(d + 1);
    });
    const hasNeighbor = cur.some((d) => neigh.has(d) && !prevSet.has(d));
    if (hasNeighbor) neighborHit++;
  }
  const total = repeatCounts.reduce((s, v2) => s + v2, 0) || 1;
  const repeatDist = [0, 1, 2, 3].map((k) => ({
    k,
    count: repeatCounts[k],
    rate: +(repeatCounts[k] / total * 100).toFixed(0)
  }));
  const avgRepeat = +((repeatCounts[1] + repeatCounts[2] * 2 + repeatCounts[3] * 3) / total).toFixed(2);
  const neighSet = /* @__PURE__ */ new Set();
  last.forEach((d) => {
    if (d > 0) neighSet.add(d - 1);
    if (d < 9) neighSet.add(d + 1);
  });
  const neighborNums = [...neighSet].filter((d) => !lastSet.has(d)).sort((a2, b2) => a2 - b2);
  return {
    lastNums: last,
    repeatDist,
    avgRepeat,
    expectedRepeat: repeatCounts[1] >= repeatCounts[0] ? 1 : 0,
    repeatCandidates: [...last],
    neighborNums,
    neighborRate: +(neighborHit / total * 100).toFixed(0)
  };
}
function decayWeights(n, lambda = 0.03) {
  const w = [];
  for (let i = 0; i < n; i++) w.push(Math.exp(-lambda * i));
  const sum = w.reduce((s, v2) => s + v2, 0);
  return w.map((v2) => v2 / sum);
}
function weightedPosFreq(draws, pos, lambda = 0.03) {
  const freq = Array(10).fill(0);
  const w = decayWeights(draws.length, lambda);
  for (let i = 0; i < draws.length; i++) {
    freq[draws[i].num[pos]] += w[i];
  }
  return freq;
}
function transitionMatrix(draws, pos) {
  const M2 = Array.from({ length: 10 }, () => Array(10).fill(0));
  const rowSum = Array(10).fill(0);
  for (let i = 0; i < draws.length - 1; i++) {
    const prev = draws[i + 1].num[pos];
    const curr = draws[i].num[pos];
    M2[prev][curr]++;
    rowSum[prev]++;
  }
  for (let i = 0; i < 10; i++) {
    if (rowSum[i] === 0) {
      for (let j = 0; j < 10; j++) M2[i][j] = 0.1;
    } else {
      for (let j = 0; j < 10; j++) M2[i][j] /= rowSum[i];
    }
  }
  return M2;
}
function posOmission(draws, pos) {
  const omit = Array(10).fill(draws.length);
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num[pos] === d) {
        omit[d] = i;
        break;
      }
    }
  }
  return omit;
}
function meanStd(arr) {
  const m = arr.reduce((s, v3) => s + v3, 0) / arr.length;
  const v2 = arr.reduce((s, x2) => s + (x2 - m) ** 2, 0) / arr.length;
  return { mean: +m.toFixed(1), std: +Math.sqrt(v2).toFixed(1) };
}
function predictFC3Dv2(draws, { coverRate = 0.8 } = {}) {
  if (draws.length < 10) return null;
  const last = draws[0];
  const lastAnalysis = analyzeDraw(last.num);
  const recentN = Math.min(50, draws.length);
  const recentDraws = draws.slice(0, recentN);
  const omit = Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].num.includes(d)) break;
      omit[d]++;
    }
  }
  const road012 = build012(draws, 50);
  const topRoads = road012.recommendedRoads.slice(0, 2);
  const killRoad = road012.killedRoad;
  const repeatNeighbor = buildRepeatNeighbor(draws);
  const posScores = [];
  for (let pos = 0; pos < 3; pos++) {
    const freq = weightedPosFreq(recentDraws, pos, 0.03);
    const M2 = transitionMatrix(draws, pos);
    const omit2 = posOmission(draws, pos);
    const lastDigit = last.num[pos];
    const maxFreq = Math.max(...freq, 1e-3);
    const scores = Array(10).fill(0);
    for (let d = 0; d < 10; d++) {
      scores[d] += freq[d] / maxFreq * 40;
      const transProb = M2[lastDigit][d];
      const maxTrans = Math.max(...M2[lastDigit], 1e-3);
      scores[d] += transProb / maxTrans * 30;
      const omitBonus = Math.min(omit2[d], 20) / 20;
      scores[d] += omitBonus * 20;
      if (lastDigit !== d) scores[d] += 10;
    }
    posScores.push(scores);
  }
  const totalScores = Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    totalScores[d] = (posScores[0][d] + posScores[1][d] + posScores[2][d]) / 3;
    const r = d % 3;
    if (topRoads.includes(r)) totalScores[d] += 8;
    if (r === killRoad) totalScores[d] -= 6;
  }
  const ranked = totalScores.map((s, i) => ({ digit: i, score: Math.round(s * 100) / 100 })).sort((a2, b2) => b2.score - a2.score);
  const hot = ranked.slice(0, 3).map((r) => r.digit);
  const cold = ranked.slice(-3).map((r) => r.digit);
  const dan = ranked.slice(0, 2).map((r) => r.digit);
  const tuo = ranked.slice(2, 6).map((r) => r.digit);
  const posTop = posScores.map(
    (s) => s.map((v2, d) => ({ d, v: v2 })).sort((a2, b2) => b2.v - a2.v).slice(0, 2).map((x2) => x2.d)
  );
  const Z = { 0.7: 1.036, 0.75: 1.15, 0.8: 1.282, 0.85: 1.44, 0.9: 1.645 };
  const z = Z[coverRate] || Z[0.8];
  const sums = recentDraws.map((d) => analyzeDraw(d.num).sum);
  const spans = recentDraws.map((d) => analyzeDraw(d.num).span);
  const sumStat = meanStd(sums);
  const spanStat = meanStd(spans);
  const sumRange = [Math.max(0, Math.round(sumStat.mean - z * sumStat.std)), Math.min(27, Math.round(sumStat.mean + z * sumStat.std))];
  const spanRange = [Math.max(0, Math.round(spanStat.mean - z * spanStat.std)), Math.min(9, Math.round(spanStat.mean + z * spanStat.std))];
  const oddEven = buildOddEven(draws, 50);
  const oddCount = Math.min(8, Math.max(1, Math.ceil(coverRate * 8)));
  const recommendedOdd = oddEven.ranked.slice(0, oddCount).map((p2) => p2.pattern);
  const formDist = {};
  recentDraws.forEach((d) => {
    const a2 = analyzeDraw(d.num);
    formDist[a2.form] = (formDist[a2.form] || 0) + 1;
  });
  const recommendedForms = Object.entries(formDist).sort((a2, b2) => b2[1] - a2[1]).slice(0, 2).map(([f]) => f);
  const kill = ranked.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: omit[r.digit],
    reason: omit[r.digit] <= 1 ? "\u521A\u5F00\u51FA\uFF0C\u77ED\u671F\u91CD\u590D\u6982\u7387\u4F4E" : "\u7EFC\u5408\u8BC4\u5206\u57AB\u5E95\uFF0C\u53EF\u6392\u9664"
  }));
  return {
    drawCount: draws.length,
    lastDraw: last,
    lastAnalysis,
    hot,
    cold,
    dan,
    tuo,
    ranked,
    spanRange,
    spanAvg: spanStat.mean,
    sumRange,
    sumAvg: sumStat.mean,
    recommendedOdd,
    recommendedForms,
    coverRate,
    oddCount,
    oddEven,
    road012,
    repeatNeighbor,
    kill,
    omit,
    posTop,
    algorithm: "v2"
  };
}

// src/lib/pl3Predict.js
var CFG = {
  windows: [20, 60, 200],
  // 长窗权重更高：短窗噪声大，长窗对真实频率偏移更稳
  weights: { w20: 0.15, w60: 0.3, w200: 0.35, wMarkov: 0.2 },
  smooth: 1,
  coverSum: 0.8,
  coverSpan: 0.8,
  oddTop: 6
};
function posFreq(draws, pos, N2) {
  const arr = Array(10).fill(CFG.smooth);
  const n = Math.min(N2, draws.length);
  for (let i = 0; i < n; i++) arr[draws[i].num[pos]]++;
  const total = arr.reduce((a2, b2) => a2 + b2, 0);
  return arr.map((v2) => v2 / total);
}
function posMarkov(draws, pos, N2) {
  const freq = posFreq(draws, pos, N2);
  const M2 = Array.from({ length: 10 }, () => Array(10).fill(0));
  const n = Math.min(N2, draws.length);
  for (let i = 0; i < n - 1; i++) M2[draws[i + 1].num[pos]][draws[i].num[pos]]++;
  return M2.map((row) => {
    const s = row.reduce((a2, b2) => a2 + b2, 0);
    return row.map((v2, j) => (v2 + 2 * freq[j]) / (s + 2));
  });
}
function expertProbs(draws, pos) {
  const [n1, n2, n3] = CFG.windows;
  const f1 = posFreq(draws, pos, n1);
  const f2 = posFreq(draws, pos, n2);
  const f3 = posFreq(draws, pos, n3);
  const mk = posMarkov(draws, pos, n2);
  const last = draws[0].num[pos];
  const w = CFG.weights;
  return f1.map(
    (v2, d) => w.w20 * v2 + w.w60 * f2[d] + w.w200 * f3[d] + w.wMarkov * mk[last][d]
  );
}
function enumerateDistributions(probs) {
  const sumDist = Array(28).fill(0);
  const spanDist = Array(10).fill(0);
  const formDist = { \u8C79\u5B50: 0, \u7EC4\u4E09: 0, \u7EC4\u516D: 0 };
  const oddDist = {};
  const isOdd2 = (d) => d % 2 === 1;
  for (let a2 = 0; a2 < 10; a2++) {
    const pa2 = probs[0][a2];
    if (!pa2) continue;
    for (let b2 = 0; b2 < 10; b2++) {
      const pab = pa2 * probs[1][b2];
      if (!pab) continue;
      for (let c = 0; c < 10; c++) {
        const p2 = pab * probs[2][c];
        if (!p2) continue;
        const sum = a2 + b2 + c;
        const span = Math.max(a2, b2, c) - Math.min(a2, b2, c);
        sumDist[sum] += p2;
        spanDist[span] += p2;
        const uniq = (/* @__PURE__ */ new Set([a2, b2, c])).size;
        formDist[uniq === 1 ? "\u8C79\u5B50" : uniq === 2 ? "\u7EC4\u4E09" : "\u7EC4\u516D"] += p2;
        const pat = `${isOdd2(a2) ? "\u5947" : "\u5076"}${isOdd2(b2) ? "\u5947" : "\u5076"}${isOdd2(c) ? "\u5947" : "\u5076"}`;
        oddDist[pat] = (oddDist[pat] || 0) + p2;
      }
    }
  }
  return { sumDist, spanDist, formDist, oddDist };
}
function shortestInterval(dist, lo, hi2, target) {
  let best = null;
  for (let a2 = lo; a2 <= hi2; a2++) {
    let acc = 0;
    for (let b2 = a2; b2 <= hi2; b2++) {
      acc += dist[b2];
      if (acc >= target) {
        if (!best || b2 - a2 < best[1] - best[0]) best = [a2, b2];
        break;
      }
    }
  }
  return best || [lo, hi2];
}
function modeOf(arr) {
  const m = /* @__PURE__ */ new Map();
  let best = arr[0];
  let bestN = 0;
  for (const v2 of arr) {
    const n = (m.get(v2) || 0) + 1;
    m.set(v2, n);
    if (n > bestN) {
      bestN = n;
      best = v2;
    }
  }
  return best;
}
function buildTiers(rankedDigits) {
  return [6, 7, 8].map((k) => {
    const groupBets = k * (k - 1) * (k - 2) / 6;
    const directBets = k * k * k;
    return {
      cover: k,
      codes: rankedDigits.slice(0, k).map((x2) => x2.digit),
      expectHits: +(k * 0.3).toFixed(1),
      fullCoverRate: +((k / 10) ** 3 * 100).toFixed(1),
      // 3 个开奖号全落在覆盖内的概率
      groupBets,
      groupCost: groupBets * 2,
      directBets,
      directCost: directBets * 2,
      costPerHit: +(groupBets * 2 / (k * 0.3)).toFixed(1)
    };
  });
}
function predictFC3Dv22(draws, { cover = 6, coverRate = 0.8 } = {}) {
  const base = predictFC3Dv2(draws);
  if (!base) return null;
  if (draws.length < 10) return base;
  const posProb = [0, 1, 2].map((pos) => expertProbs(draws, pos));
  const { sumDist, spanDist, formDist, oddDist } = enumerateDistributions(posProb);
  const appearProb = Array.from(
    { length: 10 },
    (_, d) => 1 - posProb.reduce((acc, p2) => acc * (1 - p2[d]), 1)
  );
  const rankedDigits = appearProb.map((p2, d) => ({ digit: d, score: +(p2 * 100).toFixed(2) })).sort((a2, b2) => b2.score - a2.score);
  const dan = rankedDigits.slice(0, 2).map((x2) => x2.digit);
  const tuo = rankedDigits.slice(2, Math.max(6, cover)).map((x2) => x2.digit);
  const tiers = buildTiers(rankedDigits);
  const posTop = posProb.map(
    (p2) => p2.map((v2, d) => ({ d, v: v2 })).sort((a2, b2) => b2.v - a2.v).slice(0, 2).map((x2) => x2.d)
  );
  const baseScore = new Map(base.ranked.map((r) => [r.digit, r.score]));
  const maxBase = Math.max(...base.ranked.map((r) => r.score), 1);
  const ranked = rankedDigits.map((r) => ({
    digit: r.digit,
    score: +(r.score * 0.7 + baseScore.get(r.digit) / maxBase * 30).toFixed(2)
  })).sort((a2, b2) => b2.score - a2.score);
  const sumRange = shortestInterval(sumDist, 0, 27, coverRate);
  const spanRange = shortestInterval(spanDist, 0, 9, coverRate);
  const sums = draws.slice(0, 300).map((d) => analyzeDraw(d.num).sum);
  const spans = draws.slice(0, 300).map((d) => analyzeDraw(d.num).span);
  const oddCount = Math.min(8, Math.max(1, Math.ceil(coverRate * 8)));
  const recommendedOdd = Object.entries(oddDist).sort((a2, b2) => b2[1] - a2[1]).slice(0, oddCount).map(([pat]) => pat);
  const recommendedForms = Object.entries(formDist).sort((a2, b2) => b2[1] - a2[1]).slice(0, 2).map(([f]) => f);
  const hot = ranked.slice(0, 3).map((r) => r.digit);
  const cold = ranked.slice(-3).map((r) => r.digit);
  const kill = ranked.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: base.omit[r.digit],
    reason: base.omit[r.digit] <= 1 ? "\u521A\u5F00\u51FA\uFF0C\u77ED\u671F\u91CD\u590D\u6982\u7387\u4F4E" : "\u7EFC\u5408\u6982\u7387\u57AB\u5E95\uFF0C\u53EF\u6392\u9664"
  }));
  return {
    ...base,
    hot,
    cold,
    dan,
    tuo,
    ranked,
    posTop,
    sumRange,
    spanRange,
    sumAvg: +(sums.reduce((a2, b2) => a2 + b2, 0) / sums.length).toFixed(1),
    spanAvg: +(spans.reduce((a2, b2) => a2 + b2, 0) / spans.length).toFixed(1),
    sumMode: modeOf(sums),
    spanMode: modeOf(spans),
    recommendedOdd,
    recommendedForms,
    coverRate,
    oddCount,
    oddEven: { ...buildOddEven(draws, 50), ranked: base.oddEven.ranked, recommendedPatterns: recommendedOdd },
    kill,
    cover,
    tiers,
    algorithm: "pl3-v3"
  };
}
var PRO = {
  hedge: { lookback: 24, eta: 0.8, minWeight: 0.02 },
  gapBlend: 0.9,
  markov2Smooth: 3,
  structWindow: 120,
  structBlend: 0.2,
  // 近期分布 vs 长期分布的混合比例
  structBeta: 0.45,
  // 结构约束强度（0 = 关闭）
  topCombos: 10
};
function proNorm(arr) {
  const t = arr.reduce((a2, b2) => a2 + b2, 0) || 1;
  return arr.map((v2) => v2 / t);
}
function proFreq(draws, pos, N2, smooth = 1) {
  const arr = Array(10).fill(smooth);
  const n = Math.min(N2, draws.length);
  for (let i = 0; i < n; i++) arr[draws[i].num[pos]]++;
  return proNorm(arr);
}
function proMarkov1Next(draws, pos, N2) {
  const n = Math.min(N2, draws.length);
  const f = proFreq(draws, pos, N2);
  const cur = draws[0].num[pos];
  const row = Array(10).fill(0);
  for (let i = 0; i < n - 1; i++) {
    if (draws[i + 1].num[pos] === cur) row[draws[i].num[pos]]++;
  }
  return proNorm(row.map((v2, j) => v2 + 2 * f[j]));
}
function proMarkov2Next(draws, pos, N2) {
  const n = Math.min(N2, draws.length);
  if (n < 6) return proMarkov1Next(draws, pos, N2);
  const m1 = proMarkov1Next(draws, pos, N2);
  const cur = draws[0].num[pos];
  const prev = draws[1].num[pos];
  const row = Array(10).fill(0);
  for (let i = 0; i < n - 2; i++) {
    if (draws[i + 1].num[pos] === cur && draws[i + 2].num[pos] === prev) {
      row[draws[i].num[pos]]++;
    }
  }
  const k = PRO.markov2Smooth;
  return proNorm(row.map((v2, j) => v2 + k * m1[j]));
}
function proGap(draws, pos) {
  const omit = Array(10).fill(draws.length);
  for (let i = 0; i < draws.length; i++) {
    const v2 = draws[i].num[pos];
    if (omit[v2] === draws.length) omit[v2] = i;
  }
  const f = proFreq(draws, pos, draws.length);
  return proNorm(
    f.map((v2, d) => v2 * (1 + PRO.gapBlend * Math.tanh((omit[d] - 10) / 10)))
  );
}
function proRing(draws, pos) {
  const hist = Array(6).fill(1);
  for (let i = 0; i < draws.length - 1; i++) {
    const a2 = draws[i].num[pos];
    const b2 = draws[i + 1].num[pos];
    hist[Math.min(Math.abs(a2 - b2), 10 - Math.abs(a2 - b2))]++;
  }
  const total = hist.reduce((a2, b2) => a2 + b2, 0);
  const last = draws[0].num[pos];
  const dist = Array(10).fill(0);
  const ringCount = Array(6).fill(0);
  for (let d = 0; d < 10; d++) {
    const k = Math.min(Math.abs(d - last), 10 - Math.abs(d - last));
    dist[d] = k;
    ringCount[k]++;
  }
  return proNorm(dist.map((k) => hist[k] / total / ringCount[k]));
}
function proContrarian(draws, pos) {
  const f = proFreq(draws, pos, 60);
  return proNorm(f.map((v2) => Math.max(0.02, 0.1 + (0.1 - v2) * 1.5)));
}
var PRO_EXPERTS = [
  { key: "w20", name: "\u77ED\u7A97\u9891\u7387 20", fn: (d, p2) => proFreq(d, p2, 20) },
  { key: "w60", name: "\u4E2D\u7A97\u9891\u7387 60", fn: (d, p2) => proFreq(d, p2, 60) },
  { key: "w200", name: "\u957F\u7A97\u9891\u7387 200", fn: (d, p2) => proFreq(d, p2, 200) },
  { key: "w500", name: "\u8D85\u957F\u7A97 500", fn: (d, p2) => proFreq(d, p2, 500) },
  { key: "markov1", name: "\u4E00\u9636\u8F6C\u79FB", fn: (d, p2) => proMarkov1Next(d, p2, 200) },
  { key: "markov2", name: "\u4E8C\u9636\u8F6C\u79FB", fn: (d, p2) => proMarkov2Next(d, p2, 200) },
  { key: "gap", name: "\u9057\u6F0F\u56DE\u8865", fn: (d, p2) => proGap(d, p2) },
  { key: "ring", name: "\u5468\u671F\u90BB\u8DDD", fn: (d, p2) => proRing(d, p2) },
  { key: "contrarian", name: "\u51B7\u70ED\u53CD\u8F6C", fn: (d, p2) => proContrarian(d, p2) }
];
function proHedge(draws, pos) {
  const K = PRO_EXPERTS.length;
  const losses = Array(K).fill(0);
  const counts = Array(K).fill(0);
  let used = 0;
  for (let t = 1; t <= PRO.hedge.lookback; t++) {
    const hist = draws.slice(t);
    if (hist.length < 20) break;
    const actual = draws[t - 1].num[pos];
    for (let i = 0; i < K; i++) {
      const p2 = PRO_EXPERTS[i].fn(hist, pos);
      losses[i] += -Math.log(Math.min(0.999, Math.max(1e-4, p2[actual])));
      counts[i]++;
    }
    used++;
  }
  if (!used) return Array(K).fill(1 / K);
  const avg = losses.map((l, i) => counts[i] ? l / counts[i] : Math.log(10));
  const best = Math.max(...avg);
  const raw = avg.map((a2) => Math.exp(-PRO.hedge.eta * (a2 - best)));
  const sum = raw.reduce((a2, b2) => a2 + b2, 0);
  const w = raw.map((v2) => Math.max(PRO.hedge.minWeight, v2 / sum));
  const ws = w.reduce((a2, b2) => a2 + b2, 0);
  return w.map((v2) => v2 / ws);
}
function comboStruct(a2, b2, c, prev) {
  const sum = a2 + b2 + c;
  const span = Math.max(a2, b2, c) - Math.min(a2, b2, c);
  const uniq = (/* @__PURE__ */ new Set([a2, b2, c])).size;
  let rep = -1;
  if (prev) {
    const pool = [...prev];
    rep = 0;
    for (const d of [a2, b2, c]) {
      const i = pool.indexOf(d);
      if (i >= 0) {
        pool.splice(i, 1);
        rep++;
      }
    }
  }
  return {
    sum,
    span,
    form: uniq === 1 ? 0 : uniq === 2 ? 1 : 2,
    // 豹子 / 组三 / 组六
    odd: a2 % 2 + b2 % 2 + c % 2,
    tail: sum % 10,
    rep
  };
}
function structDist(draws, key, size) {
  const arr = Array(size).fill(1);
  let n = 0;
  for (let i = 0; i < draws.length; i++) {
    const prev = draws[i + 1] ? draws[i + 1].num : null;
    const s = comboStruct(draws[i].num[0], draws[i].num[1], draws[i].num[2], prev);
    if (s[key] < 0) continue;
    arr[s[key]]++;
    n++;
  }
  return arr.map((v2) => v2 / (n + size));
}
function buildStructModel(draws) {
  const recent = draws.slice(0, PRO.structWindow);
  const shape = [
    ["span", 10],
    ["sum", 28],
    ["form", 3],
    ["odd", 4],
    ["tail", 10],
    ["rep", 4]
  ];
  const model = {};
  for (const [key, size] of shape) {
    const a2 = structDist(recent, key, size);
    const b2 = structDist(draws, key, size);
    model[key] = a2.map((v2, i) => PRO.structBlend * v2 + (1 - PRO.structBlend) * b2[i]);
  }
  return model;
}
function structLogProb(s, model) {
  let v2 = Math.log(model.span[s.span]) + Math.log(model.sum[s.sum]);
  v2 += Math.log(model.form[s.form]) + Math.log(model.odd[s.odd]) + Math.log(model.tail[s.tail]);
  if (s.rep >= 0) v2 += Math.log(model.rep[s.rep]);
  return v2;
}
function predictPL3Pro(draws, { cover = 6, beta = PRO.structBeta, coverRate = 0.8 } = {}) {
  const base = predictFC3Dv2(draws);
  if (!base) return null;
  if (draws.length < 40) return predictFC3Dv22(draws, { cover });
  const weightsByPos = [0, 1, 2].map((pos) => proHedge(draws, pos));
  const posProb = [0, 1, 2].map((pos) => {
    const w = weightsByPos[pos];
    const probs = Array(10).fill(0);
    PRO_EXPERTS.forEach((e, i) => {
      const p2 = e.fn(draws, pos);
      for (let d = 0; d < 10; d++) probs[d] += w[i] * p2[d];
    });
    return proNorm(probs);
  });
  const model = buildStructModel(draws);
  const prevNums = draws[0] ? draws[0].num : null;
  const combos = [];
  for (let a2 = 0; a2 < 10; a2++) {
    for (let b2 = 0; b2 < 10; b2++) {
      for (let c = 0; c < 10; c++) {
        const p0 = posProb[0][a2] * posProb[1][b2] * posProb[2][c];
        const s = comboStruct(a2, b2, c, prevNums);
        combos.push({ a: a2, b: b2, c, p0, s, lp: structLogProb(s, model) });
      }
    }
  }
  const lps = combos.map((x2) => x2.lp);
  const meanLp = lps.reduce((x2, y2) => x2 + y2, 0) / lps.length;
  const sdLp = Math.sqrt(lps.reduce((s, v2) => s + (v2 - meanLp) ** 2, 0) / lps.length) || 1;
  for (const x2 of combos) {
    const z = Math.max(-3, Math.min(3, (x2.lp - meanLp) / sdLp));
    x2.mult = Math.exp(beta * z);
    x2.w = x2.p0 * x2.mult;
  }
  const totalW = combos.reduce((s, x2) => s + x2.w, 0) || 1;
  for (const x2 of combos) x2.p = x2.w / totalW;
  const sumDist = Array(28).fill(0);
  const spanDist = Array(10).fill(0);
  const formName = ["\u8C79\u5B50", "\u7EC4\u4E09", "\u7EC4\u516D"];
  const formDist = [0, 0, 0];
  const oddDist = {};
  const appear = Array(10).fill(0);
  const posMarg = [Array(10).fill(0), Array(10).fill(0), Array(10).fill(0)];
  for (const x2 of combos) {
    sumDist[x2.s.sum] += x2.p;
    spanDist[x2.s.span] += x2.p;
    formDist[x2.s.form] += x2.p;
    const pat = `${x2.a % 2 ? "\u5947" : "\u5076"}${x2.b % 2 ? "\u5947" : "\u5076"}${x2.c % 2 ? "\u5947" : "\u5076"}`;
    oddDist[pat] = (oddDist[pat] || 0) + x2.p;
    for (const d of /* @__PURE__ */ new Set([x2.a, x2.b, x2.c])) appear[d] += x2.p;
    posMarg[0][x2.a] += x2.p;
    posMarg[1][x2.b] += x2.p;
    posMarg[2][x2.c] += x2.p;
  }
  const rankedDigits = appear.map((p2, d) => ({ digit: d, score: +(p2 * 100).toFixed(2) })).sort((a2, b2) => b2.score - a2.score);
  const dan = rankedDigits.slice(0, 2).map((x2) => x2.digit);
  const tuo = rankedDigits.slice(2, Math.max(6, cover)).map((x2) => x2.digit);
  const tiers = buildTiers(rankedDigits);
  const posTop = posMarg.map(
    (p2) => p2.map((v2, d) => ({ d, v: v2 })).sort((a2, b2) => b2.v - a2.v).slice(0, 2).map((x2) => x2.d)
  );
  const baseScore = new Map(base.ranked.map((r) => [r.digit, r.score]));
  const maxBase = Math.max(...base.ranked.map((r) => r.score), 1);
  const ranked = rankedDigits.map((r) => ({
    digit: r.digit,
    score: +(r.score * 0.7 + baseScore.get(r.digit) / maxBase * 30).toFixed(2)
  })).sort((a2, b2) => b2.score - a2.score);
  const topCombos = [...combos].sort((x2, y2) => y2.p - x2.p).slice(0, PRO.topCombos).map((x2, i) => ({
    rank: i + 1,
    num: [x2.a, x2.b, x2.c],
    prob: +(x2.p * 100).toFixed(2),
    lift: +(x2.p / x2.p0).toFixed(2),
    sum: x2.s.sum,
    span: x2.s.span,
    form: formName[x2.s.form]
  }));
  const sumRange = shortestInterval(sumDist, 0, 27, coverRate);
  const spanRange = shortestInterval(spanDist, 0, 9, coverRate);
  const oddCount = Math.min(8, Math.max(1, Math.ceil(coverRate * 8)));
  const recommendedOdd = Object.entries(oddDist).sort((a2, b2) => b2[1] - a2[1]).slice(0, oddCount).map(([pat]) => pat);
  const recommendedForms = formDist.map((v2, i) => ({ name: formName[i], v: v2 })).sort((a2, b2) => b2.v - a2.v).slice(0, 2).map((x2) => x2.name);
  const sums = draws.slice(0, 300).map((d) => analyzeDraw(d.num).sum);
  const spans = draws.slice(0, 300).map((d) => analyzeDraw(d.num).span);
  const hot = ranked.slice(0, 3).map((r) => r.digit);
  const cold = ranked.slice(-3).map((r) => r.digit);
  const kill = rankedDigits.slice(-2).map((r) => ({
    digit: r.digit,
    score: r.score,
    omit: base.omit[r.digit],
    // 置信度 = 出现概率低于均匀 10% 的幅度
    confidence: +Math.max(0, (0.1 - r.score / 100) / 0.1 * 100).toFixed(0),
    reason: base.omit[r.digit] <= 1 ? "\u521A\u5F00\u51FA\uFF0C\u77ED\u671F\u91CD\u590D\u6982\u7387\u4F4E" : "\u7EFC\u5408\u6982\u7387\u57AB\u5E95\uFF0C\u53EF\u6392\u9664"
  }));
  const avgWeights = PRO_EXPERTS.map((e, i) => ({
    key: e.key,
    name: e.name,
    weight: +((weightsByPos[0][i] + weightsByPos[1][i] + weightsByPos[2][i]) / 3 * 100).toFixed(1)
  })).sort((a2, b2) => b2.weight - a2.weight);
  return {
    ...base,
    hot,
    cold,
    dan,
    tuo,
    ranked,
    posTop,
    sumRange,
    spanRange,
    sumAvg: +(sums.reduce((a2, b2) => a2 + b2, 0) / sums.length).toFixed(1),
    spanAvg: +(spans.reduce((a2, b2) => a2 + b2, 0) / spans.length).toFixed(1),
    sumMode: modeOf(sums),
    spanMode: modeOf(spans),
    recommendedOdd,
    recommendedForms,
    coverRate,
    oddCount,
    oddEven: { ...buildOddEven(draws, 50), ranked: base.oddEven.ranked, recommendedPatterns: recommendedOdd },
    kill,
    cover,
    tiers,
    topCombos,
    expertWeights: avgWeights,
    structBeta: beta,
    directPlan: {
      pos: posTop,
      bets: posTop.reduce((s, p2) => s * p2.length, 1),
      cost: posTop.reduce((s, p2) => s * p2.length, 1) * 2
    },
    algorithm: "pl3-pro"
  };
}

// src/lib/ssqPredict.js
var RED_MAX = 33;
var BLUE_MAX = 16;
var RED_PICK = 6;
var PRIMES2 = /* @__PURE__ */ new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);
var ZONE3 = [
  [1, 11],
  [12, 22],
  [23, 33]
];
var ZONE4 = [
  [1, 8],
  [9, 16],
  [17, 24],
  [25, 33]
];
var ZONE6 = [
  [1, 5],
  [6, 11],
  [12, 16],
  [17, 22],
  [23, 27],
  [28, 33]
];
var GOLDEN_OMIT = [1, 2, 3, 5, 8, 13, 21, 34];
var BLUE_GOLDEN = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
var BLUE_GOLDEN_POINT = [3, 6, 8, 10, 13];
var range2 = (a2, b2) => Array.from({ length: b2 - a2 + 1 }, (_, i) => a2 + i);
var RED_NUMS = range2(1, 33);
var BLUE_NUMS = range2(1, 16);
var inZone = (n, [a2, b2]) => n >= a2 && n <= b2;
var countIn = (arr, [a2, b2]) => arr.filter((n) => n >= a2 && n <= b2).length;
function consecutiveGroups(nums) {
  const groups = [];
  let cur = [nums[0]];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) cur.push(nums[i]);
    else {
      if (cur.length >= 2) groups.push(cur);
      cur = [nums[i]];
    }
  }
  if (cur.length >= 2) groups.push(cur);
  return groups;
}
function maxRun(nums, test) {
  let best = 0;
  let cur = 0;
  for (const n of nums) {
    if (test(n)) {
      cur++;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
}
function analyzeRed(red2) {
  const nums = [...red2].sort((a2, b2) => a2 - b2);
  const sum = nums.reduce((s, n) => s + n, 0);
  const span = nums[nums.length - 1] - nums[0];
  const diffs = /* @__PURE__ */ new Set();
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) diffs.add(nums[j] - nums[i]);
  }
  const gaps = [];
  for (let i = 1; i < nums.length; i++) gaps.push(nums[i] - nums[i - 1]);
  const odd = nums.filter((n) => n % 2 === 1).length;
  const big = nums.filter((n) => n >= 17).length;
  const prime = nums.filter((n) => PRIMES2.has(n)).length;
  const tails = nums.map((n) => n % 10);
  return {
    nums,
    sum,
    sumTail: sum % 10,
    span,
    ac: diffs.size - (nums.length - 1),
    odd,
    even: nums.length - odd,
    big,
    small: nums.length - big,
    prime,
    composite: nums.length - prime,
    zone3: ZONE3.map((z) => countIn(nums, z)),
    zone4: ZONE4.map((z) => countIn(nums, z)),
    zone6: ZONE6.map((z) => countIn(nums, z)),
    road012: [0, 1, 2].map((r) => nums.filter((n) => n % 3 === r).length),
    road4: [0, 1, 2, 3].map((r) => nums.filter((n) => n % 4 === r).length),
    road6: [0, 1, 2, 3, 4, 5].map((r) => nums.filter((n) => n % 6 === r).length),
    groups: consecutiveGroups(nums),
    maxConsecutive: consecutiveGroups(nums).reduce((m, g) => Math.max(m, g.length), 0),
    oddRun: maxRun(nums, (n) => n % 2 === 1),
    evenRun: maxRun(nums, (n) => n % 2 === 0),
    primeRun: maxRun(nums, (n) => PRIMES2.has(n)),
    gaps,
    maxGap: gaps.length ? Math.max(...gaps) : 0,
    minGap: gaps.length ? Math.min(...gaps) : 0,
    gapSum: gaps.reduce((s, g) => s + g, 0),
    tailSum: tails.reduce((s, t) => s + t, 0),
    tailGroups: new Set(tails).size,
    tails
  };
}
function analyzeDraw2(d) {
  return { ...analyzeRed(d.red), blue: d.blue, id: d.id, date: d.date };
}
function omitSeries(draws, pool, hitTest) {
  const rows = pool.map((n) => ({
    n,
    count: 0,
    curOmit: draws.length,
    maxOmit: 0,
    lastIssue: null,
    holds: []
  }));
  const byNum = new Map(rows.map((r) => [r.n, r]));
  for (let i = 0; i < draws.length; i++) {
    const d = draws[i];
    for (const n of pool) {
      if (hitTest(d, n)) {
        const r = byNum.get(n);
        r.count++;
        if (r.lastIssue === null) {
          r.lastIssue = d.id;
          r.curOmit = i;
        }
        r.holds.push(i);
      }
    }
  }
  for (const r of rows) {
    let prev = -1;
    let maxGap = r.curOmit;
    for (const idx of r.holds) {
      maxGap = Math.max(maxGap, idx - prev - 1);
      prev = idx;
    }
    r.maxOmit = Math.max(maxGap, r.curOmit);
    r.avgOmit = r.count ? +(draws.length / r.count).toFixed(2) : draws.length;
  }
  return rows;
}
function redStats(draws) {
  const rows = omitSeries(draws, RED_NUMS, (d, n) => d.red.includes(n));
  return rows.map((r) => {
    const level = r.curOmit <= 5 ? "\u70ED" : r.curOmit <= 10 ? "\u6E29" : "\u51B7";
    return {
      ...r,
      level,
      golden: GOLDEN_OMIT.includes(r.curOmit),
      // 底部信号：接近历史最大遗漏
      bottom: r.maxOmit > 0 && r.curOmit / r.maxOmit >= 0.85,
      // 反转信号：当前遗漏小于平均遗漏（由冷转热）
      reverse: r.avgOmit > 0 && r.curOmit > 0 && r.curOmit <= r.avgOmit * 0.6,
      death: r.curOmit >= 20
    };
  });
}
function blueStats(draws) {
  const rows = omitSeries(draws, BLUE_NUMS, (d, n) => d.blue === n);
  return rows.map((r) => {
    const period = r.count ? +(draws.length / r.count).toFixed(2) : Infinity;
    const level = period < 14 ? "\u70ED" : period <= 18 ? "\u6E29" : "\u51B7";
    return {
      ...r,
      period,
      level,
      golden: BLUE_GOLDEN.includes(r.curOmit),
      goldenPoint: BLUE_GOLDEN_POINT.includes(r.n),
      // 目前遗漏超过历史最大遗漏：开出后必须跟进（书中实例）
      beyondMax: r.curOmit > r.maxOmit
    };
  });
}
var CFG2 = {
  // 红球分数权重（一层法 + 二层法 + 三分法）
  wFreq10: 0.3,
  wFreq30: 0.25,
  wFreq100: 0.15,
  wOmit: 0.12,
  wRecent5: 0.1,
  wRepeat: 0.06,
  wNeighbor: 0.04,
  // 候选池大小（组合枚举 C(12,6)=924，浏览器里也能秒算）
  candidates: 12
};
function freqScore(draws, n, window2) {
  const sample = draws.slice(0, Math.min(window2, draws.length));
  if (!sample.length) return 0;
  const count = sample.filter((d) => d.red.includes(n)).length;
  const expect = sample.length * RED_PICK / RED_MAX;
  return expect > 0 ? count / expect : 0;
}
function scoreRed(draws, stats) {
  const last = draws[0];
  const prev = draws[1];
  const prevSet = new Set(prev ? prev.red : []);
  const neighborSet = /* @__PURE__ */ new Set();
  for (const n of prevSet) {
    if (n - 1 >= 1) neighborSet.add(n - 1);
    if (n + 1 <= RED_MAX) neighborSet.add(n + 1);
  }
  const pool = /* @__PURE__ */ new Set();
  for (const d of draws.slice(0, 5)) for (const n of d.red) pool.add(n);
  return stats.map((s) => {
    const freq = CFG2.wFreq10 * freqScore(draws, s.n, 10) + CFG2.wFreq30 * freqScore(draws, s.n, 30) + CFG2.wFreq100 * freqScore(draws, s.n, 100);
    const ratio = s.avgOmit > 0 ? Math.min(s.curOmit / s.avgOmit, 3) : 1;
    const omitScore = CFG2.wOmit * (1 - Math.abs(ratio - 1) / 2);
    const recent5 = pool.has(s.n) ? CFG2.wRecent5 : 0;
    const repeat = prevSet.has(s.n) ? CFG2.wRepeat : 0;
    const neighbor = neighborSet.has(s.n) ? CFG2.wNeighbor : 0;
    return {
      ...s,
      score: +(freq + omitScore + recent5 + repeat + neighbor).toFixed(4),
      parts: { freq: +freq.toFixed(3), omit: +omitScore.toFixed(3), recent5: !!recent5, repeat: !!repeat, neighbor: !!neighbor }
    };
  });
}
function structureScore(c) {
  let s = 0;
  const d = (v2) => Math.abs(v2);
  s -= d(c.sum - 102) / 25;
  if (c.span >= 24 && c.span <= 29) s += 0.8;
  else s -= Math.min(d(c.span - 26.5) / 6, 1);
  s -= c.zone3.reduce((acc, v2) => acc + d(v2 - 2), 0) * 0.7;
  s -= d(c.big - 3) * 0.55;
  s -= d(c.odd - 3) * 0.55;
  if (c.prime === 2 || c.prime === 3) s += 0.5;
  else s -= 0.4;
  s -= c.road012.filter((v2) => v2 === 0).length * 0.45;
  s -= d(c.road012[0] - 2) * 0.2 + d(c.road012[1] - 2) * 0.2 + d(c.road012[2] - 2) * 0.2;
  if (c.groups.length > 1) s -= (c.groups.length - 1) * 0.6;
  s -= d(c.tailGroups - 5) * 0.35;
  s -= d(c.tailSum - 27) / 20;
  return s;
}
function scoreBlue(draws, stats) {
  const lastBlue = draws[0]?.blue;
  const seq = draws.slice(0, 12).map((d) => d.blue);
  const freqMap = /* @__PURE__ */ new Map();
  for (const b2 of seq) freqMap.set(b2, (freqMap.get(b2) || 0) + 1);
  return stats.map((s) => {
    let score = 0;
    if (Number.isFinite(s.period)) score += (16 - Math.min(s.period, 32)) / 16;
    const ratio = s.avgOmit > 0 ? Math.min(s.curOmit / s.avgOmit, 3) : 1;
    score += 0.5 * (1 - Math.abs(ratio - 1) / 2);
    if (s.golden) score += 0.35;
    if (s.goldenPoint) score += 0.25;
    if (lastBlue) {
      const diff = Math.abs(s.n - lastBlue);
      if (diff >= 1 && diff <= 3) score += 0.4;
      const loop = Math.min(diff, BLUE_MAX - diff);
      if (loop >= 1 && loop <= 2) score += 0.3;
    }
    score -= (freqMap.get(s.n) || 0) * 0.08;
    return { ...s, score: +score.toFixed(4) };
  });
}
function bestCombination(cands) {
  const n = cands.length;
  let best = null;
  const idx = [];
  const walk = (start) => {
    if (idx.length === RED_PICK) {
      const red2 = idx.map((i) => cands[i].n).sort((a2, b2) => a2 - b2);
      const c = analyzeRed(red2);
      const indiv = idx.reduce((s, i) => s + cands[i].score, 0);
      const total = indiv + structureScore(c);
      if (!best || total > best.total) best = { red: red2, total, indiv, structure: c, picked: idx.map((i) => cands[i]) };
      return;
    }
    for (let i = start; i < n; i++) {
      idx.push(i);
      walk(i + 1);
      idx.pop();
    }
  };
  walk(0);
  return best;
}
function predictSSQ(draws, { cover = 6 } = {}) {
  if (!Array.isArray(draws) || draws.length < 12) return null;
  const rStats = redStats(draws);
  const scored = scoreRed(draws, rStats).sort((a2, b2) => b2.score - a2.score);
  const cands = [];
  for (const z of ZONE3) {
    const inZ = scored.filter((s) => inZone(s.n, z));
    for (const s of inZ.slice(0, 4)) if (!cands.includes(s)) cands.push(s);
  }
  for (const s of scored) {
    if (cands.length >= CFG2.candidates) break;
    if (!cands.includes(s)) cands.push(s);
  }
  const pool = cands.slice(0, CFG2.candidates).sort((a2, b2) => b2.score - a2.score).slice(0, 12);
  const combo = bestCombination(pool);
  if (!combo) return null;
  const bStats = blueStats(draws);
  const blues = scoreBlue(draws, bStats).sort((a2, b2) => b2.score - a2.score);
  const ranked = scored.map((s) => ({ n: s.n, score: s.score, level: s.level, omit: s.curOmit }));
  const kill = [...ranked].sort((a2, b2) => a2.score - b2.score).slice(0, 5).map((x2) => x2.n);
  const tiers = [6, 7, 8, 9, 10].map((k) => {
    const bets = combinationCount(k, 6);
    return {
      cover: k,
      codes: ranked.slice(0, k).map((x2) => x2.n),
      expectHits: +(k * RED_PICK / RED_MAX).toFixed(2),
      fullHitRate: +(fullHitRate(k) * 100).toFixed(2),
      bets,
      cost: bets * 2
    };
  });
  return {
    red: combo.red,
    blue: blues[0].n,
    blueBackups: blues.slice(1, 4).map((b2) => b2.n),
    structure: combo.structure,
    ranked,
    candidates: scored.slice(0, 16),
    kill,
    blues: blues.slice(0, 8),
    tiers,
    cover,
    blueParts: blues[0],
    analysis: analyzeDraw2(draws[0])
  };
}
function combinationCount(n, k) {
  if (k > n) return 0;
  let v2 = 1;
  for (let i = 0; i < k; i++) v2 = v2 * (n - i) / (i + 1);
  return Math.round(v2);
}
function fullHitRate(k) {
  return combinationCount(k, 6) / combinationCount(RED_MAX, 6);
}

// api/_lib/http.js
function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

// api/daily-push.js
var CONFIG_KEY = "daily_push_config";
var STATUS_KEY = "daily_push_last";
var HISTORY_KEY = "daily_push_history";
var FRESH_RETRY_MS = 1500;
var DIGIT_SCHEMA = 5;
var KL8_SCHEMA = 3;
var AI_TIMEOUT_MS = 38e3;
var shDate = (d = /* @__PURE__ */ new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
function freshness(latest, maxAgeDays = 1) {
  const expected = shDate(new Date(Date.now() - 864e5 * maxAgeDays));
  const date = latest?.date || null;
  if (!date) return { state: "unknown", expected, date: null, id: latest?.id ?? null };
  return {
    state: date >= expected ? "ok" : "stale",
    expected,
    date,
    id: latest?.id ?? null
  };
}
var staleWarning = (f, name) => f && f.state === "stale" ? line(
  `<font color='red'>\u26A0\uFE0F ${name}\u6570\u636E\u6E90\u8FD8\u6CA1\u66F4\u65B0\uFF1A\u6700\u65B0\u53EA\u5230 ${f.date}\uFF08\u7B2C ${f.id} \u671F\uFF09\uFF0C\u672C\u671F\u63A8\u8350\u57FA\u4E8E\u65E7\u6570\u636E\uFF0C\u7A0D\u540E\u53EF\u624B\u52A8\u91CD\u53D1</font>`
) : null;
async function savePushStatus(status) {
  if (!process.env.DATABASE_URL) return;
  try {
    await writeConfig(getSql(), STATUS_KEY, JSON.stringify(status));
  } catch (e) {
    console.error("[daily-push] \u8BB0\u5F55\u63A8\u9001\u72B6\u6001\u5931\u8D25\uFF1A", e.message);
  }
}
async function loadConfig() {
  let cfg = {};
  if (process.env.DATABASE_URL) {
    try {
      const sql = getSql();
      const raw = await readConfig(sql, CONFIG_KEY);
      if (raw) cfg = JSON.parse(raw) || {};
    } catch (e) {
      console.error("[daily-push] \u8BFB\u53D6\u63A8\u9001\u914D\u7F6E\u5931\u8D25\uFF1A", e.message);
    }
  }
  return {
    webhook: cfg.webhook || process.env.FEISHU_WEBHOOK_URL || "",
    secret: cfg.secret || process.env.FEISHU_WEBHOOK_SECRET || "",
    kl8: cfg.kl8 !== false,
    fc3d: cfg.fc3d !== false,
    pl3: cfg.pl3 !== false,
    ssq: cfg.ssq !== false
  };
}
function buildKl8(draws) {
  const history = draws.slice(0, 200);
  const nextId = history[0].id + 1;
  const v7 = v7Recommend(history, { play: 10, nextId });
  const { scores } = scoreBalls(history, { periods: 100, halfLife: 20, hotMode: "mix" });
  const ranked = Array.from({ length: BALL_MAX }, (_, i) => i + 1).map((n) => ({ n, score: scores[n] })).sort((a2, b2) => b2.score - a2.score);
  const picks = (v7?.picks?.length === 10 ? [...v7.picks] : pickBalanced(ranked, 10).map((x2) => x2.n)).sort(
    (a2, b2) => a2 - b2
  );
  const groups = [0, 3, 6].map(
    (off) => pickBalanced(ranked.slice(off), 10).map((x2) => x2.n).sort((a2, b2) => a2 - b2)
  );
  return { latest: history[0], nextId, v7, picks, groups };
}
var pad = (n) => String(n).padStart(2, "0");
function buildFc3d(draws) {
  const p2 = predictFC3Dv2(draws);
  if (!p2) return null;
  return { latest: draws[0], pred: p2 };
}
function buildPl3(draws) {
  const p2 = predictPL3Pro(draws);
  if (!p2) return null;
  return { latest: draws[0], pred: p2 };
}
function buildSsq(draws) {
  const p2 = predictSSQ(draws);
  if (!p2) return null;
  return { latest: draws[0], pred: p2 };
}
function extractJson(text) {
  const raw = String(text || "");
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = body.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
  }
  try {
    return JSON.parse(slice.replace(/(?<![\d."'\-])0+(\d+)/g, "$1"));
  } catch {
    return null;
  }
}
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`AI \u8C03\u7528\u8D85\u8FC7 ${Math.round(ms / 1e3)} \u79D2`)), ms);
    })
  ]);
}
function balancedFromPool(pool, n) {
  const bandOf = (x2) => Math.min(3, Math.floor((x2 - 1) / 20));
  const bandLimit = Math.max(2, Math.ceil(n / 4) + 1);
  const oddLimit = Math.ceil(n / 2) + 1;
  const ordered = [...pool].sort((a2, b2) => b2.score - a2.score);
  const picked = [];
  const band = [0, 0, 0, 0];
  let odd = 0;
  const push = (x2, strict) => {
    if (picked.includes(x2.n)) return false;
    const b2 = bandOf(x2.n);
    if (strict && band[b2] >= bandLimit) return false;
    if (strict && (x2.n % 2 === 1 ? odd >= oddLimit : picked.length - odd >= oddLimit)) return false;
    picked.push(x2.n);
    band[b2]++;
    if (x2.n % 2 === 1) odd++;
    return true;
  };
  for (const x2 of ordered) {
    if (picked.length >= n) break;
    push(x2, true);
  }
  for (const x2 of ordered) {
    if (picked.length >= n) break;
    push(x2, false);
  }
  return picked.sort((a2, b2) => a2 - b2);
}
async function buildDigitAi({ game, label, draws, sql, llm }) {
  const drawId = Number(draws?.[0]?.id);
  const summary = summarizeDigit(draws, 100);
  if (!drawId || !summary) return null;
  const pool = digitCandidatePool(summary);
  if (!pool.straight.length || !pool.group.length || !pool.group3.length) return null;
  const algoTop = {
    straight: pool.straight.slice(0, 3),
    group: pool.group.slice(0, 2),
    group3: pool.group3.slice(0, 1)
  };
  const base = { drawId, pool, algoTop, picks: algoTop, source: "algo", note: "", summary: "", cached: false };
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM digit_ai_runs
        WHERE game = ${game} AND draw_id = ${drawId} AND status = 'done'`;
      const r = rows[0]?.result;
      if (r && r.schema === DIGIT_SCHEMA && r.picks?.straight?.length === 3) {
        return {
          ...base,
          picks: {
            straight: r.picks.straight,
            group: r.picks.group || [],
            group3: r.picks.group3 || []
          },
          source: r.finalSource === "algo" ? "algo" : "ai",
          note: r.finalNote || "",
          summary: r.picks.summary || "",
          cached: true
        };
      }
    } catch {
    }
  }
  try {
    const [sys, user] = buildDigitMessages(summary, label);
    const messages = [
      sys,
      {
        role: "user",
        content: `${user.content}

\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\u6587\u5B57\u3001\u4E0D\u8981\u4EE3\u7801\u5757\u56F4\u680F\uFF1A{"straight":["123","456","789"],"group":["135","246"],"group3":["112"],"reasons":{"123":"\u4E00\u53E5\u8BDD\u4F9D\u636E"},"summary":"60 \u5B57\u5185","risk":"\u4E00\u53E5\u98CE\u9669\u63D0\u793A"}\u3002straight \u5FC5\u987B\u6B63\u597D 3 \u4E2A\u3001group \u6B63\u597D 2 \u4E2A\u3001group3 \u6B63\u597D 1 \u4E2A\uFF0C\u4E14\u90FD\u53EA\u80FD\u6765\u81EA\u4E0A\u9762\u7ED9\u51FA\u7684\u5019\u9009\u6C60\u3002`
      }
    ];
    const raw = await withTimeout(
      callAi(llm, messages, { maxTokens: 900, temperature: 0.3 }),
      AI_TIMEOUT_MS
    );
    const obj = extractJson(raw);
    const take = (arr, max) => [...new Set((Array.isArray(arr) ? arr : []).map((x2) => String(x2).replace(/\D/g, "")))].filter((n) => n.length === 3).slice(0, max);
    const straight = pickInPool(take(obj?.straight, 12), pool.straight, 3);
    const group = pickInPool(take(obj?.group, 8), pool.group, 2);
    const group3 = pickInPool(take(obj?.group3, 5), pool.group3, 1);
    if (straight.length === 3 && group.length === 2 && group3.length === 1) {
      return {
        ...base,
        picks: { straight, group, group3 },
        source: "ai",
        note: "AI \u5DF2\u5728\u7B97\u6CD5\u5019\u9009\u6C60\u5185\u5B8C\u6210\u7EC8\u9009",
        summary: String(obj?.summary || "").slice(0, 200)
      };
    }
    return { ...base, note: "AI \u7EC8\u9009\u672A\u5168\u90E8\u843D\u5728\u5019\u9009\u6C60\u5185\uFF0C\u5DF2\u56DE\u9000\u7B97\u6CD5\u524D\u4E09" };
  } catch (e) {
    return { ...base, note: `AI \u7EC8\u9009\u5931\u8D25\uFF08${e.message || e}\uFF09\uFF0C\u5DF2\u56DE\u9000\u7B97\u6CD5\u524D\u4E09` };
  }
}
function pickInPool(list, pool, max) {
  return [...new Set(list)].filter((n) => pool.includes(n)).slice(0, max);
}
async function buildKl8Ai({ draws, built, sql, llm }) {
  if (!built?.v7) return null;
  const history = draws.slice(0, 200);
  const nextId = built.nextId;
  const algoTen = [...built.picks];
  const wide = balancedFromPool(built.v7.pool, 20);
  const base = { nextId, wide, ten: algoTen, source: "algo", note: "", summary: "", cached: false };
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM kl8_ai_deep_runs
        WHERE draw_id = ${nextId} AND play = 10 AND status = 'done'`;
      const r = rows[0]?.result;
      if (r && r.schema === KL8_SCHEMA && Array.isArray(r.final10) && r.final10.length === 10) {
        return {
          ...base,
          ten: [...r.final10].sort((a2, b2) => a2 - b2),
          source: r.final10Source === "algo" ? "algo" : "ai",
          note: r.final10Note || "",
          cached: true
        };
      }
    } catch {
    }
  }
  try {
    const messages = [
      {
        role: "system",
        content: "\u4F60\u662F\u5FEB\u4E508\uFF0880 \u9009 20\uFF09\u6570\u636E\u5206\u6790\u52A9\u624B\u3002\u6BCF\u4E2A\u53F7\u7801\u6BCF\u671F\u51FA\u73B0\u6982\u7387\u6052\u4E3A 25%\uFF0C\u5F00\u5956\u72EC\u7ACB\u968F\u673A\uFF0C\u4E0D\u5F97\u58F0\u79F0\u53D1\u73B0\u89C4\u5F8B\u3001\u4E0D\u5F97\u627F\u8BFA\u4E2D\u5956\u3002\u53EA\u8F93\u51FA JSON\u3002"
      },
      {
        role: "user",
        content: [
          `\u76EE\u6807\uFF1A\u7B2C ${nextId} \u671F\uFF0C\u73A9\u6CD5\u300C\u9009\u5341\u300D\uFF0C\u7ED9\u51FA 10 \u4E2A\u53F7\u7801\u3002`,
          "",
          `\u6700\u8FD1 5 \u671F\u5F00\u5956\uFF1A`,
          ...history.slice(0, 5).map((d) => `\u7B2C${d.id}\u671F\uFF1A${d.nums.map(pad).join(" ")}`),
          "",
          `\u7B97\u6CD5\u5019\u9009 20 \u7801\uFF08\u6309\u5E95\u5C42\u8BC4\u5206\u6392\u5E8F\uFF09\uFF1A${wide.map(pad).join(" ")}`,
          "",
          '\u8BF7\u4ECE\u4E0A\u9762 20 \u4E2A\u5019\u9009\u91CC\u7EC8\u9009\u6B63\u597D 10 \u4E2A\uFF08\u53EF\u4EE5\u653E\u5F03\u6392\u540D\u9760\u540E\u7684\u53F7\uFF09\uFF0C\u5E76\u7ED9\u6BCF\u4E2A\u53F7\u4E00\u53E5\u8BDD\u7406\u7531\u3002\u53EA\u8F93\u51FA JSON\uFF1A{"picks":[\u53F7\u7801 x10],"reasons":{"01":"\u4E00\u53E5\u8BDD"},"summary":"60 \u5B57\u5185"}\u3002'
        ].join("\n")
      }
    ];
    const raw = await withTimeout(
      callAi(llm, messages, { maxTokens: 700, temperature: 0.3 }),
      AI_TIMEOUT_MS
    );
    const obj = extractJson(raw);
    const picked = [
      ...new Set((Array.isArray(obj?.picks) ? obj.picks : []).map(Number).filter(Number.isInteger))
    ].filter((n) => wide.includes(n));
    if (picked.length === 10) {
      return {
        ...base,
        ten: picked.sort((a2, b2) => a2 - b2),
        source: "ai",
        note: "\u7B97\u6CD5 20 \u7801 \u2192 AI \u7EC8\u5BA1\u5B8C\u6210",
        summary: String(obj?.summary || "").slice(0, 200)
      };
    }
    return { ...base, note: "AI \u7EC8\u5BA1\u7ED9\u51FA\u7684\u6709\u6548\u53F7\u7801\u4E0D\u8DB3 10 \u4E2A\uFF0C\u5DF2\u56DE\u9000\u7B97\u6CD5\u878D\u5408\u7ED3\u679C" };
  } catch (e) {
    return { ...base, note: `AI \u7EC8\u5BA1\u5931\u8D25\uFF08${e.message || e}\uFF09\uFF0C\u5DF2\u56DE\u9000\u7B97\u6CD5\u878D\u5408\u7ED3\u679C` };
  }
}
async function loadHistory() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const raw = await readConfig(getSql(), HISTORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function saveHistory(history) {
  if (!process.env.DATABASE_URL) return;
  try {
    await writeConfig(getSql(), HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("[daily-push] \u8BB0\u5F55\u4E0A\u671F\u63A8\u9001\u5931\u8D25\uFF1A", e.message);
  }
}
function digitHitOf(picks, num) {
  const actual = (num || []).join("");
  if (actual.length !== 3) return null;
  const key = [...actual].sort().join("");
  const uniq = new Set(actual).size;
  const hit = (list, test) => Array.isArray(list) ? list.filter(test).length : 0;
  return {
    actual,
    straight: hit(picks?.straight, (n) => n === actual),
    group: uniq === 3 ? hit(picks?.group, (n) => [...n].sort().join("") === key) : 0,
    group3: uniq === 2 ? hit(picks?.group3, (n) => [...n].sort().join("") === key) : 0
  };
}
function kl8AlgoPrev(draws) {
  const latest = draws?.[0];
  const hist = draws?.slice(1) || [];
  if (!latest || hist.length < 20) return null;
  const v7 = v7Recommend(hist, { play: 10, nextId: latest.id });
  if (!v7) return null;
  const drawn = new Set(latest.nums);
  return { drawId: Number(latest.id), picks: v7.picks, hits: v7.picks.filter((n) => drawn.has(n)).length };
}
function digitAlgoPrev(draws) {
  const latest = draws?.[0];
  const hist = draws?.slice(1) || [];
  if (!latest || hist.length < 10) return null;
  const summary = summarizeDigit(hist, 100);
  const pool = summary ? digitCandidatePool(summary) : null;
  if (!pool?.straight.length) return null;
  const picks = {
    straight: pool.straight.slice(0, 3),
    group: pool.group.slice(0, 2),
    group3: pool.group3.slice(0, 1)
  };
  const h2 = digitHitOf(picks, latest.num);
  return h2 ? { drawId: Number(latest.id), ...h2 } : null;
}
function ssqAlgoPrev(draws) {
  const latest = draws?.[0];
  const hist = draws?.slice(1) || [];
  if (!latest || hist.length < 10) return null;
  const p2 = predictSSQ(hist);
  if (!p2) return null;
  return {
    drawId: Number(latest.id),
    red: p2.red.filter((n) => latest.red.includes(n)).length,
    blue: p2.blue === latest.blue
  };
}
async function kl8AiPrev(sql, draws, prev) {
  const latest = draws?.[0];
  if (!latest) return null;
  if (sql) {
    try {
      const rows = await sql`
        SELECT result FROM kl8_ai_deep_runs
        WHERE draw_id = ${Number(latest.id)} AND play = 10 AND status = 'done'`;
      const r = rows[0]?.result;
      if (r?.schema === KL8_SCHEMA && Array.isArray(r.final10)) return r.final10;
    } catch {
    }
  }
  const rec = prev?.kl8;
  return rec && Number(rec.targetId) === Number(latest.id) && Array.isArray(rec.ai10) ? rec.ai10 : null;
}
async function digitAiPrev(sql, game, draws, prev) {
  const latest = draws?.[0];
  const prevDraw = draws?.[1];
  if (!latest) return null;
  if (sql && prevDraw) {
    try {
      const rows = await sql`
        SELECT result FROM digit_ai_runs
        WHERE game = ${game} AND draw_id = ${Number(prevDraw.id)} AND status = 'done'`;
      const r = rows[0]?.result;
      if (r?.schema === DIGIT_SCHEMA && r.picks?.straight?.length === 3) return r.picks;
    } catch {
    }
  }
  const rec = prev?.[game];
  return rec && Number(rec.targetId) === Number(latest.id) && rec.ai?.straight?.length ? rec.ai : null;
}
var DISCLAIMER = {
  tag: "note",
  elements: [
    {
      tag: "plain_text",
      content: "\u5F00\u5956\u4E3A\u72EC\u7ACB\u968F\u673A\u4E8B\u4EF6\uFF0C\u4EE5\u4E0A\u53F7\u7801\u4EC5\u4E3A\u5386\u53F2\u6570\u636E\u6574\u7406\uFF0C\u4E0D\u6784\u6210\u4EFB\u4F55\u6295\u6CE8\u5EFA\u8BAE\u3002"
    }
  ]
};
var red = (s) => `<font color='red'>${s}</font>`;
var grey = (s) => `<font color='grey'>${s}</font>`;
function buildCard({ title, template, blocks, warning }) {
  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: { template, title: { tag: "plain_text", content: title } },
      elements: [...warning ? [warning, HR] : [], ...blocks, { tag: "hr" }, DISCLAIMER]
    }
  };
}
var line = (content) => ({ tag: "div", text: { tag: "lark_md", content } });
var HR = { tag: "hr" };
function buildKl8Card(kl8, ai2, title, warning, hits = null) {
  const picks = kl8.picks.map(pad).join(" ");
  const firstPrize = Math.round(comb(BALL_MAX, 10) / comb(20, 10));
  return buildCard({
    title,
    template: "blue",
    warning,
    blocks: [
      line(`\u4E0A\u671F\u5F00\u5956\uFF1A${grey(kl8.latest.nums.map(pad).join(" "))}`),
      line(`**\u6982\u7387** \u6BCF\u53F7\u6BCF\u671F\u6052 25%\uFF1B\u9009\u5341\u4E2D\u5341\u7EA6 1/${firstPrize.toLocaleString("en-US")}\uFF08\u5355\u6CE8 2 \u5143\uFF09`),
      hits ? line(
        `**\u4E0A\u671F\u547D\u4E2D**\uFF08\u7B2C ${hits.drawId} \u671F\uFF09\uFF1A\u7B97\u6CD5\u5341\u7801 ${hits.algo}/10 \xB7 AI \u7EC8\u5BA1 ${hits.ai === null || hits.ai === void 0 ? "\u65E0\u8BB0\u5F55" : `${hits.ai}/10`}`
      ) : line(grey("\u4E0A\u671F\u547D\u4E2D\uFF1A\u6682\u65E0\u4E0A\u671F\u63A8\u8350\u8BB0\u5F55\uFF0C\u4E0B\u6B21\u63A8\u9001\u8D77\u663E\u793A")),
      HR,
      line(`**\u7B97\u6CD5\u63A8\u8350\u5341\u7801**\uFF08v7 \u591A\u7A97\u53E3\u52A0\u6743\u8BC4\u5206\uFF09
<font color='red'>${picks}</font>`),
      HR,
      line("**\u4E09\u6CE8\u53C2\u8003**"),
      line(`\u2460 ${kl8.groups[0].map(pad).join(" ")}`),
      line(`\u2461 ${kl8.groups[1].map(pad).join(" ")}`),
      line(`\u2462 ${kl8.groups[2].map(pad).join(" ")}`),
      ...kl8AiLines(ai2)
    ]
  });
}
function kl8AiLines(ai2) {
  if (!ai2) return [];
  const tag = ai2.source === "ai" ? "AI \u7EC8\u5BA1" : "\u7B97\u6CD5\u878D\u5408";
  const head = ai2.source === "ai" ? "\u7B97\u6CD5 20 \u7801 \u2192 AI \u7EC8\u5BA1" : "AI \u672A\u901A\u8FC7\uFF0C\u5DF2\u56DE\u9000\u7B97\u6CD5\u878D\u5408";
  return [
    HR,
    line(`**${tag} \xB7 \u7B2C ${ai2.nextId} \u671F 10 \u7801**\uFF08${head}\uFF09
<font color='red'>${ai2.ten.map(pad).join(" ")}</font>`),
    line(grey(`\u7B97\u6CD5\u5019\u9009 20 \u7801\uFF1A${ai2.wide.map(pad).join(" ")}`)),
    ai2.summary ? line(grey(ai2.summary)) : null,
    line(grey(`${ai2.note || ""}${ai2.cached ? " \xB7 \u590D\u7528\u7AD9\u5185\u5DF2\u751F\u6210\u7ED3\u679C" : ""}`))
  ].filter(Boolean);
}
function digitAiLines(ai2) {
  if (!ai2) return [];
  const p2 = ai2.picks;
  const tag = ai2.source === "ai" ? "AI \u7EC8\u9009" : "\u7B97\u6CD5\u524D\u4E09\uFF08AI \u672A\u8FC7\u6821\u9A8C\uFF09";
  return [
    HR,
    line(grey(`\u7B97\u6CD5\u6C60 ${ai2.pool.straight.length}/${ai2.pool.group.length}/${ai2.pool.group3.length} \u6CE8\uFF08\u76F4\u9009/\u7EC4\u516D/\u7EC4\u4E09\uFF09`)),
    line(`**${tag}** \u76F4\u9009 ${red(p2.straight.join(" "))}`),
    line(`\u7EC4\u516D ${red(p2.group.join(" "))}\u3000\u7EC4\u4E09 ${red(p2.group3.join(" "))}`),
    ai2.cached ? line(grey("\u590D\u7528\u7AD9\u5185\u5DF2\u751F\u6210\u7ED3\u679C")) : null
  ].filter(Boolean);
}
function buildFc3dCard(digit, title, { template = "red", extra = [], warning = null, ai: ai2 = null, hits = null } = {}) {
  const p2 = digit.pred;
  const [bai, shi, ge] = p2.posTop;
  const bets = bai.length * shi.length * ge.length;
  return buildCard({
    title,
    template,
    warning,
    blocks: [
      line(`\u4E0A\u671F\u5F00\u5956\uFF1A${grey(digit.latest.num.join(" "))}`),
      line(grey("\u6982\u7387 \u76F4\u9009 1/1000 \xB7 \u7EC4\u516D 1/167 \xB7 \u7EC4\u4E09 1/333")),
      hits ? line(
        `**\u4E0A\u671F\u547D\u4E2D**\uFF08\u7B2C ${hits.drawId} \u671F\uFF0C\u76F4\u9009/\u7EC4\u516D/\u7EC4\u4E09\uFF09\uFF1A\u7B97\u6CD5 ${hits.algo.straight}/${hits.algo.group}/${hits.algo.group3}\u3000AI ${hits.ai ? `${hits.ai.straight}/${hits.ai.group}/${hits.ai.group3}` : "\u65E0\u8BB0\u5F55"}`
      ) : line(grey("\u4E0A\u671F\u547D\u4E2D\uFF1A\u6682\u65E0\u4E0A\u671F\u63A8\u8350\u8BB0\u5F55\uFF0C\u4E0B\u6B21\u63A8\u9001\u8D77\u663E\u793A")),
      HR,
      line(`**\u76F4\u9009\u590D\u5F0F** ${bets} \u6CE8 \xB7 ${bets * 2} \u5143`),
      line(`\u767E ${red(bai.join("/"))}\u3000\u5341 ${red(shi.join("/"))}\u3000\u4E2A ${red(ge.join("/"))}`),
      line(`**\u53CC\u80C6** ${red(p2.dan.join("/"))}\u3000\u62D6\u7801 ${p2.tuo.join("/")}`),
      line(`\u548C\u503C ${p2.sumRange[0]}~${p2.sumRange[1]}\u3000\u8DE8\u5EA6 ${p2.spanRange[0]}~${p2.spanRange[1]}\u3000\u6740\u53F7 ${grey(p2.kill.map((k) => k.digit).join("/"))}`),
      ...extra,
      ...digitAiLines(ai2)
    ]
  });
}
function buildPl3Card(pl3, title, warning, ai2 = null, hits = null) {
  const tiers = pl3.pred.tiers || [];
  const extra = tiers.length ? [
    line(
      `**\u8986\u76D6\u6863\u4F4D** ${tiers.map((t) => `${t.cover}\u7801 ${t.expectHits}\u4E2A/${t.groupCost}\u5143`).join("\u3000")}`
    )
  ] : [];
  return buildFc3dCard(pl3, title, { template: "orange", extra, warning, ai: ai2, hits });
}
function buildSsqCard(ssq, title, warning, hits = null) {
  const p2 = ssq.pred;
  const s = p2.structure;
  const tiers = p2.tiers || [];
  const firstPrize = Math.round(comb(33, 6) * 16);
  return buildCard({
    title,
    template: "green",
    warning,
    blocks: [
      line(
        `\u4E0A\u671F\u5F00\u5956\uFF1A\u7EA2 ${grey(ssq.latest.red.map(pad).join(" "))}\u3000\u84DD ${grey(pad(ssq.latest.blue))}`
      ),
      line(`**\u6982\u7387** \u4E00\u7B49\u5956 1/${firstPrize.toLocaleString("en-US")}\uFF08\u7EA2\u7403 6/33 + \u84DD\u7403 1/16\uFF09`),
      hits ? line(
        `**\u4E0A\u671F\u547D\u4E2D**\uFF08\u7B2C ${hits.drawId} \u671F\uFF09\uFF1A\u7EA2\u7403 ${hits.red}/6 \xB7 \u84DD\u7403 ${hits.blue ? "\u547D\u4E2D" : "\u672A\u4E2D"}`
      ) : line(grey("\u4E0A\u671F\u547D\u4E2D\uFF1A\u6682\u65E0\u4E0A\u671F\u63A8\u8350\u8BB0\u5F55\uFF0C\u4E0B\u6B21\u63A8\u9001\u8D77\u663E\u793A")),
      HR,
      line(`**\u63A8\u8350 6 \u7EA2**
<font color='red'>${p2.red.map(pad).join(" ")}</font>`),
      line(
        `**\u63A8\u8350\u84DD\u7403** <font color='red'>${pad(p2.blue)}</font>\u3000\u5907\u9009 ${p2.blueBackups.map(pad).join(" ")}`
      ),
      HR,
      line(
        `\u548C\u503C ${s.sum}\u3000\u8DE8\u5EA6 ${s.span}\u3000\u4E09\u533A ${s.zone3.join(":")}\u3000\u5927\u5C0F ${s.big}:${s.small}\u3000\u5947\u5076 ${s.odd}:${s.even}`
      ),
      line(`\u6740\u7EA2 ${grey(p2.kill.map(pad).join(" "))}`),
      HR,
      line(
        `**\u8986\u76D6\u6863\u4F4D** ${tiers.map((t) => `${t.cover}\u7801 ${t.expectHits}\u4E2A/${t.cost}\u5143`).join("\u3000")}`
      )
    ]
  });
}
function feishuSign(secret, timestamp) {
  if (!secret) return {};
  const stringToSign = `${timestamp}
${secret}`;
  const sign = import_node_crypto.default.createHmac("sha256", stringToSign).update("").digest("base64");
  return { timestamp, sign };
}
async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method === "GET" && req.query?.status === "1") {
    let last = null;
    if (process.env.DATABASE_URL) {
      try {
        const raw = await readConfig(getSql(), STATUS_KEY);
        if (raw) last = JSON.parse(raw);
      } catch (e) {
        console.error("[daily-push] \u8BFB\u53D6\u63A8\u9001\u72B6\u6001\u5931\u8D25\uFF1A", e.message);
      }
    }
    return res.status(200).json({ last });
  }
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.method === "GET" && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "\u672A\u6388\u6743" });
  }
  const isTest = req.method === "POST" || req.query?.test === "1";
  try {
    const cfg = await loadConfig();
    const isDry = req.query?.dry === "1";
    if (!cfg.webhook && !isDry) {
      await savePushStatus({ at: (/* @__PURE__ */ new Date()).toISOString(), ok: false, error: "\u672A\u914D\u7F6E\u98DE\u4E66 Webhook" });
      return res.status(400).json({
        error: "\u8FD8\u6CA1\u6709\u914D\u7F6E\u98DE\u4E66\u673A\u5668\u4EBA Webhook\u3002\u8BF7\u5230\u300C\u8BBE\u7F6E \u2192 \u6BCF\u65E5\u63A8\u8350\u63A8\u9001\u300D\u91CC\u586B\u5199\u5E76\u4FDD\u5B58\u3002"
      });
    }
    const only = String(req.query?.only || "").trim();
    if (only) {
      for (const k of ["kl8", "fc3d", "pl3", "ssq"]) if (k !== only) cfg[k] = false;
    }
    let [kl8Res, fc3dRes, pl3Res, ssqRes] = await Promise.allSettled([
      cfg.kl8 ? fetchKl8Draws(100) : Promise.resolve(null),
      cfg.fc3d ? fetchFc3dDraws(100) : Promise.resolve(null),
      cfg.pl3 ? fetchPl3Draws(100) : Promise.resolve(null),
      cfg.ssq ? fetchSsqDraws(100) : Promise.resolve(null)
    ]);
    const drawsOf = (r) => r.status === "fulfilled" && r.value ? Array.isArray(r.value) ? r.value : r.value.draws : null;
    const refetchIfStale = async (r, enabled, fn, maxAgeDays = 1) => {
      const list = drawsOf(r);
      if (!enabled || !list?.length) return r;
      if (freshness(list[0], maxAgeDays).state !== "stale") return r;
      await new Promise((ok) => setTimeout(ok, FRESH_RETRY_MS));
      const [again] = await Promise.allSettled([fn(100)]);
      const retried = drawsOf(again);
      return retried?.length ? again : r;
    };
    [kl8Res, fc3dRes, pl3Res, ssqRes] = await Promise.all([
      refetchIfStale(kl8Res, cfg.kl8, fetchKl8Draws),
      refetchIfStale(fc3dRes, cfg.fc3d, fetchFc3dDraws),
      refetchIfStale(pl3Res, cfg.pl3, fetchPl3Draws),
      refetchIfStale(ssqRes, cfg.ssq, fetchSsqDraws, 4)
    ]);
    const kl8 = kl8Res.status === "fulfilled" && kl8Res.value ? buildKl8(kl8Res.value) : null;
    const fc3d = fc3dRes.status === "fulfilled" && fc3dRes.value ? buildFc3d(fc3dRes.value) : null;
    const pl3 = pl3Res.status === "fulfilled" && pl3Res.value ? buildPl3(pl3Res.value.draws) : null;
    const ssq = ssqRes.status === "fulfilled" && ssqRes.value ? buildSsq(ssqRes.value.draws) : null;
    let sqlAi = null;
    if (process.env.DATABASE_URL) {
      try {
        sqlAi = getSql();
        await ensureTables(sqlAi);
      } catch (e) {
        console.warn("[daily-push] \u6570\u636E\u5E93\u4E0D\u53EF\u7528\uFF0C\u8DF3\u8FC7 AI \u5171\u4EAB\u7F13\u5B58\uFF1A", e.message);
        sqlAi = null;
      }
    }
    let llm = null;
    try {
      llm = await resolveLlmSettings();
    } catch (e) {
      console.error("[daily-push] \u8BFB\u53D6\u5927\u6A21\u578B\u914D\u7F6E\u5931\u8D25\uFF1A", e.message);
    }
    const safely = async (fn) => {
      try {
        return await fn();
      } catch (e) {
        console.error("[daily-push] AI \u7EC8\u9009\u5931\u8D25\uFF1A", e.message);
        return null;
      }
    };
    const [kl8Ai, fc3dAi, pl3Ai] = llm ? await Promise.all([
      kl8 ? safely(() => buildKl8Ai({ draws: drawsOf(kl8Res), built: kl8, sql: sqlAi, llm })) : null,
      fc3d ? safely(
        () => buildDigitAi({ game: "fc3d", label: "\u798F\u5F693D", draws: drawsOf(fc3dRes), sql: sqlAi, llm })
      ) : null,
      pl3 ? safely(
        () => buildDigitAi({ game: "pl3", label: "\u6392\u5217\u4E09", draws: drawsOf(pl3Res), sql: sqlAi, llm })
      ) : null
    ]) : [null, null, null];
    const prevHistory = await loadHistory();
    const kl8Draws = drawsOf(kl8Res);
    const fc3dDraws = drawsOf(fc3dRes);
    const pl3Draws = drawsOf(pl3Res);
    const ssqDraws = drawsOf(ssqRes);
    const hits = { kl8: null, fc3d: null, pl3: null, ssq: null };
    if (kl8 && kl8Draws) {
      const algo = kl8AlgoPrev(kl8Draws);
      const aiPicks = await kl8AiPrev(sqlAi, kl8Draws, prevHistory);
      const drawn = new Set(kl8Draws[0]?.nums || []);
      hits.kl8 = algo ? {
        drawId: algo.drawId,
        algo: algo.hits,
        ai: aiPicks ? aiPicks.filter((n) => drawn.has(n)).length : null
      } : null;
    }
    if (fc3d && fc3dDraws) {
      const algo = digitAlgoPrev(fc3dDraws);
      const aiPicks = await digitAiPrev(sqlAi, "fc3d", fc3dDraws, prevHistory);
      hits.fc3d = algo ? {
        drawId: algo.drawId,
        actual: algo.actual,
        algo: { straight: algo.straight, group: algo.group, group3: algo.group3 },
        ai: aiPicks ? digitHitOf(aiPicks, fc3dDraws[0].num) : null
      } : null;
    }
    if (pl3 && pl3Draws) {
      const algo = digitAlgoPrev(pl3Draws);
      const aiPicks = await digitAiPrev(sqlAi, "pl3", pl3Draws, prevHistory);
      hits.pl3 = algo ? {
        drawId: algo.drawId,
        actual: algo.actual,
        algo: { straight: algo.straight, group: algo.group, group3: algo.group3 },
        ai: aiPicks ? digitHitOf(aiPicks, pl3Draws[0].num) : null
      } : null;
    }
    if (ssq && ssqDraws) hits.ssq = ssqAlgoPrev(ssqDraws);
    const fresh = {
      kl8: kl8 ? freshness(kl8.latest) : null,
      fc3d: fc3d ? freshness(fc3d.latest) : null,
      pl3: pl3 ? freshness(pl3.latest) : null,
      ssq: ssq ? freshness(ssq.latest, 4) : null
    };
    const skipped = {
      kl8: kl8Res.status === "rejected" ? kl8Res.reason?.message : null,
      fc3d: fc3dRes.status === "rejected" ? fc3dRes.reason?.message : null,
      pl3: pl3Res.status === "rejected" ? pl3Res.reason?.message : null,
      ssq: ssqRes.status === "rejected" ? ssqRes.reason?.message : null
    };
    if (!kl8 && !fc3d && !pl3 && !ssq) {
      const errs = Object.values(skipped).filter(Boolean);
      const error = `\u5F00\u5956\u6570\u636E\u83B7\u53D6\u5931\u8D25\uFF1A${errs.join("\uFF1B") || "\u672A\u77E5\u539F\u56E0"}`;
      await savePushStatus({ at: (/* @__PURE__ */ new Date()).toISOString(), ok: false, error, skipped });
      return res.status(502).json({ error });
    }
    const now = /* @__PURE__ */ new Date();
    const dateText = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
    const prefix = isTest ? "\u3010\u6D4B\u8BD5\u3011" : "";
    const cards = [];
    if (kl8)
      cards.push(
        buildKl8Card(kl8, kl8Ai, `${prefix}\u5FEB\u4E508 \u63A8\u8350 \xB7 ${dateText}`, staleWarning(fresh.kl8, "\u5FEB\u4E508"), hits.kl8)
      );
    if (fc3d)
      cards.push(
        buildFc3dCard(fc3d, `${prefix}\u798F\u5F693D \u63A8\u8350 \xB7 ${dateText}`, {
          warning: staleWarning(fresh.fc3d, "\u798F\u5F693D"),
          ai: fc3dAi,
          hits: hits.fc3d
        })
      );
    if (pl3)
      cards.push(
        buildPl3Card(
          pl3,
          `${prefix}\u6392\u5217\u4E09 v3 Pro \u63A8\u8350 \xB7 ${dateText}`,
          staleWarning(fresh.pl3, "\u6392\u5217\u4E09"),
          pl3Ai,
          hits.pl3
        )
      );
    if (ssq)
      cards.push(buildSsqCard(ssq, `${prefix}\u53CC\u8272\u7403 \u63A8\u8350 \xB7 ${dateText}`, staleWarning(fresh.ssq, "\u53CC\u8272\u7403"), hits.ssq));
    if (isDry) {
      return res.status(200).json({ ok: true, cards, hits });
    }
    const timestamp = Math.floor(Date.now() / 1e3);
    const signPart = feishuSign(cfg.secret, timestamp);
    const payloads = cards;
    let sent = 0;
    for (const payload of payloads) {
      const r = await fetch(cfg.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...signPart })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || (data.code ?? 0) !== 0) {
        const error = `\u98DE\u4E66\u63A8\u9001\u5931\u8D25\uFF1A${data.msg || `HTTP ${r.status}`}${data.code ? `\uFF08${data.code}\uFF09` : ""}`;
        await savePushStatus({ at: (/* @__PURE__ */ new Date()).toISOString(), ok: false, error, sent, total: payloads.length, fresh });
        return res.status(502).json({ error });
      }
      sent++;
    }
    await saveHistory({
      at: (/* @__PURE__ */ new Date()).toISOString(),
      kl8: kl8 ? { targetId: kl8.nextId, picks: kl8.picks, ai10: kl8Ai?.ten || null } : prevHistory?.kl8 || null,
      fc3d: fc3dAi ? { targetId: Number(fc3dAi.drawId) + 1, ai: fc3dAi.picks } : prevHistory?.fc3d || null,
      pl3: pl3Ai ? { targetId: Number(pl3Ai.drawId) + 1, ai: pl3Ai.picks } : prevHistory?.pl3 || null,
      ssq: ssq ? { targetId: Number(ssq.latest.id) + 1, red: ssq.pred.red, blue: ssq.pred.blue } : prevHistory?.ssq || null
    });
    await savePushStatus({
      at: (/* @__PURE__ */ new Date()).toISOString(),
      ok: true,
      test: isTest,
      sent,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, ssq: !!ssq },
      ai: { kl8: !!kl8Ai, fc3d: !!fc3dAi, pl3: !!pl3Ai },
      hits,
      fresh
    });
    return res.status(200).json({
      ok: true,
      test: isTest,
      pushed: { kl8: !!kl8, fc3d: !!fc3d, pl3: !!pl3, ssq: !!ssq },
      ai: {
        kl8: kl8Ai ? { source: kl8Ai.source, cached: kl8Ai.cached, ten: kl8Ai.ten } : null,
        fc3d: fc3dAi ? { source: fc3dAi.source, cached: fc3dAi.cached, picks: fc3dAi.picks } : null,
        pl3: pl3Ai ? { source: pl3Ai.source, cached: pl3Ai.cached, picks: pl3Ai.picks } : null
      },
      messages: payloads.length,
      hits,
      fresh,
      skipped
    });
  } catch (e) {
    console.error("[daily-push]", e);
    await savePushStatus({ at: (/* @__PURE__ */ new Date()).toISOString(), ok: false, error: e.message || "\u63A8\u9001\u5931\u8D25" });
    return res.status(500).json({ error: e.message || "\u63A8\u9001\u5931\u8D25" });
  }
}

// .tmp-group-test.mjs
var API = "https://open.feishu.cn/open-apis";
var ROUNDS = Number(process.env.ROUNDS || 3);
function fakeRes() {
  const box = {};
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v2) {
      this.headers[String(k).toLowerCase()] = v2;
    },
    getHeader(k) {
      return this.headers[String(k).toLowerCase()];
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(o) {
      box.body = o;
      return this;
    },
    end() {
    },
    box
  };
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const sql = getSql();
  const cfg = JSON.parse(await readConfig(sql, "lark_bot_config") || "{}");
  const chatIds = cfg.chatIds || [];
  console.log("chatIds =", JSON.stringify(chatIds), "openIds =", JSON.stringify(cfg.openIds || []));
  if (!chatIds.length) {
    console.log("NO_GROUP\uFF1A\u673A\u5668\u4EBA\u8FD8\u6CA1\u6536\u5230\u8FC7\u7FA4\u6D88\u606F");
    return;
  }
  const tr2 = await fetch(`${API}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: cfg.appId, app_secret: cfg.appSecret })
  });
  const td = await tr2.json();
  if (td.code !== 0) throw new Error(`token \u5931\u8D25\uFF1A${td.msg}`);
  const token = td.tenant_access_token;
  const chatId = chatIds[0];
  for (let round = 1; round <= ROUNDS; round++) {
    const res = fakeRes();
    const t0 = Date.now();
    await handler({ method: "GET", query: { dry: "1" }, headers: {} }, res);
    const cards = res.box.body?.cards || [];
    console.log(`round ${round}: \u751F\u6210 ${cards.length} \u5F20\u5361\uFF0C\u7528\u65F6 ${Date.now() - t0}ms`);
    let ok = 0;
    for (const payload of cards) {
      const r = await fetch(`${API}/im/v1/messages?receive_id_type=chat_id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receive_id: chatId, msg_type: "interactive", content: JSON.stringify(payload.card) })
      });
      const d = await r.json();
      if (d.code === 0) ok++;
      else console.log(`  ${payload.card?.header?.title?.content} => code=${d.code} ${d.msg}`);
    }
    console.log(`round ${round}: \u6210\u529F ${ok}/${cards.length}`);
    if (round < ROUNDS) await sleep(2e3);
  }
}
main().catch((e) => {
  console.error("FAILED", e.message);
  process.exit(1);
});
/*! Bundled license information:

@neondatabase/serverless/index.mjs:
  (*! Bundled license information:
  
  ieee754/index.js:
    (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)
  
  buffer/index.js:
    (*!
     * The buffer module from node.js, for the browser.
     *
     * @author   Feross Aboukhadijeh <https://feross.org>
     * @license  MIT
     *)
  *)
*/
