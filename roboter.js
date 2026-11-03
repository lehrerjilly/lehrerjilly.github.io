// Roboter-Engine für "Roboter steuern", "Wiederholen" und "Fehler finden".
// Die Level stehen in der jeweiligen HTML-Datei (MODUS, TITEL, LEVEL).
//
// Zeichen in der Karte:
//   R = Roboter (Start)   Z = Batterie (Ziel)   # = Stein   D = Diamant   . = frei
(function () {
  const PFEIL = { O: "⬆️", U: "⬇️", L: "⬅️", R: "➡️" };
  const WORT = { O: "hoch", U: "runter", L: "nach links", R: "nach rechts" };
  const DELTA = { O: [-1, 0], U: [1, 0], L: [0, -1], R: [0, 1] };
  const STUFE = { 1: ["leicht", "stufe1"], 2: ["mittel", "stufe2"], 3: ["schwer", "stufe3"] };
  const ZAHLEN = [1, 2, 3, 4, 5, 6];
  const TEMPO = 520;
  const SPEICHER = "robo-" + MODUS;

  let geschafft = laden();
  let lvl = 0, level, karte, prog = [], offen = null, zahl = 1;
  let laeuft = false, timer = null, pos, diamanten, ziel;

  const $ = id => document.getElementById(id);
  document.body.classList.add("modus-" + MODUS);

  function laden() { try { return JSON.parse(localStorage.getItem(SPEICHER)) || {}; } catch (e) { return {}; } }
  function speichern() { try { localStorage.setItem(SPEICHER, JSON.stringify(geschafft)); } catch (e) {} }

  function vorlesen(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, ""));
      u.lang = "de-DE"; u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---------- Grundgerüst ----------
  document.getElementById("app").innerHTML = `
    <div class="oben">
      <a class="zurueck" href="index.html">⬅ Übersicht</a>
      <span class="sterne" id="sterne"></span>
    </div>

    <section id="auswahl">
      <h1>${TITEL}</h1>
      <p class="auftrag">Wähle ein Level! Fang oben links an.</p>
      <div class="legende">
        <span class="schild stufe1">leicht</span>
        <span class="schild stufe2">mittel</span>
        <span class="schild stufe3">schwer</span>
      </div>
      <div class="levelgitter" id="levelgitter"></div>
    </section>

    <section id="spiel" hidden>
      <div class="kopf">
        <button class="klein" id="zurAuswahl">🗺 Level</button>
        <h1 id="lvTitel"></h1>
        <span class="schild" id="lvStufe"></span>
      </div>
      <p class="auftrag"><span id="lvAuftrag"></span>
        <button class="lautsprecher" id="vorlesenBtn" aria-label="Vorlesen">🔊</button></p>
      <div class="spielflaeche">
        <div class="feldbox"><div class="feld" id="feld"></div></div>
        <div class="steuer">
          <div class="bereich">
            <h2>📋 Mein Programm <span class="zaehler" id="zaehler"></span></h2>
            <div class="programm" id="programm"></div>
          </div>
          <div class="bereich palette" id="palette"></div>
        </div>
      </div>
      <div class="meldung" id="meldung" aria-live="polite"></div>
      <div class="knoepfe">
        <button class="knopf start" id="start">▶ Start</button>
        <button class="knopf neu" id="neu">🔄 Roboter zurück</button>
        <button class="knopf weiter" id="weiter" hidden>Nächstes Level ➡</button>
      </div>
    </section>

    <div class="picker" id="picker" hidden>
      <div class="pickerbox" id="pickerbox"></div>
    </div>`;

  // ---------- Level-Auswahl ----------
  function sterneZeigen() {
    const n = LEVEL.filter((_, i) => geschafft[i]).length;
    $("sterne").textContent = `⭐ ${n} / ${LEVEL.length}`;
  }

  function auswahlZeigen() {
    stop();
    $("spiel").hidden = true;
    $("auswahl").hidden = false;
    const g = $("levelgitter");
    g.innerHTML = "";
    LEVEL.forEach((l, i) => {
      const b = document.createElement("button");
      b.className = "levelknopf" + (geschafft[i] ? " geschafft" : "");
      const [wort, klasse] = STUFE[l.stufe];
      b.innerHTML = `<span class="nr">${i + 1}</span>
        <span class="schild ${klasse}">${wort}</span>
        <span class="stern">${geschafft[i] ? "⭐" : ""}</span>`;
      b.addEventListener("click", () => levelStarten(i));
      g.appendChild(b);
    });
    sterneZeigen();
  }

  // ---------- Level starten ----------
  function normal(k) {
    if (typeof k === "string") return { d: k };
    if (Array.isArray(k)) return { d: k[0], n: k[1] };
    return { block: k.block.slice(), n: k.n };
  }

  function levelStarten(i) {
    lvl = i;
    level = LEVEL[i];
    karte = level.karte;
    prog = MODUS === "fehler" ? level.programm.map(normal) : [];
    offen = null;
    zahl = 1;
    $("auswahl").hidden = true;
    $("spiel").hidden = false;
    $("lvTitel").textContent = `Level ${i + 1}`;
    const [wort, klasse] = STUFE[level.stufe];
    $("lvStufe").textContent = wort;
    $("lvStufe").className = "schild " + klasse;
    $("lvAuftrag").textContent = auftragText();
    $("weiter").hidden = true;
    $("start").hidden = false;
    paletteZeichnen();
    zuruecksetzen();
    sterneZeigen();
    window.scrollTo(0, 0);
  }

  function auftragText() {
    const hatDiamant = karte.some(z => z.includes("D"));
    let t = "Bring den Roboter 🤖 zur Batterie 🔋.";
    if (hatDiamant) t += " Sammle unterwegs alle Diamanten 💎 ein.";
    if (MODUS === "fehler") {
      t = "Dieses Programm hat " + (level.fehler > 1 ? level.fehler + " Fehler" : "einen Fehler") +
        ". Drücke ▶ Start und schau genau hin. Tippe dann auf eine Karte, um sie zu ändern.";
      if (hatDiamant) t += " Der Roboter muss alle Diamanten 💎 einsammeln.";
    } else if (level.max) {
      t += ` Du darfst höchstens ${level.max} ${level.max === 1 ? "Karte" : "Karten"} benutzen.`;
    }
    if (level.tipp) t += " " + level.tipp;
    return t;
  }

  // ---------- Spielfeld ----------
  function start() {
    for (let r = 0; r < karte.length; r++)
      for (let c = 0; c < karte[r].length; c++)
        if (karte[r][c] === "R") return [r, c];
  }

  function feldZeichnen() {
    const f = $("feld");
    f.innerHTML = "";
    f.style.setProperty("--spalten", karte[0].length);
    karte.forEach((zeile, r) => {
      [...zeile].forEach((ch, c) => {
        const z = document.createElement("div");
        z.className = "zelle" + ((r + c) % 2 ? " dunkel" : "");
        z.id = `z-${r}-${c}`;
        if (ch === "#") { z.classList.add("stein"); z.textContent = "🪨"; }
        if (ch === "Z") { z.classList.add("ziel"); z.textContent = "🔋"; }
        if (ch === "D") z.textContent = "💎";
        f.appendChild(z);
      });
    });
    const robo = document.createElement("div");
    robo.className = "roboter";
    robo.id = "robo";
    robo.textContent = "🤖";
    f.appendChild(robo);
    roboSetzen(false);
  }

  function roboSetzen(animiert) {
    const robo = $("robo");
    if (!animiert) robo.style.transition = "none";
    robo.style.setProperty("--r", pos[0]);
    robo.style.setProperty("--c", pos[1]);
    if (!animiert) { robo.offsetWidth; robo.style.transition = ""; }
  }

  function zuruecksetzen() {
    stop();
    pos = start();
    diamanten = new Set();
    karte.forEach((zeile, r) => [...zeile].forEach((ch, c) => {
      if (ch === "D") diamanten.add(r + "," + c);
      if (ch === "Z") ziel = [r, c];
    }));
    feldZeichnen();
    progZeichnen();
    meldung("", "");
    $("start").hidden = false;
    $("weiter").hidden = true;
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    laeuft = false;
    if ($("start")) $("start").disabled = false;
  }

  function meldung(text, art, sprechen) {
    $("meldung").textContent = text;
    $("meldung").className = "meldung " + (art || "");
    if (sprechen) vorlesen(text);
  }

  // ---------- Programm anzeigen ----------
  function progZeichnen(markiert, kaputt) {
    const p = $("programm");
    p.innerHTML = "";
    if (!prog.length) {
      p.innerHTML = `<div class="leerhinweis">Tippe unten auf die Pfeile.</div>`;
    }
    prog.forEach((k, i) => {
      const el = document.createElement("div");
      const istMarkiert = markiert && markiert.i === i;
      el.className = "prog-karte";
      el.innerHTML = `<span class="nr">${i + 1}</span>`;
      if (k.block) {
        el.classList.add("block");
        if (k === offen) el.classList.add("offen");
        el.insertAdjacentHTML("beforeend", `<span class="klammer">🔁</span>`);
        k.block.forEach((d, j) => {
          const chip = document.createElement("button");
          chip.className = "chip";
          if (istMarkiert && markiert.j === j) chip.classList.add(kaputt ? "kaputt" : "aktiv");
          chip.textContent = PFEIL[d];
          chip.setAttribute("aria-label", WORT[d]);
          chip.addEventListener("click", e => { e.stopPropagation(); karteAntippen(i, j); });
          el.appendChild(chip);
        });
        if (k === offen) {
          el.insertAdjacentHTML("beforeend", `<span class="klammer">…</span>`);
        } else {
          const a = document.createElement("button");
          a.className = "anzahl";
          a.textContent = k.n + "×";
          a.addEventListener("click", e => { e.stopPropagation(); karteAntippen(i, "n"); });
          el.appendChild(a);
        }
      } else {
        if (istMarkiert) el.classList.add(kaputt ? "kaputt" : "aktiv");
        el.insertAdjacentHTML("beforeend", `<span>${PFEIL[k.d]}</span>`);
        if (k.n) el.insertAdjacentHTML("beforeend", `<span class="anzahl">${k.n}×</span>`);
        el.setAttribute("aria-label", (k.n ? k.n + " mal " : "") + WORT[k.d]);
      }
      el.addEventListener("click", () => karteAntippen(i, null));
      p.appendChild(el);
    });

    const z = $("zaehler");
    if (level.max && MODUS !== "fehler") {
      z.textContent = `${prog.length} / ${level.max} Karten`;
      z.className = "zaehler" + (prog.length > level.max ? " zuviel" : "");
    } else {
      z.textContent = `${prog.length} ${prog.length === 1 ? "Karte" : "Karten"}`;
      z.className = "zaehler";
    }
  }

  // ---------- Bedienung ----------
  function paletteZeichnen() {
    const p = $("palette");
    p.innerHTML = "";
    if (MODUS === "fehler") {
      p.innerHTML = `
        <p class="hinweis">🐞 Finde die falsche Karte und tippe darauf.<br>Dann kannst du sie ändern.</p>
        <div class="zeile"><button class="nebenknopf" id="original">↺ Programm wie am Anfang</button></div>`;
      $("original").addEventListener("click", () => { prog = level.programm.map(normal); zuruecksetzen(); });
      return;
    }
    if (MODUS === "wiederholen") {
      p.insertAdjacentHTML("beforeend", `<div class="titel">1. Wie oft?</div><div class="zahlen" id="zahlen"></div>
        <div class="titel">2. Wohin?</div>`);
      ZAHLEN.forEach(n => {
        const b = document.createElement("button");
        b.className = "zahl";
        b.textContent = n + "×";
        b.dataset.n = n;
        b.addEventListener("click", () => { zahl = n; zahlenMarkieren(); });
        $("zahlen").appendChild(b);
      });
      zahlenMarkieren();
    }
    const kreuz = document.createElement("div");
    kreuz.className = "steuerkreuz";
    kreuz.innerHTML = `<div class="mitte">🤖</div>`;
    ["O", "L", "R", "U"].forEach(d => {
      const b = document.createElement("button");
      b.className = "pfeiltaste " + d;
      b.textContent = PFEIL[d];
      b.setAttribute("aria-label", WORT[d]);
      b.addEventListener("click", () => pfeil(d));
      kreuz.appendChild(b);
    });
    p.appendChild(kreuz);

    const zeile = document.createElement("div");
    zeile.className = "zeile";
    if (level.block) {
      zeile.innerHTML += `<button class="nebenknopf blockknopf" id="blockBtn"></button>`;
    }
    zeile.innerHTML += `<button class="nebenknopf" id="letzte">↩ Letzte weg</button>
      <button class="nebenknopf" id="alle">🗑 Alles weg</button>`;
    p.appendChild(zeile);
    if (level.block) {
      p.insertAdjacentHTML("beforeend", `<p class="hinweis" id="blockHinweis"></p>`);
      $("blockBtn").addEventListener("click", blockUmschalten);
      blockKnopfZeigen();
    }
    $("letzte").addEventListener("click", () => {
      if (laeuft) return;
      if (offen && offen.block.length) offen.block.pop();
      else { if (prog[prog.length - 1] === offen) offen = null; prog.pop(); }
      blockKnopfZeigen();
      zuruecksetzen();
    });
    $("alle").addEventListener("click", () => {
      if (laeuft) return;
      prog = []; offen = null;
      blockKnopfZeigen();
      zuruecksetzen();
    });
  }

  function zahlenMarkieren() {
    document.querySelectorAll(".zahl").forEach(b => b.classList.toggle("gewaehlt", +b.dataset.n === zahl));
  }

  function blockKnopfZeigen() {
    if (!level.block || !$("blockBtn")) return;
    const b = $("blockBtn");
    if (offen) {
      b.textContent = "✅ Muster fertig";
      b.classList.add("an");
      $("blockHinweis").textContent = "Tippe jetzt die Pfeile für das Muster. Wähle oben, wie oft. Dann: Muster fertig.";
    } else {
      b.textContent = "🔁 Muster-Block";
      b.classList.remove("an");
      $("blockHinweis").textContent = "Ein Muster-Block wiederholt mehrere Pfeile.";
    }
  }

  function blockUmschalten() {
    if (laeuft) return;
    if (offen) {
      if (!offen.block.length) prog.pop();
      else offen.n = zahl;
      offen = null;
      zahl = 1;
      zahlenMarkieren();
    } else {
      offen = { block: [], n: null };
      prog.push(offen);
    }
    blockKnopfZeigen();
    zuruecksetzen();
  }

  function pfeil(d) {
    if (laeuft) return;
    if (offen) {
      offen.block.push(d);
    } else if (MODUS === "wiederholen") {
      prog.push({ d, n: zahl });
      zahl = 1;
      zahlenMarkieren();
    } else {
      prog.push({ d });
    }
    vorlesen(WORT[d]);
    zuruecksetzen();
  }

  function karteAntippen(i, j) {
    if (laeuft) return;
    const k = prog[i];
    if (MODUS === "fehler") { pickerOeffnen(i, j); return; }
    if (k.block && j !== null && j !== "n") {
      k.block.splice(j, 1);
      if (!k.block.length && k !== offen) prog.splice(i, 1);
    } else {
      if (k === offen) offen = null;
      prog.splice(i, 1);
    }
    blockKnopfZeigen();
    zuruecksetzen();
  }

  // ---------- Reparieren (Fehler finden) ----------
  function pickerOeffnen(i, j) {
    const k = prog[i];
    const box = $("pickerbox");
    let zeigtPfeile, zeigtZahl;
    if (k.block) { zeigtPfeile = j !== null && j !== "n"; zeigtZahl = !zeigtPfeile; }
    else { zeigtPfeile = true; zeigtZahl = !!k.n; }

    function malen() {
      const aktuell = k.block ? (zeigtPfeile ? k.block[j] : null) : k.d;
      box.innerHTML = `<h2>Karte ${i + 1} ändern</h2>`;
      if (zeigtPfeile) {
        const kreuz = document.createElement("div");
        kreuz.className = "steuerkreuz";
        kreuz.innerHTML = `<div class="mitte">🔧</div>`;
        ["O", "L", "R", "U"].forEach(d => {
          const b = document.createElement("button");
          b.className = "pfeiltaste " + d + (d === aktuell ? " gewaehlt" : "");
          b.textContent = PFEIL[d];
          b.setAttribute("aria-label", WORT[d]);
          b.addEventListener("click", () => {
            if (k.block) k.block[j] = d; else k.d = d;
            malen();
          });
          kreuz.appendChild(b);
        });
        box.appendChild(kreuz);
      }
      if (zeigtZahl) {
        const zz = document.createElement("div");
        zz.className = "zahlen";
        ZAHLEN.forEach(n => {
          const b = document.createElement("button");
          b.className = "zahl" + (k.n === n ? " gewaehlt" : "");
          b.textContent = n + "×";
          b.addEventListener("click", () => { k.n = n; malen(); });
          zz.appendChild(b);
        });
        box.appendChild(zz);
      }
      const fertig = document.createElement("button");
      fertig.className = "knopf weiter";
      fertig.textContent = "✔ Fertig";
      fertig.addEventListener("click", () => { $("picker").hidden = true; zuruecksetzen(); });
      box.appendChild(fertig);
    }
    malen();
    $("picker").hidden = false;
  }

  // ---------- Programm ausführen ----------
  function schritte() {
    const s = [];
    prog.forEach((k, i) => {
      const n = k.n || 1;
      for (let w = 0; w < n; w++) {
        if (k.block) k.block.forEach((d, j) => s.push({ d, i, j }));
        else s.push({ d: k.d, i, j: null });
      }
    });
    return s;
  }

  function los() {
    if (laeuft) return;
    if (offen) blockUmschalten();
    if (!prog.length) { meldung("Das Programm ist noch leer.", "schlecht", true); return; }
    if (level.max && MODUS !== "fehler" && prog.length > level.max) {
      meldung(`Zu viele Karten! Du darfst nur ${level.max} benutzen.` +
        (MODUS === "wiederholen" ? " Tipp: Fasse gleiche Pfeile zusammen." : " Suche einen kürzeren Weg."), "schlecht", true);
      return;
    }
    zuruecksetzen();
    const liste = schritte();
    laeuft = true;
    $("start").disabled = true;
    let s = 0;

    function schritt() {
      if (s >= liste.length) { ende(); return; }
      const { d, i, j } = liste[s];
      progZeichnen({ i, j });
      const r = pos[0] + DELTA[d][0], c = pos[1] + DELTA[d][1];
      const drinnen = r >= 0 && r < karte.length && c >= 0 && c < karte[0].length;
      if (!drinnen || karte[r][c] === "#") {
        progZeichnen({ i, j }, true);
        $("robo").classList.remove("wackeln");
        $("robo").offsetWidth;
        $("robo").classList.add("wackeln");
        meldung(drinnen ? `💥 Autsch! Bei Karte ${i + 1} fährt der Roboter gegen einen Stein.`
                        : `💥 Autsch! Bei Karte ${i + 1} fährt der Roboter aus dem Feld.`, "schlecht", true);
        stop();
        return;
      }
      pos = [r, c];
      roboSetzen(true);
      const feld = $(`z-${r}-${c}`);
      if (!feld.classList.contains("ziel")) feld.classList.add("spur");
      if (diamanten.has(r + "," + c)) { diamanten.delete(r + "," + c); feld.textContent = ""; }
      s++;
      if (r === ziel[0] && c === ziel[1] && !diamanten.size) {
        timer = setTimeout(gewonnen, TEMPO);
        return;
      }
      timer = setTimeout(schritt, TEMPO);
    }

    function ende() {
      stop();
      progZeichnen();
      if (pos[0] === ziel[0] && pos[1] === ziel[1]) meldung("💎 Fast! Sammle erst alle Diamanten ein.", "schlecht", true);
      else meldung("🤔 Der Roboter ist noch nicht bei der Batterie.", "schlecht", true);
    }
    timer = setTimeout(schritt, 200);
  }

  function gewonnen() {
    stop();
    progZeichnen();
    $("robo").classList.add("jubel");
    geschafft[lvl] = true;
    speichern();
    sterneZeigen();
    meldung("🎉 Super! Der Roboter hat die Batterie!", "gut", true);
    $("start").hidden = true;
    $("weiter").hidden = false;
    $("weiter").textContent = lvl + 1 < LEVEL.length ? "Nächstes Level ➡" : "🏆 Zur Level-Übersicht";
  }

  $("start").addEventListener("click", los);
  $("neu").addEventListener("click", () => { $("start").hidden = false; $("weiter").hidden = true; zuruecksetzen(); });
  $("weiter").addEventListener("click", () => lvl + 1 < LEVEL.length ? levelStarten(lvl + 1) : auswahlZeigen());
  $("zurAuswahl").addEventListener("click", auswahlZeigen);
  $("vorlesenBtn").addEventListener("click", () => vorlesen($("lvAuftrag").textContent));
  $("picker").addEventListener("click", e => { if (e.target.id === "picker") { $("picker").hidden = true; zuruecksetzen(); } });

  auswahlZeigen();
})();
