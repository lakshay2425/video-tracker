const KEY = "video-library-v2";
const OLD = "video-library-v1";
const NEW = "__new__";
const PALETTE = ["c0", "c1", "c2", "c3"];

let db = null;
let secFilter = "all";
let addOpen = false;
let addMode = "single";
let presetFor = { sectionId: "", playlistId: "" };
let single = null;
let bulkRows = [];
let formError = "";
let flash = "";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const normalize = s => String(s == null ? "" : s).trim().replace(/\s+/g, " ");
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- storage ---------- */
function defaults(){
  return {
    sections: [
      { id: "spirituality", name: "Spirituality" },
      { id: "front-end", name: "Front-end development" },
      { id: "back-end", name: "Back-end development" }
    ],
    statuses: [
      { id: "watching", label: "Watching", rank: 0 },
      { id: "to-watch", label: "To watch", rank: 1 },
      { id: "watched", label: "Watched", rank: 2 },
      { id: "rewatch", label: "Rewatch", rank: 3 }
    ],
    playlists: [],
    videos: []
  };
}
function valid(p){
  return p && Array.isArray(p.sections) && Array.isArray(p.statuses) && Array.isArray(p.videos);
}
function ensure(p){
  if (!Array.isArray(p.playlists)) p.playlists = [];
  p.videos.forEach(v => { if (!v.playlistId) v.playlistId = null; });
  p.playlists.forEach(pl => {
    const members = p.videos.filter(v => v.playlistId === pl.id).map(v => v.id);
    const memberIds = new Set(members);
    const ordered = Array.isArray(pl.videoOrder) ? pl.videoOrder.filter(id => memberIds.has(id)) : [];
    const seen = new Set(ordered);
    members.forEach(id => { if (!seen.has(id)){ ordered.push(id); seen.add(id); } });
    pl.videoOrder = ordered;
  });
  return p;
}
function load(){
  try {
    const v = localStorage.getItem(KEY);
    if (v){ const p = JSON.parse(v); if (valid(p)){ db = ensure(p); return; } }
  } catch (e) {}
  try {
    const o = localStorage.getItem(OLD);
    if (o){
      const old = JSON.parse(o);
      db = defaults();
      const map = { watch: "to-watch", rewatch: "rewatch", watched: "watched" };
      (Array.isArray(old) ? old : []).forEach(i => {
        let sec = null;
        if (i.section){
          sec = db.sections.find(s => s.name.toLowerCase() === String(i.section).toLowerCase());
          if (!sec){ sec = { id: uid(), name: i.section }; db.sections.push(sec); }
        }
        db.videos.push({ id: i.id || uid(), title: i.title, url: i.url, sectionId: sec ? sec.id : null, playlistId: null, statusId: map[i.status] || "to-watch" });
      });
      save();
      return;
    }
  } catch (e) {}
  db = defaults();
}
function save(){
  ensure(db);
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
}

/* ---------- helpers ---------- */
function el(tag, props, ...kids){
  const n = document.createElement(tag);
  if (props) for (const k in props){
    const v = props[k];
    if (k === "text") n.textContent = v;
    else if (k === "value") n.value = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) n.append(c);
  return n;
}
function sortedStatuses(){ return [...db.statuses].sort((a, b) => a.rank - b.rank); }
function statusOf(id){ return db.statuses.find(s => s.id === id) || null; }
function statusIndex(id){ return sortedStatuses().findIndex(s => s.id === id); }
function sectionOf(id){ return db.sections.find(s => s.id === id) || null; }
function playlistOf(id){ return db.playlists.find(p => p.id === id) || null; }
function playlistsIn(sectionId){ return db.playlists.filter(p => p.sectionId === sectionId); }
function fallbackStatus(){ const f = sortedStatuses()[0]; return f ? f.id : ""; }
function pillColorFor(id){ const i = statusIndex(id); return "var(--" + PALETTE[(i < 0 ? 0 : i) % 4] + ")"; }
function swap(arr, a, b){ const t = arr[a]; arr[a] = arr[b]; arr[b] = t; save(); render(); }

// Two-tap confirm: first click arms, second click within 3s runs the action.
function dangerBtn(label, action, cls){
  const b = el("button", { type: "button", class: cls || "ghost danger small", text: label });
  b.dataset.label = label;
  b.addEventListener("click", () => {
    if (b.dataset.armed){ action(); }
    else {
      b.dataset.armed = "1"; b.textContent = "Confirm";
      setTimeout(() => { if (b.isConnected){ delete b.dataset.armed; b.textContent = b.dataset.label; } }, 3000);
    }
  });
  return b;
}
function moveBtn(label, disabled, action){
  return el("button", { type: "button", class: "ghost small", text: label,
    "aria-label": label === "↑" ? "Move up" : "Move down", disabled: disabled ? "" : null, onclick: action });
}
function card(title, ...kids){
  return el("section", { class: "card" }, el("h2", { text: title }), ...kids);
}

/* ---------- normalisation: applied before anything is stored ---------- */
function resolveSection(raw){
  const n = normalize(raw);
  const hit = db.sections.find(s => s.name.toLowerCase() === n.toLowerCase());
  if (hit) return hit.id;
  const sec = { id: uid(), name: cap(n) };
  db.sections.push(sec);
  return sec.id;
}
function resolveStatus(raw){
  const n = normalize(raw);
  const hit = db.statuses.find(s => s.label.toLowerCase() === n.toLowerCase());
  if (hit) return hit.id;
  const rank = db.statuses.reduce((m, s) => Math.max(m, s.rank), -1) + 1;
  const st = { id: uid(), label: cap(n), rank };
  db.statuses.push(st);
  return st.id;
}
function resolvePlaylist(raw, sectionId){
  const n = normalize(raw);
  const hit = db.playlists.find(p => p.sectionId === sectionId && p.name.toLowerCase() === n.toLowerCase());
  if (hit) return hit.id;
  const pl = { id: uid(), name: cap(n), sectionId };
  db.playlists.push(pl);
  return pl.id;
}

/* ---------- add form (single and bulk share the same rows) ---------- */
function newRow(){
  return { title: "", url: "", sectionId: presetFor.sectionId || "", sectionNew: "",
    playlistId: presetFor.playlistId || "", playlistNew: "",
    statusId: fallbackStatus(), statusNew: "", collapsed: false, error: "",
    titleFetchStatus: "", titleFetchUrl: "", titleFetchToken: 0 };
}
// null = blank row (skipped), "" = valid, otherwise an error message
function checkRow(r){
  const t = normalize(r.title), u = normalize(r.url);
  if (!t && !u) return null;
  if (!t) return "Add a title.";
  if (!/^https?:\/\//i.test(u)) return "Paste the full link, starting with https://.";
  if (r.sectionId === NEW && !normalize(r.sectionNew)) return "Name the new section.";
  if (r.playlistId === NEW && !normalize(r.playlistNew)) return "Name the new playlist.";
  if (r.statusId === NEW && !normalize(r.statusNew)) return "Name the new status.";
  return "";
}
// Validates every row first; stores nothing if any row is invalid.
function saveRows(rows){
  const results = rows.map(checkRow);
  if (results.every(x => x === null)){ formError = "Add a title and a link first."; return false; }
  if (results.some(x => x)){
    rows.forEach((r, i) => { r.error = results[i] || ""; if (results[i]) r.collapsed = false; });
    formError = "Fix the highlighted fields first.";
    return false;
  }
  rows.forEach((r, i) => {
    if (results[i] === null) return;
    const sectionId = r.sectionId === NEW ? resolveSection(r.sectionNew) : (sectionOf(r.sectionId) ? r.sectionId : null);
    let playlistId = null;
    if (sectionId){
      if (r.playlistId === NEW) playlistId = resolvePlaylist(r.playlistNew, sectionId);
      else if (playlistOf(r.playlistId) && playlistOf(r.playlistId).sectionId === sectionId) playlistId = r.playlistId;
    }
    const statusId = r.statusId === NEW ? resolveStatus(r.statusNew) : (statusOf(r.statusId) ? r.statusId : fallbackStatus());
    db.videos.push({ id: uid(), title: normalize(r.title), url: normalize(r.url),
      sectionId: sectionId || null, playlistId, statusId });
  });
  save();
  formError = "";
  rows.forEach(r => { r.error = ""; });
  return true;
}

const KINDS = {
  section: { idKey: "sectionId", newKey: "sectionNew", label: "Section", none: "No section", add: "+ New section…",
    opts: () => db.sections.map(s => [s.id, s.name]) },
  playlist: { idKey: "playlistId", newKey: "playlistNew", label: "Playlist", none: "No playlist", add: "+ New playlist…",
    opts: r => (r.sectionId && r.sectionId !== NEW) ? playlistsIn(r.sectionId).map(p => [p.id, p.name]) : [] },
  status: { idKey: "statusId", newKey: "statusNew", label: "Status", none: null, add: "+ New status…",
    opts: () => sortedStatuses().map(s => [s.id, s.label]) }
};
function picker(r, kind){
  const K = KINDS[kind];
  const opts = [];
  if (K.none !== null) opts.push(el("option", { value: "", text: K.none }));
  K.opts(r).forEach(([id, name]) => opts.push(el("option", { value: id, text: name })));
  opts.push(el("option", { value: NEW, text: K.add }));
  const sel = el("select", { "aria-label": K.label, onchange: e => {
    r[K.idKey] = e.target.value;
    if (kind === "section") r.playlistId = "";   // a playlist belongs to one section
    render();
  } }, ...opts);
  sel.value = r[K.idKey] || "";
  const wrap = el("label", null, K.label, sel);
  if (r[K.idKey] === NEW){
    const ph = "New " + K.label.toLowerCase() + " name";
    wrap.append(el("input", { value: r[K.newKey] || "", placeholder: ph, "aria-label": ph, autocomplete: "off",
      oninput: e => { r[K.newKey] = e.target.value; } }));
  }
  return wrap;
}
function youtubeVideoUrl(value){
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host === "www.youtu.be"){
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (host !== "youtube.com" && host !== "www.youtube.com" && host !== "m.youtube.com") return "";
    if (url.pathname === "/watch") return url.searchParams.get("v") || "";
    const match = url.pathname.match(/^\/shorts\/([^/]+)/);
    return match ? match[1] : "";
  } catch (e) {
    return "";
  }
}
async function fetchYouTubeTitle(r, value){
  const videoId = youtubeVideoUrl(value);
  if (!videoId){
    if (r.titleFetchStatus){ r.titleFetchToken++; r.titleFetchStatus = ""; r.titleFetchUrl = ""; render(); }
    return;
  }
  if (normalize(r.title) || (r.titleFetchUrl === value && r.titleFetchStatus)) return;
  const token = ++r.titleFetchToken;
  r.titleFetchUrl = value;
  r.titleFetchStatus = "Fetching title…";
  render();
  try {
    const response = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(value));
    if (!response.ok) throw new Error("YouTube title request failed.");
    const data = await response.json();
    if (token !== r.titleFetchToken || !addOpen || (single !== r && !bulkRows.includes(r))) return;
    if (!data.title) throw new Error("YouTube did not return a title.");
    if (!normalize(r.title)) r.title = data.title;
    r.titleFetchStatus = "";
  } catch (e) {
    if (token !== r.titleFetchToken || !addOpen || (single !== r && !bulkRows.includes(r))) return;
    r.titleFetchStatus = "Could not fetch title. Enter it manually.";
  }
  render();
}
function fieldsFor(r){
  const title = el("input", { value: r.title, placeholder: "Video title", autocomplete: "off",
    oninput: e => { r.title = e.target.value; } });
  const url = el("input", { value: r.url, type: "url", inputmode: "url", placeholder: "https://www.youtube.com/watch?v=…",
    oninput: e => { r.url = e.target.value; },
    onchange: e => { r.url = e.target.value; fetchYouTubeTitle(r, e.target.value); },
    onpaste: e => { setTimeout(() => { r.url = e.target.value; fetchYouTubeTitle(r, e.target.value); }, 0); } });
  return [
    el("label", { class: "full" }, "Title",
      title,
      el("span", { class: "hint", role: "status", text: r.titleFetchStatus })),
    el("label", { class: "full" }, "YouTube link",
      url),
    picker(r, "section"),
    ...(r.sectionId ? [picker(r, "playlist")] : []),
    picker(r, "status")
  ];
}
function openAdd(sectionId, playlistId){
  addOpen = true; addMode = "single";
  presetFor = { sectionId: sectionId || "", playlistId: playlistId || "" };
  single = newRow(); bulkRows = [newRow()];
  formError = ""; flash = "";
  render();
}
function addModule(sectionId, playlistId){
  if (!addOpen) return el("button", { type: "button", class: "add-btn", text: "+ Add a video",
    onclick: () => openAdd(sectionId, playlistId) });
  const mode = (m, label) => el("button", { type: "button", class: "seg", "aria-pressed": String(addMode === m), text: label,
    onclick: () => { addMode = m; formError = ""; render(); } });
  const msg = flash; flash = "";
  return el("section", { class: "card", "aria-label": "Add videos" },
    el("div", { class: "add-head" },
      el("div", { class: "seg-group", role: "group", "aria-label": "Add mode" }, mode("single", "Single video"), mode("bulk", "Bulk add")),
      el("button", { type: "button", class: "ghost small", text: "Close", onclick: () => { addOpen = false; render(); } })),
    el("div", { class: "ok", text: msg }),
    addMode === "single" ? singleBody() : bulkBody());
}
function singleBody(){
  if (!single) single = newRow();
  const r = single;
  const form = el("form", { class: "stack", novalidate: "" },
    el("div", { class: "fields" }, ...fieldsFor(r)),
    el("div", { class: "err", role: "alert", text: formError }),
    el("div", { class: "btns" }, el("button", { type: "submit", text: "Add video" })));
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (saveRows([r])){ single = newRow(); flash = "Saved."; }
    render();
  });
  return form;
}
function bulkBody(){
  return el("div", { class: "stack" },
    el("div", { class: "stack" }, ...bulkRows.map((r, i) => bulkRow(r, i))),
    el("div", { class: "err", role: "alert", text: formError }),
    el("div", { class: "btns" },
      el("button", { type: "button", class: "ghost", text: "+ Add another video",
        onclick: () => { bulkRows.push(newRow()); render(); } }),
      el("button", { type: "button", text: "Add all videos",
        onclick: () => { if (saveRows(bulkRows)){ bulkRows = [newRow()]; flash = "Saved."; } render(); } })));
}
function bulkRow(r, i){
  const head = el("button", { type: "button", class: "row-head", "aria-expanded": String(!r.collapsed),
    onclick: () => { r.collapsed = !r.collapsed; render(); } },
    el("span", { class: "chev", "aria-hidden": "true", text: r.collapsed ? "▸" : "▾" }),
    el("span", { class: "row-title", text: `${i + 1}. ${normalize(r.title) || "New video"}` }),
    r.error ? el("span", { class: "row-bad", text: "Needs fixing" }) : null);
  const remove = dangerBtn("Remove", () => {
    bulkRows.splice(i, 1);
    if (!bulkRows.length) bulkRows.push(newRow());
    render();
  });
  return el("div", { class: "bulk-row" },
    el("div", { class: "row-top" }, head, remove),
    r.collapsed ? null : el("div", { class: "fields" }, ...fieldsFor(r), el("div", { class: "err", text: r.error || "" })));
}

/* ---------- shared list pieces ---------- */
function filterBar(){
  return el("section", { class: "card" },
    el("div", { class: "chips", role: "group", "aria-label": "Filter by status" },
      el("button", { type: "button", class: "chip", "aria-pressed": String(secFilter === "all"),
        onclick: () => { secFilter = "all"; render(); }, text: "All" }),
      ...sortedStatuses().map(st => el("button", { type: "button", class: "chip", "aria-pressed": String(secFilter === st.id),
        onclick: () => { secFilter = st.id; render(); }, text: st.label }))));
}
function videoList(vids, emptyText, playlist){
  const shown = vids
    .filter(v => secFilter === "all" || v.statusId === secFilter)
    .sort(playlist
      ? (a, b) => playlist.videoOrder.indexOf(a.id) - playlist.videoOrder.indexOf(b.id)
      : (a, b) => statusIndex(a.statusId) - statusIndex(b.statusId) || a.title.localeCompare(b.title));
  const list = el("ul", { class: "card list", style: "padding:0 14px;gap:0" });
  if (!vids.length) list.append(el("li", { class: "empty", text: emptyText }));
  else if (!shown.length) list.append(el("li", { class: "empty", text: "Nothing with this status." }));
  shown.forEach(v => list.append(videoRow(v, playlist)));
  return list;
}
function reorderVideo(playlist, video, delta){
  const index = playlist.videoOrder.indexOf(video.id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= playlist.videoOrder.length) return;
  [playlist.videoOrder[index], playlist.videoOrder[target]] =
    [playlist.videoOrder[target], playlist.videoOrder[index]];
  save(); render();
}
function videoRow(v, playlist){
  const st = el("select", { "aria-label": "Edit watching status for " + v.title,
    onchange: e => { v.statusId = e.target.value; save(); render(); } },
    ...sortedStatuses().map(s => el("option", { value: s.id, text: s.label, ...(s.id === v.statusId ? { selected: "selected" } : {}) })));
  const move = el("select", { "aria-label": "Move to another playlist for " + v.title,
    onchange: e => {
      const target = playlistOf(e.target.value);
      if (target){ v.playlistId = target.id; v.sectionId = target.sectionId; }
      else v.playlistId = null;
      save(); render();
    } },
    el("option", { value: "", text: "No playlist", ...(!v.playlistId ? { selected: "selected" } : {}) }),
    ...db.playlists.map(p => el("option", {
      value: p.id,
      text: (sectionOf(p.sectionId) ? sectionOf(p.sectionId).name + " — " : "") + p.name,
      ...(p.id === v.playlistId ? { selected: "selected" } : {})
    })));
  const actions = el("details", { class: "video-menu" },
    el("summary", { "aria-label": "Video actions for " + v.title, title: "Video actions", text: "⋮" }),
    el("div", { class: "video-menu-panel" },
      el("label", { class: "video-menu-action" }, "Move to another playlist", move),
      el("label", { class: "video-menu-action" }, "Edit watching status", st),
      playlist ? el("div", { class: "video-menu-action" },
        el("span", { text: "Reorder in playlist" }),
        el("div", { class: "video-reorder" },
          el("button", { type: "button", class: "ghost small", text: "Move up",
            disabled: playlist.videoOrder.indexOf(v.id) === 0 ? "" : null,
            onclick: () => reorderVideo(playlist, v, -1) }),
          el("button", { type: "button", class: "ghost small", text: "Move down",
            disabled: playlist.videoOrder.indexOf(v.id) === playlist.videoOrder.length - 1 ? "" : null,
            onclick: () => reorderVideo(playlist, v, 1) }))) : null,
      el("div", { class: "video-menu-action" }, dangerBtn("Delete", () => {
        db.videos = db.videos.filter(x => x.id !== v.id); save(); render();
      }))));
  return el("li", { class: "row" },
    el("div", { class: "main" },
      el("a", { class: "vtitle", href: v.url, target: "_blank", rel: "noopener noreferrer", text: v.title }),
      el("span", { class: "pill", style: "--pc:" + pillColorFor(v.statusId), text: (statusOf(v.statusId) || { label: "No status" }).label })),
    el("div", { class: "ops" }, actions));
}
function tile(href, colorIdx, sub, name){
  return el("a", { class: "tile", href, style: "--tile:var(--" + PALETTE[colorIdx % 4] + ")" },
    sub ? el("span", { class: "tile-sub", text: sub }) : null,
    el("span", { class: "tile-name", text: name }));
}
function label(text){ return el("div", { class: "label", text }); }

/* ---------- routing and rendering ---------- */
function currentRoute(){ return (location.hash || "#home").slice(1); }
function link(href, text){ return el("a", { class: "crumb", href, text }); }

function render(){
  const route = currentRoute();
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const title = document.getElementById("title");
  nav.replaceChildren();
  let view;
  if (route === "prefs"){
    title.textContent = "Settings";
    nav.append(link("#home", "← Back to library"));
    view = prefsView();
  } else if (route === "s-none"){
    title.textContent = "Unsorted";
    nav.append(link("#home", "← All sections"));
    view = sectionView({ id: null, name: "Unsorted" });
  } else if (route.startsWith("p-") && playlistOf(route.slice(2))){
    const p = playlistOf(route.slice(2));
    const parent = sectionOf(p.sectionId);
    title.textContent = p.name;
    nav.append(parent ? link("#s-" + parent.id, "← " + parent.name) : link("#home", "← All sections"));
    view = playlistView(p);
  } else if (route.startsWith("s-") && sectionOf(route.slice(2))){
    const sec = sectionOf(route.slice(2));
    title.textContent = sec.name;
    nav.append(link("#home", "← All sections"));
    view = sectionView(sec);
  } else {
    title.textContent = "Video Library";
    nav.append(link("#prefs", "Settings"));
    view = homeView();
  }
  app.replaceChildren(view);
}
window.addEventListener("hashchange", () => { addOpen = false; formError = ""; render(); });

/* ---------- home ---------- */
function homeView(){
  const wrap = el("div", { class: "stack" });
  if (!db.sections.length){
    wrap.append(el("section", { class: "card" },
      el("p", { class: "hint", text: "No sections yet. Sections group your videos." }),
      el("div", { class: "btns" }, el("a", { class: "btn", href: "#prefs", text: "Add your first section" }))));
  } else {
    const grid = el("div", { class: "grid" });
    db.sections.forEach((s, idx) => grid.append(tile("#s-" + s.id, idx, null, s.name)));
    if (db.videos.some(v => !sectionOf(v.sectionId))){
      grid.append(el("a", { class: "tile tile-muted", href: "#s-none" }, el("span", { class: "tile-name", text: "Unsorted" })));
    }
    wrap.append(grid);
  }
  if (db.playlists.length){
    wrap.append(label("Playlists"));
    const grid = el("div", { class: "grid" });
    db.playlists.forEach(p => {
      const sec = sectionOf(p.sectionId);
      grid.append(tile("#p-" + p.id, Math.max(0, db.sections.indexOf(sec)), sec ? sec.name : "", p.name));
    });
    wrap.append(grid);
  }
  wrap.append(addModule(null, null));
  return wrap;
}

/* ---------- section: its playlists, then its loose videos ---------- */
function sectionView(sec){
  const wrap = el("div", { class: "stack" });
  const pls = sec.id ? playlistsIn(sec.id) : [];
  if (pls.length){
    wrap.append(label("Playlists"));
    wrap.append(el("div", { class: "grid" }, ...pls.map(p => tile("#p-" + p.id, db.sections.indexOf(sec), null, p.name))));
    wrap.append(label("Videos"));
  }
  const direct = db.videos.filter(v => (v.sectionId || null) === (sec.id || null) && !v.playlistId);
  wrap.append(filterBar(), videoList(direct, "No videos here yet. Add one below."));
  wrap.append(addModule(sec.id, null));
  return wrap;
}

/* ---------- playlist ---------- */
function playlistView(p){
  const wrap = el("div", { class: "stack" });
  const vids = db.videos.filter(v => v.playlistId === p.id);
  wrap.append(filterBar(), videoList(vids, "No videos in this playlist yet. Add one below.", p));
  wrap.append(addModule(p.sectionId, p.id));
  return wrap;
}

/* ---------- settings ---------- */
function prefsView(){
  const wrap = el("div", { class: "stack" });

  const secList = el("ul", { class: "list" });
  db.sections.forEach((s, idx) => {
    secList.append(el("li", { class: "row" },
      el("div", { class: "rowline" }, el("input", { value: s.name, "aria-label": "Section name",
        onchange: e => { const v = normalize(e.target.value); if (!v){ e.target.value = s.name; return; } s.name = cap(v); save(); render(); } })),
      el("div", { class: "ops" },
        moveBtn("↑", idx === 0, () => swap(db.sections, idx, idx - 1)),
        moveBtn("↓", idx === db.sections.length - 1, () => swap(db.sections, idx, idx + 1)),
        dangerBtn("Delete", () => {
          const gone = playlistsIn(s.id).map(p => p.id);
          db.playlists = db.playlists.filter(p => p.sectionId !== s.id);
          db.videos.forEach(v => {
            if (v.sectionId === s.id) v.sectionId = null;
            if (gone.includes(v.playlistId)) v.playlistId = null;
          });
          db.sections = db.sections.filter(x => x.id !== s.id); save(); render();
        }))));
  });
  const newSec = el("input", { placeholder: "New section name", "aria-label": "New section name" });
  wrap.append(card("Sections",
    el("p", { class: "hint", text: "Deleting a section removes its playlists. Their videos move to Unsorted." }),
    secList,
    el("div", { class: "rowline" }, newSec,
      el("button", { type: "button", class: "small", text: "Add section", onclick: () => {
        const v = normalize(newSec.value); if (!v) return;
        db.sections.push({ id: uid(), name: cap(v) }); save(); render(); } }))));

  const plList = el("ul", { class: "list" });
  db.playlists.forEach(p => {
    const sec = sectionOf(p.sectionId);
    plList.append(el("li", { class: "row" },
      el("div", { class: "rowline" },
        el("input", { value: p.name, "aria-label": "Playlist name", onchange: e => {
          const v = normalize(e.target.value); if (!v){ e.target.value = p.name; return; } p.name = cap(v); save(); render(); } }),
        el("span", { class: "hint", text: sec ? sec.name : "" })),
      el("div", { class: "ops" }, dangerBtn("Delete", () => {
        db.playlists = db.playlists.filter(x => x.id !== p.id);
        db.videos.forEach(v => { if (v.playlistId === p.id) v.playlistId = null; });
        save(); render();
      }))));
  });
  const plName = el("input", { placeholder: "New playlist name", "aria-label": "New playlist name" });
  const plSec = el("select", { "aria-label": "Playlist section" },
    ...db.sections.map(s => el("option", { value: s.id, text: s.name })));
  wrap.append(card("Playlists",
    el("p", { class: "hint", text: "Each playlist belongs to one section. A video belongs to one playlist at most." }),
    plList,
    el("div", { class: "rowline" }, plName, plSec,
      el("button", { type: "button", class: "small", text: "Add playlist", onclick: () => {
        const v = normalize(plName.value);
        if (!v || !plSec.value) return;
        resolvePlaylist(v, plSec.value); save(); render(); } }))));

  const ordered = sortedStatuses();
  const stList = el("ul", { class: "list" });
  ordered.forEach((s, idx) => {
    const inUse = db.videos.some(v => v.statusId === s.id);
    const del = dangerBtn("Delete", () => {
      if (inUse || db.statuses.length <= 1) return;
      db.statuses = db.statuses.filter(x => x.id !== s.id);
      sortedStatuses().forEach((x, i) => { x.rank = i; });
      save(); render();
    });
    if (inUse){ del.disabled = true; del.title = "Used by videos. Move them to another status first."; }
    const up = () => { const a = ordered[idx], b = ordered[idx - 1]; [a.rank, b.rank] = [b.rank, a.rank]; save(); render(); };
    const down = () => { const a = ordered[idx], b = ordered[idx + 1]; [a.rank, b.rank] = [b.rank, a.rank]; save(); render(); };
    stList.append(el("li", { class: "row" },
      el("div", { class: "rowline" }, el("input", { value: s.label, "aria-label": "Status name",
        onchange: e => { const v = normalize(e.target.value); if (!v){ e.target.value = s.label; return; } s.label = cap(v); save(); render(); } })),
      el("div", { class: "ops" }, moveBtn("↑", idx === 0, up), moveBtn("↓", idx === ordered.length - 1, down), del)));
  });
  const newSt = el("input", { placeholder: "New status name", "aria-label": "New status name" });
  wrap.append(card("Statuses",
    el("p", { class: "hint", text: "Higher on the list shows first inside a section. A status that videos still use can't be deleted." }),
    stList,
    el("div", { class: "rowline" }, newSt,
      el("button", { type: "button", class: "small", text: "Add status", onclick: () => {
        const v = normalize(newSt.value); if (!v) return;
        db.statuses.push({ id: uid(), label: cap(v), rank: db.statuses.reduce((m, s) => Math.max(m, s.rank), -1) + 1 });
        save(); render(); } }))));

  const out = el("textarea", { "aria-label": "Export and import data", placeholder: "Export text appears here. Paste an export here to import it." });
  const msg = el("div", { class: "hint", role: "status" });
  const file = el("input", { type: "file", accept: "application/json,.json", "aria-label": "Choose export file" });
  file.addEventListener("change", () => {
    const f = file.files && file.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { out.value = String(r.result || ""); msg.textContent = "File loaded. Press Import to replace the library."; };
    r.readAsText(f);
  });
  wrap.append(card("Export and import",
    el("p", { class: "hint", text: "Copy the export text into another browser or device, then paste it there and press Import." }),
    el("div", { class: "btns" },
      el("button", { type: "button", class: "ghost small", text: "Show export", onclick: () => {
        out.value = JSON.stringify(db, null, 2); out.select(); msg.textContent = "Copy this text and keep it somewhere safe."; } }),
      el("button", { type: "button", class: "ghost small", text: "Copy", onclick: () => {
        if (!out.value) return;
        navigator.clipboard.writeText(out.value).then(() => { msg.textContent = "Copied."; },
          () => { out.select(); msg.textContent = "Press Ctrl+C or Cmd+C to copy."; }); } })),
    out,
    el("label", null, "Or load an export file", file),
    el("div", { class: "btns" },
      dangerBtn("Import (replaces library)", () => {
        try {
          const p = JSON.parse(out.value);
          if (!valid(p)) throw new Error("invalid");
          ensure(p);
          const sectionIds = new Set(p.sections.map(s => s.id));
          const statusIds = new Set(p.statuses.map(s => s.id));
          const playlistIds = new Set(p.playlists.map(x => x.id));
          const first = [...p.statuses].sort((a, b) => a.rank - b.rank)[0];
          p.videos.forEach(v => {
            if (!sectionIds.has(v.sectionId)) v.sectionId = null;
            if (!playlistIds.has(v.playlistId)) v.playlistId = null;
            if (!statusIds.has(v.statusId)) v.statusId = first ? first.id : null;
          });
          db = p; save(); msg.textContent = "Imported."; render();
        } catch (e) { msg.textContent = "That text is not a valid library export."; }
      })),
    msg));
  return wrap;
}

load();
render();
