/* Clashbound — DOM UI. Human = P1, AI = P2.
   Flow: deck select → newGame → human mulligan (click cards to toss, confirm) →
   turns. Clash flow: engine calls CB.hooks.clashWindow; for the human defender we
   stash the decision and return PENDING — the engine keeps st.pendingAttack and
   the AI loop exits. resolveClash() applies the choice, resolves, resumes AI. */
(function () {
  const CB = window.CB, E = CB.engine;
  let st, attacking = null, logLen = 0, aiBusy = false;
  let pendingClash = null; // {attacker, defender, cards:[{handIdx, card}]}
  let mullSel = new Set(); // hand indices marked for redraw
  let deckA = "bruiser", deckB = "bulwark";

  const DECK_HERO = { bruiser: "vex", bulwark: "thorn", trickster: "odds" };
  const $ = (id) => document.getElementById(id);

  CB.hooks.humanSeat = 0;
  CB.hooks.humanClash = function (game, defPi, attacker, defender) {
    const p = game.players[defPi];
    const cards = [];
    p.hand.forEach((c, i) => { if (c.clashOnly && E.totalMana(p) >= c.cost) cards.push({ handIdx: i, card: c }); });
    if (!cards.length) return null;
    pendingClash = { attacker, defender, cards };
    render();
    return CB.hooks.PENDING;
  };

  function resolveClash(handIdx) {
    if (!pendingClash) return;
    const p = st.players[0];
    let ctx = null;
    if (handIdx !== null) {
      const c = p.hand[handIdx];
      if (c && c.clashOnly && E.totalMana(p) >= c.cost) {
        p.hand.splice(handIdx, 1);
        E.pay(p, c.cost);
        ctx = { attacker: pendingClash.attacker, defender: pendingClash.defender, negate: false };
        E.say(st, `CLASH: P1 plays ${c.name}`, 0);
        c.effect(st, 0, ctx);
        p.discard.push(c);
      }
    }
    pendingClash = null;
    E.resolveAttack(st, ctx);
    resumeAI();
  }

  function resumeAI() {
    // continue the AI turn that paused on our clash decision
    if (st.winner !== null) { aiBusy = false; render(); return; }
    CB.ai.takeTurn(st, 1);
    if (st.pendingAttack) { render(); return; } // paused again on another clash
    E.endTurn(st);
    aiBusy = false;
    if (st.winner === null) E.startTurn(st);
    render();
  }

  function showDeckSelect() {
    $("deckselect").style.display = "flex";
    $("app").style.display = "none";
  }

  function newGame() {
    const others = Object.keys(CB.cards.DECKS).filter((d) => d !== deckA);
    deckB = others[(Math.random() * others.length) | 0];
    st = E.newGame(CB.cards.DECKS[deckA], CB.cards.DECKS[deckB],
      CB.heroes.byId[DECK_HERO[deckA]], CB.heroes.byId[DECK_HERO[deckB]],
      (Math.random() * 1e9) | 0);
    attacking = null; logLen = 0; aiBusy = false; pendingClash = null; gameSeq++;
    mullSel = new Set();
    $("log").innerHTML = "";
    $("deckselect").style.display = "none";
    $("app").style.display = "block";
    CB.ai.mulligan(st, 1); // AI resolves its mulligan immediately; human chooses
    render();
  }

  function confirmMulligan() {
    if (st.phase !== "mulligan") return;
    E.mulligan(st, 0, Array.from(mullSel));
    mullSel = new Set();
    E.startTurn(st);
    render();
  }

  function kw(m) {
    const k = m.card.keywords.join(" ");
    return k + (m.sick ? " · zzz" : "") + (m.card.keywords.includes("Ward") ? (m.wardUsed ? " ·ward×" : " ·ward") : "");
  }

  function minionEl(m, mine) {
    const el = document.createElement("div");
    el.className = "minion" +
      (m.card.keywords.includes("Guard") ? " guard" : "") +
      (m.sick ? " sick" : "");
    el.innerHTML = `<div class="name">${m.card.name}</div><div class="kw">${kw(m)}</div><div class="stats">${m.atk}/${m.hp}</div>`;
    if (mine && !m.sick && !m.attacked && st.winner === null && !aiBusy && !pendingClash && st.phase === "main") {
      el.classList.add("canatk");
      el.onclick = () => { attacking = attacking === m ? null : m; render(); };
    }
    if (attacking && !mine) {
      const legal = E.legalTargets(st, 0, attacking);
      if (legal.includes(m)) { el.classList.add("targetable"); el.onclick = () => { E.attack(st, 0, attacking.uid, m); attacking = null; render(); }; }
    }
    if (attacking === m) el.classList.add("selected");
    return el;
  }

  function pips(cp, mine) {
    let s = "";
    for (let i = 0; i < E.CONTEST_TARGET; i++) s += `<span class="pip${i < cp ? " on" : ""}${mine ? " mine" : ""}"></span>`;
    return s;
  }

  function render() {
    const me = st.players[0], opp = st.players[1];
    const myAtk = me.board.reduce((s, m) => s + m.atk, 0);
    const opAtk = opp.board.reduce((s, m) => s + m.atk, 0);
    const inMulligan = st.phase === "mulligan";
    const heroArt = { vex: "art/hero-vex.svg", thorn: "art/hero-thorn.svg", odds: "art/hero-odds.svg" };
    $("oppbar").innerHTML = `<img class="heroart" src="${heroArt[opp.hero.id] || ""}" alt=""> <b>${opp.hero.name}</b> <span class="decktag">${deckB}</span> HP ${opp.hp} · hand ${opp.hand.length} · deck ${opp.deck.length} · board ATK ${opAtk}`;
    $("mybar").innerHTML = `<img class="heroart" src="${heroArt[me.hero.id] || ""}" alt=""> <b>${me.hero.name}</b> <span class="decktag">${deckA}</span> HP ${me.hp} · deck ${me.deck.length} · mana <b>${me.mana + me.tempMana}</b>${me.tempMana ? " (+" + me.tempMana + " surge)" : ""} · board ATK ${myAtk}`;
    $("cp").innerHTML = `<span class="cplabel">YOU</span> ${pips(me.cp, true)} <b>${me.cp}</b> — <b>${opp.cp}</b> ${pips(opp.cp, false)} <span class="cplabel">AI</span>`;
    $("turn").textContent = st.winner !== null
      ? `GAME OVER — ${st.winner === 0 ? "YOU WIN" : "AI WINS"} (${st.winReason})`
      : inMulligan ? "MULLIGAN — click cards to redraw"
      : pendingClash ? "CLASH — defend!" : aiBusy ? "AI thinking…" : `YOUR TURN ${st.turn}`;

    const ob = $("oppboard"); ob.innerHTML = "";
    for (let i = 0; i < E.BOARD_CAP; i++) {
      const s = document.createElement("div"); s.className = "slot";
      if (opp.board[i]) s.appendChild(minionEl(opp.board[i], false));
      ob.appendChild(s);
    }
    if (attacking && E.legalTargets(st, 0, attacking).includes("hero")) {
      $("oppbar").style.outline = "3px solid #d9534f";
      $("oppbar").onclick = () => { E.attack(st, 0, attacking.uid, "hero"); attacking = null; render(); };
    } else { $("oppbar").style.outline = ""; $("oppbar").onclick = null; }

    const mb = $("myboard"); mb.innerHTML = "";
    for (let i = 0; i < E.BOARD_CAP; i++) {
      const s = document.createElement("div"); s.className = "slot";
      if (me.board[i]) s.appendChild(minionEl(me.board[i], true));
      mb.appendChild(s);
    }

    const h = $("hand"); h.innerHTML = "";
    me.hand.forEach((c, i) => {
      const el = document.createElement("div");
      const afford = E.canPlay(st, 0, c) && !c.clashOnly;
      el.className = "card" + (afford ? "" : " unaffordable") + (inMulligan && mullSel.has(i) ? " mullsel" : "");
      const stat = c.type === "minion" ? ` ${c.atk}/${c.hp}` : "";
      const kws = (c.keywords || []).join(" ") + (c.clashOnly ? " Clash" : "");
      el.innerHTML = `<span class="cost">${c.cost}</span><span class="name">${c.name}</span><div class="txt">${kws}${stat}</div><div class="txt">${c.text || ""}</div>`;
      if (inMulligan) {
        el.classList.add("mullpick");
        el.onclick = () => { if (mullSel.has(i)) mullSel.delete(i); else mullSel.add(i); render(); };
      } else if (afford && st.winner === null && !aiBusy && !pendingClash && st.phase === "main") {
        el.onclick = () => {
          const target = c.needsTarget ? pickSpellTarget(c) : null;
          E.playCard(st, 0, i, target); render();
        };
      }
      h.appendChild(el);
    });

  // needsTarget spells: friendly spells target your board, hostile spells the enemy's.
  function pickSpellTarget(c) {
    const friendly = c.targetSide === "self";
    const board = friendly ? st.players[0].board : st.players[1].board;
    if (!board.length) return null;
    return board.reduce((a, b) => (b.atk > a.atk ? b : a));
  }

    // mulligan bar
    const mb2 = $("mulliganbar");
    if (inMulligan) {
      mb2.style.display = "flex";
      $("mullinfo").textContent = mullSel.size
        ? `${mullSel.size} card${mullSel.size === 1 ? "" : "s"} marked — confirm to redraw`
        : "Click cards to mark them for redraw, or keep your hand.";
      $("mullconfirm").textContent = mullSel.size ? `Redraw ${mullSel.size}` : "Keep hand";
    } else mb2.style.display = "none";

    // clash prompt
    const cp = $("clashprompt");
    if (pendingClash) {
      cp.style.display = "flex";
      const at = pendingClash.attacker;
      const df = pendingClash.defender;
      $("clashinfo").textContent = `${at.card.name} (${at.atk}/${at.hp}) attacks ${df === "hero" ? "YOUR HERO" : df.card.name} — play a Clash spell?`;
      const btns = $("clashcards"); btns.innerHTML = "";
      for (const { handIdx, card } of pendingClash.cards) {
        const b = document.createElement("button");
        b.textContent = `${card.name} (${card.cost})`;
        b.title = card.text || "";
        b.onclick = () => resolveClash(handIdx);
        btns.appendChild(b);
      }
    } else cp.style.display = "none";

    $("power").disabled = me.powerUsed || E.totalMana(me) < 2 || st.winner !== null || aiBusy || !!pendingClash || inMulligan;
    $("power").textContent = `${me.hero.powerName.split("(")[0].trim()} (2)`;
    $("endturn").disabled = st.winner !== null || aiBusy || !!pendingClash || inMulligan;

    const lg = $("log");
    const fresh = st.log.slice(logLen);
    if (fresh.length) {
      lg.innerHTML += fresh.map((l) => `<div class="new">${l}</div>`).join("");
      logLen = st.log.length;
      lg.scrollTop = lg.scrollHeight;
    }
  }

  let gameSeq = 0; // invalidates stale AI timers when a new game starts

  $("endturn").onclick = () => {
    if (aiBusy || pendingClash || st.phase !== "main") return;
    attacking = null;
    E.endTurn(st);
    if (st.winner !== null) { render(); return; }
    aiBusy = true;
    render();
    const seq = gameSeq;
    setTimeout(() => {
      if (seq !== gameSeq) return; // a newer game superseded this timer
      E.startTurn(st);
      CB.ai.takeTurn(st, 1);
      if (st.pendingAttack) { render(); return; } // clash prompt — resolveClash resumes
      E.endTurn(st);
      aiBusy = false;
      if (st.winner === null) E.startTurn(st);
      render();
    }, 350);
  };
  $("power").onclick = () => {
    const me = st.players[0];
    const targetless = me.hero.id === "odds";
    const t = me.hero.id === "thorn" ? me.board[0] : st.players[1].board[0];
    if (targetless || t) { E.heroPower(st, 0, targetless ? undefined : t); render(); }
  };
  $("decline").onclick = () => resolveClash(null);
  $("mullconfirm").onclick = confirmMulligan;
  $("newgame").onclick = showDeckSelect;
  document.querySelectorAll("#deckselect button[data-deck]").forEach((b) => {
    b.onclick = () => { deckA = b.dataset.deck; newGame(); };
  });

  showDeckSelect();
})();
