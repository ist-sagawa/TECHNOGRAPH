var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-6E27Gm/functionsWorker-0.9729797323631102.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var PROJECT_ID = "nacdthna";
var DATASET = "production";
var API_VERSION = "2024-07-02";
function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Avoid edge caching; gallery should reflect new uploads quickly.
      "cache-control": "no-store",
      ...init.headers || {}
    },
    ...init
  });
}
__name(json, "json");
__name2(json, "json");
async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limitRaw = Number(url.searchParams.get("limit") || "240");
  const limit = Number.isFinite(limitRaw) ? Math.min(1e3, Math.max(1, Math.floor(limitRaw))) : 240;
  const query = `*[_type == "crystalizerImage"]
    | order(coalesce(date, createdAt, _createdAt) desc, _createdAt desc)
    [0...$limit]{
      _id,
      title,
      date,
      externalId,
      name,
      message,
      "createdAt": coalesce(createdAt, _createdAt),
      "imageUrl": image.asset->url
    }`;
  const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(query)}&$limit=${encodeURIComponent(String(limit))}`;
  const tokenRaw = context?.env?.SANITY_API_READ_TOKEN || context?.env?.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_WRITE_TOKEN;
  const token = String(tokenRaw || "").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
  const res = await fetch(endpoint, {
    headers: {
      ...token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
  const text = await res.text().catch(() => "");
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    return json(
      {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || text || "Failed to query Sanity"
      },
      { status: 500 }
    );
  }
  const items = Array.isArray(data?.result) ? data.result : [];
  return json({ ok: true, items });
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
var PROJECT_ID2 = "nacdthna";
var DATASET2 = "production";
var API_VERSION2 = "2024-07-02";
function toHex(bytes) {
  try {
    return Array.from(bytes).map((b) => Number(b).toString(16).padStart(2, "0")).join(" ");
  } catch {
    return "";
  }
}
__name(toHex, "toHex");
__name2(toHex, "toHex");
function sniffImageType(buf) {
  const u8 = new Uint8Array(buf || new ArrayBuffer(0));
  const head = u8.slice(0, 16);
  const hex = toHex(head);
  const isPng = head.length >= 8 && head[0] === 137 && head[1] === 80 && head[2] === 78 && head[3] === 71 && head[4] === 13 && head[5] === 10 && head[6] === 26 && head[7] === 10;
  if (isPng) return { guessedType: "image/png", magic: "png", headHex: hex };
  const isJpeg = head.length >= 3 && head[0] === 255 && head[1] === 216 && head[2] === 255;
  if (isJpeg) return { guessedType: "image/jpeg", magic: "jpeg", headHex: hex };
  const isGif = head.length >= 4 && head[0] === 71 && head[1] === 73 && head[2] === 70 && head[3] === 56;
  if (isGif) return { guessedType: "image/gif", magic: "gif", headHex: hex };
  const isRiff = head.length >= 4 && head[0] === 82 && head[1] === 73 && head[2] === 70 && head[3] === 70;
  const isWebp = isRiff && head.length >= 12 && head[8] === 87 && head[9] === 69 && head[10] === 66 && head[11] === 80;
  if (isWebp) return { guessedType: "image/webp", magic: "webp", headHex: hex };
  const isFtyp = head.length >= 8 && head[4] === 102 && head[5] === 116 && head[6] === 121 && head[7] === 112;
  if (isFtyp) return { guessedType: "application/octet-stream", magic: "ftyp", headHex: hex };
  return { guessedType: "application/octet-stream", magic: "unknown", headHex: hex };
}
__name(sniffImageType, "sniffImageType");
__name2(sniffImageType, "sniffImageType");
function json2(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers || {}
    },
    ...init
  });
}
__name(json2, "json2");
__name2(json2, "json");
async function onRequestPost(context) {
  const tokenRaw = context?.env?.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_WRITE_TOKEN;
  const token = String(tokenRaw || "").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
  if (!token) {
    return json2(
      {
        ok: false,
        error: "Missing SANITY_API_WRITE_TOKEN env var."
      },
      { status: 500 }
    );
  }
  const ct = context.request.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return json2(
      {
        ok: false,
        error: "Content-Type must be multipart/form-data"
      },
      { status: 400 }
    );
  }
  const form = await context.request.formData();
  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const dateRaw = String(form.get("date") || "").trim();
  const externalIdRaw = String(form.get("id") || form.get("externalId") || "").trim();
  const name = String(form.get("name") || "").trim();
  const message = String(form.get("message") || "").trim();
  if (!(file instanceof File)) {
    return json2(
      {
        ok: false,
        error: "Missing form field: file"
      },
      { status: 400 }
    );
  }
  const size = Number(file.size || 0);
  const type = String(file.type || "").trim();
  if (!size || size <= 0) {
    return json2(
      {
        ok: false,
        error: "Uploaded file is empty (0 bytes)."
      },
      { status: 400 }
    );
  }
  if (type && !type.startsWith("image/")) {
    return json2(
      {
        ok: false,
        error: `Uploaded file is not an image (type: ${type}).`
      },
      { status: 400 }
    );
  }
  const filename = file.name || `crystalizer_${Date.now()}.png`;
  const now = /* @__PURE__ */ new Date();
  const dateAuto = now.toISOString().slice(0, 10);
  const date = dateRaw || dateAuto;
  const rand = (() => {
    try {
      return (crypto?.randomUUID?.() || "").replace(/-/g, "").slice(0, 8);
    } catch {
      return String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
    }
  })();
  const externalId = externalIdRaw || `cr${Date.now()}_${rand}`;
  const sanitizeDocId = /* @__PURE__ */ __name2((id) => {
    const s = String(id || "").trim();
    const cleaned = s.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    return cleaned || `cr${Date.now()}_${rand}`;
  }, "sanitizeDocId");
  const buf = await file.arrayBuffer();
  if (!buf || buf.byteLength <= 0) {
    return json2(
      {
        ok: false,
        error: "Failed to read uploaded file bytes."
      },
      { status: 400 }
    );
  }
  const sniff = sniffImageType(buf);
  const contentType = type || sniff.guessedType || "application/octet-stream";
  const blob = new Blob([buf], { type: contentType });
  const up = new FormData();
  up.append("file", blob, filename);
  const assetUrl = `https://${PROJECT_ID2}.api.sanity.io/v${API_VERSION2}/assets/images/${DATASET2}?filename=${encodeURIComponent(filename)}`;
  const parseJsonOrNull = /* @__PURE__ */ __name2((txt) => {
    try {
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  }, "parseJsonOrNull");
  const doMultipartUpload = /* @__PURE__ */ __name2(async () => {
    const res = await fetch(assetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: up
    });
    const text = await res.text().catch(() => "");
    const json3 = parseJsonOrNull(text);
    return { res, text, json: json3, method: "multipart" };
  }, "doMultipartUpload");
  const doRawUpload = /* @__PURE__ */ __name2(async () => {
    const res = await fetch(assetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": contentType
      },
      body: buf
    });
    const text = await res.text().catch(() => "");
    const json3 = parseJsonOrNull(text);
    return { res, text, json: json3, method: "raw" };
  }, "doRawUpload");
  let assetAttempt = await doMultipartUpload();
  if (!assetAttempt.res.ok) {
    const msg = assetAttempt.json?.message || assetAttempt.json?.error || assetAttempt.text || "";
    const details = String(assetAttempt.json?.details || "");
    const shouldRetryRaw = String(msg).toLowerCase().includes("invalid image") || String(msg).toLowerCase().includes("metadata") || details.toLowerCase().includes("unsupported image format");
    if (shouldRetryRaw) {
      assetAttempt = await doRawUpload();
    }
  }
  const assetRes = assetAttempt.res;
  const assetText = assetAttempt.text;
  const assetJson = assetAttempt.json;
  const assetUploadMethod = assetAttempt.method;
  if (!assetRes.ok) {
    return json2(
      {
        ok: false,
        step: "uploadAsset",
        status: assetRes.status,
        uploadMethod: assetUploadMethod,
        received: {
          filename,
          size,
          type,
          contentType,
          magic: sniff.magic,
          headHex: sniff.headHex
        },
        response: assetJson,
        responseText: assetJson ? void 0 : assetText
      },
      { status: assetRes.status || 502 }
    );
  }
  const assetId = assetJson?.document?._id;
  const asset = assetJson?.document;
  if (!assetId) {
    return json2(
      {
        ok: false,
        step: "uploadAsset",
        error: "Sanity asset upload succeeded but no document._id returned",
        response: assetJson
      },
      { status: 502 }
    );
  }
  const docId = sanitizeDocId(externalId);
  const doc = {
    _id: docId,
    _type: "crystalizerImage",
    title: title || filename.replace(/\.(png|jpg|jpeg|webp)$/i, ""),
    date,
    externalId,
    name: name || void 0,
    message: message || void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    image: {
      _type: "image",
      asset: { _type: "reference", _ref: assetId }
    }
  };
  const mutateUrl = `https://${PROJECT_ID2}.api.sanity.io/v${API_VERSION2}/data/mutate/${DATASET2}?returnIds=true`;
  const mutateRes = await fetch(mutateUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ mutations: [{ create: doc }] })
  });
  const mutateText = await mutateRes.text().catch(() => "");
  const mutateJson = (() => {
    try {
      return mutateText ? JSON.parse(mutateText) : null;
    } catch {
      return null;
    }
  })();
  if (!mutateRes.ok) {
    return json2(
      {
        ok: false,
        step: "createDocument",
        status: mutateRes.status,
        asset,
        response: mutateJson,
        responseText: mutateJson ? void 0 : mutateText
      },
      { status: mutateRes.status || 502 }
    );
  }
  const createdId = mutateJson?.results?.[0]?.id || docId;
  return json2({
    ok: true,
    asset,
    documentId: createdId,
    uploadMethod: assetUploadMethod
  });
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
var BASIC_USER = "tg";
var BASIC_PASS = "qwerasdf";
async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(`${err.message}
${err.stack}`, { status: 500 });
  }
}
__name(errorHandling, "errorHandling");
__name2(errorHandling, "errorHandling");
async function handleRequest({ next, request }) {
  if (request.headers.has("Authorization")) {
    const Authorization = request.headers.get("Authorization");
    const [scheme, encoded] = Authorization.split(" ");
    if (!encoded || scheme !== "Basic") {
      return new Response(`The Authorization header must start with Basic`, {
        status: 400
      });
    }
    const buffer = Uint8Array.from(
      atob(encoded),
      (character) => character.charCodeAt(0)
    );
    const decoded = new TextDecoder().decode(buffer).normalize();
    const index = decoded.indexOf(":");
    if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
      return new Response("Invalid authorization value.", { status: 400 });
    }
    const user = decoded.substring(0, index);
    const pass = decoded.substring(index + 1);
    if (BASIC_USER !== user) {
      return new Response("Invalid credentials.", { status: 401 });
    }
    if (BASIC_PASS !== pass) {
      return new Response("Invalid credentials.", { status: 401 });
    }
    return await next();
  }
  return new Response("You need to login.", {
    status: 401,
    headers: {
      // Prompts the user for credentials.
      "WWW-Authenticate": 'Basic realm="my scope", charset="UTF-8"'
    }
  });
}
__name(handleRequest, "handleRequest");
__name2(handleRequest, "handleRequest");
var onRequest = [errorHandling, handleRequest];
var routes = [
  {
    routePath: "/api/crystalizer/gallery",
    mountPath: "/api/crystalizer",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/crystalizer/upload",
    mountPath: "/api/crystalizer",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-ZyY2W6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-ZyY2W6/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.9729797323631102.js.map
