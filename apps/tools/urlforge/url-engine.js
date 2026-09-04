/*
 * url-engine.js — dependency-free URL parser / builder / decomposer
 * (Casper, CASPER-X402)
 */
'use strict';

const URLForge = (() => {
  function parse(input) {
    if (!input) return null;
    let rest = String(input).trim();
    let protocol = '';
    let auth = '';
    let host = '';
    let port = '';
    let path = '';
    let query = '';
    let fragment = '';

    const protoMatch = rest.match(/^([a-z][a-z0-9+.-]*):\/\//i);
    if (protoMatch) {
      protocol = protoMatch[1];
      rest = rest.slice(protoMatch[0].length);
    }

    const hashIdx = rest.indexOf('#');
    if (hashIdx !== -1) { fragment = rest.slice(hashIdx + 1); rest = rest.slice(0, hashIdx); }

    const qIdx = rest.indexOf('?');
    if (qIdx !== -1) { query = rest.slice(qIdx + 1); rest = rest.slice(0, qIdx); }

    // At this point rest = [auth@]host[:port]/path
    const atIdx = rest.lastIndexOf('@');
    if (atIdx !== -1) { auth = rest.slice(0, atIdx); rest = rest.slice(atIdx + 1); }

    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) { path = rest.slice(slashIdx); rest = rest.slice(0, slashIdx); }

    // rest = host[:port]
    let hostPort = rest;
    // Only strip port if it's purely numeric after last colon (handle IPv6 [::1])
    if (hostPort.startsWith('[')) {
      const close = hostPort.indexOf(']');
      if (close !== -1) {
        host = hostPort.slice(0, close + 1);
        const after = hostPort.slice(close + 1);
        if (after.startsWith(':')) port = after.slice(1);
        hostPort = '';
      }
    }
    if (hostPort) {
      const colonIdx = hostPort.lastIndexOf(':');
      if (colonIdx !== -1 && /^\d+$/.test(hostPort.slice(colonIdx + 1))) {
        host = hostPort.slice(0, colonIdx);
        port = hostPort.slice(colonIdx + 1);
      } else {
        host = hostPort;
      }
    }

    const q = parseQuery(query);
    return {
      protocol,
      username: auth.split(':')[0] || '',
      password: auth.slice(auth.indexOf(':') + 1) || '',
      host,
      hostname: host.replace(/^\[|\]$/g, ''),
      port,
      path,
      pathname: path,
      query,
      search: query ? '?' + query : '',
      hash: fragment ? '#' + fragment : '',
      fragment,
      params: q,
      toString() {
        let s = '';
        if (this.protocol) s += this.protocol + '://';
        if (this.username) s += this.username + (this.password ? ':' + this.password : '') + '@';
        s += this.host;
        if (this.port) s += ':' + this.port;
        s += this.path || '';
        if (this.query) s += '?' + this.query;
        if (this.fragment) s += '#' + this.fragment;
        return s;
      },
    };
  }

  function parseQuery(qstr) {
    const params = {};
    if (!qstr) return params;
    for (const pair of qstr.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      let key, val;
      if (eq === -1) { key = decode(pair); val = ''; }
      else { key = decode(pair.slice(0, eq)); val = decode(pair.slice(eq + 1)); }
      if (params[key] === undefined) params[key] = val;
      else if (Array.isArray(params[key])) params[key].push(val);
      else params[key] = [params[key], val];
    }
    return params;
  }
  function decode(s) {
    try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; }
  }

  function queryToString(params) {
    const parts = [];
    for (const [k, v] of Object.entries(params || {})) {
      if (Array.isArray(v)) {
        for (const item of v) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(item));
      } else {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
      }
    }
    return parts.join('&');
  }

  function addParam(input, key, val) {
    const u = parse(input);
    if (!u) return input;
    const params = { ...u.params };
    const existing = params[key];
    if (existing === undefined) params[key] = val;
    else if (Array.isArray(existing)) params[key] = [...existing, val];
    else params[key] = [existing, val];
    u.query = queryToString(params);
    u.search = '?' + u.query;
    return u.toString();
  }

  function setParam(input, key, val) {
    const u = parse(input);
    if (!u) return input;
    const params = { ...u.params };
    params[key] = val;
    u.query = queryToString(params);
    u.search = '?' + u.query;
    return u.toString();
  }

  function removeParam(input, key) {
    const u = parse(input);
    if (!u) return input;
    const params = { ...u.params };
    delete params[key];
    const query = queryToString(params);
    if (query) { u.query = query; u.search = '?' + query; }
    else { u.query = ''; u.search = ''; }
    return u.toString();
  }

  function removeTracking(input) {
    const u = parse(input);
    if (!u) return input;
    const TRACKING = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_cid','mc_eid','igshid','ref','ref_src','_gl','spm','sc_campaign','vero_id']);
    let changed = false;
    for (const k of Object.keys(u.params)) {
      if (TRACKING.has(k)) { delete u.params[k]; changed = true; }
    }
    if (changed) {
      const query = queryToString(u.params);
      if (query) { u.query = query; u.search = '?' + query; }
      else { u.query = ''; u.search = ''; }
    }
    return { url: u.toString(), removed: changed };
  }

  return { parse, parseQuery, queryToString, addParam, setParam, removeParam, removeTracking };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = URLForge;
