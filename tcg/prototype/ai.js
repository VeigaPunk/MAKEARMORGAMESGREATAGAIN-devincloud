/* Clashbound — heuristic AI + clash response. Global: CB.ai. */
(function (root) {
  const CB = (root.CB = root.CB || {});

  function E() { return CB.engine; }

  // Contest scoring mirrors engine.js GUARD_NO_CONTEST: Guard ATK doesn't contest.
  function contestAtk(m) { return (E().GUARD_NO_CONTEST && m.card.keywords.includes("Guard")) ? 0 : m.atk; }

  // Heuristic policy: spend early tempo, then choose attacks by their contest impact.
  function takeTurn(st, pi) {
    const p = st.players[pi], opp = st.players[1 - pi];
    let acted = true;
    while (acted && st.winner === null) {
      acted = false;

      // The Push is deliberately a turn-one opener: the extra mana improves the
      // whole turn and is otherwise easy to strand in hand.
      if (st.turn === 1) {
        const push = p.hand.findIndex((c) => c.id === "the-push" && E().canPlay(st, pi, c));
        if (push >= 0) { E().playCard(st, pi, push, null); acted = true; continue; }
      }

      // Remove a guard when it is the only thing preventing lethal damage.
      const guards = opp.board.filter((m) => m.card.keywords.includes("Guard"));
      const boardAtk = p.board.reduce((s, m) => s + contestAtk(m), 0), oppAtk = opp.board.reduce((s, m) => s + contestAtk(m), 0);
      const ready = p.board.filter((m) => !m.sick && !m.attacked);
      const canFace = ready.some((m) => E().legalTargets(st, pi, m).includes("hero"));
      const lethalAtk = ready.reduce((s, m) => s + m.atk, 0);
      if (!canFace && guards.length && lethalAtk >= opp.hp) {
        const spell = bestDamageSpell(st, pi, guards);
        if (spell >= 0) {
          E().playCard(st, pi, spell, pickTarget(st, pi, p.hand[spell]));
          acted = true; continue;
        }
      }
      const attack = CB.ai.chooseAttack(st, pi, boardAtk, oppAtk);
      if (attack) {
        const r = E().attack(st, pi, attack.m.uid, attack.target);
        if (r === "pending" || st.pendingAttack) return; // human defender deciding — UI resumes us
        if (r !== false) { acted = true; continue; } // illegal pick (e.g. GUARD_PASSIVE) — fall through, never loop on it
      }

      let best = -1, bestCost = -1;
      for (let i = 0; i < p.hand.length; i++) {
        const c = p.hand[i];
        if (E().canPlay(st, pi, c) && c.cost > bestCost && !c.clashOnly) { best = i; bestCost = c.cost; }
      }
      if (best >= 0) {
        const c = p.hand[best];
        E().playCard(st, pi, best, pickTarget(st, pi, c));
        acted = true; continue;
      }
      if (!p.powerUsed && E().totalMana(p) >= 2) {
        const t = p.hero.id === "thorn" ? p.board[0] : (opp.board[0] || p.board[0]);
        if (t) { E().heroPower(st, pi, t); acted = true; }
      }
    }
  }

  function bestDamageSpell(st, pi, targets) {
    const p = st.players[pi];
    let best = -1, value = -1;
    for (let i = 0; i < p.hand.length; i++) {
      const c = p.hand[i];
      if (!E().canPlay(st, pi, c) || !["sucker-punch", "shank", "last-breath", "ring-out", "corner-cut"].includes(c.id)) continue;
      const damage = c.id === "sucker-punch" ? 2 : c.id === "shank" ? 3 : c.id === "corner-cut" ? 1 : 99;
      const kill = targets.some((m) => m.hp <= damage);
      const score = (kill ? 1000 : 0) + damage - c.cost * 0.1;
      if (score > value) { value = score; best = i; }
    }
    return best;
  }

  function chooseAttack(st, pi, boardAtk, oppAtk) {
    const p = st.players[pi];
    const ahead = boardAtk > oppAtk;
    let best = null, bestScore = -Infinity;
    for (const m of p.board) {
      if (m.sick || m.attacked) continue;
      if (E().GUARD_PASSIVE && m.card.keywords.includes("Guard")) continue;
      const legal = E().legalTargets(st, pi, m); // per-attacker: Pierce bypasses Guard
      for (const target of legal) {
        const isHero = target === "hero";
        const targetDies = !isHero && target.hp <= m.atk;
        const attackerDies = !isHero && target.atk >= m.hp;
        const projectedOwn = boardAtk - (attackerDies ? contestAtk(m) : 0);
        const projectedOpp = oppAtk - (targetDies ? contestAtk(target) : 0);
        const flips = boardAtk <= oppAtk && projectedOwn > projectedOpp;
        let score = (flips ? 10000 : 0) + (projectedOwn - projectedOpp) * 10;
        if (isHero) score += m.atk * 0.5;
        if (ahead && attackerDies) score -= 5000;
        if (!isHero && targetDies) score += target.atk * 4;
        if (score > bestScore) { bestScore = score; best = { m, target }; }
      }
    }
    return best;
  }

  function pickTarget(st, pi, card) {
    const opp = st.players[1 - pi];
    if (card.type === "spell") {
      const dmg = ["sucker-punch", "shank", "last-breath", "ring-out", "corner-cut"].includes(card.id);
      if (dmg && opp.board.length) {
        const guards = opp.board.filter((m) => m.card.keywords.includes("Guard"));
        const pool = guards.length ? guards : opp.board;
        return pool.reduce((a, b) => (b.atk > a.atk ? b : a));
      }
      return null;
    }
    return null;
  }

  // Clash window: defender decides whether to spend a clash spell.
  function clashResponse(st, defPi, attacker, defender) {
    const p = st.players[defPi];
    const idx = p.hand.findIndex((c) => c.clashOnly && E().totalMana(p) >= c.cost);
    if (idx < 0) return null;
    const c = p.hand[idx];
    // heuristic: feint only vs lethal/big hits; cheap clash vs efficient trades
    const incoming = attacker.atk;
    const lethal = defender === "hero" && incoming >= p.hp;
    const bigHit = incoming >= 4;
    if (c.id === "feint" && !lethal) return null;
    if (c.id !== "feint" && !bigHit && !lethal) return null;
    p.hand.splice(idx, 1);
    const fromTemp = Math.min(p.tempMana, c.cost);
    p.tempMana -= fromTemp; p.mana -= c.cost - fromTemp;
    const ctx = { attacker, defender, negate: false };
    E().say(st, `CLASH: P${defPi + 1} plays ${c.name}`, defPi);
    c.effect(st, defPi, ctx);
    p.discard.push(c);
    return ctx;
  }

  // AI mulligan rule: toss cards costing ≥5 (mirrors engine autoMulligan).
  function aiMulligan(st, pi) {
    const p = st.players[pi];
    if (p.mulliganDone) return false;
    const toss = p.hand.reduce((out, c, i) => { if (c.cost >= 5) out.push(i); return out; }, []);
    return E().mulligan(st, pi, toss);
  }

  CB.ai = { takeTurn, clashResponse, pickTarget, chooseAttack, bestDamageSpell, mulligan: aiMulligan };
  // Default clash seam: AI defender → heuristic; human defender → UI hook if installed.
  CB.hooks.clashWindow = function (st, defPi, attacker, defender) {
    if (CB.hooks.humanClash && defPi === CB.hooks.humanSeat) {
      return CB.hooks.humanClash(st, defPi, attacker, defender);
    }
    return CB.ai.clashResponse(st, defPi, attacker, defender);
  };
})(typeof window !== "undefined" ? window : globalThis);
