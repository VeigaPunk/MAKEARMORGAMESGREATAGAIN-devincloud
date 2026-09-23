/* Clashbound — core engine. file://-safe, no modules, no deps.
   Global: CB.engine. Runs in browser AND node (for the sim harness).
   Clash seam: CB.hooks.clashWindow(st, defPi, attacker, defender) → ctx | null |
   CB.hooks.PENDING (defers resolution; caller resumes via E.resolveAttack). */
(function (root) {
  const CB = (root.CB = root.CB || {});
  CB.hooks = CB.hooks || {};
  const PENDING = (CB.hooks.PENDING = { pending: true });

  const CONTEST_TARGET = 8;
  const MAX_MANA = 10;
  const BOARD_CAP = 5;
  const START_HP = 20;
  const OPEN_HAND = 3;
  const PUSH_CARD = "the-push";   // P2 compensation; variant harness may null it
  const SURGE_MANA = 1;           // temp mana when behind on CP
  const SURGE_AT = 3;             // CP deficit that triggers surge (true comeback, not subsidy)
  const SURGE_DRAW_AT = 99;       // disabled: surge draw subsidized the stronger deck
  const SURGE_ODDS_AT = 99;       // disabled
  const SURGE_ODDS_MANA = 2;
  const PIERCE_BYPASS = true;     // Pierce attackers may ignore Guard (reach)
  const GUARD_NO_CONTEST = true;  // Guard ATK excluded from the contest sum
  const GUARD_PASSIVE = false;    // Guard minions cannot attack

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let uidCounter = 1;
  function mkMinion(card, owner) {
    return {
      uid: card.id + "#" + uidCounter++,
      card, owner,
      atk: card.atk, hp: card.hp, maxHp: card.hp,
      sick: !card.keywords.includes("Blitz"),
      wardUsed: false, attacked: false,
    };
  }

  function newGame(deckA, deckB, heroA, heroB, seed) {
    const rand = rng(seed);
    const st = {
      rand, turn: 0, active: 0, phase: "mulligan",
      winner: null, winReason: null, log: [], pendingAttack: null,
      players: [
        { hero: heroA, hp: CB.engine.START_HP, mana: 0, tempMana: 0, deck: shuffle(deckA.slice(), rand), hand: [], board: [], cp: 0, discard: [], mulliganDone: false },
        { hero: heroB, hp: CB.engine.START_HP, mana: 0, tempMana: 0, deck: shuffle(deckB.slice(), rand), hand: [], board: [], cp: 0, discard: [], mulliganDone: false },
      ],
    };
    for (const p of st.players) for (let i = 0; i < CB.engine.OPEN_HAND; i++) drawCard(st, p);
    if (CB.engine.PUSH_CARD) st.players[1].hand.push(CB.cards.byId[CB.engine.PUSH_CARD]);
    say(st, `Game start. P1 ${heroA.name} vs P2 ${heroB.name}. Mulligan phase.`);
    return st;
  }

  function say(st, msg, pi) { st.log.push(`T${st.turn} P${(pi === undefined ? st.active : pi) + 1}: ${msg}`); }

  function drawCard(st, p) {
    const c = p.deck.pop();
    if (!c) { st.winner = 1 - st.players.indexOf(p); st.winReason = "deck-out"; return null; }
    if (p.hand.length < 10) p.hand.push(c); else p.discard.push(c);
    return c;
  }

  // Replace selected opening cards once, then lock the hand for the game.
  function mulligan(st, pi, indices) {
    if (st.phase !== "mulligan" || st.winner !== null) return false;
    const p = st.players[pi];
    if (p.mulliganDone) return false;
    const chosen = Array.from(new Set((indices || []).filter((i) => Number.isInteger(i) && i >= 0 && i < p.hand.length))).sort((a, b) => b - a);
    const returned = [];
    for (const i of chosen) returned.push(p.hand.splice(i, 1)[0]);
    p.deck.push(...returned);
    shuffle(p.deck, st.rand);
    for (let i = 0; i < returned.length; i++) drawCard(st, p);
    p.mulliganDone = true;
    say(st, `P${pi + 1} mulligan: ${returned.length} card${returned.length === 1 ? "" : "s"} redrawn`);
    if (st.players.every((player) => player.mulliganDone)) st.phase = "setup";
    return true;
  }

  function autoMulligan(st) {
    for (let pi = 0; pi < st.players.length; pi++) {
      const p = st.players[pi];
      if (!p.mulliganDone) mulligan(st, pi, p.hand.reduce((out, c, i) => {
        if (c.cost >= 5) out.push(i);
        return out;
      }, []));
    }
  }

  function totalMana(p) { return p.mana + p.tempMana; }

  function startTurn(st) {
    if (st.winner !== null) return;
    if (st.phase === "mulligan") autoMulligan(st);
    if (st.phase === "setup") st.phase = "main";
    if (st.phase !== "main") return;
    st.turn += st.active === 0 ? 1 : 0;
    const me = st.players[st.active], opp = st.players[1 - st.active];
    me.powerUsed = false;
    me.mana = Math.min(CB.engine.MAX_MANA, Math.ceil(st.turn));
    me.tempMana = 0;
    // surge: opponent leads contest points by ≥SURGE_AT — a true comeback lever,
    // not a constant subsidy (R2: flat surge amplified the stronger deck's recovery).
    const deficit = opp.cp - me.cp;
    if (deficit >= CB.engine.SURGE_AT) {
      const surgeKind = me.hero.surge || "standard";
      if (surgeKind === "odds" && deficit >= CB.engine.SURGE_ODDS_AT) {
        me.tempMana += CB.engine.SURGE_ODDS_MANA;
        say(st, `SURGE(odds): behind ${me.cp}-${opp.cp}, +${CB.engine.SURGE_ODDS_MANA} mana`);
      } else {
        me.tempMana += CB.engine.SURGE_MANA;
        say(st, `SURGE: behind ${me.cp}-${opp.cp}, +${CB.engine.SURGE_MANA} mana`);
      }
      if (deficit >= CB.engine.SURGE_DRAW_AT) {
        drawCard(st, me);
        if (surgeKind === "thorn") {
          for (const m of me.board) m.atk += 1;
          say(st, `SURGE(thorn): +1 draw, minions +1 ATK`);
        } else {
          say(st, `SURGE: +1 draw`);
        }
      }
    }
    for (const m of me.board) { m.sick = false; m.attacked = false; m.wardUsed = false; }
    for (const m of opp.board) m.wardUsed = false;
    drawCard(st, me);
    if (st.winner !== null) return;
    st.phase = "main";
  }

  function endTurn(st) {
    if (st.phase !== "main" || st.winner !== null) return; // contest only resolves from main phase
    const me = st.players[st.active], opp = st.players[1 - st.active];
    // contest check: more total ATK on board scores; flipping the lead steals a point.
    // GUARD_NO_CONTEST: Guard minions hold ground — their ATK doesn't contest.
    const contestAtk = (m) => (CB.engine.GUARD_NO_CONTEST && m.card.keywords.includes("Guard") ? 0 : m.atk);
    const myAtk = me.board.reduce((s, m) => s + contestAtk(m), 0);
    const opAtk = opp.board.reduce((s, m) => s + contestAtk(m), 0);
    if (myAtk > opAtk) {
      if (opp.cp - me.cp >= 2) { opp.cp -= 1; me.cp += 1; say(st, `contest STEAL: ${myAtk}>${opAtk} → CP ${me.cp}-${opp.cp}`); }
      else { me.cp += 1; say(st, `contest: ${myAtk}>${opAtk} → CP ${me.cp}-${opp.cp}`); }
    } else if (opAtk > myAtk) {
      if (me.cp - opp.cp >= 2) { me.cp -= 1; opp.cp += 1; say(st, `contest STEAL: ${opAtk}>${myAtk} → CP ${me.cp}-${opp.cp}`); }
      else { opp.cp += 1; say(st, `contest: ${opAtk}>${myAtk} → CP ${me.cp}-${opp.cp}`); }
    }
    if (me.cp >= CB.engine.CONTEST_TARGET) { st.winner = st.active; st.winReason = "contest"; return; }
    if (opp.cp >= CB.engine.CONTEST_TARGET) { st.winner = 1 - st.active; st.winReason = "contest"; return; }
    st.active = 1 - st.active;
  }

  function canPlay(st, pi, card) {
    const p = st.players[pi];
    if (totalMana(p) < card.cost) return false;
    if (card.type === "minion" && p.board.length >= CB.engine.BOARD_CAP) return false;
    if (card.needsTarget && st.players[card.targetSide === "self" ? pi : 1 - pi].board.length === 0) return false;
    return true;
  }

  function pay(p, cost) {
    const fromTemp = Math.min(p.tempMana, cost);
    p.tempMana -= fromTemp; p.mana -= cost - fromTemp;
  }

  function playCard(st, pi, handIdx, target) {
    const p = st.players[pi];
    const card = p.hand[handIdx];
    if (!card || !canPlay(st, pi, card) || st.phase !== "main") return false;
    if (card.type === "spell" && card.clashOnly) return false; // clash spells only in defense window
    p.hand.splice(handIdx, 1);
    pay(p, card.cost);
    if (card.type === "minion") {
      const m = mkMinion(card, pi);
      p.board.push(m);
      say(st, `plays ${card.name} (${m.atk}/${m.hp})`);
      if (card.warcry) card.warcry(st, pi, m, target);
    } else {
      say(st, `casts ${card.name}`);
      card.effect(st, pi, target);
      p.discard.push(card);
    }
    cleanup(st);
    return true;
  }

  function guards(board) { return board.filter((m) => m.card.keywords.includes("Guard")); }

  // legalTargets(st, atkPi, attacker?) — a Pierce attacker ignores Guard (reach).
  function legalTargets(st, atkPi, attacker) {
    const opp = st.players[1 - atkPi];
    const bypass = CB.engine.PIERCE_BYPASS && attacker && attacker.card.keywords.includes("Pierce");
    const g = bypass ? [] : guards(opp.board);
    return g.length ? g.slice() : opp.board.concat(["hero"]);
  }

  // All damage to minions routes through here → Ward applies to spells/powers/combat alike.
  function dealDamage(st, minion, amount) {
    if (minion.card.keywords.includes("Ward") && !minion.wardUsed) {
      minion.wardUsed = true;
      say(st, `${minion.card.name}'s Ward absorbs ${amount}`);
      return 0;
    }
    minion.hp -= amount;
    return amount;
  }

  function hitHero(st, oppPi, amount, label) {
    const opp = st.players[oppPi];
    opp.hp -= amount;
    if (label) say(st, `${label} (HP ${opp.hp})`);
    if (opp.hp <= 0 && st.winner === null) { st.winner = 1 - oppPi; st.winReason = "lethal"; }
  }

  // beginAttack validates and stashes the pending attack; resolveAttack finishes it.
  function beginAttack(st, atkPi, minionUid, target) {
    const me = st.players[atkPi], opp = st.players[1 - atkPi];
    const m = me.board.find((x) => x.uid === minionUid);
    if (!m || m.sick || m.attacked) return false;
    if (CB.engine.GUARD_PASSIVE && m.card.keywords.includes("Guard")) return false;
    const legal = legalTargets(st, atkPi, m);
    const t = target === "hero" ? "hero" : opp.board.find((x) => x.uid === (target && target.uid));
    if (!legal.includes(t === "hero" ? "hero" : t)) return false;
    st.pendingAttack = { atkPi, uid: minionUid, target: t === "hero" ? "hero" : t.uid };
    return true;
  }

  function resolveAttack(st, ctx) {
    const pa = st.pendingAttack;
    if (!pa) return false;
    st.pendingAttack = null;
    const me = st.players[pa.atkPi], opp = st.players[1 - pa.atkPi];
    const m = me.board.find((x) => x.uid === pa.uid);
    if (ctx && ctx.negate) {
      if (m) m.attacked = true;
      say(st, `${m ? m.card.name : "attacker"}'s attack is negated`);
      cleanup(st);
      return true;
    }
    if (!m) { cleanup(st); return true; } // clash killed the attacker — no damage
    const t = pa.target === "hero" ? "hero" : opp.board.find((x) => x.uid === pa.target);
    if (t !== "hero" && !t) { cleanup(st); return true; } // defender died to the clash
    m.attacked = true;
    if (t === "hero") {
      hitHero(st, 1 - pa.atkPi, m.atk, `${m.card.name} hits hero for ${m.atk}`);
    } else {
      say(st, `${m.card.name}(${m.atk}/${m.hp}) → ${t.card.name}(${t.atk}/${t.hp})`);
      const dealt = dealDamage(st, t, m.atk);
      if (m.card.keywords.includes("Pierce") && t.hp < 0) {
        const over = Math.min(-t.hp, dealt);
        if (over > 0) hitHero(st, 1 - pa.atkPi, over, `Pierce overflow ${over} → hero`);
      }
      dealDamage(st, m, t.atk);
    }
    cleanup(st);
    return true;
  }

  function attack(st, atkPi, minionUid, target) {
    if (!beginAttack(st, atkPi, minionUid, target)) return false;
    const pa = st.pendingAttack;
    const me = st.players[pa.atkPi], opp = st.players[1 - pa.atkPi];
    const m = me.board.find((x) => x.uid === pa.uid);
    const t = pa.target === "hero" ? "hero" : opp.board.find((x) => x.uid === pa.target);
    const ctx = CB.hooks.clashWindow ? CB.hooks.clashWindow(st, 1 - atkPi, m, t) : null;
    if (ctx === PENDING) return "pending"; // human defender deciding — st.pendingAttack retained
    return resolveAttack(st, ctx);
  }

  function heroPower(st, pi, target) {
    const p = st.players[pi];
    if (p.powerUsed || totalMana(p) < 2) return false;
    pay(p, 2); p.powerUsed = true;
    p.hero.power(st, pi, target);
    say(st, `hero power: ${p.hero.powerName}`);
    cleanup(st);
    return true;
  }

  function cleanup(st) {
    for (const p of st.players) {
      const dead = p.board.filter((m) => m.hp <= 0);
      for (const d of dead) {
        p.board.splice(p.board.indexOf(d), 1);
        p.discard.push(d.card);
        say(st, `${d.card.name} dies`);
        if (d.card.deathcry) d.card.deathcry(st, d.owner, d);
      }
    }
    // centralized lethal check — catches spell/power/clash damage, not just attacks
    for (let i = 0; i < 2; i++) {
      if (st.players[i].hp <= 0 && st.winner === null) { st.winner = 1 - i; st.winReason = "lethal"; }
    }
  }

  CB.engine = {
    CONTEST_TARGET, MAX_MANA, BOARD_CAP, START_HP, OPEN_HAND,
    PUSH_CARD, SURGE_MANA, SURGE_AT, SURGE_DRAW_AT, SURGE_ODDS_AT, SURGE_ODDS_MANA,
    PIERCE_BYPASS, GUARD_NO_CONTEST, GUARD_PASSIVE,
    newGame, startTurn, endTurn, playCard, attack, beginAttack, resolveAttack,
    heroPower, canPlay, legalTargets, totalMana, drawCard, say, mulligan,
    dealDamage, hitHero, cleanup, pay,
  };
})(typeof window !== "undefined" ? window : globalThis);
