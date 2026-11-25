// スマホ用ページ
//   ?t=<token>      Get It Now：あなた盤（M1）
//   ?c=<card_token> カード：ひも付け済みなら M1、まだなら M2
//   なし            作品ページ
// どの入口でも、下に同じ特設エリア（公開日の告知・曲の紹介・みんなの My Cover）を出す
(function () {
  const C = window.MYCOVER;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const token = params.get("t");
  const cardToken = params.get("c");
  const headers = { apikey: C.publishableKey, "Content-Type": "application/json" };
  const pad = (n, d) => String(n).padStart(d, "0");
  const fmt = (sec) => {
    if (sec == null || !isFinite(sec)) return "-:--";
    sec = Math.max(0, Math.floor(sec));
    return `${Math.floor(sec / 60)}:${pad(sec % 60, 2)}`;
  };
  const cssUrl = (u) => `url("${String(u).replace(/["\\\n]/g, encodeURIComponent)}")`;

  function show(id) {
    ["loading", "error", "m1", "m2", "home"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
  }

  // ---------------------------------------------------------------- Supabase
  async function rpc(name, args) {
    const res = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`rpc ${name}: ${res.status}`);
    return res.json();
  }

  // 公開されている（非表示でない）ジャケットを新しい順に。読めるのは No.・画像・入力文だけ
  async function fetchCovers(offset, limit) {
    const q = `select=jacket_no,image_url,prompt&order=jacket_no.desc&offset=${offset}&limit=${limit}`;
    const res = await fetch(`${C.supabaseUrl}/rest/v1/covers?${q}`, { headers: { ...headers, Prefer: "count=exact" } });
    if (!res.ok) throw new Error(`covers: ${res.status}`);
    const total = Number((res.headers.get("Content-Range") || "").split("/")[1]);
    return { rows: await res.json(), total: isFinite(total) ? total : null };
  }

  // アクセス・操作の記録（持ち帰りページだけ。個人を特定する情報は送らない）
  const who = () => (cardToken ? { card_token: cardToken } : token ? { token } : null);
  function logView(kind) {
    fetch(`${C.supabaseUrl}/rest/v1/page_views`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ kind, ...who() }), keepalive: true,
    }).catch(() => {});
  }
  function logEvent(event) {
    if (!who()) return Promise.resolve();
    return fetch(`${C.supabaseUrl}/rest/v1/page_events`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ event, ...who() }), keepalive: true,
    }).catch(() => {});
  }

  // ---------------------------------------------------------------- 共通の部品
  function fillInfo(el) {
    el.replaceChildren(...C.exhibition.map((line) => Object.assign(document.createElement("div"), { textContent: line })));
  }

  function showError(message) {
    $("error-msg").textContent = message;
    show("error");
  }

  // ---------------------------------------------------------------- M1 あなた盤
  function showCover(cover) {
    $("no").textContent = "No." + pad(cover.jacket_no, C.jacketDigits);
    $("jacket").src = cover.image_url;
    $("hero-bg").style.backgroundImage = cssUrl(cover.image_url);
    $("track-title").textContent = C.track.title;
    $("artist").textContent = C.track.artist;
    $("meta").textContent = `${C.track.format}・あなた盤 No.${pad(cover.jacket_no, C.jacketDigits)}`;
    $("row-title").textContent = C.track.title;
    $("row-artist").textContent = C.track.artist;
    $("prompt").textContent = cover.prompt;
    setupPlayer();
    show("m1");
    setupSpecial({ mine: cover });
  }

  function setupPlayer() {
    const audio = new Audio(C.track.mp3);
    audio.preload = "metadata";
    const seek = $("seek");
    const dl = $("download");
    dl.href = C.track.mp3;
    dl.setAttribute("download", `${C.track.title}.mp3`);
    dl.addEventListener("click", () => logEvent("mp3_download"));
    let dragging = false;
    const update = () => {
      const d = audio.duration;
      seek.max = isFinite(d) ? d : 0;
      if (!dragging) seek.value = audio.currentTime;
      seek.style.setProperty("--pct", isFinite(d) && d ? `${(seek.value / d) * 100}%` : "0%");
      $("pos").textContent = fmt(+seek.value);
      $("dur").textContent = fmt(d);
      $("row-dur").textContent = fmt(d);
      $("play").classList.toggle("playing", !audio.paused);
    };
    ["timeupdate", "loadedmetadata", "play", "pause", "ended"].forEach((ev) => audio.addEventListener(ev, update));
    audio.addEventListener("error", () => {
      // TODO: MP3 を置くまでは「準備中」
      $("dur").textContent = "準備中";
      $("row-dur").textContent = "準備中";
      ["play", "back10", "fwd10"].forEach((id) => { $(id).disabled = true; });
      dl.classList.add("disabled");
      dl.textContent = "Download (MP3)（準備中）";
    });
    $("play").addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
    $("back10").addEventListener("click", () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
    $("fwd10").addEventListener("click", () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    seek.addEventListener("input", () => { dragging = true; update(); });
    seek.addEventListener("change", () => { audio.currentTime = +seek.value; dragging = false; update(); });
    update();
  }

  // ---------------------------------------------------------------- M2 未ひも付けカード
  function showUnlinkedCard(card) {
    $("no").textContent = "Card No." + pad(card.card_no, C.cardDigits);
    show("m2");
    setupSpecial({});
  }

  // ---------------------------------------------------------------- 作品ページ
  function showHome() {
    $("home-catch").textContent = C.work.catch;
    $("foot-home").classList.add("hidden");
    $("to-home").classList.add("hidden");
    show("home");
    setupSpecial({ home: true });
    renderDetail();
    setupMenu();
  }

  // 展示作品の詳細（config.js の detail）。項目が無ければその欄は出さない
  const el = (tag, props, ...children) => {
    const e = Object.assign(document.createElement(tag), props || {});
    e.append(...children);
    return e;
  };
  function renderDetail() {
    const d = C.detail;
    if (!d) return;
    const hideIfEmpty = (id, ok) => { if (!ok) $(id).remove(); };

    $("d-subtitle").textContent = d.subtitle || "";
    $("d-lead").textContent = d.about?.lead || "";
    $("d-body").replaceChildren(...(d.about?.body || []).map((t) => el("p", { textContent: t })));
    $("d-meanings").replaceChildren(...(d.about?.meanings || []).map((m) =>
      el("div", { className: "meaning" }, el("b", { textContent: m.word }), el("small", { textContent: m.reading }), el("p", { textContent: m.text }))));
    hideIfEmpty("about", d.about);

    // 体験の流れ：段階ごとに、鑑賞者の行動・体験してほしいこと・制作者の意図
    const j = d.journey;
    const row = (label, text) => el("div", { className: "j-row" }, el("dt", { textContent: label }), el("dd", { textContent: text }));
    $("d-journey").replaceChildren(...(j?.phases || []).map((ph) => el("section", { className: "phase" },
      el("h3", { className: "phase-title", textContent: ph.title }),
      el("ol", { className: "steps" }, ...ph.steps.map((st) => el("li", {},
        el("div", { className: "step-head" }, el("b", { textContent: st.title }),
          ...(st.tags || []).map((t) => el("span", { className: "tag", textContent: t }))),
        el("p", { className: "step-action", textContent: st.action }),
        el("dl", { className: "step-detail" }, row("体験してほしいこと", st.feel), row("制作者の意図", st.intent))))))));
    if (j?.records) $("d-records").textContent = `記録するもの：${j.records}`;
    else $("d-records").remove();
    hideIfEmpty("experience", (j?.phases || []).length);

    const r = d.research;
    if (r) {
      $("d-question").textContent = r.question || "";
      $("d-research").replaceChildren(...(r.body || []).map((t) => el("p", { textContent: t })));
      $("d-notice").textContent = r.notice || "";
      if (!r.notice) $("d-notice").remove();
    }
    hideIfEmpty("research", r);

    const sys = d.system;
    if (sys) {
      $("d-flow").replaceChildren(...(sys.flow || []).map((t) => el("li", { textContent: t })));
      $("d-points").replaceChildren(...(sys.points || []).map((t) => el("li", { textContent: t })));
    }
    hideIfEmpty("system", sys);
    $("home-detail").classList.remove("hidden");

    const ex = d.exhibition;
    if (ex) {
      $("ex-theme").textContent = ex.theme ? `${ex.name}「${ex.theme}」` : ex.name || "";
      const facts = [["会期", ex.period], ["時間", ex.hours], ["会場", ex.venue], ["形式", ex.format]].filter(([, v]) => v);
      $("ex-facts").replaceChildren(...facts.flatMap(([k, v]) => [el("dt", { textContent: k }), el("dd", { textContent: v })]));
      $("ex-layout").replaceChildren(...(ex.layout || []).map((l) => el("li", {}, el("b", { textContent: l.place }), l.detail)));
      if (ex.mapUrl) { $("ex-map").href = ex.mapUrl; $("ex-map").classList.remove("hidden"); }
      $("exhibition").classList.remove("hidden");
      $("info-card").classList.add("hidden"); // 簡易版の展示情報は出さない
    }

    const cr = d.credit;
    if (cr) {
      $("cr-name").textContent = cr.name || "";
      $("cr-name-en").textContent = cr.nameEn || "";
      $("cr-aff").textContent = (cr.affiliation || []).join("\n");
      if (C.authorUrl) $("credit").append(el("a", { className: "pill", href: C.authorUrl, target: "_blank", rel: "noopener", textContent: "作者HP" }));
      $("credit").classList.remove("hidden");
    }
  }

  // メニュー：表示されている項目だけを並べ、いま見ている項目を白くする
  function setupMenu() {
    const items = [["release", "Release"], ["song", C.track.title], ["about", "About"], ["experience", "Experience"],
      ["research", "Research"], ["system", "System"], ["everyone", "Gallery"], ["exhibition", "Exhibition"], ["credit", "Credit"]]
      .filter(([id]) => $(id) && $(id).offsetParent !== null);
    const menu = $("menu");
    menu.replaceChildren(...items.map(([id, label]) => el("a", { href: `#${id}`, textContent: label })));
    menu.classList.remove("hidden");
    const links = [...menu.querySelectorAll("a")];
    const setActive = (id) => {
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${id}`));
      const a = links.find((x) => x.getAttribute("href") === `#${id}`);
      if (a) menu.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      }, { rootMargin: "-120px 0px -55% 0px" });
      items.forEach(([id]) => io.observe($(id)));
    }
  }

  // ---------------------------------------------------------------- 特設エリア
  const WEEK = "日月火水木金土";
  const dateText = (date) => { // 端末の設定によらず日本時間で表示
    const d = new Date(date.getTime() + 9 * 3600e3);
    return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}（${WEEK[d.getUTCDay()]}）`;
  };
  function countdownText(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => pad(n, 2)).join(":");
    return d > 0 ? `公開まで あと ${d}日 ${hms}` : `公開まで あと ${hms}`;
  }

  function setupSpecial({ mine = null, home = false }) {
    const r = C.release || {};
    const official = r.officialJacketAt ? new Date(r.officialJacketAt) : null;
    const mv = r.mvAt ? new Date(r.mvAt) : null;
    $("release-sub").textContent = `「${C.track.title}」の公式ジャケットと MV が公開されます`;

    // 公式ジャケット（公開後：あなた盤と並べて表示・ダウンロード）
    $("official").addEventListener("error", () => {
      $("official").replaceWith(Object.assign(document.createElement("div"), { className: "official-empty", textContent: "準備中" }));
      $("official-dl").classList.add("disabled");
    });
    $("official-dl").href = r.officialJacketImage;
    $("official-dl").setAttribute("download", `${C.track.title}_official.jpg`);
    $("official-dl").addEventListener("click", () => logEvent("official_download"));
    if (mine) {
      $("mine").src = mine.image_url;
    } else {
      $("mine-fig").remove();
      $("compare").classList.add("single");
      $("official-fig").querySelector("figcaption").textContent = "公式ジャケット";
    }
    let officialLoaded = false;
    const loadOfficial = () => { if (!officialLoaded) { officialLoaded = true; $("official").src = r.officialJacketImage; } };

    // MV：クリックを記録してから YouTube へ
    $("mv-link").addEventListener("click", (e) => {
      e.preventDefault();
      if (!r.mvUrl) return;
      Promise.race([logEvent("mv_click"), new Promise((ok) => setTimeout(ok, 800))]).then(() => { location.href = r.mvUrl; });
    });

    // あなた盤と公式盤が並んで画面に入ったら1回だけ記録
    if (mine && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting) && !$("official-after").classList.contains("hidden")) {
          logEvent("compare_view");
          io.disconnect();
        }
      }, { threshold: 0.6 });
      io.observe($("compare"));
    }

    const tick = () => {
      const now = Date.now();
      const officialOpen = !!official && now >= official.getTime();
      const mvOpen = !!mv && now >= mv.getTime() && !!r.mvUrl;
      if (officialOpen) loadOfficial(); // 公開日まで画像を読み込まない
      $("official-before").classList.toggle("hidden", officialOpen);
      $("official-after").classList.toggle("hidden", !officialOpen);
      $("official-date").textContent = official ? `${dateText(official)} 公開` : "近日公開";
      $("official-count").textContent = official && !officialOpen ? countdownText(official - now) : "";
      $("mv-before").classList.toggle("hidden", mvOpen);
      $("mv-after").classList.toggle("hidden", !mvOpen);
      $("mv-date").textContent = mv ? `${dateText(mv)} 公開` : "近日公開";
      $("mv-count").textContent = mv && !(now >= mv.getTime()) ? countdownText(mv - now) : "";
    };
    tick();
    setInterval(tick, 1000);

    // 曲の紹介（文章が設定されているときだけ）
    if (C.work.songIntro) {
      $("song-title").textContent = `${C.track.title} について`;
      $("song-intro").textContent = C.work.songIntro;
      $("song").classList.remove("hidden");
    }

    // 展示情報
    fillInfo($("info"));
    $("foot-credit").textContent = C.exhibition[C.exhibition.length - 1];
    if (C.authorUrl) {
      $("foot-credit").append(" ／ ", Object.assign(document.createElement("a"), { href: C.authorUrl, textContent: "作者HP", target: "_blank", rel: "noopener" }));
    }

    setupEveryone({ mine, home });
    $("special").classList.remove("hidden");
  }

  // ---------------------------------------------------------------- みんなの My Cover
  function tile(c, mineNo) {
    const b = document.createElement("button");
    b.className = "tile" + (c.jacket_no === mineNo ? " mine" : "");
    const img = Object.assign(document.createElement("img"), { src: c.image_url, alt: "", loading: "lazy" });
    const label = document.createElement("span");
    label.textContent = (c.jacket_no === mineNo ? "あなた盤 " : "") + "No." + pad(c.jacket_no, C.jacketDigits);
    b.append(img, label);
    b.addEventListener("click", () => openViewer(c));
    return b;
  }

  async function setupEveryone({ mine, home }) {
    const shelf = $("shelf");
    const mineNo = mine ? mine.jacket_no : null;
    if (home) shelf.classList.add("grid");
    let offset = 0;
    const limit = home ? C.gallery.page : C.gallery.shelf;
    const load = async () => {
      try {
        const { rows, total } = await fetchCovers(offset, limit);
        offset += rows.length;
        shelf.append(...rows.map((c) => tile(c, mineNo)));
        if (total != null) $("everyone-count").textContent = `${total} 枚`;
        if (home && offset === rows.length) fillHomeStack(rows);
        $("more").classList.toggle("hidden", !home || total == null || offset >= total);
        if (!shelf.children.length) shelf.replaceWith(Object.assign(document.createElement("p"), { className: "empty-text", textContent: "まだありません。" }));
      } catch (_) {
        $("everyone").classList.add("hidden");
      }
    };
    $("more").addEventListener("click", load);
    await load();
  }

  function fillHomeStack(rows) {
    const items = rows.slice(0, 9).map((c) => Object.assign(document.createElement("img"), { src: c.image_url, alt: "" }));
    while (items.length < 9) items.push(document.createElement("i"));
    $("home-stack").replaceChildren(...items);
  }

  // ---------------------------------------------------------------- 大きく見る
  function openViewer(c) {
    $("viewer-img").src = c.image_url;
    $("viewer-no").textContent = "No." + pad(c.jacket_no, C.jacketDigits);
    $("viewer-prompt").textContent = c.prompt;
    $("viewer").classList.remove("hidden");
  }
  const closeViewer = () => $("viewer").classList.add("hidden");
  $("viewer-close").addEventListener("click", closeViewer);
  $("viewer").addEventListener("click", (e) => { if (e.target === $("viewer")) closeViewer(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeViewer(); });

  // ---------------------------------------------------------------- 読み込み
  async function loadByToken() {
    logView("get_it_now");
    // 確定直後は展示PCからの送信が届いていないことがあるので、少し待って何度か試す
    for (let i = 0; i < 12; i++) {
      const rows = await rpc("get_cover_by_token", { p_token: token });
      if (rows.length) return showCover(rows[0]);
      $("loading-msg").textContent = "ジャケットを準備しています…\nそのまましばらくお待ちください。";
      await new Promise((r) => setTimeout(r, 3000));
    }
    showError("ジャケットが見つかりませんでした。\n時間をおいてから、もう一度読み込んでください。");
  }

  async function loadByCard() {
    logView("card");
    const rows = await rpc("get_card", { p_card_token: cardToken });
    if (!rows.length) return showError("このカードは見つかりませんでした。\nURL をもう一度確認してください。");
    const card = rows[0];
    if (!card.linked) return showUnlinkedCard(card);
    showCover(card);
  }

  if (token) {
    loadByToken().catch(() => showError("読み込みに失敗しました。\n電波の良いところで、もう一度読み込んでください。"));
  } else if (cardToken) {
    loadByCard().catch(() => showError("読み込みに失敗しました。\n電波の良いところで、もう一度読み込んでください。"));
  } else {
    showHome();
  }
})();
