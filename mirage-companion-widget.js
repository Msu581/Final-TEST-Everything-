/* =========================================================================
   MIRAGE COMPANION WIDGET — v5.0 "Horizon"
   Offline assistant for the Verification Suite.

   • 100% offline: no API key, no network calls, no external fonts.
   • Everything renders inside a shadow root: no style collisions.
   • Reads the portal's own session (vsuite.session) to know who is
     signed in, and unlocks Super Admin controls for super admin IDs.

   INSTALL (unchanged)
     <script src="mirage-companion-widget.js" defer></script>

   PUBLIC API (unchanged + new)
     MirageCompanion.open()
     MirageCompanion.close()
     MirageCompanion.toggle()
     MirageCompanion.ask("What tools are available?")
     MirageCompanion.forget()        // clears the remembered name
     MirageCompanion.role()          // "guest" | "staff" | "admin"   (new)
     MirageCompanion.version         // "5.0"                          (new)

   SHORTCUTS
     Alt + M   open / close Mirage        /   start a command
     Esc       close                      ↑   recall your last message

   NOTE ON SUPER ADMIN
     The portal is a static GitHub Pages site. Its sign-in is a shared
     convenience gate, not real security (see README.md), and the same is
     true of the super admin controls here: they are shortcuts for the
     admin, not a protection boundary.
   ========================================================================= */

(function () {
  'use strict';

  if (window.__mirageCompanionLoaded) return;
  window.__mirageCompanionLoaded = true;

  /* =======================================================================
     CONFIGURATION
     Values are taken from the portal's CONFIG (script.js) when available,
     so tool links, org names and accounts are never duplicated here.
     ======================================================================= */

  var SITE = (typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG : {};

  var CFG = {
    botName: 'Mirage',
    version: '5.0',
    tools: {
      tool1: {
        key: 'tool1',
        name: 'Marksheet vs TR Verification',
        short: 'Marksheet vs TR',
        url: (SITE.TOOL_URLS && SITE.TOOL_URLS.allInOne) || 'apps/allinone/'
      },
      tool2: {
        key: 'tool2',
        name: 'White vs Original Verification',
        short: 'White vs Original',
        url: (SITE.TOOL_URLS && SITE.TOOL_URLS.whiteVsOriginal) || 'apps/white-vs-original/'
      },
      tool3: {
        key: 'tool3',
        name: 'Consolidated Marksheet Checker',
        short: 'Consolidated Checker',
        url: (SITE.TOOL_URLS && SITE.TOOL_URLS.consolidatedChecker) || 'apps/consolidated-checker/'
      },
      tool4: {
        key: 'tool4',
        name: 'Provisional Result Tool',
        short: 'Provisional Result',
        url: (SITE.TOOL_URLS && SITE.TOOL_URLS.provisional) || 'apps/provisional/'
      },
      tool5: {
        key: 'tool5',
        name: 'Tr-Tru Eligibility Checker',
        short: 'Tr-Tru Eligibility',
        url: (SITE.TOOL_URLS && SITE.TOOL_URLS.trTruEligible) || 'apps/tr-tru-eligible/'
      }
    },
    orgName: SITE.ORG_NAME || 'Medhavi Skills University',
    orgUnit: SITE.ORG_UNIT || 'Controller of Examinations',
    sessionHours: SITE.SESSION_HOURS || 8,
    maxAttempts: SITE.MAX_ATTEMPTS || 5,
    lockoutSeconds: SITE.LOCKOUT_SECONDS || 30,

    /* IDs / display names treated as super admin, in addition to any
       account in CONFIG.CREDENTIALS whose id contains "superadmin". */
    superAdmins: ['SuperAdmin123'],

    sessionKey: 'vsuite.session',
    attemptsKey: 'vsuite.attempts',
    prefsKey: 'mirage_v5_prefs',
    linksKey: 'mirage_v5_links',
    chatKey: 'mirage_v5_chat',
    oldMemoryKey: 'mirage_ai_memory_v3'
  };

  var ROLE_LEVEL = { guest: 0, staff: 1, admin: 2 };

  /* =======================================================================
     STYLES
     ======================================================================= */

  var CSS = `
:host{
  all:initial;
  position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483000;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-synthesis:none;-webkit-font-smoothing:antialiased;

  --brand:#7b2332; --brand-2:#a63a4c; --brand-3:#4a1520;
  --gold:#e0a84a; --gold-soft:#f6e3bf;
  --bg:#fbf8f6; --surface:#ffffff; --surface-2:#f4efec; --surface-3:#ece4e0;
  --line:#e7ddd8; --text:#2a1d1f; --muted:#7c6a6d; --faint:#a8989b;
  --bubble-bot:#f4efec; --bubble-user:linear-gradient(135deg,var(--brand-2),var(--brand));
  --ok:#2f8a5b; --warn:#c98a1b; --bad:#c2413a;
  --shadow:0 30px 80px -20px rgba(58,19,26,.45),0 10px 30px -12px rgba(58,19,26,.25);
  --ring:0 0 0 3px rgba(224,168,74,.45);

  /* companion skin (Mirage default) */
  --shell:#cfe0a9; --shell-2:#b3cb86; --rim:#8fae66; --visor:#23392f; --eye:#e9f7c0; --glow:#b9e26f;
}
:host([data-theme=dark]){
  --bg:#17121a; --surface:#201a23; --surface-2:#2a2230; --surface-3:#342a3b;
  --line:#3a3040; --text:#f1e9ec; --muted:#b6a5ad; --faint:#85757d;
  --bubble-bot:#2a2230;
  --shadow:0 30px 80px -20px rgba(0,0,0,.75),0 10px 30px -12px rgba(0,0,0,.5);
}
:host([data-skin=nova]){ --shell:#d5cdf3; --shell-2:#b9aee9; --rim:#9788d3; --visor:#342b55; --eye:#efeaff; --glow:#b6a5ff; }
:host([data-skin=pip]){ --shell:#f3cda6; --shell-2:#e5b07c; --rim:#c98b52; --visor:#4d3726; --eye:#fff0dc; --glow:#ffc58a; }

*{box-sizing:border-box}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:none;box-shadow:var(--ring);border-radius:10px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

/* ---------------- launcher ---------------- */
.fab{
  position:fixed;right:22px;bottom:22px;width:62px;height:62px;border:0;border-radius:22px;
  background:radial-gradient(120% 120% at 30% 20%,var(--brand-2),var(--brand) 55%,var(--brand-3));
  box-shadow:0 14px 34px -8px rgba(123,35,50,.6),inset 0 1px 0 rgba(255,255,255,.25);
  display:grid;place-items:center;transition:transform .25s cubic-bezier(.2,.9,.3,1.4),box-shadow .25s;
}
.fab:hover{transform:translateY(-3px) rotate(-4deg)}
.fab:active{transform:scale(.94)}
.fab::before{content:"";position:absolute;inset:-5px;border-radius:26px;border:2px solid rgba(224,168,74,.55);opacity:0;animation:fabPulse 3.2s ease-out infinite}
@keyframes fabPulse{0%{opacity:.8;transform:scale(.92)}70%,100%{opacity:0;transform:scale(1.18)}}
.fab-face{width:34px;height:28px;border-radius:11px;background:var(--visor);border:3px solid var(--shell);display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 0 12px -2px var(--glow)}
.fab-face i{width:5px;height:10px;border-radius:4px;background:var(--eye);animation:blink 5s infinite}
.fab-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--gold);color:#3a1a0c;font-size:11px;font-weight:800;display:none;place-items:center;border:2px solid #fff}
.fab-badge.on{display:grid}
.fab-tip{position:fixed;right:94px;bottom:36px;background:var(--surface);color:var(--text);border:1px solid var(--line);padding:8px 12px;border-radius:12px;font-size:12.5px;box-shadow:var(--shadow);white-space:nowrap;opacity:0;transform:translateX(8px);transition:.3s;pointer-events:none}
.fab-tip.on{opacity:1;transform:none}
:host(.open) .fab,:host(.open) .fab-tip{display:none}

/* ---------------- panel ---------------- */
.panel{
  position:fixed;right:20px;bottom:20px;width:410px;height:min(700px,calc(100vh - 40px));
  background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:26px;
  box-shadow:var(--shadow);display:none;flex-direction:column;overflow:hidden;
  transform-origin:bottom right;
}
:host(.open) .panel{display:flex;animation:panelIn .38s cubic-bezier(.2,.9,.25,1.15)}
@keyframes panelIn{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:none}}
:host(.expanded) .panel{width:min(760px,calc(100vw - 40px));height:calc(100vh - 40px)}

/* ---------------- header ---------------- */
.head{
  position:relative;flex-shrink:0;padding:14px 14px 0;color:#fff;overflow:hidden;
  background:linear-gradient(135deg,var(--brand-3),var(--brand) 45%,var(--brand-2));
}
.head .aur{position:absolute;border-radius:50%;filter:blur(26px);opacity:.55;pointer-events:none}
.head .a1{width:160px;height:160px;background:#e0a84a;left:-40px;top:-90px;animation:drift 12s ease-in-out infinite alternate}
.head .a2{width:180px;height:180px;background:#c2416a;right:-60px;top:-70px;animation:drift 15s ease-in-out infinite alternate-reverse}
.head .a3{width:120px;height:120px;background:#7c5cff;left:40%;top:-40px;opacity:.28;animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate(40px,30px) scale(1.2)}}
.head-row{position:relative;display:flex;align-items:center;gap:11px}
.avatar{position:relative;width:44px;height:44px;border-radius:15px;background:linear-gradient(160deg,var(--shell),var(--shell-2));border:2px solid rgba(255,255,255,.55);display:grid;place-items:center;flex-shrink:0;box-shadow:0 6px 16px -6px rgba(0,0,0,.5)}
.avatar-visor{width:32px;height:22px;border-radius:9px;background:var(--visor);display:flex;align-items:center;justify-content:center;gap:6px;transform:translate(var(--ax,0),var(--ay,0));transition:transform .15s}
.avatar-visor i{width:4px;height:9px;border-radius:3px;background:var(--eye);animation:blink 5s infinite;box-shadow:0 0 6px var(--glow)}
.avatar .live{position:absolute;right:-3px;bottom:-3px;width:12px;height:12px;border-radius:50%;background:#5fd08a;border:2px solid var(--brand)}
:host([data-busy]) .avatar .live{background:var(--gold);animation:blip 1s infinite}
.title{flex:1;min-width:0}
.title b{display:flex;align-items:center;gap:7px;font-size:16px;letter-spacing:-.2px}
.title small{display:block;font-size:11.5px;opacity:.8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.role{white-space:nowrap;display:inline-block;vertical-align:middle;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.28)}
.role.admin{background:linear-gradient(135deg,#f3cf80,#e0a84a);color:#3a1a0c;border-color:transparent;box-shadow:0 0 14px -2px rgba(224,168,74,.9)}
.role.staff{background:rgba(95,208,138,.25);border-color:rgba(95,208,138,.5)}
.hbtn{width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;display:grid;place-items:center;padding:0;transition:background .2s}
.hbtn:hover{background:rgba(255,255,255,.22)}
.hbtn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hbtn.on{background:var(--gold);color:#3a1a0c;border-color:transparent}
.hactions{display:flex;gap:5px}

.tabs{position:relative;display:flex;gap:4px;margin-top:12px}
.tab{flex:1;border:0;background:transparent;color:rgba(255,255,255,.75);font-size:12.5px;font-weight:600;padding:9px 6px 11px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;gap:6px}
.tab:hover{color:#fff}
.tab[aria-selected=true]{background:var(--bg);color:var(--text)}
.tab .crown{color:var(--gold)}
.tab[hidden]{display:none}

/* ---------------- views ---------------- */
.views{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}
.view{flex:1;min-height:0;display:none;flex-direction:column}
.view.on{display:flex}
.scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--surface-3) transparent}

/* ---------------- habitat / stage ---------------- */
.stage{position:relative;flex-shrink:0;height:148px;overflow:hidden;border-bottom:1px solid var(--line);transition:height .35s ease}
.stage.min{height:0;border-bottom:0}
.scene{position:absolute;inset:0}
.scene > i{position:absolute;display:block;pointer-events:none}
.sky{inset:0}
.orb{width:38px;height:38px;border-radius:50%;right:12%;top:18px}
.far{left:-10%;right:-10%;bottom:-40px;height:95px;border-radius:50% 50% 0 0}
.near{left:-20%;right:30%;bottom:-54px;height:92px;border-radius:50% 60% 0 0}
.fx{inset:0}
/* aurora (default) */
.scene[data-s=aurora] .sky{background:linear-gradient(180deg,#1b1233,#2c1d4a 55%,#3d2350)}
.scene[data-s=aurora] .fx{background:radial-gradient(60% 40% at 20% 30%,rgba(99,242,190,.45),transparent 70%),radial-gradient(50% 40% at 70% 20%,rgba(160,120,255,.45),transparent 70%),radial-gradient(40% 30% at 50% 60%,rgba(255,120,170,.25),transparent 70%);filter:blur(8px);animation:aurora 9s ease-in-out infinite alternate}
.scene[data-s=aurora] .orb{background:#fff7da;box-shadow:0 0 30px 6px rgba(255,247,218,.45);width:24px;height:24px;top:22px}
.scene[data-s=aurora] .far{background:#2a1e3f}
.scene[data-s=aurora] .near{background:#1f1630}
.scene[data-s=aurora] .stars,.scene[data-s=night] .stars{inset:0;background-image:radial-gradient(1.4px 1.4px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 28% 12%,#fff,transparent),radial-gradient(1.2px 1.2px at 44% 30%,#fff,transparent),radial-gradient(1px 1px at 63% 14%,#fff,transparent),radial-gradient(1.4px 1.4px at 80% 36%,#fff,transparent),radial-gradient(1px 1px at 90% 10%,#fff,transparent),radial-gradient(1px 1px at 6% 48%,#fff,transparent),radial-gradient(1.2px 1.2px at 55% 50%,#fff,transparent);animation:twinkle 4s ease-in-out infinite alternate}
@keyframes aurora{to{transform:translateX(18px) skewX(-6deg);opacity:.75}}
@keyframes twinkle{to{opacity:.45}}
/* meadow */
.scene[data-s=meadow] .sky{background:linear-gradient(180deg,#8fd0f0,#cdeaf5 70%,#eef6dc)}
.scene[data-s=meadow] .orb{background:radial-gradient(circle at 40% 40%,#fff8c9,#ffd24a);box-shadow:0 0 0 8px rgba(255,226,122,.25),0 0 30px 10px rgba(255,214,90,.4)}
.scene[data-s=meadow] .far{background:#a9d38a}
.scene[data-s=meadow] .near{background:#86bd67}
.scene[data-s=meadow] .fx{background:radial-gradient(40px 12px at 18% 32%,rgba(255,255,255,.95),transparent 70%),radial-gradient(56px 14px at 58% 22%,rgba(255,255,255,.85),transparent 70%);animation:clouds 18s linear infinite alternate}
@keyframes clouds{to{transform:translateX(40px)}}
/* night */
.scene[data-s=night] .sky{background:linear-gradient(180deg,#0e1a33,#233554 70%,#34496b)}
.scene[data-s=night] .orb{background:#f4efd8;box-shadow:0 0 26px 4px rgba(244,239,216,.35),inset -7px -3px 0 #d8cfae}
.scene[data-s=night] .far{background:#1e2e48}
.scene[data-s=night] .near{background:#16233a}
/* ocean */
.scene[data-s=ocean] .sky{background:linear-gradient(180deg,#7fd3ea,#bfeaf2 60%,#fef3d9)}
.scene[data-s=ocean] .orb{background:radial-gradient(circle,#fffbe0,#ffd66b);box-shadow:0 0 30px 8px rgba(255,214,107,.45)}
.scene[data-s=ocean] .far{left:-20%;right:-20%;height:60px;bottom:-10px;border-radius:0;background:repeating-radial-gradient(circle at 50% -40px,#3fa7c9 0 14px,#57b9d6 14px 28px);animation:waves 6s linear infinite}
.scene[data-s=ocean] .near{left:-10%;right:-10%;height:34px;bottom:-6px;border-radius:0;background:#2f8fb5;opacity:.85;animation:waves 4s linear infinite reverse}
@keyframes waves{to{transform:translateX(56px)}}
/* sunset */
.scene[data-s=sunset] .sky{background:linear-gradient(180deg,#3a1f5c,#b8436b 50%,#f4a261 85%)}
.scene[data-s=sunset] .orb{top:62px;width:56px;height:56px;right:20%;background:radial-gradient(circle,#ffe6a8,#ff9d5c);box-shadow:0 0 40px 14px rgba(255,157,92,.55)}
.scene[data-s=sunset] .far{background:#5a2848}
.scene[data-s=sunset] .near{background:#3a1733}

.stage-ui{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px}
.speech{position:absolute;left:12px;top:12px;max-width:52%;background:rgba(255,255,255,.93);color:#2a1d1f;font-size:12px;line-height:1.4;padding:8px 11px;border-radius:14px 14px 14px 4px;box-shadow:0 8px 20px -10px rgba(0,0,0,.4);transition:opacity .3s,transform .3s}
.speech.hide{opacity:0;transform:translateY(-4px)}
.stage-tools{position:absolute;right:8px;bottom:8px;display:flex;gap:4px}
.sbtn{border:0;background:rgba(255,255,255,.85);color:#3a2a2c;border-radius:9px;height:26px;padding:0 9px;font-size:11px;font-weight:600;box-shadow:0 4px 12px -6px rgba(0,0,0,.4)}
.sbtn:hover{background:#fff}
.recall{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;border:0;background:#fff;color:#3a2a2c;border-radius:999px;padding:9px 16px;font-size:12px;font-weight:600;box-shadow:0 10px 24px -8px rgba(0,0,0,.45)}
.stage.away .recall{display:block}

/* ---------------- the companion ---------------- */
.actor{position:relative;width:110px;height:100px;transform:scale(.78);transform-origin:50% 100%;transition:transform 1.6s ease-in-out,opacity .6s}
.stage.away .actor{transform:scale(.78) translateX(360px);opacity:0}
.bot{position:absolute;inset:0;animation:float 3.6s ease-in-out infinite}
.bot .shadow{position:absolute;left:22px;right:22px;bottom:-4px;height:10px;border-radius:50%;background:rgba(0,0,0,.25);filter:blur(3px)}
.bot .ant{position:absolute;left:52px;top:-14px;width:5px;height:18px;border-radius:3px;background:var(--rim)}
.bot .ant::after{content:"";position:absolute;left:-5px;top:-9px;width:15px;height:15px;border-radius:50%;background:var(--glow);box-shadow:0 0 10px var(--glow)}
.bot .ear{display:none;position:absolute;top:-10px;width:30px;height:32px;background:var(--shell);border:2px solid var(--rim);border-radius:6px 26px 0 0;left:8px;transform:rotate(-14deg)}
.bot .ear.r{left:auto;right:8px;transform:scaleX(-1) rotate(-14deg)}
:host([data-skin=pip]) .bot .ear{display:block}
:host([data-skin=pip]) .bot .ant{display:none}
.bot .head{position:absolute;left:4px;right:4px;top:0;height:76px;border-radius:32px;background:linear-gradient(170deg,var(--shell),var(--shell-2));border:2px solid var(--rim);box-shadow:inset 0 6px 0 rgba(255,255,255,.35),0 6px 0 var(--rim);transition:transform .2s}
:host([data-skin=nova]) .bot .head{border-radius:44px}
.bot .visor{position:absolute;inset:14px 13px 15px;border-radius:20px;background:var(--visor);overflow:hidden;box-shadow:inset 0 3px 6px rgba(0,0,0,.4)}
.bot .visor::after{content:"";position:absolute;left:10%;top:8%;width:40%;height:22%;border-radius:10px;background:rgba(255,255,255,.1)}
.bot .eyes{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:22px;transform:translate(var(--lx,0),var(--ly,0));transition:transform .12s}
.bot .eye{width:9px;height:17px;border-radius:6px;background:var(--eye);box-shadow:0 0 8px var(--glow);animation:blink 5s infinite}
:host([data-skin=nova]) .bot .eye{width:12px;height:13px;border-radius:50%}
.bot .mouth{position:absolute;left:calc(50% - 7px);bottom:6px;width:14px;height:6px;border-bottom:3px solid var(--eye);border-radius:0 0 10px 10px;transition:.2s}
.bot .arm{position:absolute;top:50px;left:-10px;width:13px;height:30px;border-radius:10px;background:var(--shell-2);border:2px solid var(--rim);transform:rotate(14deg);transform-origin:top center}
.bot .arm.r{left:auto;right:-10px;transform:rotate(-14deg)}
.bot .foot{position:absolute;bottom:0;left:24px;width:26px;height:15px;border-radius:6px 6px 9px 9px;background:var(--rim)}
.bot .foot.r{left:auto;right:24px}
.bot .zzz{position:absolute;right:-6px;top:-14px;display:none;color:#fff;font-weight:800;text-shadow:0 1px 4px rgba(0,0,0,.4)}
.bot .zzz span{position:absolute;opacity:0;animation:snore 3s linear infinite;font-size:13px}
.bot .zzz span:nth-child(2){animation-delay:1s}.bot .zzz span:nth-child(3){animation-delay:2s}
.bot .hearts{position:absolute;left:50%;top:-6px;display:none}
.bot .hearts span{position:absolute;color:#ff6b8a;font-size:14px;opacity:0;animation:heart 1.6s ease-out 2}
.bot .hearts span:nth-child(2){left:-20px;animation-delay:.25s}.bot .hearts span:nth-child(3){left:16px;animation-delay:.5s}
/* moods */
.bot.think .ant::after{animation:glowPulse .7s ease-in-out infinite}
.bot.think .eyes{--ly:-4px !important}
.bot.happy .eye{height:8px;border-radius:8px 8px 2px 2px;animation:none}
.bot.happy .mouth{height:9px;width:18px;left:calc(50% - 9px)}
.bot.wow .mouth{width:10px;height:10px;left:calc(50% - 5px);border:3px solid var(--eye);border-radius:50%}
.bot.wow .eye{height:14px;width:14px;border-radius:50%}
.bot.love .hearts{display:block}
.bot.sleep{animation:breathe 4s ease-in-out infinite}
.bot.sleep .eye{height:3px;animation:none}
.bot.sleep .head{transform:rotate(7deg)}
.bot.sleep .zzz{display:block}
.bot.wave .arm.r{animation:wave .35s ease-in-out 6}
.bot.dance{animation:dance .45s ease-in-out 6}
.bot.jump{animation:jump .5s cubic-bezier(.3,1.6,.5,1) 2}
.bot.spin{animation:spin 1s ease-in-out}
.bot.look .head{animation:lookAround 3s ease-in-out}
.bot.stretch .arm{transform:rotate(160deg)}
.bot.stretch .arm.r{transform:rotate(-160deg)}
.actor.walk .foot{animation:step .28s infinite alternate}
.actor.walk .foot.r{animation-delay:.14s}

@keyframes float{50%{transform:translateY(-6px)}}
@keyframes blink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.1)}}
@keyframes wave{50%{transform:rotate(-130deg)}}
@keyframes dance{0%,100%{transform:rotate(-10deg) translateX(-8px)}50%{transform:rotate(10deg) translateX(8px)}}
@keyframes jump{50%{transform:translateY(-26px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes lookAround{25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}
@keyframes breathe{50%{transform:translateY(3px) scaleY(.98)}}
@keyframes step{to{transform:translateY(-7px)}}
@keyframes snore{0%{opacity:0;transform:translate(0,10px) scale(.7)}20%{opacity:.9}100%{opacity:0;transform:translate(26px,-40px) scale(1.4)}}
@keyframes heart{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translateY(-40px) scale(1.2)}}
@keyframes glowPulse{50%{box-shadow:0 0 20px 4px var(--glow);transform:scale(1.15)}}

/* ---------------- messages ---------------- */
.msgs{flex:1;min-height:0;padding:16px 14px 6px}
.day{text-align:center;font-size:10.5px;color:var(--faint);margin:2px 0 12px;letter-spacing:.06em;text-transform:uppercase}
.msg{display:flex;gap:8px;margin:0 0 14px;align-items:flex-end;animation:msgIn .3s ease}
@keyframes msgIn{from{opacity:0;transform:translateY(6px)}}
.msg .mini{width:26px;height:26px;border-radius:9px;flex-shrink:0;background:linear-gradient(160deg,var(--shell),var(--shell-2));display:grid;place-items:center}
.msg .mini i{width:18px;height:12px;border-radius:5px;background:var(--visor);display:block;position:relative}
.msg .mini i::before,.msg .mini i::after{content:"";position:absolute;top:3px;width:2.5px;height:6px;border-radius:2px;background:var(--eye)}
.msg .mini i::before{left:5px}.msg .mini i::after{right:5px}
.msg.m-user{justify-content:flex-end}
.col{max-width:84%;display:flex;flex-direction:column;gap:5px;min-width:0}
.msg.m-user .col{align-items:flex-end}
.bubble{background:var(--bubble-bot);color:var(--text);padding:10px 13px;border-radius:17px 17px 17px 5px;font-size:13.2px;line-height:1.58;overflow-wrap:anywhere}
.msg.m-user .bubble{background:var(--bubble-user);color:#fff;border-radius:17px 17px 5px 17px}
.bubble p{margin:0 0 7px}.bubble p:last-child{margin:0}
.bubble ul,.bubble ol{margin:4px 0 7px;padding-left:18px}.bubble li{margin:2px 0}
.bubble code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;background:rgba(123,35,50,.1);color:var(--brand-2);padding:1px 5px;border-radius:5px}
:host([data-theme=dark]) .bubble code{background:rgba(224,168,74,.14);color:var(--gold)}
.msg.m-user .bubble code{background:rgba(255,255,255,.2);color:#fff}
.bubble strong{font-weight:700}
.bubble h4{margin:2px 0 6px;font-size:13.5px}
.bubble .kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:6px 0;font-size:12.5px}
.bubble .kv span:nth-child(odd){color:var(--muted)}
.bubble .formula{font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:12px;white-space:pre-wrap}
.bubble.err{background:rgba(194,65,58,.1);border:1px solid rgba(194,65,58,.25)}
.bubble.admin{background:linear-gradient(135deg,rgba(224,168,74,.16),rgba(123,35,50,.08));border:1px solid rgba(224,168,74,.4)}
.meta{display:flex;gap:6px;align-items:center;font-size:10px;color:var(--faint);padding:0 4px}
.meta button{border:0;background:transparent;color:var(--faint);font-size:10.5px;padding:2px 4px;border-radius:6px}
.meta button:hover{color:var(--brand-2);background:var(--surface-2)}
.meta button.on{color:var(--brand-2)}
.acts{display:flex;flex-wrap:wrap;gap:6px}
.act{border:1px solid var(--brand-2);background:var(--surface);color:var(--brand-2);border-radius:11px;padding:7px 11px;font-size:12px;font-weight:650;display:inline-flex;align-items:center;gap:6px;transition:.18s}
.act:hover{background:var(--brand-2);color:#fff}
.act.primary{background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;border-color:transparent}
.act.primary:hover{filter:brightness(1.1)}
.act.gold{background:linear-gradient(135deg,#f3cf80,var(--gold));color:#3a1a0c;border-color:transparent}
.act.danger{border-color:var(--bad);color:var(--bad)}
.act.danger:hover{background:var(--bad);color:#fff}
:host([data-theme=dark]) .act{border-color:var(--gold);color:var(--gold)}
:host([data-theme=dark]) .act:hover{background:var(--gold);color:#2a1a0c}
:host([data-theme=dark]) .act.primary,:host([data-theme=dark]) .act.gold{color:#fff}
:host([data-theme=dark]) .act.gold{color:#3a1a0c}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:11px 12px;margin:6px 0}
.card h5{margin:0 0 3px;font-size:13px}
.card p{margin:0 0 8px;font-size:12px;color:var(--muted)}
.typing{display:inline-flex;gap:4px;padding:13px 15px;background:var(--bubble-bot);border-radius:17px 17px 17px 5px}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--faint);animation:blip 1.1s infinite}
.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}
@keyframes blip{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}

.chips{display:flex;gap:6px;overflow-x:auto;padding:4px 14px 10px;flex-shrink:0;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chip{flex-shrink:0;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:999px;padding:7px 12px;font-size:12px;white-space:nowrap;transition:.18s}
.chip:hover{border-color:var(--brand-2);color:var(--brand-2);transform:translateY(-1px)}
.chip.admin{border-color:rgba(224,168,74,.6)}
.chip.admin::before{content:"\\2654 ";color:var(--gold)}

/* ---------------- composer ---------------- */
.composer{position:relative;flex-shrink:0;padding:0 12px 10px}
.box{display:flex;align-items:flex-end;gap:4px;background:var(--surface);border:1.5px solid var(--line);border-radius:18px;padding:5px 5px 5px 14px;transition:.2s}
.box:focus-within{border-color:var(--brand-2);box-shadow:0 0 0 4px rgba(166,58,76,.12)}
.box textarea{flex:1;min-width:0;border:0;background:transparent;resize:none;outline:none;font-size:13.5px;line-height:1.45;padding:8px 0;max-height:110px;color:var(--text)}
.box textarea::placeholder{color:var(--faint)}
.ibtn{width:36px;height:36px;border:0;border-radius:12px;background:transparent;color:var(--muted);display:grid;place-items:center;flex-shrink:0;padding:0}
.ibtn:hover{background:var(--surface-2);color:var(--brand-2)}
.ibtn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ibtn.send{background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff}
.ibtn.send:disabled{opacity:.35;cursor:default}
.ibtn.listen{background:var(--bad);color:#fff;animation:micPulse 1.2s infinite}
@keyframes micPulse{50%{box-shadow:0 0 0 7px rgba(194,65,58,.18)}}
.note{display:flex;justify-content:space-between;font-size:10.5px;color:var(--faint);padding:6px 6px 0}
.note b{color:var(--muted);font-weight:600}
.palette{position:absolute;left:12px;right:12px;bottom:calc(100% - 2px);background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);max-height:250px;display:none;padding:6px}
.palette.on{display:block}
.pitem{display:flex;gap:10px;align-items:center;width:100%;border:0;background:transparent;text-align:left;padding:8px 10px;border-radius:10px;font-size:12.5px}
.pitem:hover,.pitem.sel{background:var(--surface-2)}
.pitem code{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--brand-2);font-size:12px;min-width:92px}
:host([data-theme=dark]) .pitem code{color:var(--gold)}
.pitem span{color:var(--muted);font-size:11.5px}
.pitem .lock{margin-left:auto;font-size:10px;color:var(--gold)}

/* ---------------- explore ---------------- */
.explore{padding:14px}
.search{display:flex;align-items:center;gap:8px;background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:0 12px;margin-bottom:12px}
.search:focus-within{border-color:var(--brand-2)}
.search svg{width:16px;height:16px;fill:none;stroke:var(--faint);stroke-width:2}
.search input{flex:1;border:0;background:transparent;outline:none;padding:11px 0;font-size:13px;color:var(--text)}
.cats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.cat{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:11px 12px;text-align:left;transition:.18s}
.cat:hover{border-color:var(--brand-2);transform:translateY(-1px)}
.cat.sel{border-color:var(--brand-2);background:var(--surface-2)}
.cat b{display:block;font-size:12.5px;margin-top:5px}
.cat small{color:var(--muted);font-size:11px}
.cat .ic{font-size:17px}
.topic{display:flex;justify-content:space-between;align-items:center;width:100%;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;padding:11px 4px;font-size:13px;gap:10px}
.topic:hover{color:var(--brand-2)}
.topic span{color:var(--faint);font-size:11px;flex-shrink:0}
.sec-title{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:14px 0 4px;font-weight:700}
.empty{color:var(--muted);font-size:12.5px;padding:16px 4px}

/* ---------------- admin ---------------- */
.adm-view{padding:14px}
.acard{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px;margin-bottom:12px}
.acard.hero{background:linear-gradient(135deg,var(--brand-3),var(--brand) 60%,var(--brand-2));color:#fff;border:0;position:relative;overflow:hidden}
.acard.hero::after{content:"\\2654";position:absolute;right:14px;top:4px;font-size:64px;opacity:.14}
.acard h3{margin:0 0 10px;font-size:13px;display:flex;align-items:center;gap:8px}
.acard h3 small{margin-left:auto;font-weight:500;color:var(--muted);font-size:11px}
.acard.hero h3 small{color:rgba(255,255,255,.7)}
.skv{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:12.5px}
.skv span:nth-child(odd){opacity:.72}
.meter{height:6px;border-radius:4px;background:rgba(255,255,255,.2);overflow:hidden;margin:12px 0}
.meter i{display:block;height:100%;background:linear-gradient(90deg,#f3cf80,var(--gold));border-radius:4px;transition:width .6s}
.row{display:flex;gap:7px;flex-wrap:wrap}
.hero .act{border-color:rgba(255,255,255,.5);color:#fff;background:rgba(255,255,255,.1)}
.hero .act:hover{background:#fff;color:var(--brand)}
.hero .act.gold{background:linear-gradient(135deg,#f3cf80,var(--gold));color:#3a1a0c;border-color:transparent}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tile{border:1px solid var(--line);background:var(--surface-2);border-radius:14px;padding:11px;text-align:left;transition:.18s;min-width:0}
.tile:hover{border-color:var(--brand-2);transform:translateY(-1px)}
.tile b{display:block;font-size:12.5px;margin-top:4px}
.tile small{display:block;color:var(--muted);font-size:10.5px;margin-top:2px}
.tile .ic{font-size:16px}
.link-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.link-row:last-child{border-bottom:0}
.link-row .nm{flex:1;min-width:0}
.link-row .nm small{display:block;color:var(--faint);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xbtn{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:5px 9px;font-size:11px}
.xbtn:hover{border-color:var(--brand-2);color:var(--brand-2)}
.xbtn.del:hover{border-color:var(--bad);color:var(--bad)}
.form2{display:grid;grid-template-columns:1fr 1.4fr auto;gap:6px;margin-top:10px}
.form2 input{min-width:0;border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:8px 10px;font-size:12px;outline:none;color:var(--text)}
.form2 input:focus{border-color:var(--brand-2)}
.users{font-size:12.5px}
.users div{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}
.users div:last-child{border-bottom:0}
.users code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--muted)}
.pill{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:var(--surface-3);color:var(--muted)}
.pill.gold{background:var(--gold-soft);color:#6b3f06}
.pill.you{background:rgba(95,208,138,.2);color:var(--ok)}
.small-note{font-size:11px;color:var(--muted);line-height:1.5;margin:8px 0 0}

/* ---------------- settings ---------------- */
.settings{position:absolute;inset:0;z-index:20;background:var(--bg);display:none;flex-direction:column}
.settings.on{display:flex;animation:msgIn .25s ease}
.set-head{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 8px}
.set-head h2{margin:0;font-size:17px;letter-spacing:-.3px}
.set-body{padding:4px 16px 18px;flex:1}
.set-group{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:4px 14px;margin-bottom:12px}
.set{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);font-size:13px}
.set.stack{flex-direction:column;align-items:stretch;gap:9px}
.set.stack .seg{flex-wrap:wrap;justify-content:flex-start}
.box textarea:focus,.box textarea:focus-visible{outline:none;box-shadow:none}
.set:last-child{border-bottom:0}
.set small{display:block;color:var(--muted);font-size:11px;margin-top:2px;line-height:1.45}
.switch{position:relative;width:40px;height:23px;flex-shrink:0}
.switch input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer;z-index:1}
.switch i{position:absolute;inset:0;border-radius:12px;background:var(--surface-3);transition:.2s}
.switch i::after{content:"";position:absolute;left:3px;top:3px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:.2s}
.switch input:checked + i{background:var(--brand-2)}
.switch input:checked + i::after{transform:translateX(17px)}
.switch input:focus-visible + i{box-shadow:var(--ring)}
.seg{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.seg button{border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:6px 9px;font-size:11.5px}
.seg button[aria-pressed=true]{border-color:var(--brand-2);background:var(--brand-2);color:#fff}
.swatch{width:26px;height:26px;border-radius:50%;padding:0 !important;border:2px solid var(--surface) !important;box-shadow:0 0 0 1px var(--line)}
.swatch[aria-pressed=true]{box-shadow:0 0 0 2px var(--brand-2) !important}
.swatch[data-v=aurora]{background:linear-gradient(135deg,#2c1d4a,#63f2be)}
.swatch[data-v=meadow]{background:linear-gradient(135deg,#8fd0f0,#86bd67)}
.swatch[data-v=night]{background:linear-gradient(135deg,#0e1a33,#34496b)}
.swatch[data-v=ocean]{background:linear-gradient(135deg,#7fd3ea,#2f8fb5)}
.swatch[data-v=sunset]{background:linear-gradient(135deg,#3a1f5c,#f4a261)}
.skin{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:58px}
.skin i{width:28px;height:24px;border-radius:9px;border:4px solid;display:block}
.skin[data-v=mirage] i{border-color:#cfe0a9;background:#23392f}
.skin[data-v=nova] i{border-color:#d5cdf3;background:#342b55;border-radius:50%}
.skin[data-v=pip] i{border-color:#f3cda6;background:#4d3726}
.wide-btn{width:100%;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:10px;font-size:12.5px;margin-top:8px}
.wide-btn:hover{border-color:var(--bad);color:var(--bad)}
.foot-note{font-size:11px;color:var(--muted);line-height:1.6;margin:10px 2px 0}

/* toast */
.toast{position:absolute;left:50%;bottom:86px;transform:translateX(-50%) translateY(10px);background:var(--text);color:var(--bg);font-size:12px;padding:8px 14px;border-radius:999px;opacity:0;transition:.25s;pointer-events:none;z-index:30;white-space:nowrap}
.toast.on{opacity:1;transform:translateX(-50%)}

/* motion off */
:host([data-motion=off]) *,:host([data-motion=off]) *::before,:host([data-motion=off]) *::after{animation:none !important;transition:none !important}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition:none !important}}

@media (max-width:480px){
  #exp-btn{display:none}
  .panel{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0;border:0}
  :host(.expanded) .panel{width:100vw;height:100dvh}
  .fab{right:16px;bottom:16px}
  .stage{height:128px}
  .fab-tip{display:none}
}
@media (max-height:620px){ .stage{height:108px} .actor{transform:scale(.62)} }
`;

  /* =======================================================================
     MARKUP
     ======================================================================= */

  var ICON = {
    voice: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    expand: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
  };

  var MARKUP = `
<button class="fab" id="fab" type="button" aria-label="Open Mirage assistant (Alt+M)">
  <span class="fab-face" aria-hidden="true"><i></i><i></i></span>
  <span class="fab-badge" id="fab-badge">1</span>
</button>
<div class="fab-tip" id="fab-tip" aria-hidden="true">Need help? Ask Mirage ✨</div>

<div class="panel" id="panel" role="dialog" aria-label="Mirage assistant">

  <header class="head">
    <i class="aur a1"></i><i class="aur a2"></i><i class="aur a3"></i>
    <div class="head-row">
      <div class="avatar" aria-hidden="true"><div class="avatar-visor" id="avatar-visor"><i></i><i></i></div><span class="live"></span></div>
      <div class="title">
        <b><span id="bot-name">Mirage</span> <span class="role" id="role-badge">Guest</span></b>
        <small id="status-line">Offline assistant · nothing leaves this browser</small>
      </div>
      <div class="hactions">
        <button class="hbtn" id="voice-btn" type="button" aria-pressed="false" title="Read replies aloud" aria-label="Read replies aloud">${ICON.voice}</button>
        <button class="hbtn" id="set-btn" type="button" title="Settings" aria-label="Settings">${ICON.gear}</button>
        <button class="hbtn" id="exp-btn" type="button" title="Expand" aria-label="Expand">${ICON.expand}</button>
        <button class="hbtn" id="close-btn" type="button" title="Close (Esc)" aria-label="Close">${ICON.close}</button>
      </div>
    </div>
    <nav class="tabs" role="tablist" aria-label="Mirage sections">
      <button class="tab" role="tab" type="button" data-view="chat" aria-selected="true">💬 Chat</button>
      <button class="tab" role="tab" type="button" data-view="explore" aria-selected="false">🧭 Explore</button>
      <button class="tab" role="tab" type="button" data-view="admin" aria-selected="false" hidden><span class="crown">♔</span> Admin</button>
    </nav>
  </header>

  <div class="views">

    <section class="view on" id="view-chat" role="tabpanel">
      <div class="stage" id="stage">
        <div class="scene" id="scene" data-s="aurora" aria-hidden="true">
          <i class="sky"></i><i class="stars"></i><i class="fx"></i><i class="orb"></i><i class="far"></i><i class="near"></i>
        </div>
        <div class="stage-ui">
          <div class="speech" id="speech">Hi! I'm Mirage 👋</div>
          <div class="actor" id="actor">
            <div class="bot" id="bot" role="img" aria-label="Mirage, the assistant's companion">
              <div class="shadow"></div>
              <div class="ant"></div><div class="ear"></div><div class="ear r"></div>
              <div class="arm"></div><div class="arm r"></div>
              <div class="foot"></div><div class="foot r"></div>
              <div class="head"><div class="visor"><div class="eyes"><div class="eye"></div><div class="eye"></div></div><div class="mouth"></div></div></div>
              <div class="zzz"><span>z</span><span>z</span><span>Z</span></div>
              <div class="hearts"><span>♥</span><span>♥</span><span>♥</span></div>
            </div>
          </div>
          <div class="stage-tools">
            <button class="sbtn" data-pet="wave" type="button" title="Wave" aria-label="Wave">👋</button>
            <button class="sbtn" data-pet="dance" type="button" title="Dance" aria-label="Dance">🕺</button>
            <button class="sbtn" data-pet="jump" type="button" title="Jump" aria-label="Jump">⤴</button>
            <button class="sbtn" data-pet="sleep" type="button" id="nap-btn" title="Nap" aria-label="Nap">😴</button>
          </div>
          <button class="recall" id="recall" type="button">Come back, Mirage ↗</button>
        </div>
      </div>

      <div class="msgs scroll" id="msgs" role="log" aria-live="polite" aria-label="Conversation"></div>
      <div class="chips" id="chips" aria-label="Suggestions"></div>

      <div class="composer">
        <div class="palette scroll" id="palette" role="listbox" aria-label="Commands"></div>
        <form class="box" id="form" autocomplete="off">
          <label class="sr" for="input">Message Mirage</label>
          <textarea id="input" rows="1" maxlength="500" placeholder="Ask anything, or type / for commands"></textarea>
          <button class="ibtn" id="mic" type="button" title="Speak" aria-label="Speak your question">${ICON.mic}</button>
          <button class="ibtn send" id="send" type="submit" aria-label="Send" disabled>${ICON.send}</button>
        </form>
        <div class="note"><span id="voice-status">Enter to send · <b>/</b> commands · <b>Alt+M</b> toggle</span><span>v5.0</span></div>
      </div>
    </section>

    <section class="view" id="view-explore" role="tabpanel">
      <div class="explore scroll" style="flex:1">
        <label class="search">${ICON.search}<input id="ex-search" type="search" placeholder="Search every topic Mirage knows…" aria-label="Search topics"></label>
        <div class="cats" id="ex-cats"></div>
        <div id="ex-list"></div>
      </div>
    </section>

    <section class="view" id="view-admin" role="tabpanel">
      <div class="adm-view scroll" style="flex:1" id="admin-body"></div>
    </section>

    <section class="settings" id="settings" aria-label="Settings">
      <div class="set-head">
        <h2>Settings</h2>
        <button class="ibtn" id="set-close" type="button" aria-label="Close settings">${ICON.close}</button>
      </div>
      <div class="set-body scroll">
        <div class="set-group">
          <div class="set stack"><span>Companion<small>Who keeps you company.</small></span>
            <span class="seg" data-pref="skin">
              <button class="skin" data-v="mirage" type="button"><i></i>Mirage</button>
              <button class="skin" data-v="nova" type="button"><i></i>Nova</button>
              <button class="skin" data-v="pip" type="button"><i></i>Pip</button>
            </span></div>
          <div class="set stack"><span>Scene<small>The world behind your companion.</small></span>
            <span class="seg" data-pref="scene">
              <button class="swatch" data-v="aurora" type="button" title="Aurora" aria-label="Aurora"></button>
              <button class="swatch" data-v="meadow" type="button" title="Meadow" aria-label="Meadow"></button>
              <button class="swatch" data-v="night" type="button" title="Night" aria-label="Night"></button>
              <button class="swatch" data-v="ocean" type="button" title="Ocean" aria-label="Ocean"></button>
              <button class="swatch" data-v="sunset" type="button" title="Sunset" aria-label="Sunset"></button>
            </span></div>
          <div class="set stack"><span>Appearance<small>Auto follows the site's light / dark switch.</small></span>
            <span class="seg" data-pref="theme">
              <button data-v="auto" type="button">Auto</button><button data-v="light" type="button">Light</button><button data-v="dark" type="button">Dark</button>
            </span></div>
          <label class="set"><span>Show habitat<small>The animated scene above the chat.</small></span><span class="switch"><input type="checkbox" data-pref="habitat"><i></i></span></label>
        </div>

        <div class="set-group">
          <label class="set"><span>Idle activities<small>Plays, naps, and wanders off when left alone.</small></span><span class="switch"><input type="checkbox" data-pref="idle"><i></i></span></label>
          <label class="set"><span>Animations<small>Your device's reduced-motion setting also applies.</small></span><span class="switch"><input type="checkbox" data-pref="motion"><i></i></span></label>
          <label class="set"><span>Instant replies<small>Skip the typing pause.</small></span><span class="switch"><input type="checkbox" data-pref="instant"><i></i></span></label>
          <label class="set"><span>Keep chat between pages<small>Stored for this tab only; cleared when it closes.</small></span><span class="switch"><input type="checkbox" data-pref="keepChat"><i></i></span></label>
          <label class="set"><span>Read replies aloud<small>Uses your device's built-in voice (works offline).</small></span><span class="switch"><input type="checkbox" data-pref="speak"><i></i></span></label>
        </div>

        <button class="wide-btn" id="forget-btn" type="button">Forget my name and preferences</button>
        <p class="foot-note">Mirage runs entirely in this browser: no API key, no server, no tracking. Only your preferences, remembered name and saved links are kept on this device. Voice input uses the browser's speech service, which in some browsers (e.g. Chrome) needs an internet connection; everything else works offline.</p>
      </div>
    </section>

    <div class="toast" id="toast" role="status"></div>
  </div>
</div>
`;

  /* =======================================================================
     KNOWLEDGE BASE
     Each entry: id, cat, topic, t (title), q (example questions),
     k (keywords), a (answer, light markdown or a function(ctx)),
     more (optional deeper answer), f (follow-up chips), b (buttons).
     Markdown: **bold**, `code`, "- " bullets, "1. " steps, ``` formula ```.
     ======================================================================= */

  var CATS = [
    { id: 'start',    ic: '🚀', t: 'Getting started',   d: 'What this site is' },
    { id: 'access',   ic: '🔐', t: 'Sign-in & session', d: 'Login, lockout, expiry' },
    { id: 'portal',   ic: '🏠', t: 'Portal & site',     d: 'Sections, theme, seasons' },
    { id: 'tool1',    ic: '📑', t: 'Marksheet vs TR',   d: 'Tool 01 (All-in-One)' },
    { id: 'tool2',    ic: '🧾', t: 'White vs Original', d: 'Tool 02, four checks' },
    { id: 'tool3',    ic: '🎓', t: 'Consolidated Checker', d: 'Tool 03, transcript audit' },
    { id: 'tool4',    ic: '📋', t: 'Provisional Result', d: 'Tool 04, regular + improvement' },
    { id: 'tool5',    ic: '✅', t: 'Tr-Tru Eligibility', d: 'Tool 05, semester eligibility' },
    { id: 'reports',  ic: '📊', t: 'Excel reports',     d: 'Every sheet explained' },
    { id: 'trouble',  ic: '🛠', t: 'Troubleshooting',   d: 'When something is off' },
    { id: 'glossary', ic: '📖', t: 'Glossary',          d: 'TR, SGPA, T-P-PR…' },
    { id: 'calc',     ic: '🧮', t: 'Calculators',       d: 'SGPA, %, credits' },
    { id: 'mirage',   ic: '✨', t: 'About Mirage',      d: 'What I can do' },
    { id: 'admin',    ic: '♔',  t: 'Super admin',       d: 'Special controls', level: 'admin' }
  ];

  var T1 = 'tool1', T2 = 'tool2', T3 = 'tool3', T4 = 'tool4', T5 = 'tool5';

  var KB = [

    /* ------------------------------------------------ getting started */
    { id: 'about', cat: 'start', topic: 'site', t: 'What is the Verification Suite?',
      q: ['what is this website', 'what is this site', 'what is this portal', 'what does this site do', 'tell me about this website', 'what can i do here', 'purpose of this portal', 'what is verification suite', 'explain this website', 'overview'],
      k: ['website', 'site', 'portal', 'suite', 'purpose', 'overview'],
      a: function (c) {
        return '**The Verification Suite** is the ' + c.org.unit + ' office\'s single entry point for checking examination records at ' + c.org.name + '.\n\n' +
          'It holds **five independent tools**:\n' +
          '- **Marksheet vs TR** checks issued gradesheet PDFs against the tabulated result (TR).\n' +
          '- **White vs Original** checks white-background copies against sealed originals, and also runs SGPA, withheld and failed-candidate checks.\n' +
          '- **Consolidated Marksheet Checker** audits consolidated transcript PDFs, recomputing every SGPA, CGPA, credit, mark and percentage with exact arithmetic.\n' +
          '- **Provisional Result** combines each semester\'s Regular and Improvement TRs, keeps the better attempt per subject and decides who gets a provisional result.\n' +
          '- **Tr-Tru Eligibility** reads one Truscholar marksheet or TR per semester and marks each student Eligible only if no subject in any semester is F / Fail.\n\n' +
          'Everything runs **in your browser**. Files never leave your device, and every check ends in an **Excel report**.';
      },
      f: ['What tools are available?', 'How does it work?', 'Is my data safe?'],
      b: [['See the tools', 'nav:tools']] },

    { id: 'tools', cat: 'start', topic: 'site', t: 'Which tools are available?',
      q: ['what tools are available', 'which tools', 'list the tools', 'what are the two tools', 'what are the three tools', 'what are the five tools', 'what are the 5 tools', 'show me the tools', 'available applications', 'what apps are there', 'tools list'],
      k: ['tools', 'tool', 'apps', 'applications', 'available', 'list'],
      a: '**01 · Marksheet vs TR Verification** (All-in-One)\nLoads the TR spreadsheet and a batch of gradesheet PDFs, pairs them on registration number, and reports every field that disagrees.\n\n' +
         '**02 · White vs Original Verification**\nA toolkit of four checks:\n1. White vs Original comparison\n2. SGPA & Percentage recomputation\n3. Withheld students (from the TR)\n4. Failed candidates (from PDFs, TR, or both)\n\n' +
         '**03 · Consolidated Marksheet Checker**\nReads each consolidated transcript PDF, recomputes every SGPA, CGPA, credit, mark and percentage from the printed subject rows, and checks each against what the transcript prints.\n\n' +
         '**04 · Provisional Result Tool**\nLoads the Regular TR and the Improvement / Supplementary TR for each semester (up to 8), keeps the higher total per subject, applies the Withheld (W in Grace) rule and builds the provisional result workbook.\n\n' +
         '**05 · Tr-Tru Eligibility Checker**\nTakes one Truscholar marksheet or TR per semester (.xlsx / .csv), matches students by Enrollment No and marks each one **Eligible** only if no subject in any semester has grade F / Fail.',
      f: ['Which tool should I use?', 'How do I use Marksheet vs TR?', 'How do I use the Provisional Result tool?', 'How do I use the Tr-Tru Eligibility Checker?'],
      b: [['Open Marksheet vs TR', 'open:tool1'], ['Open White vs Original', 'open:tool2'], ['Open Consolidated Checker', 'open:tool3'], ['Open Provisional Result', 'open:tool4'], ['Open Tr-Tru Eligibility', 'open:tool5']] },

    { id: 'which', cat: 'start', topic: 'site', t: 'Which tool should I use?',
      q: ['which tool should i use', 'which one do i need', 'which tool for my task', 'which tool checks sgpa', 'which tool for withheld', 'which tool for failed students', 'difference between the two tools', 'difference between the three tools', 'tool1 vs tool2', 'allinone vs whitevsoriginal', 'which tool checks cgpa', 'which tool for consolidated transcript', 'when to use which tool', 'compare the tools', 'which tool for provisional result', 'which tool for improvement tr', 'which tool for supplementary', 'which tool checks eligibility', 'which tool for eligible students', 'difference between the five tools'],
      k: ['which', 'difference', 'compare', 'choose', 'versus'],
      a: 'Pick by **what you are comparing**:\n' +
         '- Gradesheet PDFs **against the TR spreadsheet** → **Marksheet vs TR**\n' +
         '- White-background PDFs **against sealed original PDFs** → **White vs Original** (module 1)\n' +
         '- Check that the **printed SGPA / percentage** are correct → White vs Original (module 2)\n' +
         '- Find **withheld** students (W in the Grace cell) → White vs Original (module 3)\n' +
         '- Find **failed** candidates → White vs Original (module 4)\n' +
         '- Audit a **consolidated transcript** (all semesters: SGPA, **CGPA**, credits, marks, percentage) → **Consolidated Marksheet Checker**\n' +
         '- Combine **Regular + Improvement / Supplementary TRs** and decide who gets a **provisional result** (with the Withheld rule) → **Provisional Result Tool**\n' +
         '- Check which students are **eligible** (no F / Fail in any semester) from **Truscholar marksheets or TRs** → **Tr-Tru Eligibility Checker**\n\n' +
         'Marksheet vs TR also re-derives totals (max marks, credits, credit points), so it catches arithmetic errors too.',
      f: ['How do I use Marksheet vs TR?', 'What are the four checks in White vs Original?', 'What does the Consolidated Checker do?', 'What does the Provisional Result tool do?', 'What does the Tr-Tru Eligibility Checker do?'],
      b: [['Open Marksheet vs TR', 'open:tool1'], ['Open White vs Original', 'open:tool2'], ['Open Consolidated Checker', 'open:tool3'], ['Open Provisional Result', 'open:tool4'], ['Open Tr-Tru Eligibility', 'open:tool5']] },

    { id: 'workflow', cat: 'start', topic: 'site', t: 'How does it work, step by step?',
      q: ['how does it work', 'how do i use this site', 'steps to use', 'workflow', 'process', 'how to get started', 'getting started', 'from sign in to report', 'guide me', 'tutorial'],
      k: ['how', 'work', 'steps', 'workflow', 'process', 'start', 'guide', 'tutorial'],
      a: '1. **Sign in** with the ID issued to the examination office team.\n' +
         '2. **Pick the tool**: Marksheet vs TR for gradesheets against the TR; White vs Original for copy-to-copy comparison and the SGPA, withheld and failed checks; Consolidated Marksheet Checker to audit the consolidated transcript; Provisional Result to combine Regular and Improvement TRs; Tr-Tru Eligibility to check that no semester has an F.\n' +
         '3. **Load the files and run**: add the TR workbook and/or the PDFs, correct the format options only if auto-detection gets them wrong, then run.\n' +
         '4. **Download and come back**: save the Excel report, then return to the portal whenever you need another tool.',
      f: ['How do I sign in?', 'Which tool should I use?'],
      b: [['Show "How it works"', 'nav:workflow']] },

    { id: 'privacy', cat: 'start', topic: 'site', t: 'Is my data safe? Are files uploaded?',
      q: ['is my data safe', 'are files uploaded', 'does it upload my files', 'where do my files go', 'privacy', 'is it private', 'do you store my pdfs', 'data security', 'confidential data', 'does anyone see my files'],
      k: ['safe', 'upload', 'privacy', 'private', 'data', 'confidential', 'store', 'server'],
      a: 'Your files **are not uploaded anywhere**. All five tools read the PDFs and Excel files inside the page you open them in, and build the report on your machine. The portal itself never receives a file.\n\n' +
         'Two things to keep in mind:\n' +
         '- Sign-in controls access to the **portal page only**. It does not encrypt or protect your documents.\n' +
         '- Downloaded reports are ordinary Excel files, so store them where your office normally keeps examination records.',
      more: 'For a compliance record, the portal itself recommends verifying this against the source of each application rather than relying on a summary. The tools load public libraries (pdf.js, SheetJS and ExcelJS) from cdnjs. Those are code, not data: your files are never sent to them.',
      f: ['Is the sign-in secure?', 'Does it work offline?'] },

    { id: 'offline', cat: 'start', topic: 'site', t: 'Does it work offline?',
      q: ['does it work offline', 'can i use it without internet', 'offline mode', 'no internet', 'internet required', 'works without wifi', 'need internet'],
      k: ['offline', 'internet', 'wifi', 'network', 'connection'],
      a: '- **Mirage (me)** works fully offline: no API, no server.\n' +
         '- **The portal** works once loaded. It only uses Google Fonts for typography, and falls back to system fonts without them.\n' +
         '- **The tools** do their work locally, but load **pdf.js, SheetJS and ExcelJS from cdnjs** when the page opens. They need internet on first load. After that the browser usually caches the libraries, but that is not guaranteed.\n' +
         '- **Tr-Tru Eligibility (Tool 05)** carries its own copy of SheetJS and ExcelJS inside the page, so once the page is open it needs no library download.\n\n' +
         'Tip: open the tool once while online before working somewhere with a weak connection.',
      f: ['The tool page is blank', 'Is my data safe?'] },

    { id: 'browser', cat: 'start', topic: 'site', t: 'Which browser / device should I use?',
      q: ['which browser', 'supported browsers', 'does it work on mobile', 'can i use my phone', 'chrome or edge', 'safari support', 'firefox', 'device requirements', 'system requirements', 'laptop or phone'],
      k: ['browser', 'chrome', 'edge', 'firefox', 'safari', 'mobile', 'phone', 'device', 'requirements'],
      a: 'Use an up-to-date **Chrome or Edge on a laptop/desktop** for the verification tools. Large batches (hundreds of PDFs) need memory and a real file picker.\n\n' +
         'Firefox and Safari also work for the portal. Phones can sign in and browse the portal, but running big batches on a phone is not recommended.',
      f: ['How many PDFs can I load?', 'Does it work offline?'] },

    /* ------------------------------------------------ sign-in & session */
    { id: 'login', cat: 'access', topic: 'site', t: 'How do I sign in?',
      q: ['how do i sign in', 'how to login', 'how do i log in', 'where do i enter my id', 'sign in steps', 'login help', 'how to access the portal', 'cant find login'],
      k: ['login', 'sign', 'access', 'id', 'enter'],
      a: 'On the sign-in page:\n1. Enter your **Staff ID** (not case-sensitive).\n2. Enter your **Password** (case-sensitive). Use **Show** to check what you typed.\n3. Tick **Keep me signed in on this device** only on your own computer.\n4. Press **Sign in**. A short truck animation plays, then the portal opens.',
      f: ['I forgot my password', 'What does "Keep me signed in" do?', 'Account locked after wrong attempts'] },

    { id: 'forgot', cat: 'access', topic: 'site', t: 'I forgot my password / ID',
      q: ['i forgot my password', 'forgot password', 'reset password', 'lost my password', 'forgot my id', 'change my password', 'new password', 'password not working', 'what is the password'],
      k: ['forgot', 'reset', 'lost', 'password', 'change'],
      a: 'There is no self-service reset: the portal is a static site with no account server. Ask the **examination office / super admin** for the current ID and password. The sign-in page says: *"Use the updated ID and password that has been provided."*\n\nIDs are not case-sensitive, but passwords are. Check Caps Lock and use **Show** to see what you typed.',
      more: 'Admins manage accounts in the **CONFIG → CREDENTIALS** block at the top of `script.js`. Each account is `{ id, password, display }`. Changing a password there and publishing to GitHub Pages updates it for everyone.',
      f: ['Account locked after wrong attempts', 'How do I sign in?'] },

    { id: 'lockout', cat: 'access', topic: 'site', t: 'Too many attempts / locked out',
      q: ['account locked', 'too many attempts', 'locked out', 'wait seconds before trying again', 'why cant i login', 'sign in button disabled', 'access denied', 'id or password is incorrect', 'lockout'],
      k: ['locked', 'lockout', 'attempts', 'denied', 'wait', 'disabled', 'incorrect'],
      a: function (c) {
        return 'After **' + c.cfg.maxAttempts + ' wrong attempts** the Sign in button pauses for **' + c.cfg.lockoutSeconds + ' seconds** with a countdown. Just wait. It unlocks by itself and the counter resets.\n\n' +
          '**"Access denied"** means the ID or password did not match. IDs are not case-sensitive; passwords are.' +
          (c.level >= 2 ? '\n\n♔ As super admin you can clear the counter on this browser with `/unlock`.' : '');
      },
      f: ['I forgot my password', 'How do I sign in?'] },

    { id: 'keep', cat: 'access', topic: 'site', t: 'What does "Keep me signed in" do?',
      q: ['what does keep me signed in do', 'keep me signed in', 'remember me', 'stay logged in', 'why do i have to login again', 'session after closing browser', 'remember login'],
      k: ['keep', 'remember', 'stay', 'signed', 'persist'],
      a: function (c) {
        return '- **Ticked**: your session is saved on this device and survives closing the browser, for up to **' + c.cfg.sessionHours + ' hours**.\n' +
          '- **Unticked**: the session lasts only for this browser tab session. Close it and you sign in again.\n\n' +
          'Only tick it on a computer that is yours alone.';
      },
      f: ['How long does a session last?', 'How do I sign out?'] },

    { id: 'expiry', cat: 'access', topic: 'site', t: 'How long does a session last?',
      q: ['how long does a session last', 'session expired', 'session timeout', 'when will i be logged out', 'why was i signed out', 'session duration', 'how many hours', 'when will i get logged out', 'how long until i am logged out', 'how long can i stay logged in'],
      k: ['session', 'expire', 'expired', 'timeout', 'hours', 'duration'],
      a: function (c) {
        var s = c.session;
        var extra = s && s.user ? '\n\nYour current session ends **' + fmtWhen(s.expires) + '** (' + fmtLeft(s.expires) + ' left).' : '';
        return 'A session is valid for **' + c.cfg.sessionHours + ' hours** from sign-in. After that the portal shows *"Session expired. Sign in again to open the suite."*' + extra;
      },
      f: ['What does "Keep me signed in" do?', 'Who am I signed in as?'] },

    { id: 'logout', cat: 'access', topic: 'site', t: 'How do I sign out?',
      q: ['how do i sign out', 'how to logout', 'how do i log out', 'where is sign out', 'where is logout button', 'end my session'],
      k: ['logout', 'signout', 'exit'],
      a: function (c) {
        return 'Use **Sign out** at the top right of the portal (or inside the ☰ menu on mobile). It clears your session on this browser straight away.\n\nFrom inside a tool, use the floating **Log out** control at the bottom-right corner.' +
          (c.level >= 2 ? '\n\n♔ You can also just tell me: **"log me out"**.' : '');
      },
      f: ['What does "Keep me signed in" do?'] },

    { id: 'security', cat: 'access', topic: 'site', t: 'Is the sign-in secure?',
      q: ['is the sign in secure', 'is login secure', 'how secure is this', 'can anyone access the tools', 'security limitations', 'is the password safe', 'can someone bypass login', 'can this site be hacked', 'is the portal safe from hackers'],
      k: ['secure', 'security', 'bypass', 'hack', 'protected'],
      a: 'Honest answer: it is a **shared team gate, not real security**. The site runs on GitHub Pages, which serves every file publicly. That means:\n' +
         '- The account list is readable in the page source.\n' +
         '- Anyone who types `/apps/allinone/` directly reaches a tool without signing in.\n\n' +
         'So **never put confidential data in the portal itself**. Your documents are safe for a different reason: they are processed locally and never uploaded.',
      f: ['Is my data safe?', 'Where are accounts managed?'] },

    { id: 'accounts', cat: 'access', topic: 'site', t: 'Where are accounts managed?',
      q: ['where are accounts managed', 'how to add a user', 'add new account', 'create user', 'remove a user', 'change credentials', 'manage users', 'add team member'],
      k: ['account', 'accounts', 'user', 'users', 'add', 'create', 'member', 'credentials'],
      a: 'Accounts live in the **CONFIG** block at the top of `script.js`, under `CREDENTIALS`:\n```\n{ id: "Exam02", password: "change-me", display: "Exam02" }\n```\nAdd, edit or remove an entry, commit, and GitHub Pages publishes it. There is no admin screen that writes accounts, because a static site cannot save changes.',
      f: ['Is the sign-in secure?', 'What can a super admin do?'] },

    { id: 'whoami', cat: 'access', topic: 'site', t: 'Who am I signed in as?',
      q: ['who am i', 'who am i signed in as', 'am i logged in', 'my account', 'my role', 'what is my access level', 'am i admin', 'my session', 'session info', 'current user'],
      k: ['whoami', 'role', 'account', 'logged', 'current'],
      a: function (c) {
        var s = c.session;
        if (!s || !s.user) return 'You are **not signed in** right now, so I am in guest mode. Sign in on this page to open the tools.';
        return '<kv>Signed in as|**' + s.user + '**\nAccess|' + (c.level >= 2 ? '♔ Super Admin' : 'Staff') + '\nSession ends|' + fmtWhen(s.expires) + '\nTime left|' + fmtLeft(s.expires) + '\nRemembered|' + (s.store === 'local' ? 'Yes (keep me signed in)' : 'This tab only') + '</kv>';
      },
      f: ['What can a super admin do?', 'How do I sign out?'] },

    /* ------------------------------------------------ portal */
    { id: 'sections', cat: 'portal', topic: 'site', t: 'What is on the portal page?',
      q: ['what is on the portal', 'what sections are on the portal', 'portal sections', 'what sections are there', 'navigation menu', 'overview tools how it works about', 'where is the menu', 'portal layout'],
      k: ['sections', 'menu', 'navigation', 'layout', 'page'],
      a: 'After sign-in the portal has four sections (top menu, or ☰ on mobile):\n' +
         '1. **Overview**: what the suite does, with a specimen field comparison.\n' +
         '2. **Tools**: the five tool cards with their Open buttons.\n' +
         '3. **How it works**: sign in → pick tool → load & run → download.\n' +
         '4. **About**: how the portal and tools relate, plus document-handling guidance.',
      b: [['Overview', 'nav:overview'], ['Tools', 'nav:tools'], ['How it works', 'nav:workflow'], ['About', 'nav:about']] },

    { id: 'theme', cat: 'portal', topic: 'site', t: 'Dark mode / light mode',
      q: ['dark mode', 'light mode', 'how to change theme', 'night mode', 'switch theme', 'the sun moon toggle', 'make it dark', 'why is it always light'],
      k: ['dark', 'light', 'theme', 'night', 'mode', 'toggle'],
      a: 'Click the **sun / moon switch** in the header (also on the sign-in page). Your choice is remembered on this device. With no saved choice the suite always opens in **light** mode, and ignores your system setting on purpose.\n\nI follow the site\'s theme automatically. Say **"dark mode"** or **"light mode"** and I will flip it for you.',
      b: [['Toggle theme now', 'theme:toggle']] },

    { id: 'season', cat: 'portal', topic: 'site', t: 'The seasonal background',
      q: ['what is the season button', 'current season', 'change season', 'falling leaves', 'background trees', 'snow on the page', 'seasonal background', 'why are there leaves'],
      k: ['season', 'seasons', 'leaves', 'snow', 'petals', 'autumn', 'winter', 'spring', 'summer'],
      a: 'The scene behind the sign-in panel is **seasonal decoration**. It never touches sign-in. Use the **Current season** control at the bottom-left to choose:\n- **Current** (from the calendar: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter)\n- **Random**, or a specific season.\n\nThe sky also follows your clock: sunrise, morning, afternoon, evening, night. A reload returns to Current season.' },

    { id: 'loader', cat: 'portal', topic: 'site', t: 'The truck animation after sign-in',
      q: ['what is the truck', 'truck animation', 'loading screen after login', 'authenticated animation', 'why is there a truck', 'skip the animation'],
      k: ['truck', 'animation', 'loading', 'authenticated'],
      a: 'That is the **sign-in loading screen**: a truck drives through a moving landscape while the session is prepared, then **Authenticated** appears and the portal opens (about 5 seconds). It is purely visual: your credentials are already checked by then.\n\nIf your device has **reduce motion** turned on, the scene stays still and only the progress shows.' },

    { id: 'back', cat: 'portal', topic: 'site', t: 'Getting back to the portal from a tool',
      q: ['how do i go back to the portal', 'back to portal', 'return to home', 'go back from tool', 'switch to the other tool', 'portal bar', 'back button in tool'],
      k: ['back', 'return', 'home', 'switch'],
      a: 'Inside each tool there is a small floating control at the **bottom-right** with **Back to portal** and **Log out**. The tools keep their own state, so switching between them is safe. (The Consolidated Marksheet Checker has no floating control: use your browser\'s **Back** button to return. The Provisional Result and Tr-Tru Eligibility tools do have it.) Save your report first, though: a page reload clears a tool\'s loaded files.',
      b: [['Go to Tools section', 'nav:tools']] },

    /* ------------------------------------------------ TOOL 1 */
    { id: 't1-about', cat: 'tool1', topic: T1, t: 'What does Marksheet vs TR do?',
      q: ['what is marksheet vs tr', 'what is allinone', 'what is the all in one tool', 'tool 1', 'first tool', 'gradesheet verification tool', 'marksheet verification', 'tell me about allinone', 'tr verification tool'],
      k: ['allinone', 'tool1', 'first'],
      a: '**Marksheet vs TR Verification** cross-checks TruScholar gradesheet PDFs against the **tabulated result (TR)**, field by field, down to the last credit point.\n\n' +
         '- The **TR is the source of truth**; the gradesheets are what get checked.\n' +
         '- Files are paired on **Registration No.**\n' +
         '- It checks the identity block, subject table, credit structure, marks, grades, credit points and totals.\n' +
         '- It handles up to **~1000 PDFs** per run and outputs one **.xlsx** report.',
      f: ['How do I use Marksheet vs TR?', 'What rules does it apply?', 'What is in its Excel report?'],
      b: [['Open Marksheet vs TR', 'open:tool1']] },

    { id: 't1-steps', cat: 'tool1', topic: T1, t: 'How to use Marksheet vs TR',
      q: ['how do i use marksheet vs tr', 'how to use allinone', 'how to use tool 1', 'use tool 1', 'tool 1 kaise use kare', 'allinone kaise chalaye', 'steps for tool 1', 'how to run the tr check', 'how to verify gradesheets against tr', 'allinone steps', 'how to start verification'],
      k: ['use', 'steps', 'run', 'how'],
      a: '1. **Load TR**: choose the TR Excel file. If the workbook has several sheets, pick the **semester / sheet** to compare against.\n' +
         '2. Check **Detected TR Format**, and override it only if it is wrong.\n' +
         '3. (Optional) Pick the **Program Structure sheet** for the T-P-PR / Total Credit Structure check.\n' +
         '4. **Add PDFs**: select or drag up to ~1000 gradesheets. Leave **Transcript Format** on Auto Detect unless needed.\n' +
         '5. Press **Run verification**. Progress, elapsed time and ETA are shown, and it keeps running in a background tab.\n' +
         '6. **Download Excel report**, name the file (a name is suggested from Program / Batch / Semester), and save.',
      f: ['What are the TR formats?', 'What are the transcript formats?', 'What is in its Excel report?'],
      b: [['Open Marksheet vs TR', 'open:tool1']] },

    { id: 't1-trformat', cat: 'tool1', topic: T1, t: 'TR formats 1, 2 and 3',
      q: ['what are the tr formats', 'tr format 1', 'tr format 2', 'tr format 3', 'detected tr format', 'which tr format', 'tr format special ojt', 'no tppr row'],
      k: ['trformat', 'format', 'formats', 'detected', 'ojt'],
      a: 'The tool auto-detects the TR layout. Override it only if detection is wrong (your manual choice wins):\n' +
         '- **Format 1 · Standard**: has the T-P-PR row (e.g. `3-0-0`) above the marks columns.\n' +
         '- **Format 2 · No T-P-PR row**: credit is a single number (3, 4, 8…). The T-P-PR for totals comes from the **Program Structure** sheet.\n' +
         '- **Format 3 · Special OJT**: an OJT block whose code cell is blank. The code is pulled per student from **"Role (Code)"**.',
      f: ['What is the Program Structure sheet?', 'What is T-P-PR?'] },

    { id: 't1-progstruct', cat: 'tool1', topic: T1, t: 'Program Structure sheet',
      q: ['what is the program structure sheet', 'program structure', 'no program structure sheet', 'should i select program structure', 'total credit structure check'],
      k: ['program', 'structure'],
      a: 'The **Program Structure sheet** lists each subject with its category (Theory / Practical / OJT) or a T-P-PR value. It turns single credit numbers into the `3-0-0` form for the **Total Credit Structure** check.\n\n' +
         'It is **off by default** and must be selected manually, because some TR sheets carry T-P-PR themselves. Leave it on **No Program Structure sheet** to skip that check, or pick the exact sheet if your workbook has one. It matters most for **TR Format 2**.' },

    { id: 't1-transcript', cat: 'tool1', topic: T1, t: 'Transcript (gradesheet) formats',
      q: ['what are the transcript formats', 'identity block format', 'format 1 name father mother', 'format 2 abc id', 'format 3 name reg category', 'format 4 sem 1 code', 'transcript format auto detect', 'gradesheet formats'],
      k: ['transcript', 'identity', 'abcid', 'aadhaar', 'father', 'mother', 'category', 'format4'],
      a: '**Identity block (pick one, or Auto Detect per gradesheet):**\n' +
         '- **Format 1**: Name, Father, Mother, DOB, Aadhaar, with **no** ABC ID row.\n' +
         '- **Format 2**: Format 1 fields **plus** an ABC ID row.\n' +
         '- **Format 3**: Name, Reg. No. and Category only. The missing fields are reported **N/A**, not blank.\n\n' +
         '**Subject table (tick in addition):**\n' +
         '- **Format 4 · Sem-1 course-code style**: codes print like `MTL100 [T]`, and the credit column holds a single number.',
      f: ['Explain Format 4 brackets', 'Why is ABC ID N/A?'] },

    { id: 't1-f4', cat: 'tool1', topic: T1, t: 'Format 4: [T] / [P] / [PR] brackets',
      q: ['explain format 4 brackets', 'what does t p pr bracket mean', 'mtl100 t', 'course code bracket', 'sem 1 code format', 'missing bracket error', 'wrong bracket', 'mcl300 p error'],
      k: ['bracket', 'format4', 'sem1', 'brackets'],
      a: 'In **Format 4**, codes look like `MTL100 [T]`: three letters + three digits (**no space**), one space, then `[T]`, `[P]` or `[PR]`.\n\nThe bracket must agree with the TR\'s T-P-PR row:\n```\nx-0-0 → [T]    0-x-0 → [P]    0-0-x → [PR]\n```\nA `3-0-0` subject printed as `MCL300 [P]` is an **error**. The printed credit number is also checked subject by subject against the TR\'s credit-number row (the row directly below T-P-PR).\n\nLeave the box unticked to auto-detect per gradesheet. Tick it to force the check on every PDF, so a row with **no** bracket is reported as missing one.',
      f: ['Which bracket for 0-4-0?', 'What is in the Sem-1 Code Format sheet?'] },

    { id: 't1-rules', cat: 'tool1', topic: T1, t: 'Rules Marksheet vs TR applies',
      q: ['what rules does it apply', 'rules in force', 'how strict is the comparison', 'what is compared', 'matching rules', 'what does it check', 'exact match rules', 'is subject name case sensitive'],
      k: ['rules', 'rule', 'check', 'compared', 'strict', 'exact'],
      a: 'Every rule is applied to **every** gradesheet. Nothing is sampled.\n' +
         '- **Match key**: Registration No.\n' +
         '- **Credit structure**: T-P-PR, exact position (`0-4-0 ≠ 0-0-4`)\n' +
         '- **SGPA / Percentage**: exact to 1 decimal\n' +
         '- **Student name**: exact string\n' +
         '- **Subject name**: normalises `&` ↔ `and`, spacing and case. A cosmetic difference is a *variant*; anything else is a mismatch.\n' +
         '- **Marks, Grade, Grade Points, Credit Points**: exact\n' +
         '- **Subject pairing**: course code first, then course name\n' +
         '- **Blank fields** (TruScholar glitch): always flagged, even when PDF and TR are both blank',
      more: 'Subject detection reads the TR\'s column blocks structurally: a block counts if it has a course name, code, credit line or mark, so an OJT column with no course code is still counted. A row that prints Code, Name and Credits but leaves Marks (or Grade / GP / CP) empty is still read, and the empty cell is reported as an error.',
      f: ['What totals are derived?', 'Why is a blank field flagged?'] },

    { id: 't1-derived', cat: 'tool1', topic: T1, t: 'Derived totals it re-computes',
      q: ['what totals are derived', 'derived totals', 'how is maximum marks calculated', 'total credits formula', 'grand total credit points formula', 'total credit line', 'how are totals checked'],
      k: ['derived', 'totals', 'maximum', 'grand', 'formula'],
      a: 'These are **not in the TR**; the tool computes them from the TR\'s subjects and checks each against the PDF\'s printed totals:\n```\nMaximum Marks            = subjects × 100\nTotal credit line        = Σ T-P-PR   (position-wise)\nTotal Credits            = Σ (x + y + z)\nGrand Total Credit Points = 10 × Total Credits\n```\nTry me: *"total credits for 3-0-0, 0-4-0, 2-0-0"*.',
      f: ['total credits for 3-0-0, 0-4-0, 2-0-0', 'max marks for 7 subjects'] },

    { id: 't1-pairing', cat: 'tool1', topic: T1, t: 'How subjects are paired',
      q: ['how are subjects paired', 'subject pairing', 'course code differs', 'course code mismatch', 'subject missing', 'mispaired course', 'code different between tr and gradesheet'],
      k: ['pairing', 'paired', 'mispaired', 'code', 'course'],
      a: 'Subjects are paired by **course code first**, then by **course name** as a fallback. If the codes differ between the TR and the gradesheet but the names match, that is **noted** (see *Subject Code Mapping*), not treated as a missing subject.\n\nDuplicate or mispaired courses are flagged in **Duplicate Detection**.',
      f: ['What is in its Excel report?'] },

    { id: 't1-batch', cat: 'tool1', topic: T1, t: 'How many PDFs? Background running',
      q: ['how many pdfs can i load', 'batch size', 'maximum pdfs', '1000 pdfs', 'can i switch tabs while running', 'does it keep running in background', 'progress in tab title', 'close tab during run', 'how long does it take'],
      k: ['batch', 'many', 'maximum', 'background', 'progress', 'long', 'speed', 'time'],
      a: '- Up to **~1000 PDFs** per run in Marksheet vs TR. White vs Original accepts many at once too.\n' +
         '- The run **keeps going in a background tab**: switch tabs or minimise and it carries on to the end.\n' +
         '- Live progress also shows in the **tab title**, with Elapsed / Est. remaining / Done / Left on the page.\n' +
         '- The browser **warns you** if you try to close the tab mid-run.\n\n' +
         'Speed depends on your computer. Close heavy apps for very large batches.' },

    { id: 't1-prev', cat: 'tool1', topic: T1, t: 'Clear all / previous reports',
      q: ['previous excel reports', 'clear all', 'start a new batch', 'reset the tool', 'where are my earlier reports', 'download again'],
      k: ['previous', 'clear', 'reset', 'again'],
      a: '**Clear all** resets the tool for a new batch. **Previous Excel reports (this session)** lists the reports you already generated, so you can download them again. That list is only for the current page session: reloading clears it.' },

    /* ------------------------------------------------ TOOL 2 */
    { id: 't2-about', cat: 'tool2', topic: T2, t: 'What does White vs Original do?',
      q: ['what is white vs original', 'what is whitevsoriginal', 'tool 2', 'second tool', 'grade sheet verification toolkit', 'tell me about white vs original', 'four checks', 'what are the four checks in white vs original', 'modules of tool 2'],
      k: ['whitevsoriginal', 'tool2', 'second', 'toolkit', 'modules'],
      a: '**White vs Original** (Grade Sheet Verification Toolkit) has **four checks**, each with its own numbered report:\n' +
         '1. **White vs Original** → `1_white_vs_original.xlsx`\n' +
         '2. **SGPA & Percentage** → `2_sgpa_percentage_check.xlsx`\n' +
         '3. **Withheld Students** → `3_withheld_students.xlsx`\n' +
         '4. **Failed Candidates** → `4_failed_candidates.xlsx`\n\n' +
         'Everything runs in your browser.',
      f: ['How does White vs Original comparison work?', 'How is SGPA recomputed?', 'How are withheld students found?', 'How are failed candidates found?'],
      b: [['Open White vs Original', 'open:tool2']] },

    { id: 't2-wvo', cat: 'tool2', topic: T2, t: 'Module 1: White vs Original comparison',
      q: ['how does white vs original comparison work', 'how to use white vs original', 'how to use tool 2', 'how do i use white vs original', 'tool 2 kaise use kare', 'compare white background with original', 'white background pdfs', 'sealed original pdfs', 'how are white and original paired', 'module 1', 'upload both sets'],
      k: ['white', 'original', 'sealed', 'background', 'module1', 'pair'],
      a: '1. **Step 1**: add the **white-background** PDFs.\n2. **Step 2**: add the **original (sealed)** PDFs. Any order is fine.\n3. **Run comparison**, then **Download Final Excel report**.\n\n' +
         'Files pair on **Registration No.**, falling back to **Name + DOB + Semester**. Every identity field, course-table row, table total, summary value and the **publication date** are compared with an **exact string match after whitespace normalisation**.',
      f: ['Why is 7.6 vs 7.60 a mismatch?', 'What is the ABC ID rule?'],
      b: [['Open White vs Original', 'open:tool2']] },

    { id: 't2-exact', cat: 'tool2', topic: T2, t: 'Why is 7.6 vs 7.60 a mismatch?',
      q: ['why is 7 6 vs 7 60 a mismatch', 'why is 7.6 different from 7.60', 'case difference mismatch', 'hyphen vs en dash', 'false mismatch', 'too strict comparison', 'punctuation mismatch'],
      k: ['mismatch', 'dash', 'hyphen', 'case', 'punctuation', 'strict'],
      a: 'The White vs Original rule is deliberately **exact**: two copies of the same document should print identical text. So all of these are reported as mismatches, **each with a note on the kind of difference**:\n- case differences (`Sunita` vs `SUNITA`)\n- punctuation variants (en-dash `–` vs hyphen `-`)\n- `7.6` vs `7.60`\n\nOnly whitespace is normalised. Read the note column to tell cosmetic differences from real ones.' },

    { id: 't2-abc', cat: 'tool2', topic: T2, t: 'ABC ID rule',
      q: ['what is the abc id rule', 'abc id skipped', 'why is abc id n a', 'abc id mismatch', 'no abc id row'],
      k: ['abcid', 'skipped'],
      a: '- **White vs Original**: if **neither** copy carries an ABC ID, the check is **SKIPPED**. If only **one** copy carries it, that is a **mismatch**.\n' +
         '- **Marksheet vs TR**: a gradesheet format with no ABC ID row (Format 1 / 3) is reported as a **format difference (N/A)**, not a blank-data error.' },

    { id: 't2-sgpa', cat: 'tool2', topic: T2, t: 'Module 2: SGPA & Percentage recomputation',
      q: ['how is sgpa recomputed', 'sgpa and percentage check', 'module 2', 'verify sgpa', 'check percentage', 'wrong sgpa', 'how is sgpa calculated', 'sgpa formula', 'percentage formula', 'rounding rule'],
      k: ['sgpa', 'percentage', 'recompute', 'module2', 'rounding', 'round'],
      a: 'Each sheet is recomputed **from its own printed rows**:\n```\nPercentage = round(Total Marks / Maximum Marks × 100, 1)\nSGPA       = round(Total Credit Points / Total Credits, 1)\n```\nRounding is **half-up** (`8.25 → 8.3`).\n\nA wrong SGPA usually starts further up the sheet, so it also checks:\n- per-row **Credit Points = (T+P+PR) × grade point**\n- the column sums\n- **Maximum Marks = 100 × courses**\n- **Grand Total Credit Points = Total Credits × 10**\n\nPick a **copy label** (Original / White / Unlabelled). It only appears in the report.',
      f: ['sgpa 218 28', 'percentage 512 of 700'],
      b: [['Open White vs Original', 'open:tool2']] },

    { id: 't2-withheld', cat: 'tool2', topic: T2, t: 'Module 3: Withheld students',
      q: ['how are withheld students found', 'withheld students', 'what is withheld', 'grace cell w', 'module 3', 'find withheld', 'w in grace column'],
      k: ['withheld', 'grace', 'module3'],
      a: 'A student is **WITHHELD** when **any subject\'s Grace cell contains the letter W or w**. A numeric grace mark (`4`, `2.5`, `0`) is never a W. The rule is deliberately literal.\n\n' +
         '1. Load the **TR / Result sheet** (.xlsx / .xls).\n2. Choose the sheet (Auto-detect finds the best match) and TR format.\n3. **Find withheld students** → `3_withheld_students.xlsx`.\n\n' +
         'Column positions are never hard-coded: the header row is found by its repeated **Grace / Result** labels. **Sheet 2** exports every Grace cell exactly as it appears, with its Excel row number.',
      f: ['What is the special OJT case?', 'How are failed candidates found?'] },

    { id: 't2-ojt', cat: 'tool2', topic: T2, t: 'Special OJT layout',
      q: ['what is the special ojt case', 'ojt code blank', 'on the job training code', 'role code beside program', 'hap423', 'special case tr format'],
      k: ['ojt', 'special', 'role', 'hap423'],
      a: 'In the **special OJT** layout the OJT band header carries **no code**. Each student\'s own OJT role and code sit in the unlabelled column next to **Program**, e.g. `Optometry Assistant (HAP423)`. The tool reads that per student and joins it to the band title:\n```\nHAP423 / On the Job Training - 1 (Optometry Assistant)\n```\nLeave the TR format on **Auto-detect**: the special case is used only when a header code is blank. In Marksheet vs TR this corresponds to **TR Format 3**.' },

    { id: 't2-failed', cat: 'tool2', topic: T2, t: 'Module 4: Failed candidates',
      q: ['how are failed candidates found', 'failed candidates', 'find failed students', 'module 4', 'who failed', 'pdf only tr only', 'cross check failed'],
      k: ['failed', 'fail', 'module4', 'cross'],
      a: 'Provide **PDFs, a TR, or both**:\n' +
         '- **From PDFs**: a candidate fails if any course row has grade `F / FF / FAIL / AB / ABS / ABSENT / I / RA / R / NC / U`, a grade point of **0**, or absent marks. (`P` is a pass; `W` is withheld, not failed.)\n' +
         '- **From the TR**: any subject **Result = F**, **Letter Grade = F**, or overall **Remark = F**.\n\n' +
         'With both, **Sheet 3** cross-checks the lists and marks anyone found by only one source as **PDF ONLY / TR ONLY**. OJT codes like `HTP400-1` are matched to `HTP400`. Output: `4_failed_candidates.xlsx`.',
      f: ['Is AB a fail?', 'Is W a fail?'] },

    /* ------------------------------------------------ TOOL 3 */
    { id: 't3-about', cat: 'tool3', topic: T3, t: 'What does the Consolidated Marksheet Checker do?',
      q: ['what is consolidated marksheet checker', 'what is the consolidated checker', 'what does the consolidated checker do', 'tool 3', 'third tool', 'tell me about tool 3', 'tell me about consolidated', 'consolidated marksheet audit', 'consolidated transcript audit', 'what is tool 3', 'how does tool 3 work', 'how does consolidated work', 'how does the consolidated checker work', 'how does the consolidated transcript checker work'],
      k: ['consolidated', 'tool3', 'third', 'audit', 'cgpa'],
      a: '**Consolidated Marksheet Checker** (Tool 03) audits the **consolidated transcript** (all semesters on one sheet). It does not trust the printed numbers: it **recomputes them** and compares.\n\n' +
         '- Reads each transcript PDF in your browser with **pdf.js** (nothing is uploaded).\n' +
         '- Rebuilds the subject rows from the **two-column semester layout** (rotated pages are handled).\n' +
         '- Recomputes every **SGPA, CGPA, total credits, obtained / maximum marks and percentage**, and re-derives each **grade from marks**.\n' +
         '- Uses **exact fraction arithmetic** (BigInteger rationals, no floats), so a value either matches or it does not.\n' +
         '- Checks **Programme, Specialization** and **Year of Passing (2025)**.\n' +
         '- Gives on-screen tabs plus one Excel report, `Transcript_Audit_<date>.xlsx`.\n\n' +
         'Unlike Marksheet vs TR and White vs Original, it needs **no TR**: only the transcript PDFs.',
      f: ['How do I use the Consolidated Checker?', 'How is CGPA calculated?', 'Old vs New grade scale', 'What is in the Consolidated Checker report?'],
      b: [['Open Consolidated Checker', 'open:tool3']] },

    { id: 't3-steps', cat: 'tool3', topic: T3, t: 'How to use the Consolidated Checker',
      q: ['how do i use the consolidated checker', 'how to use consolidated', 'how to use tool 3', 'use tool 3', 'tool 3 kaise use kare', 'steps for tool 3', 'consolidated steps', 'how to run the consolidated audit', 'how to audit consolidated transcript', 'how to check consolidated marksheet', 'run audit'],
      k: ['use', 'steps', 'run', 'how', 'audit'],
      a: '1. **Step 1 · Add transcript PDFs**: one consolidated transcript per student. Select many at once or drag them onto the panel. They must have a **text layer**.\n' +
         '2. **Step 2 · Grade scale**: choose **Old grade** or **New grade** (or edit the bands; *Reset to MSU default* restores Old).\n' +
         '3. Choose the **CGPA formula**: **Old** or **New**.\n' +
         '4. Fill **Expected programme** and **Expected specialization** (e.g. *Bachelor of Vocation*, *Fashion Design*). They must match the PDF exactly. Year of Passing is fixed at **2025**.\n' +
         '5. Press **Run audit** in the bottom action bar.\n' +
         '6. Read the result tabs (start with **Students**), then **Download Excel report**. **Clear all** starts a new batch.',
      f: ['Old vs New grade scale', 'Old vs New CGPA formula', 'Programme & specialization check', 'What do Clean / Flagged / Rejected mean?'],
      b: [['Open Consolidated Checker', 'open:tool3']] },

    { id: 't3-grades', cat: 'tool3', topic: T3, t: 'Old vs New grade scale',
      q: ['old vs new grade scale', 'old grade vs new grade', 'what is the grade scale', 'grade scale in tool 3', 'grade bands', 'old grade system', 'new grade system', 'marks for o grade', 'how is grade derived from marks', 'reset to msu default', 'edit grade scale', 'raw json grade scale'],
      k: ['grade', 'scale', 'bands', 'old', 'new', 'json'],
      a: 'The Checker **re-derives each grade from the marks** and compares it with the printed letter. Bands are **inclusive lower bounds** on marks:\n' +
         '<kv>Grade (point)|Old · New\nO (10)|≥ 99 · ≥ 90\nA+ (9)|≥ 90 · ≥ 80\nA (8)|≥ 80 · ≥ 70\nB+ (7)|≥ 70 · ≥ 60\nB (6)|≥ 60 · ≥ 50\nC (5)|≥ 50 · ≥ 45\nP (4)|≥ 40 · ≥ 40\nF (0)|below 40</kv>' +
         'Pick **Old grade** or **New grade** in Step 2, or edit the bands (also as raw JSON under *Advanced*) if a programme uses a different scale. **Reset to MSU default** brings back the Old scale.',
      f: ['Old vs New CGPA formula', 'How is SGPA checked in the Consolidated Checker?'] },

    { id: 't3-cgpa', cat: 'tool3', topic: T3, t: 'Old vs New CGPA formula',
      q: ['old vs new cgpa formula', 'how is cgpa calculated', 'cgpa formula', 'old cgpa formula', 'new cgpa formula', 'how is cgpa checked', 'cgpa mismatch', 'wrong cgpa', 'which cgpa formula should i use'],
      k: ['cgpa', 'formula', 'cumulative'],
      a: 'Pick one in Step 2. Only the selected formula decides the CGPA match / mismatch:\n' +
         '```\nOld = Σ(semester credits × printed SGPA) ÷ printed Total Credits\nNew = Σ(course credit × grade point from marks) ÷ Total Credits   (every course)\n```\n' +
         '- **Old** uses each semester\'s printed SGPA exactly as printed.\n' +
         '- **New** works course by course; the grade point comes from that course\'s **marks**, never its printed letter.\n\n' +
         'Either way the exact fraction is kept to the end, then **Excel ROUND(CGPA, 1)** is applied. The **Summary** sheet records which formula was used.',
      f: ['Old vs New grade scale', 'Why exact fractions?'] },

    { id: 't3-sgpa', cat: 'tool3', topic: T3, t: 'How is SGPA checked in the Consolidated Checker?',
      q: ['how is sgpa checked in the consolidated checker', 'consolidated sgpa', 'semester sgpa check', 'semester credit check', 'credits line mismatch', 'printed credits line', 'parse integrity check', 'semester sgpa sheet'],
      k: ['sgpa', 'semester', 'credits', 'integrity'],
      a: 'For **every semester**:\n' +
         '1. **Credits first**: each subject\'s T-P-PR is summed (`0-4-0 → 4`, never 0), and the semester total must equal the printed **CREDITS** line. This doubles as a **parse-integrity check**: if a row was mis-read, the credits will not reconcile and it is flagged as **Critical** under Data Errors.\n' +
         '2. **SGPA** is recomputed from the rows:\n```\nSGPA = Σ(Ci × Gi) ÷ ΣCi   (1 decimal, ROUND_HALF_UP)\n```\n' +
         'and compared with the printed SGPA **at the precision it was printed**. See the **Semester SGPA** and **Semester Breakdown** tabs.',
      f: ['Old vs New CGPA formula', 'Which totals does it re-derive?'] },

    { id: 't3-totals', cat: 'tool3', topic: T3, t: 'Which totals does the Consolidated Checker re-derive?',
      q: ['which totals does it re-derive', 'consolidated totals', 'final values tab', 'obtained marks check', 'maximum marks consolidated', 'percentage consolidated', 'total credits consolidated', 'unique course codes 100', 'maximum marks anomaly', 'maximum marks in tool 3', 'percentage in tool 3', 'total credits in tool 3'],
      k: ['totals', 'obtained', 'maximum', 'percentage', 'final'],
      a: 'In **Final Values**, each figure is computed and compared with the printed one:\n' +
         '```\nTotal Credits  = Σ(T + P + PR)\nObtained Marks = Σ subject marks   (with per-semester subtotals)\nMaximum Marks  = unique course codes × 100\nPercentage     = Obtained ÷ printed Maximum × 100 → Excel ROUND(value, 1)\n```\n' +
         'Example: 35 course codes × 100 = 3500 must match the printed MAX. MARKS. A Maximum Marks anomaly is **reported, never silently substituted**; a *Percentage (corrected max)* line shows what it would be. CGPA, Year of Passing, Programme and Specialization are in the same tab.',
      f: ['Old vs New CGPA formula', 'Programme & specialization check'] },

    { id: 't3-meta', cat: 'tool3', topic: T3, t: 'Programme & specialization check',
      q: ['programme and specialization check', 'expected programme', 'expected specialization', 'year of passing 2025', 'year of passing check', 'programme mismatch', 'specialization mismatch', 'bachelor of vocation', 'fashion design'],
      k: ['programme', 'program', 'specialization', 'year', 'passing', '2025'],
      a: 'Type or pick the **Expected programme** (e.g. *Master of Vocation, Bachelor of Vocation, Bachelor of Design*) and **Expected specialization** (e.g. *Fashion Design, Interior Design*) in Step 2.\n\n' +
         '- The PDF values must match **exactly**, case-sensitive; only outer spaces are ignored.\n' +
         '- **Year of Passing is fixed at 2025** and checked automatically.\n\n' +
         'Results appear in **Final Values** and the **Student Status** tab.' },

    { id: 't3-status', cat: 'tool3', topic: T3, t: 'What do Clean / Flagged / Rejected mean?',
      q: ['what do clean flagged rejected mean', 'clean flagged rejected unreadable', 'student status consolidated', 'what is rejected', 'why was a transcript rejected', 'number of flags', 'audit at a glance'],
      k: ['clean', 'flagged', 'rejected', 'unreadable', 'status'],
      a: 'Each transcript gets one status:\n' +
         '<kv>CLEAN|every computed value matched the transcript\nFLAGGED|at least one mismatch (# Flags shows how many)\nREJECTED|the audit could not be computed, e.g. no subject rows could be read · see Data Errors\nUNREADABLE|scanned / no text layer, or the PDF would not open</kv>' +
         'A **failed subject** is an academic outcome, not an audit mismatch: it appears under **Fail**, not as a flag.',
      f: ['What is in the Consolidated Checker report?', 'Consolidated transcript is unreadable'] },

    { id: 't3-report', cat: 'tool3', topic: T3, t: 'What is in the Consolidated Checker report?',
      q: ['what is in the consolidated checker report', 'consolidated report sheets', 'transcript audit excel', 'tool 3 report', 'precision log', 'extracted from pdf', 'subject grades tab', 'semester breakdown', 'consolidated excel tabs'],
      k: ['report', 'excel', 'sheets', 'precision', 'breakdown', 'extracted'],
      a: '**Download Excel report** saves `Transcript_Audit_<date>.xlsx`:\n' +
         '- **Summary**: counts, expected values, formula and rounding used\n' +
         '- **Student Status**: one row per transcript with status and # flags\n' +
         '- **Fail**: failed subjects per student per semester (F, AB, or marks below the pass band)\n' +
         '- **Semester SGPA**: computed vs printed credits and SGPA\n' +
         '- **Semester Breakdown**: every subject line with marks, derived grade, Gi and Ci × Gi\n' +
         '- **Final Values**: CGPA, totals, marks, percentage, year, programme, specialization\n' +
         '- **Subject Grades**: printed grade vs grade implied by marks\n' +
         '- **Extracted from PDF**: exactly what the reader got (check this first if a result looks wrong)\n' +
         '- **Data Errors**: credit mismatches, parser errors, unreadable files\n' +
         '- **Precision Log**: each calculation as exact fractions, with its rounded value',
      f: ['What do Clean / Flagged / Rejected mean?', 'Why exact fractions?'] },

    { id: 't3-exact', cat: 'tool3', topic: T3, t: 'Why exact fractions?',
      q: ['why exact fractions', 'exact arithmetic', 'bigint rational', 'no floating point', 'rat class', 'rounding in consolidated', 'round half up consolidated', 'self test on load'],
      k: ['exact', 'fraction', 'fractions', 'bigint', 'rational', 'float', 'selftest'],
      a: 'Every value is stored as an **exact fraction of two BigIntegers** (a small `Rat` class), never a JavaScript float. There is **no tolerance window**, so SGPA, CGPA and percentages cannot drift from rounding: a value either matches or it does not.\n\n' +
         '- SGPA: 1 decimal, **ROUND_HALF_UP**\n- CGPA and Percentage: **Excel ROUND(value, 1)**, applied only after the full calculation\n\n' +
         'A short **self-test** also checks the arithmetic engine against known cases every time the page loads (see the browser console).' },

    { id: 't3-unread', cat: 'tool3', topic: T3, t: 'Consolidated transcript is unreadable',
      q: ['consolidated transcript is unreadable', 'transcript not read', 'tool 3 pdf unreadable', 'consolidated pdf scanned', 'row missing in consolidated', 'consolidated result looks wrong'],
      k: ['unreadable', 'scanned', 'missing', 'wrong'],
      a: '- **UNREADABLE**: the PDF has no text layer (scanned / image-only) or would not open. Get the digital original, or OCR it, and re-run.\n' +
         '- **A subject row seems missing / a result looks wrong**: open **Extracted from PDF** to see what was read. If a row was missed, the semester credit check will not reconcile and **Data Errors** shows it as Critical.\n' +
         '- Check the **grade scale** (Old / New) and **CGPA formula** match the batch.',
      f: ['How do I make a PDF searchable?', 'Old vs New grade scale'] },

    /* ------------------------------------------------ TOOL 4 */
    { id: 't4-about', cat: 'tool4', topic: T4, t: 'What does the Provisional Result tool do?',
      q: ['what is the provisional result tool', 'what does the provisional result tool do', 'what is provisional', 'provisional result', 'tool 4', 'fourth tool', 'tell me about tool 4', 'what is tool 4', 'how does tool 4 work', 'tell me about provisional', 'regular and improvement tr', 'regular vs improvement', 'supplementary tr tool', 'gradesheet verification and provisional result tool'],
      k: ['provisional', 'tool4', 'fourth', 'improvement', 'supplementary', 'regular'],
      a: '**Provisional Result Tool** (Tool 04) builds the **provisional result** from the TRs. For each semester you give it the **Regular TR** and, only if that semester had one, the **Improvement / Supplementary TR**.\n\n' +
         '- For every subject it keeps the **better attempt**: `Reg 15 & Imp 30 → 30`, `Reg 16 & Imp 12 → 16`, equal → either.\n' +
         '- A student **passes overall** only if **no subject in any semester is F** after that update.\n' +
         '- A **W in any Grace cell** withholds the whole result (see *Withheld rule*).\n' +
         '- Handles up to **8 semesters**; students are matched on **Reg. / Enrollment No.**\n' +
         '- Outputs one **8-sheet** workbook, `Provisional_Result_Verified.xlsx`.\n\n' +
         'It reads **TR spreadsheets only** (.xlsx / .xls / .xlsm), no PDFs.',
      f: ['How do I use the Provisional Result tool?', 'Provisional Result: withheld rule', 'What is in the Provisional Result workbook?'],
      b: [['Open Provisional Result', 'open:tool4']] },

    { id: 't4-steps', cat: 'tool4', topic: T4, t: 'How to use the Provisional Result tool',
      q: ['how do i use the provisional result tool', 'how to use provisional', 'how to use tool 4', 'how do i use tool 4', 'use tool 4', 'tool 4 kaise use kare', 'steps for tool 4', 'provisional steps', 'how to make provisional result', 'how to generate provisional result', 'upload improvement tr', 'upload regular tr'],
      k: ['use', 'steps', 'run', 'how', 'upload'],
      a: '1. **Step 1 · Upload TR per semester**: in each semester row put the **Regular TR** on the left and the **Improvement / Supplementary TR** on the right (leave the right empty if there was none).\n' +
         '2. Each file can hold several sheets: use **Select sheet from this file** to pick the right one, or **★ All sheets (merge every program sheet)**. A sheet named `TR` is picked automatically.\n' +
         '3. **Step 2 · Compare all semesters**: the button unlocks once at least one Regular TR is loaded.\n' +
         '4. Read the overview cards and the log (warnings and errors are listed there).\n' +
         '5. **⬇ Download result workbook**. **↺ Reset** (or clicking the logo) clears everything.',
      f: ['Provisional Result: how the better attempt is chosen', 'What is in the Provisional Result workbook?', 'Provisional Result: warnings and manual review'],
      b: [['Open Provisional Result', 'open:tool4']] },

    { id: 't4-rule', cat: 'tool4', topic: T4, t: 'Provisional Result: how the better attempt is chosen',
      q: ['how is the better attempt chosen', 'higher of regular and improvement', 'comparison rule', 'which marks are kept', 'regular 15 improvement 30', 'improved via supplementary', 'pass mark in provisional', 'how is pass decided in provisional', 'not eligible for provisional', 'who gets provisional result'],
      k: ['higher', 'better', 'attempt', 'improved', 'comparison', 'eligible'],
      a: 'Per subject, per semester:\n' +
         '- The **Result** flag decides pass or fail (`P / PASS` = pass; `F / FAIL / RA / AB / ABSENT / DETAINED` = fail). If there is no flag, **40% of the maximum marks** is the pass line.\n' +
         '- If **either** attempt is a pass, the subject is **cleared**, and the higher passing total is shown.\n' +
         '- If neither passes, the higher total is shown and the subject stays **F**.\n' +
         '- **Improved via supplementary** counts students whose improvement attempt raised a mark or turned an F into a pass.\n\n' +
         'A student is **eligible for provisional** only when **no subject in any semester** is still F and nothing is withheld; otherwise they go to **Fail — No Provisional**.',
      f: ['Provisional Result: withheld rule', 'Provisional Result: warnings and manual review'] },

    { id: 't4-withheld', cat: 'tool4', topic: T4, t: 'Provisional Result: withheld rule',
      q: ['provisional result withheld rule', 'withheld in provisional', 'w in grace provisional', 'why is a student withheld in provisional', 'withheld sheet', 'grace column w provisional'],
      k: ['withheld', 'grace', 'w'],
      a: 'A **W** in the **Grace** column withholds the student\'s **whole result**. One W is enough: **any semester, any subject**, in the **regular or the improvement TR**, and it applies **even when that paper is declared P**. (`W`, `WH`, `WITHHELD` are all read as W.)\n\n' +
         'Withheld students are **left out** of *Final Result (Provisional)* and *Fail — No Provisional*, and are listed in the **Withheld** sheet with enrolment, name, marks and the exact subject(s) carrying the W.' },

    { id: 't4-report', cat: 'tool4', topic: T4, t: 'What is in the Provisional Result workbook?',
      q: ['what is in the provisional result workbook', 'provisional report sheets', 'tool 4 report', 'provisional excel tabs', 'provisional_result_verified', 'updated marks sheet', 'final result provisional sheet', 'fail no provisional sheet', 'extracted regular tr', 'extracted supplementary tr'],
      k: ['report', 'sheets', 'workbook', 'excel', 'updated', 'final'],
      a: '`Provisional_Result_Verified.xlsx` has **8 sheets**:\n' +
         '1. **Regular**: marks as read from the regular TRs\n' +
         '2. **Supplementary**: marks from the improvement TRs\n' +
         '3. **Updated Marks**: the better attempt per subject, with its source and any review note\n' +
         '4. **Final Result (Provisional)**: students eligible for a provisional result\n' +
         '5. **Withheld**: students with a W in any Grace cell, with the subject(s)\n' +
         '6. **Fail - No Provisional**: students still failing a subject\n' +
         '7. **Extracted Regular TR** and 8. **Extracted Supplementary TR**: every value the tool read, with **source sheet and row number**, for manual checking.' },

    { id: 't4-trouble', cat: 'tool4', topic: T4, t: 'Provisional Result: warnings and manual review',
      q: ['provisional result warnings', 'need manual review', 'semester was excluded', 'improvement subject does not match', 'regular tr could not be read', 'provisional result looks wrong', 'names differ regular improvement', 'unrecognised result flag'],
      k: ['review', 'warning', 'excluded', 'match', 'wrong'],
      a: '- **Semester EXCLUDED**: its Regular TR could not be read. Pick the correct sheet (or fix the file) and run again.\n' +
         '- **Improvement subject does not match ANY regular subject**: its marks were **not applied**. Check the code / name in both files. Matches made by name instead of code are listed as warnings to verify.\n' +
         '- **Need manual review**: e.g. an unrecognised Result flag (decided on marks), or the higher mark is not a pass while the other attempt is declared P.\n' +
         '- **Different names** for the same Reg. No. in the two TRs are matched on Reg. No. and flagged.\n\n' +
         'Use the two **Extracted** sheets to see exactly what was read.' },

    /* ------------------------------------------------ TOOL 5 */
    { id: 't5-about', cat: 'tool5', topic: T5, t: 'What does the Tr-Tru Eligibility Checker do?',
      q: ['what is the tr tru eligibility checker', 'what does the tr tru eligibility checker do', 'what is tr tru', 'semester eligibility checker', 'eligibility checker', 'tool 5', 'fifth tool', 'tell me about tool 5', 'what is tool 5', 'how does tool 5 work', 'tell me about eligibility', 'who is eligible', 'truscholar eligibility'],
      k: ['trtru', 'eligibility', 'eligible', 'tool5', 'fifth', 'truscholar'],
      a: '**Tr-Tru Eligibility Checker** (Tool 05, *Semester Eligibility Checker*) decides who is **eligible** across all semesters.\n\n' +
         '- Upload **one result file per semester** (up to **8**): a **Truscholar marksheet** or a **TR (transcript)**, as **.xlsx or .csv**.\n' +
         '- Students are matched across files by **Enrollment No** (fallback: hall ticket no, then email). Row order and name spelling do not matter.\n' +
         '- A student is **Eligible** only when **no subject in any semester** has the letter grade **F or Fail**.\n' +
         '- Output: `Eligibility_Report_<N>_semesters_<date>.xlsx`.\n\n' +
         'Files are read inside your browser; nothing is uploaded.',
      f: ['How do I use the Tr-Tru Eligibility Checker?', 'Tr-Tru Eligibility: rules', 'What is in the Eligibility report?'],
      b: [['Open Tr-Tru Eligibility', 'open:tool5']] },

    { id: 't5-steps', cat: 'tool5', topic: T5, t: 'How to use the Tr-Tru Eligibility Checker',
      q: ['how do i use the tr tru eligibility checker', 'how to use eligibility checker', 'how to use tool 5', 'how do i use tool 5', 'use tool 5', 'tool 5 kaise use kare', 'steps for tool 5', 'eligibility steps', 'how to check eligibility', 'check eligibility', 'how to find eligible students'],
      k: ['use', 'steps', 'run', 'how', 'check'],
      a: '1. Choose the **Number of semesters**.\n' +
         '2. Drop one file into each semester slot (**.xlsx or .csv**). The file type is **auto-detected**; if it is wrong, set the slot to **Truscholar marksheet** or **TR (transcript)**.\n' +
         '3. Press **Check eligibility**.\n' +
         '4. Read the count line and use the **All / Eligible / Not eligible** filters; each student row shows the reason.\n' +
         '5. **Download Excel report**. **Clear all** starts again.',
      f: ['Tr-Tru Eligibility: rules', 'Tr-Tru: file not recognised', 'What is in the Eligibility report?'],
      b: [['Open Tr-Tru Eligibility', 'open:tool5']] },

    { id: 't5-rules', cat: 'tool5', topic: T5, t: 'Tr-Tru Eligibility: rules',
      q: ['tr tru eligibility rules', 'eligibility rules', 'when is a student eligible', 'why not eligible', 'not eligible reason', 'no record in this semester', 'no letter grades found', 'blank grade eligibility', 'how is eligibility decided', 'how decided'],
      k: ['rules', 'eligible', 'record', 'blank', 'decided'],
      a: '1. **Eligible** only if the result is **PASS in every** uploaded semester.\n' +
         '2. A subject **fails** when its letter grade is **F or Fail** (any capitalisation, spaces ignored). Any other grade is a pass.\n' +
         '3. A semester **passes** when it has at least one graded subject and none failed. Every subject and every row is checked.\n' +
         '4. **No record** in a semester file, or **no letter grades** there → **Not Eligible** (a pass cannot be confirmed).\n' +
         '5. Matching is by **Enrollment No** → hall ticket no → email.\n' +
         '6. A **blank grade** is not a fail; it goes to the **Warnings** sheet.\n\n' +
         'For a **TR**, grades are read from its **Letter Grade** columns and its **Reg. No.** is matched with the Truscholar Enrollment No. If a file\'s own RESULT column disagrees with the grades, that is also flagged as a warning.' },

    { id: 't5-format', cat: 'tool5', topic: T5, t: 'Tr-Tru: file not recognised',
      q: ['tr tru file not recognised', 'file was not recognised', 'not a truscholar marksheet', 'not a tr', 'grd_lettr_th', 'letter grade columns', 'truscholar or tr', 'auto detect file type eligibility', 'csv or xlsx eligibility'],
      k: ['recognised', 'format', 'detect', 'truscholar', 'csv'],
      a: 'Each semester slot auto-detects the file type:\n' +
         '- **Truscholar marksheet**: needs the `GRD_LETTR_TH` letter-grade columns.\n' +
         '- **TR (transcript)**: needs **Letter Grade** columns.\n\n' +
         'If neither is found you get *"This file was not recognised…"*. Check you uploaded the right export, or set the slot\'s type manually. Rows with no enrollment number, hall ticket or email are skipped (listed in Warnings).' },

    { id: 't5-report', cat: 'tool5', topic: T5, t: 'What is in the Eligibility report?',
      q: ['what is in the eligibility report', 'eligibility report sheets', 'tool 5 report', 'eligibility excel tabs', 'eligibility_report', 'eligible sheet', 'not eligible sheet', 'how decided sheet', 'warnings sheet eligibility'],
      k: ['report', 'sheets', 'excel', 'warnings'],
      a: '`Eligibility_Report_<N>_semesters_<date>.xlsx` has:\n' +
         '- **Summary**: every student with per-semester status and the decision\n' +
         '- **Eligible** and **Not Eligible**: the two lists, each with the reason\n' +
         '- **one sheet per semester**: every subject and grade\n' +
         '- **Warnings** (if any): blank grades, duplicates, RESULT-column disagreements\n' +
         '- **How Decided**: the rules used and the file (and file type) for each semester.' },

    /* ------------------------------------------------ reports */
    { id: 'r-overview', cat: 'reports', topic: 'site', t: 'What is in the Excel reports?',
      q: ['what is in its excel report', 'what is in the report', 'excel report sheets', 'report tabs', 'what does the report contain', 'output format', 'how to read the report', 'explain the report', 'what sheets are in the report', 'which tabs are in the excel'],
      k: ['report', 'excel', 'sheets', 'tabs', 'output'],
      a: '**Marksheet vs TR** produces one workbook with a tab per check: *counts first, then the full evidence trail*:\n' +
         '- **Summary**, **Discrepancy Report**, **Field Comparison**, **Student Status**\n' +
         '- **Missing & Extra**, **Duplicate Detection**, **Subject Mapping**, **Subject Code Mapping**\n' +
         '- **Document Integrity**, **PDF Self-Check**, **TruScholar Data Verification**, **Sem-1 Code Format (F4)**\n' +
         '- **Unreadable PDFs**, **TR Extracted Data**, **PDF Extracted Data**\n\n' +
         '**White vs Original** makes one numbered workbook per check: `1_white_vs_original`, `2_sgpa_percentage_check`, `3_withheld_students`, `4_failed_candidates`.\n\n' +
         '**Consolidated Marksheet Checker** makes `Transcript_Audit_<date>.xlsx` with: Summary, Student Status, Fail, Semester SGPA, Semester Breakdown, Final Values, Subject Grades, Extracted from PDF, Data Errors, Precision Log.\n\n' +
         '**Provisional Result** makes `Provisional_Result_Verified.xlsx` with 8 sheets: Regular, Supplementary, Updated Marks, Final Result (Provisional), Withheld, Fail - No Provisional, Extracted Regular TR, Extracted Supplementary TR.\n\n' +
         '**Tr-Tru Eligibility** makes `Eligibility_Report_<N>_semesters_<date>.xlsx` with: Summary, Eligible, Not Eligible, one sheet per semester, Warnings, How Decided.\n\nAsk me about any sheet by name.',
      f: ['Explain the Discrepancy Report', 'Explain Document Integrity', 'What is in the Consolidated Checker report?', 'What is in the Provisional Result workbook?', 'What is in the Eligibility report?'] },

    { id: 'r-summary', cat: 'reports', topic: T1, t: 'Summary sheet',
      q: ['explain the summary sheet', 'summary tab', 'what is the summary', 'metric value remarks'],
      k: ['summary', 'metric'],
      a: '**Summary** has the headline counts in three columns: **Metric · Value · Remarks**. That covers how many PDFs were read and matched, how many students were flagged, and so on. Start here, then open the detailed tabs for evidence.' },

    { id: 'r-disc', cat: 'reports', topic: T1, t: 'Discrepancy Report sheet',
      q: ['explain the discrepancy report', 'discrepancy report', 'error category severity', 'what does severity mean', 'list of all errors'],
      k: ['discrepancy', 'severity', 'errors'],
      a: '**Discrepancy Report** has **one row per problem found**:\n<kv>Reg. No.|match key\nStudent|name\nError Category|kind of problem\nSection|identity / subject / totals…\nField|which field\nPDF Value|what the gradesheet prints\nTR Value|what the TR says\nSeverity|how serious it is\nNote|explanation</kv>\nFilter by **Severity** or **Error Category** in Excel to triage quickly.' },

    { id: 'r-field', cat: 'reports', topic: T1, t: 'Field Comparison sheet',
      q: ['explain field comparison', 'field comparison sheet', 'match column', 'every field compared'],
      k: ['field', 'comparison', 'match'],
      a: '**Field Comparison** is the complete evidence trail: **every** field compared, matched or not. Columns: **Reg. No. · Student · Section · Field · PDF · TR · Match?**. Filter **Match?** to see only problems, or keep all rows as proof that a field was checked.' },

    { id: 'r-status', cat: 'reports', topic: T1, t: 'Student Status sheet',
      q: ['explain student status', 'student status sheet', 'number of flags per student', 'which students are clean'],
      k: ['status', 'flags', 'clean'],
      a: '**Student Status** has one row per student: **Reg. No. · Name (PDF) · Name (TR) · Status · # Flags**. It gives a quick view of who is clean and who needs attention.' },

    { id: 'r-missing', cat: 'reports', topic: T1, t: 'Missing & Extra sheet',
      q: ['explain missing and extra', 'in pdf but not in tr', 'in tr but not in pdf', 'missing students', 'extra students', 'student not found in tr'],
      k: ['missing', 'extra', 'notfound'],
      a: '**Missing & Extra** lists students who appear on only one side:\n- **In PDF but NOT in TR**: a gradesheet with no matching TR row\n- **In TR but NOT in PDF**: a TR student with no gradesheet loaded\n\nColumns: Reg. No., Name, Programme, Semester, Note. Usually this means a wrong TR sheet, a missing PDF, or a registration number typed differently.',
      f: ['Why does a student show as missing?'] },

    { id: 'r-dup', cat: 'reports', topic: T1, t: 'Duplicate Detection sheet',
      q: ['explain duplicate detection', 'duplicate course', 'same code different name', 'duplicate subject'],
      k: ['duplicate', 'duplicates'],
      a: '**Duplicate Detection** finds a course appearing **more than once within one document**. It covers duplicate code, duplicate name, same-code/different-name and same-name/different-code, for both the gradesheet PDF and its matched TR row.' },

    { id: 'r-map', cat: 'reports', topic: T1, t: 'Subject Mapping / Subject Code Mapping',
      q: ['explain subject mapping', 'subject code mapping', 'course name differs', 'pdf course name vs tr course name'],
      k: ['mapping'],
      a: '- **Subject Mapping** pairs by code and compares names: *Reg. No. · Code · PDF Course Name · TR Course Name · Status · Note*.\n' +
         '- **Subject Code Mapping** pairs by name and compares codes: *PDF Code · TR Code · Status · Note*. This is where "codes differ but it is the same subject" is recorded.' },

    { id: 'r-integrity', cat: 'reports', topic: T1, t: 'Document Integrity & PDF Self-Check',
      q: ['explain document integrity', 'pdf self check', 'self check formula', 'computed vs pdf value', 'internal consistency'],
      k: ['integrity', 'selfcheck', 'computed', 'consistency'],
      a: 'Both check a gradesheet\'s **internal arithmetic**:\n- **Document Integrity**: *Check · Scope · Rule · PDF Value · Expected · Result*\n- **PDF Self-Check**: *Check · Scope · Formula · PDF Value · Computed · Result*\n\nThey catch sheets whose printed totals do not add up, even when the TR agrees with the gradesheet.' },

    { id: 'r-trus', cat: 'reports', topic: T1, t: 'TruScholar Data Verification sheet',
      q: ['truscholar data verification', 'truscholar sheet', 'blank field truscholar glitch'],
      k: ['truscholar'],
      a: '**TruScholar Data Verification** checks each gradesheet data field on its own: *Reg. No. · Student · Data Field · PDF Value · Result · Note*. Blank fields (a known TruScholar glitch) are always flagged here.' },

    { id: 'r-f4', cat: 'reports', topic: T1, t: 'Sem-1 Code Format (F4) sheet',
      q: ['what is in the sem 1 code format sheet', 'sem 1 code format sheet', 'f4 sheet', 'code format sheet'],
      k: ['f4', 'sem1'],
      a: '**Sem-1 Code Format (F4)** shows, per subject: the printed code token, course name, detected code shape, printed credit, and the T-P-PR derived from the TR. It is where wrong or missing `[T]/[P]/[PR]` brackets and wrong credit numbers show up.' },

    { id: 'r-unread', cat: 'reports', topic: T1, t: 'Unreadable PDFs sheet',
      q: ['explain unreadable pdfs', 'unreadable pdfs', 'pdf not read', 'no text layer', 'scanned pdf', 'pdf skipped', 'some pdfs missing from report'],
      k: ['unreadable', 'scanned', 'scan', 'text', 'layer', 'ocr', 'skipped'],
      a: '**Unreadable PDFs** lists files the tool could not read (**File · Reason**). Usually the PDF has **no text layer**: it is a scanned image, or has a non-standard layout.\n\nFix: run those files through **OCR** (make them searchable) and re-run, or check them manually.',
      f: ['How do I make a PDF searchable?'] },

    { id: 'r-extract', cat: 'reports', topic: T1, t: 'TR / PDF Extracted Data sheets',
      q: ['tr extracted data', 'pdf extracted data', 'raw data sheets', 'what the tool read'],
      k: ['extracted', 'raw'],
      a: '**TR Extracted Data** and **PDF Extracted Data** show exactly **what the tool read** from each source. When a flag looks wrong, check these first: they tell you whether the problem is in the document or in how it was read.' },

    { id: 'r-name', cat: 'reports', topic: 'site', t: 'Naming & saving the report',
      q: ['how do i name the report', 'file name suggestion', 'where is the report saved', 'download excel report', 'report not downloading', 'save the report'],
      k: ['name', 'filename', 'save', 'download', 'saved'],
      a: 'When you press **Download**, a dialog suggests a file name from the **Program / Batch / Semester** of the loaded TR. Edit it freely, then press Download. The file goes to your browser\'s normal **Downloads** folder.\n\nIf nothing downloads, check that the browser has not blocked downloads for this site (look for an icon in the address bar).' },

    /* ------------------------------------------------ troubleshooting */
    { id: 'x-blank', cat: 'trouble', topic: 'site', t: 'The tool page is blank / buttons do nothing',
      q: ['the tool page is blank', 'tool not loading', 'buttons do nothing', 'run button not working', 'page not working', 'nothing happens when i click', 'tool is stuck', 'not working'],
      k: ['blank', 'loading', 'stuck', 'nothing', 'broken', 'working'],
      a: 'Most often the libraries (pdf.js / SheetJS / ExcelJS from cdnjs) did not load. Try these in order:\n1. Check your **internet connection** and reload (Ctrl + F5).\n2. Disable ad-blockers / strict content blockers for this site.\n3. Use an up-to-date **Chrome or Edge**.\n4. Make sure you opened the site over `https://` (GitHub Pages) or a local server, not by double-clicking `index.html`.\n\nThe Run button also stays inactive until the required files are loaded: *"Load the TR and at least one PDF to begin."*',
      f: ['Does it work offline?', 'Which browser should I use?'] },

    { id: 'x-missing', cat: 'trouble', topic: T1, t: 'A student shows as missing / not matched',
      q: ['why does a student show as missing', 'student not matched', 'registration number mismatch', 'pdf not paired', 'reg no not found', 'wrong semester sheet'],
      k: ['matched', 'paired', 'registration', 'reg'],
      a: 'Pairing uses **Registration No.** Common causes:\n- The wrong **semester / sheet** is selected in the TR workbook.\n- The PDF was not loaded, or is in the **Unreadable PDFs** tab.\n- The registration number is printed or typed differently (extra space, O vs 0).\n- The student really is absent from the TR.\n\nCheck **Missing & Extra** and the **Extracted Data** tabs to see what was read.' },

    { id: 'x-blankfield', cat: 'trouble', topic: T1, t: 'Why is a blank field flagged when both are blank?',
      q: ['why is a blank field flagged', 'both blank still error', 'blank field error', 'empty field flagged', 'mother name blank'],
      k: ['blank', 'empty'],
      a: 'By design: blank fields are a known **TruScholar glitch**, so they are **always flagged**, even when both PDF and TR are blank. A field whose **label is not printed at all** (e.g. no ABC ID row) is different: that is a **format difference (N/A)**, not a blank-data error.' },

    { id: 'x-ocr', cat: 'trouble', topic: 'site', t: 'Making a scanned PDF searchable (OCR)',
      q: ['how do i make a pdf searchable', 'ocr a pdf', 'scanned pdf fix', 'convert scanned pdf to text', 'pdf has no text'],
      k: ['ocr', 'searchable', 'scanned', 'scan'],
      a: 'The tools need PDFs with a **text layer**. For scanned ones, run OCR with any tool your office approves, for example Adobe Acrobat (*Scan & OCR → Recognize text*) or another OCR utility. Then re-run the check. The best fix is to request the digital original from TruScholar.\n\nQuick test: if you can select and copy text in the PDF, it has a text layer.' },

    { id: 'x-wrongflag', cat: 'trouble', topic: 'site', t: 'A result looks wrong',
      q: ['a result looks wrong', 'false positive', 'report is wrong', 'incorrect flag', 'tool made a mistake', 'bug in the tool'],
      k: ['wrong', 'false', 'incorrect', 'mistake', 'bug'],
      a: '1. Check **TR / PDF Extracted Data** to see what was read.\n2. Confirm the **TR format** and **transcript format** (override Auto Detect if needed).\n3. Confirm the right **TR sheet** is selected.\n4. Remember White vs Original is exact by design (`7.6 ≠ 7.60`).\n\nThe portal asks: *report anything that looks wrong in a result to the examination office before acting on it.*' },

    { id: 'x-slow', cat: 'trouble', topic: 'site', t: 'It is slow / browser froze',
      q: ['it is slow', 'browser froze', 'page unresponsive', 'out of memory', 'crashed during run', 'too slow'],
      k: ['slow', 'froze', 'freeze', 'unresponsive', 'memory', 'crash'],
      a: 'Large batches are heavy. Try:\n- Split the batch (e.g. 300–500 PDFs per run).\n- Close other tabs and heavy apps.\n- Use Chrome or Edge on a laptop/desktop.\n- If the browser says *"page unresponsive"*, choose **Wait**: work is still happening.' },

    /* ------------------------------------------------ glossary */
    { id: 'g-tr', cat: 'glossary', topic: 'site', t: 'What is a TR?',
      q: ['what is tr', 'what is a tr', 'tabulated result', 'what does tr mean', 'tr sheet meaning', 'tr full form'],
      k: ['tr', 'tabulated'],
      a: '**TR = Tabulated Result**: the Excel workbook holding every student\'s results for a programme / semester. In Marksheet vs TR it is the **source of truth** that the gradesheets are checked against.' },

    { id: 'g-sgpa', cat: 'glossary', topic: 'site', t: 'What is SGPA?',
      q: ['what is sgpa', 'sgpa meaning', 'sgpa full form', 'semester grade point average', 'what is cgpa'],
      k: ['sgpa', 'cgpa', 'average'],
      a: '**SGPA = Semester Grade Point Average**:\n```\nSGPA = Total Credit Points / Total Credits   (1 decimal, half-up)\n```\nTry: **"sgpa 218 28"**. (CGPA is the cumulative version across semesters. The **Consolidated Marksheet Checker** checks CGPA too.)',
      f: ['sgpa 218 28', 'What are credit points?'] },

    { id: 'g-tppr', cat: 'glossary', topic: 'site', t: 'What is T-P-PR?',
      q: ['what is t p pr', 'what is tppr', 'credit structure meaning', 'what does 3 0 0 mean', 'theory practical project', 'credit structure'],
      k: ['tppr', 'theory', 'practical', 'structure'],
      a: '**T-P-PR** is the credit structure **Theory - Practical - Project/OJT**. `3-0-0` means 3 theory credits; `0-4-0` means 4 practical credits. **Position matters**: `0-4-0 ≠ 0-0-4`. Total credits for a subject = T + P + PR.',
      f: ['Which bracket for 0-4-0?', 'total credits for 3-0-0, 0-4-0'] },

    { id: 'g-cp', cat: 'glossary', topic: 'site', t: 'Credit points & grade points',
      q: ['what are credit points', 'what is grade point', 'credit points formula', 'how are credit points calculated', 'gp and cp'],
      k: ['points', 'grade', 'gp', 'cp'],
      a: '- **Grade Point (GP)**: the number for a grade (e.g. 8 for a given letter grade)\n- **Credit Points (CP)** per subject:\n```\nCP = (T + P + PR) × Grade Point\n```\n- **Grand Total Credit Points = Total Credits × 10** (the maximum possible)\n\nTry: **"credit points 3-0-0 grade point 8"**.' },

    { id: 'g-abc', cat: 'glossary', topic: 'site', t: 'What is ABC ID?',
      q: ['what is abc id', 'abc id meaning', 'academic bank of credits'],
      k: ['abcid', 'academic', 'bank'],
      a: '**ABC ID** is the student\'s **Academic Bank of Credits** ID. Some gradesheet formats print it (Format 2), others do not (Formats 1 & 3).',
      f: ['What is the ABC ID rule?'] },

    { id: 'g-misc', cat: 'glossary', topic: 'site', t: 'OJT, TruScholar, Grace, White copy',
      q: ['what is ojt', 'what is truscholar', 'what is grace mark', 'what is white background copy', 'what is sealed original', 'what is publication date'],
      k: ['ojt', 'truscholar', 'grace', 'sealed', 'publication'],
      a: '- **OJT**: On the Job Training, often the PR part of T-P-PR\n- **TruScholar**: the platform that issues the gradesheet PDFs\n- **Grace**: grace-marks column in the TR. A **W** there means *withheld*.\n- **White-background copy**: a plain print version of a gradesheet\n- **Original (sealed)**: the official issued version\n- **Publication date**: the result date printed on the sheet, compared in White vs Original' },

    { id: 'g-halfup', cat: 'glossary', topic: 'site', t: 'Half-up rounding',
      q: ['what is half up rounding', 'how does rounding work', 'why 8 25 becomes 8 3', 'rounding rule', 'round half up'],
      k: ['rounding', 'halfup', 'round'],
      a: '**Half-up** rounds a 5 upwards: `8.25 → 8.3`, `7.24 → 7.2`, `7.35 → 7.4`. The three SGPA-checking tools (01–03) round SGPA and percentage to **1 decimal, half-up**. Try: **"round 8.25"**.' },

    /* ------------------------------------------------ calculators (help pages) */
    { id: 'c-help', cat: 'calc', topic: 'site', t: 'What can you calculate?',
      q: ['what can you calculate', 'calculator', 'calculate sgpa', 'calculate percentage', 'math', 'can you do calculations', 'compute'],
      k: ['calculate', 'calculator', 'compute', 'math'],
      a: 'I calculate offline, using the same rules as the tools:\n' +
         '- `sgpa 218 28`: SGPA from credit points and credits\n' +
         '- `percentage 512 of 700`: percentage (1 decimal, half-up)\n' +
         '- `total credits for 3-0-0, 0-4-0, 2-0-0`: Σ T-P-PR, total credits, grand total CP\n' +
         '- `credit points 3-0-0 grade point 8`: CP for a row\n' +
         '- `bracket for 0-4-0`: Format-4 bracket\n' +
         '- `max marks for 7 subjects`\n' +
         '- `is AB a fail?`: grade verdict\n' +
         '- `round 8.25`, or plain maths like `(218/28)*10`',
      f: ['sgpa 218 28', 'percentage 512 of 700', 'total credits for 3-0-0, 0-4-0, 2-0-0'] },

    /* ------------------------------------------------ mirage */
    { id: 'm-what', cat: 'mirage', topic: 'mirage', t: 'What can Mirage do?',
      q: ['what can you do', 'help', 'what are your features', 'how can you help me', 'capabilities', 'what do you know', 'menu', 'options'],
      k: ['help', 'features', 'capabilities', 'can'],
      a: function (c) {
        var s = '**I can:**\n- Answer questions about the portal, sign-in and **all five tools**, down to every report sheet\n- Calculate **SGPA, percentage, credits**, and check grades\n- Troubleshoot common problems\n- Open tools and jump to portal sections\n- Switch **dark / light** mode\n- Remember your name, talk, and listen (voice)\n';
        if (c.level >= 2) s += '\n**♔ Super admin extras:** open **any link** from chat, sign out, extend your session, view the team list, diagnostics, saved quick links, unlock sign-in, export this chat. Type `/` to see them all.';
        else if (c.level === 1) s += '\nType `/` to see commands.';
        else s += '\nSign in to open the tools from here. Type `/` to see commands.';
        return s;
      },
      f: ['What tools are available?', 'What can you calculate?', 'Show commands'] },

    { id: 'm-ai', cat: 'mirage', topic: 'mirage', t: 'Are you an AI? Do you use the internet?',
      q: ['are you an ai', 'what are you', 'who are you', 'are you chatgpt', 'do you use the internet', 'do you need an api key', 'how do you work', 'are you a real person', 'who made you', 'who created you', 'are you online'],
      k: ['ai', 'chatgpt', 'api', 'robot', 'human', 'created', 'made'],
      a: 'I am **Mirage**, a built-in assistant that runs **entirely in your browser**. There is no API key, no server and no internet call. I match your question against a knowledge base written from this site and all five tools, with typo tolerance, and I do my calculations locally.\n\nThat makes me fast and private, but I only know about this suite. For anything else, ask a person.' },

    { id: 'm-voice', cat: 'mirage', topic: 'mirage', t: 'Voice: talking and listening',
      q: ['can you talk', 'voice mode', 'speak to you', 'read aloud', 'microphone not working', 'voice input', 'text to speech'],
      k: ['voice', 'speak', 'talk', 'microphone', 'mic', 'aloud', 'listen'],
      a: '- 🔊 in the header (or Settings) turns on **reading replies aloud**. It uses your device\'s built-in voice and works offline.\n- 🎤 next to the input lets you **speak a question**. That uses the browser\'s speech service; in Chrome it needs internet and microphone permission. If it is unavailable, just type.' },

    { id: 'm-shortcuts', cat: 'mirage', topic: 'mirage', t: 'Shortcuts & commands',
      q: ['keyboard shortcuts', 'shortcuts', 'show commands', 'list commands', 'slash commands', 'what commands'],
      k: ['shortcut', 'shortcuts', 'commands', 'command', 'slash', 'keyboard'],
      a: function (c) {
        var list = COMMANDS.filter(function (x) { return c.level >= ROLE_LEVEL[x.level]; })
          .map(function (x) { return '- `' + x.cmd + '`: ' + x.d; }).join('\n');
        return '**Keys:** `Alt+M` open/close · `Esc` close · `↑` recall last message · `Shift+Enter` new line\n\n**Commands** (type `/`):\n' + list;
      } },

    { id: 'm-companion', cat: 'mirage', topic: 'mirage', t: 'The companion & scenes',
      q: ['change companion', 'who is nova', 'who is pip', 'change background', 'change scene', 'hide the robot', 'make it smaller', 'why is mirage sleeping', 'where did mirage go'],
      k: ['companion', 'nova', 'pip', 'scene', 'background', 'robot', 'sleeping', 'habitat'],
      a: 'In ⚙ **Settings** you can pick a companion (**Mirage, Nova or Pip**), a scene (**Aurora, Meadow, Night, Ocean, Sunset**), and hide the habitat. Left alone, the companion plays, naps and eventually wanders off; press **Come back** to recall it. Or just tell me: *"dance"*, *"wave"*, *"switch to Nova"*, *"night scene"*.',
      b: [['Open settings', 'cmd:settings']] },

    /* ------------------------------------------------ super admin */
    { id: 'a-what', cat: 'admin', topic: 'admin', t: 'What can a super admin do?', level: 'admin',
      q: ['what can a super admin do', 'super admin features', 'admin powers', 'special access', 'admin commands', 'what can admin do', 'superadmin'],
      k: ['admin', 'superadmin', 'special', 'powers'],
      a: function (c) {
        if (c.level < 2) return 'Super admin accounts get extra controls in Mirage: opening any link from chat, signing out, extending sessions, a team list, diagnostics, saved quick links and more. They appear automatically when a super admin signs in.';
        return '**♔ Your super admin controls:**\n' +
          '- `open <url or name>`: open **any** link, page or saved link (add "new tab" to keep the portal open)\n' +
          '- `logout`: sign out from chat\n' +
          '- `/extend`: add ' + c.cfg.sessionHours + ' hours to your session · `/session` for details\n' +
          '- `/team`: team accounts & roles (passwords are never shown)\n' +
          '- `/links`, `/addlink Name URL`, `/removelink Name`: your quick links\n' +
          '- `/diag`: diagnostics · `/unlock`: clear sign-in lockout here\n' +
          '- `/export`: download this chat · `/reload`: refresh the page\n\n' +
          'Everything is also in the **♔ Admin** tab.';
      },
      b: [['Open Admin tab', 'cmd:admin']] }
  ];

  /* =======================================================================
     SMALL HELPERS
     ======================================================================= */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ssGet(k, d) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function fmtWhen(ts) {
    if (!ts) return '—';
    var d = new Date(ts), now = new Date();
    var t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'today at ' + t;
    var tm = new Date(now.getTime() + 86400000);
    if (d.toDateString() === tm.toDateString()) return 'tomorrow at ' + t;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' at ' + t;
  }
  function fmtLeft(ts) {
    var ms = (ts || 0) - Date.now();
    if (ms <= 0) return 'expired';
    var m = Math.round(ms / 60000), h = Math.floor(m / 60);
    return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
  }

  /* half-up to 1 decimal, safe against float noise (8.25 -> 8.3) */
  function r1(x) { return Math.round((x + (x >= 0 ? 1 : -1) * 1e-9) * 10) / 10; }
  function f1(x) { return r1(x).toFixed(1); }

  /* =======================================================================
     SESSION & ROLE  (reads the portal's own session; never writes it,
     except the explicit super-admin "extend" / "sign out" actions)
     ======================================================================= */

  function readSession() {
    var stores = [['local', localStorage], ['session', sessionStorage]];
    for (var i = 0; i < stores.length; i++) {
      try {
        var raw = stores[i][1].getItem(CFG.sessionKey);
        if (!raw) continue;
        var d = JSON.parse(raw);
        if (!d || !d.user || !d.expires) continue;
        if (Date.now() > d.expires) continue;
        return { user: String(d.user), expires: d.expires, store: stores[i][0] };
      } catch (e) {}
    }
    return null;
  }

  function superAdminNames() {
    var names = CFG.superAdmins.map(function (n) { return n.toLowerCase(); });
    (SITE.CREDENTIALS || []).forEach(function (c) {
      if (/super\s*admin/i.test(c.id || '') || /super\s*admin/i.test(c.display || '')) {
        names.push(String(c.id).toLowerCase());
        if (c.display) names.push(String(c.display).toLowerCase());
      }
    });
    return names;
  }

  function roleOf(session) {
    if (!session || !session.user) return 'guest';
    return superAdminNames().indexOf(session.user.toLowerCase()) >= 0 ? 'admin' : 'staff';
  }

  function portalVisible() {
    var app = document.getElementById('app');
    return !!(app && !app.hidden);
  }

  /* =======================================================================
     TEXT NORMALISATION
     ======================================================================= */

  var PHRASES = [
    [/\bt\s*[-\/]\s*p\s*[-\/]\s*pr\b/g, ' tppr '],
    [/\ball[\s-]*in[\s-]*one\b/g, ' allinone '],
    [/\bmark\s*sheet\s*(vs|versus|v|and|against)\s*tr\b(\s*verification)?/g, ' allinone '],
    [/\bgrade\s*sheet\s*(vs|versus|v|and|against)\s*tr\b/g, ' allinone '],
    [/\btool\s*(1|one|01)\b|\bfirst tool\b|\btool\s*i\b/g, ' tool1 allinone '],
    [/\bwhite\s*(vs|versus|v|and|against|to)?\s*original\b|\bwvo\b|\bwhite-vs-original\b/g, ' whitevsoriginal '],
    [/\btool\s*(2|two|02)\b|\bsecond tool\b|\btool\s*ii\b/g, ' tool2 whitevsoriginal '],
    [/\bconsolidated\s*(mark\s*sheets?|marksheets?|transcripts?|grade\s*sheets?)?\s*(audit\s*)?(checker|check)?(\s*tool)?\b|\bconsolidated-checker\b/g, ' consolidated '],
    [/\btool\s*(3|three|03)\b|\bthird tool\b|\btool\s*iii\b/g, ' tool3 consolidated '],
    [/\bprovisional\s*(result)?(\s*tool)?\b/g, ' provisional '],
    [/\btool\s*(4|four|04)\b|\bfourth tool\b|\btool\s*iv\b/g, ' tool4 provisional '],
    [/\btr\s*[-\/&]?\s*(vs\s*)?tru(scholar)?\s*(semester\s*)?eligib\w*(\s*checker)?(\s*tool)?\b|\btr\s*[-\/&]\s*tru\b|\btr\s+tru\b|\btrtru\b|\btr-tru-eligible\b|\bsemester\s*eligibility(\s*checker)?\b|\beligibility\s*checker\b/g, ' trtru eligibility '],
    [/\btool\s*(5|five|05)\b|\bfifth tool\b|\btool\s*v\b/g, ' tool5 trtru eligibility '],
    [/\b(grade|mark)\s*sheets?\b|\bmarksheets?\b|\btranscripts?\b/g, ' gradesheet '],
    [/\btabulat\w*\s*(result|register|sheet)?\b|\bresult\s*sheet\b/g, ' tr '],
    [/\b(logged|signed|kicked|thrown|timed)\s*out\b/g, ' logout expire '],
    [/\blog\s*in\b|\bsign\s*in\b|\bsignin\b|\blogon\b|\blog\s*on\b/g, ' login '],
    [/\blog\s*out\b|\bsign\s*out\b|\bsignout\b|\blog\s*off\b|\blogoff\b/g, ' logout '],
    [/\bpass\s*word\b|\bpwd\b|\bpasscode\b/g, ' password '],
    [/\bspread\s*sheet\b|\bxlsx\b|\bxls\b|\bworkbook\b/g, ' excel '],
    [/\bpercent\b|%/g, ' percentage '],
    [/\babc\s*id\b/g, ' abcid '],
    [/\bon\s*the\s*job\s*training\b/g, ' ojt '],
    [/\bsuper\s*admin\w*\b/g, ' superadmin admin '],
    [/\bdark\s*theme\b|\bnight\s*mode\b/g, ' dark mode '],
    [/\bpdfs\b/g, ' pdf '],
    /* a little Hinglish */
    [/\bkya\b/g, ' what '], [/\bkaise\b|\bkese\b|\bkaisey\b/g, ' how '], [/\bkyu\b|\bkyon\b|\bkyun\b/g, ' why '],
    [/\bkahan\b|\bkaha\b/g, ' where '], [/\bkholo\b|\bkhol\s*do\b|\bkhol\b/g, ' open '], [/\bbatao\b|\bbataye\b|\bbatayein\b/g, ' tell '],
    [/\bnahi\b|\bnhi\b|\bnahin\b/g, ' not '], [/\bkaam\b/g, ' work '], [/\bmadad\b/g, ' help ']
  ];

  var STOP = new Set(('a an the is are was were am be been being i me my mine you your we our they their this that these those it its and or but if ' +
    'then so to of in on at for from with by as do does did can could would should will shall may might must who whom whose there here ' +
    'please pls plz kindly just really very some any about into also hey hi ok okay want need tell know like get got give show let us one thing things ' +
    'hai hain ka ki ke ko se mein me ho kare karu karna karein karo gaya gayi raha rahi').split(' '));

  function norm(text) {
    var s = ' ' + String(text || '').toLowerCase()
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-') + ' ';
    PHRASES.forEach(function (p) { s = s.replace(p[0], p[1]); });
    return s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function stem(w) {
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /es$/.test(w) && !/ses$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }

  var CONCEPT = {
    sent: 'upload', send: 'upload', transmit: 'upload', uploaded: 'upload', anywhere: 'upload', leave: 'upload', leak: 'upload',
    hack: 'secure', hackable: 'secure', hacker: 'secure', breach: 'secure', bypas: 'secure', unsafe: 'secure',
    internet: 'offline', online: 'offline', wifi: 'offline', connection: 'offline', network: 'offline',
    return: 'back', revert: 'back', previou: 'back',
    handle: 'many', capacity: 'many', limit: 'many', count: 'many',
    fail: 'fail', failed: 'fail', failing: 'fail', failure: 'fail',
    kicked: 'expire', expire: 'expire', expir: 'expire', timeout: 'expire', logged: 'logged',
    mistake: 'wrong', error: 'wrong', incorrect: 'wrong', bug: 'wrong',
    broken: 'working', crash: 'slow', hang: 'slow', lag: 'slow', freeze: 'slow', froze: 'slow',
    bhool: 'forgot', bhul: 'forgot', forget: 'forgot', forgotten: 'forgot',
    kholna: 'open', launch: 'open',
    before: 'until', till: 'until', untill: 'until', logg: 'logged'
  };
  function tokens(text) {
    return norm(text).split(' ').filter(function (w) { return w && !STOP.has(w); })
      .map(stem).map(function (w) { return CONCEPT[w] || w; });
  }

  function lev(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 3;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function wordMatch(a, b) {
    if (a === b) return 1;
    if (a.length >= 4 && b.length >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 0.85;
    var L = Math.min(a.length, b.length);
    if (L < 4) return 0;
    var d = lev(a, b);
    if (d === 1) return 0.8;
    if (d === 2 && L >= 7) return 0.6;
    return 0;
  }

  /* precompute tokens for the knowledge base, plus IDF weights so rare,
     meaningful words count for more than common ones like "pdf" or "tool" */
  var DF = {};
  KB.forEach(function (e) {
    e._p = e.q.map(function (q) { return { n: norm(q), t: tokens(q) }; });
    e._k = e.k.map(stem).map(function (w) { return CONCEPT[w] || w; }).filter(function (w, i, a) { return a.indexOf(w) === i; });
    var seen = {};
    e._p.forEach(function (p) { p.t.forEach(function (t) { seen[t] = 1; }); });
    e._k.forEach(function (t) { seen[t] = 1; });
    Object.keys(seen).forEach(function (t) { DF[t] = (DF[t] || 0) + 1; });
  });
  var NDOC = KB.length;
  function idf(t) { return Math.log(1 + NDOC / (DF[t] || 1)); }
  KB.forEach(function (e) {
    e._p.forEach(function (p) { p.w = p.t.reduce(function (a, t) { return a + idf(t); }, 0); });
  });

  function scoreEntry(e, qn, qt, ctx) {
    if (e.level && ctx.level < ROLE_LEVEL[e.level] && e.id !== 'a-what') return 0;
    var qw = qt.map(idf), qsum = qw.reduce(function (a, b) { return a + b; }, 0);
    var best = 0;
    for (var i = 0; i < e._p.length; i++) {
      var p = e._p[i];
      if (p.n && p.n.indexOf(' ') > 0 && (' ' + qn + ' ').indexOf(' ' + p.n + ' ') >= 0) {
        var extra = Math.max(0, qt.length - p.t.length);
        best = Math.max(best, 1.12 + Math.min(p.t.length, 6) * 0.06 - Math.min(extra * 0.1, 0.4)); continue;
      }
      if (!p.t.length || !qt.length) continue;
      var hit = 0;
      for (var a = 0; a < qt.length; a++) {
        var m = 0;
        for (var b = 0; b < p.t.length; b++) { m = Math.max(m, wordMatch(qt[a], p.t[b])); if (m === 1) break; }
        hit += m * qw[a];
      }
      var sim = hit / Math.sqrt(qsum * p.w);
      if (sim > best) best = sim;
    }
    var kw = 0;
    for (var k = 0; k < e._k.length; k++) {
      for (var j = 0; j < qt.length; j++) {
        if (wordMatch(qt[j], e._k[k]) >= 0.8) { kw += 0.035 * idf(e._k[k]); break; }
      }
    }
    var score = best * 0.85 + Math.min(kw, 0.35);
    if (ctx.lastTopic && e.topic === ctx.lastTopic && e.topic !== 'site') score += 0.06;
    return score;
  }

  function rank(text, ctx) {
    var qn = norm(text), qt = tokens(text);
    return KB.map(function (e) { return { e: e, s: scoreEntry(e, qn, qt, ctx) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
  }

  /* =======================================================================
     INTENT HELPERS
     ======================================================================= */

  var QUESTION_START = /^(how|what|why|where|when|which|who|does|do|is|are|should|will|explain|tell me|kya|kaise)\b/;
  function isQuestion(raw) {
    var s = raw.trim().toLowerCase();
    return QUESTION_START.test(s) && !/^(can you|could you|would you|will you)\b/.test(s);
  }

  var GREET = /^(hi+|hello+|hey+|hiya|yo|namaste|namaskar|good (morning|afternoon|evening)|greetings|sup|what'?s up|hola)\b[\s!.,]*(mirage|there|bot)?[\s!.]*$/i;
  var THANKS = /\b(thanks?|thank you|thx|ty|dhanyavad|shukriya|appreciate it|great job|awesome|perfect|nice one|you('| a)re (the best|great|awesome))\b/i;
  var BYE = /^(bye+|goodbye|see you|see ya|cya|good night|gn|tata|later|that'?s all)\b/i;
  var HOWRU = /\b(how are you|how r u|how'?s it going|how do you do|kaise ho|how are u)\b/i;
  var JOKE = /\b(joke|make me laugh|something funny|bored)\b/i;
  var AFFIRM = /^(yes|yeah|yep|yup|sure|ok|okay|haan|ha|y|of course|please do|do it|go ahead)[\s!.]*$/i;
  var NEGATE = /^(no|nope|nah|nahi|n|cancel|stop|never ?mind|not now)[\s!.]*$/i;
  var MORE = /^(tell me more|more|more details|explain more|elaborate|go on|and\??|details|continue|what else)[\s!.?]*$/i;

  var NAME_BAD = new Set('not sure fine good ok okay here back stuck confused lost trying looking new done ready busy tired happy sad sorry going working logged signed an a the admin superadmin staff user'.split(' '));
  function extractName(raw) {
    var m = raw.match(/\b(?:my name is|my name's|call me|i am called|name is|mera naam)\s+([a-z][a-z.'-]{1,20}(?:\s+[a-z][a-z.'-]{1,20})?)\b/i) ||
            raw.match(/^(?:i am|i'm|im|this is)\s+([a-z][a-z'-]{1,20})[\s!.]*$/i);
    if (!m) return null;
    var n = m[1].trim();
    if (NAME_BAD.has(n.toLowerCase().split(' ')[0])) return null;
    return n.split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(' ');
  }

  function timeGreeting() {
    var h = new Date().getHours();
    return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  /* =======================================================================
     OFFLINE CALCULATORS
     ======================================================================= */

  var FAIL_GRADES = ['F', 'FF', 'FAIL', 'AB', 'ABS', 'ABSENT', 'I', 'RA', 'R', 'NC', 'U'];

  function nums(s) { return (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number); }
  function structs(s) {
    var out = [], re = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g, m;
    while ((m = re.exec(s))) out.push([+m[1], +m[2], +m[3]]);
    return out;
  }
  function stripStructs(s) { return s.replace(/\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?/g, ' '); }

  /* tiny safe arithmetic parser (no eval) */
  function calcExpr(src) {
    var s = src.replace(/\s+/g, '').replace(/×|x(?=\d|\()/gi, '*').replace(/÷/g, '/');
    if (!/^[\d+\-*/().^%]+$/.test(s) || !/\d/.test(s) || !/[+\-*/^%]/.test(s.replace(/^-/, ''))) return null;
    var i = 0;
    function peek() { return s[i]; }
    function num() {
      var st = i; while (i < s.length && /[\d.]/.test(s[i])) i++;
      if (st === i) throw 0; var v = parseFloat(s.slice(st, i));
      if (peek() === '%') { i++; v = v / 100; } return v;
    }
    function atom() {
      if (peek() === '(') { i++; var v = expr(); if (peek() !== ')') throw 0; i++; return v; }
      if (peek() === '-') { i++; return -atom(); }
      if (peek() === '+') { i++; return atom(); }
      return num();
    }
    function power() { var b = atom(); if (peek() === '^') { i++; return Math.pow(b, power()); } return b; }
    function term() {
      var v = power();
      while (peek() === '*' || peek() === '/') { var o = s[i++], r = power(); v = o === '*' ? v * r : v / r; }
      return v;
    }
    function expr() {
      var v = term();
      while (peek() === '+' || peek() === '-') { var o = s[i++], r = term(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    try { var v = expr(); if (i !== s.length || !isFinite(v)) return null; return v; } catch (e) { return null; }
  }
  function niceNum(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(6)); }

  function calculators(raw) {
    var s = raw.toLowerCase();
    var st = structs(s);

    /* grade verdict */
    var g = s.match(/\b(?:is|grade|does|kya)\s+["']?([a-z]{1,6})["']?\s+(?:a\s+)?(?:grade\s+)?(?:a\s+)?(fail|failed|failing|pass|passed|withheld)\b/) ||
            s.match(/\bgrade\s+["']?([a-z]{1,6})["']?\s*(?:mean|meaning|\?|$)/);
    if (g && !/^(this|that|it|he|she|my|the|student|there|he|they|mine|his|her|result|sheet|report)$/.test(g[1])) {
      var G = g[1].toUpperCase();
      var verdict = G === 'P' ? '✅ **P** is a **pass**.' :
        G === 'W' ? '⏸ **W** means **withheld**, *not* failed. Withheld students come from a W in the TR\'s Grace cell (White vs Original → module 3; in the Provisional Result tool one W withholds the whole result).' :
        FAIL_GRADES.indexOf(G) >= 0 ? '❌ **' + G + '** counts as a **fail** in the Failed Candidates check.' :
        '**' + G + '** is not in the failing list, so it is treated as a pass unless its **grade point is 0** or marks are absent.';
      return { text: verdict + '\n\nFailing grades: `' + FAIL_GRADES.join(' · ') + '`, or grade point 0, or absent marks.', mood: 'happy' };
    }

    /* Format-4 bracket */
    if (st.length === 1 && /\b(bracket|\[t\]|\[p\]|\[pr\]|code format|which code|format 4)\b/.test(s)) {
      var b = st[0], nz = b.map(function (v) { return v > 0; });
      var cnt = nz.filter(Boolean).length;
      var br = cnt !== 1 ? null : nz[0] ? '[T]' : nz[1] ? '[P]' : '[PR]';
      return { text: br ? '`' + b.join('-') + '` → **' + br + '**. For example, `ABC123 ' + br + '` with credit **' + (b[0] + b[1] + b[2]) + '**.' :
        '`' + b.join('-') + '` has ' + (cnt === 0 ? 'no credits' : 'more than one non-zero part') + ', so none of `[T]`, `[P]`, `[PR]` fits a single bracket. Format 4 expects exactly one non-zero part (`x-0-0`, `0-x-0` or `0-0-x`).', mood: 'happy' };
    }

    /* credit points for a row */
    if (st.length === 1 && /\b(credit points?|cp)\b/.test(s) && /\b(grade point|gp|grade)\b/.test(s)) {
      var gp = nums(stripStructs(s)); if (gp.length) {
        var c = st[0][0] + st[0][1] + st[0][2], v = c * gp[0];
        return { text: '```\nCP = (T + P + PR) × GP = (' + st[0].join(' + ') + ') × ' + niceNum(gp[0]) + ' = ' + niceNum(v) + '\n```\nCredit points for this row: **' + niceNum(v) + '**.', mood: 'happy' };
      }
    }

    /* sum of credit structures */
    if (st.length >= 2 || (st.length === 1 && /\b(total|sum|credits?)\b/.test(s))) {
      var sum = [0, 0, 0]; st.forEach(function (x) { sum[0] += x[0]; sum[1] += x[1]; sum[2] += x[2]; });
      var tc = sum[0] + sum[1] + sum[2];
      return { text: '<kv>Subjects|' + st.length + '\nTotal credit line (Σ T-P-PR)|**' + sum.map(niceNum).join('-') + '**\nTotal Credits|**' + niceNum(tc) + '**\nGrand Total Credit Points|**' + niceNum(tc * 10) + '**\nMaximum Marks|**' + st.length * 100 + '**</kv>' +
        'These are the derived totals Marksheet vs TR compares with the printed ones.', mood: 'happy' };
    }

    /* SGPA */
    if (/\bsgpa\b/.test(s) && !/\b(what is|meaning|full form|formula|how is|recomput)\b/.test(s)) {
      var n = nums(s);
      if (n.length >= 2) {
        var cp = Math.max(n[0], n[1]), cr = Math.min(n[0], n[1]);
        if (cr <= 0) return { text: 'Total credits must be more than 0.', kind: 'err' };
        var raw1 = cp / cr;
        return { text: '```\nSGPA = Total Credit Points / Total Credits\n     = ' + niceNum(cp) + ' / ' + niceNum(cr) + ' = ' + raw1.toFixed(4) + '\n```\nRounded half-up to 1 decimal: **SGPA ' + f1(raw1) + '**' +
          (cp > cr * 10 ? '\n\n⚠ Credit points exceed Total Credits × 10 (' + niceNum(cr * 10) + '), which is impossible on a 10-point scale. Check the numbers.' : ''), mood: 'happy' };
      }
      if (n.length < 2 && /\b(calc|calculate|compute|find|check)\b/.test(s)) return { text: 'Give me the **total credit points** and **total credits**, e.g. `sgpa 218 28`.' };
    }

    /* Percentage */
    if (/\bpercent|percentage|%/.test(s) && !/\b(what is|formula|how is|meaning)\b/.test(s)) {
      var p = nums(s.replace(/%/g, ''));
      if (p.length >= 2) {
        var mx = Math.max(p[0], p[1]), mk = Math.min(p[0], p[1]);
        if (mx <= 0) return { text: 'Maximum marks must be more than 0.', kind: 'err' };
        var pr = mk / mx * 100;
        return { text: '```\nPercentage = Total Marks / Maximum Marks × 100\n           = ' + niceNum(mk) + ' / ' + niceNum(mx) + ' × 100 = ' + pr.toFixed(4) + '\n```\nRounded half-up to 1 decimal: **' + f1(pr) + '%**', mood: 'happy' };
      }
    }

    /* max marks */
    var mm = s.match(/\bmax(?:imum)?\s*marks?\b.*?\b(\d+)\s*(subjects?|courses?|papers?)?/) || s.match(/\b(\d+)\s*(subjects?|courses?)\b.*\bmax(?:imum)?\s*marks?/);
    if (mm) { var k = +mm[1]; return { text: '```\nMaximum Marks = subjects × 100 = ' + k + ' × 100 = ' + k * 100 + '\n```\n**' + k * 100 + '** maximum marks.', mood: 'happy' }; }

    /* grand total credit points */
    var gt = s.match(/\bgrand\s*total\b.*?(\d+(?:\.\d+)?)/);
    if (gt) { var x = +gt[1]; return { text: '```\nGrand Total Credit Points = Total Credits × 10 = ' + niceNum(x) + ' × 10 = ' + niceNum(x * 10) + '\n```', mood: 'happy' }; }

    /* rounding */
    var rd = s.match(/\bround(?:ing)?\s*(?:of\s*)?(-?\d+(?:\.\d+)?)/);
    if (rd) { var y = +rd[1]; return { text: '`' + rd[1] + '` rounded **half-up** to 1 decimal → **' + f1(y) + '**', mood: 'happy' }; }

    /* plain arithmetic (never for a lone credit structure like 3-0-0) */
    if (st.length) return null;
    var ex = s.replace(/^(calc(ulate)?|compute|what'?s|what is|solve|=)\s*/, '').replace(/[=?]\s*$/, '');
    var val = calcExpr(ex);
    if (val !== null) return { text: '`' + ex.trim() + '` = **' + niceNum(val) + '**', mood: 'happy' };

    return null;
  }

  /* =======================================================================
     COMMANDS
     level: minimum role that may run it
     ======================================================================= */

  var COMMANDS = [
    { cmd: '/help',       fill: '/help',        d: 'what I can do',                   level: 'guest' },
    { cmd: '/tools',      fill: '/tools',       d: 'the five verification tools',     level: 'guest' },
    { cmd: '/calc',       fill: '/calc ',       d: 'SGPA, %, credits, maths',          level: 'guest' },
    { cmd: '/theme',      fill: '/theme',       d: 'toggle dark / light',             level: 'guest' },
    { cmd: '/whoami',     fill: '/whoami',      d: 'your account & session',          level: 'guest' },
    { cmd: '/explore',    fill: '/explore',     d: 'browse every topic',              level: 'guest' },
    { cmd: '/settings',   fill: '/settings',    d: 'companion, scene, voice',         level: 'guest' },
    { cmd: '/clear',      fill: '/clear',       d: 'clear this conversation',         level: 'guest' },
    { cmd: '/tool1',      fill: '/tool1',       d: 'open Marksheet vs TR',            level: 'staff' },
    { cmd: '/tool2',      fill: '/tool2',       d: 'open White vs Original',          level: 'staff' },
    { cmd: '/tool3',      fill: '/tool3',       d: 'open Consolidated Checker',       level: 'staff' },
    { cmd: '/tool4',      fill: '/tool4',       d: 'open Provisional Result',         level: 'staff' },
    { cmd: '/tool5',      fill: '/tool5',       d: 'open Tr-Tru Eligibility',         level: 'staff' },
    { cmd: '/go',         fill: '/go ',         d: 'jump to overview · tools · workflow · about', level: 'staff' },
    { cmd: '/open',       fill: '/open ',       d: 'open any URL, page or saved link', level: 'admin' },
    { cmd: '/logout',     fill: '/logout',      d: 'sign out from chat',              level: 'admin' },
    { cmd: '/extend',     fill: '/extend',      d: 'add session time',                level: 'admin' },
    { cmd: '/session',    fill: '/session',     d: 'session details',                 level: 'admin' },
    { cmd: '/team',       fill: '/team',        d: 'team accounts & roles',           level: 'admin' },
    { cmd: '/links',      fill: '/links',       d: 'your saved quick links',          level: 'admin' },
    { cmd: '/addlink',    fill: '/addlink ',    d: 'save a link: /addlink Name URL',  level: 'admin' },
    { cmd: '/removelink', fill: '/removelink ', d: 'remove a saved link',             level: 'admin' },
    { cmd: '/diag',       fill: '/diag',        d: 'system diagnostics',              level: 'admin' },
    { cmd: '/unlock',     fill: '/unlock',      d: 'clear sign-in lockout here',      level: 'admin' },
    { cmd: '/export',     fill: '/export',      d: 'download this chat (.txt)',       level: 'admin' },
    { cmd: '/reload',     fill: '/reload',      d: 'refresh the page',                level: 'admin' },
    { cmd: '/admin',      fill: '/admin',       d: 'open the admin dashboard',        level: 'admin' }
  ];

  var SECTIONS = { overview: 'overview', home: 'overview', top: 'overview', tools: 'tools', tool: 'tools', workflow: 'workflow', 'how it works': 'workflow', steps: 'workflow', about: 'about', notice: 'about' };

  /* map free text to a known open target */
  function resolveTarget(t) {
    var n = ' ' + norm(t) + ' ';
    if (/ (allinone|tool1) /.test(n)) return { kind: 'tool', key: 'tool1' };
    if (/ (whitevsoriginal|tool2) /.test(n)) return { kind: 'tool', key: 'tool2' };
    if (/ (consolidated|tool3) /.test(n)) return { kind: 'tool', key: 'tool3' };
    if (/ (provisional|tool4) /.test(n)) return { kind: 'tool', key: 'tool4' };
    if (/ (trtru|tool5) /.test(n) || / eligibility /.test(n)) return { kind: 'tool', key: 'tool5' };
    if (/ both /.test(n) && / tool/.test(n)) return { kind: 'both' };
    var links = lsGet(CFG.linksKey, []);
    var nt = norm(t).replace(/\b(new tab|in a new tab|in new tab|link|page|website|site|the)\b/g, '').trim();
    for (var i = 0; i < links.length; i++) if (norm(links[i].name) === nt) return { kind: 'url', url: links[i].url, name: links[i].name };
    var urlM = t.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+(\.[a-z0-9-]+)+\.?[a-z]{2,}(\/[^\s]*)?|(\.{0,2}\/)?[\w-]+\/[\w\/.-]*|[\w-]+\.html?)/i);
    if (urlM) {
      var u = urlM[0].replace(/[.,)]+$/, '');
      if (/^www\./i.test(u) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(u) && !/^[\w-]+\.html?$/i.test(u) && !/^\./.test(u) && u.indexOf('/') !== 0 && !/^(apps|assets)\//i.test(u))) u = 'https://' + u.replace(/^https?:\/\//i, '');
      return { kind: 'url', url: u, name: u };
    }
    for (var k in SECTIONS) if (n.indexOf(' ' + k + ' ') >= 0) return { kind: 'nav', id: SECTIONS[k] };
    if (/ (portal|homepage|home page|dashboard) /.test(n)) return { kind: 'nav', id: 'overview' };
    return null;
  }

  function safeUrl(u) {
    try {
      var url = new URL(u, location.href);
      return /^(https?:|file:)$/.test(url.protocol) ? url.href : null;
    } catch (e) { return null; }
  }

  /* =======================================================================
     BOOT
     ======================================================================= */

  function boot() {

    var host = document.createElement('div');
    host.className = 'mirage-companion';
    var shadow = host.attachShadow({ mode: 'open' });
    var styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    shadow.appendChild(styleEl);
    var wrap = document.createElement('div');
    wrap.innerHTML = MARKUP;
    while (wrap.firstChild) shadow.appendChild(wrap.firstChild);
    document.body.appendChild(host);

    function $(id) { return shadow.getElementById(id); }
    var el = {
      fab: $('fab'), badge: $('fab-badge'), tip: $('fab-tip'), panel: $('panel'),
      role: $('role-badge'), status: $('status-line'), visor: $('avatar-visor'),
      voiceBtn: $('voice-btn'), setBtn: $('set-btn'), expBtn: $('exp-btn'), closeBtn: $('close-btn'),
      stage: $('stage'), scene: $('scene'), speech: $('speech'), actor: $('actor'), bot: $('bot'), recall: $('recall'),
      msgs: $('msgs'), chips: $('chips'), palette: $('palette'), form: $('form'), input: $('input'),
      mic: $('mic'), send: $('send'), vstatus: $('voice-status'),
      exSearch: $('ex-search'), exCats: $('ex-cats'), exList: $('ex-list'),
      admin: $('admin-body'), settings: $('settings'), setClose: $('set-close'), forget: $('forget-btn'),
      toast: $('toast')
    };
    var tabs = Array.prototype.slice.call(shadow.querySelectorAll('.tab'));

    /* ------------------------------------------------ state */
    var DEFAULT_PREFS = { skin: 'mirage', scene: 'aurora', theme: 'auto', habitat: true, idle: true, motion: true, instant: false, keepChat: true, speak: false, name: null, seenTip: false };
    var prefs = Object.assign({}, DEFAULT_PREFS, lsGet(CFG.prefsKey, {}));
    if (!prefs.name) { var old = lsGet(CFG.oldMemoryKey, null); if (old && old.name) prefs.name = old.name; }

    var state = {
      open: false, view: 'chat', session: readSession(), role: 'guest',
      history: [], lastEntry: null, lastTopic: null, pending: null,
      lastUser: '', busy: false, idleSince: Date.now(), asleep: false, away: false,
      palIndex: 0, exCat: null, welcomed: false
    };
    state.role = roleOf(state.session);

    function level() { return ROLE_LEVEL[state.role]; }
    function ctx() {
      return { level: level(), role: state.role, session: state.session, cfg: CFG,
        org: { name: CFG.orgName, unit: CFG.orgUnit }, lastTopic: state.lastTopic, name: displayName() };
    }
    function displayName() { return prefs.name || (state.session && state.session.user) || null; }
    function savePrefs() { lsSet(CFG.prefsKey, prefs); }

    /* ------------------------------------------------ rendering: markdown-lite */
    function inline(s) {
      return s.replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,!?:]|$)/g, '$1<em>$2</em>');
    }
    function md(src) {
      var out = [], blocks = [];
      var text = String(src).replace(/```\n?([\s\S]*?)```/g, function (_, code) {
        blocks.push('<div class="formula">' + esc(code.replace(/\n$/, '')) + '</div>'); return '\u0000B' + (blocks.length - 1) + '\u0000';
      }).replace(/<kv>([\s\S]*?)<\/kv>/g, function (_, body) {
        var rows = body.split('\n').filter(Boolean).map(function (r) {
          var i = r.indexOf('|'); return '<span>' + inline(esc(r.slice(0, i))) + '</span><span>' + inline(esc(r.slice(i + 1))) + '</span>';
        });
        blocks.push('<div class="kv">' + rows.join('') + '</div>'); return '\u0000B' + (blocks.length - 1) + '\u0000';
      });
      var lines = text.split('\n'), list = null, para = [];
      function flushPara() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
      function flushList() { if (list) { out.push('<' + list.tag + '>' + list.items.join('') + '</' + list.tag + '>'); list = null; } }
      lines.forEach(function (ln) {
        var b = ln.match(/^\u0000B(\d+)\u0000$/);
        if (b) { flushPara(); flushList(); out.push(blocks[+b[1]]); return; }
        var ul = ln.match(/^\s*[-•]\s+(.*)$/), ol = ln.match(/^\s*\d+\.\s+(.*)$/);
        if (ul || ol) {
          flushPara(); var tag = ul ? 'ul' : 'ol';
          if (!list || list.tag !== tag) { flushList(); list = { tag: tag, items: [] }; }
          list.items.push('<li>' + inline(esc((ul || ol)[1])) + '</li>'); return;
        }
        flushList();
        if (!ln.trim()) { flushPara(); return; }
        var h = ln.match(/^###\s+(.*)$/);
        if (h) { flushPara(); out.push('<h4>' + inline(esc(h[1])) + '</h4>'); return; }
        para.push(inline(esc(ln)).replace(/\u0000B(\d+)\u0000/g, function (_, n) { return blocks[+n]; }));
      });
      flushPara(); flushList();
      return out.join('');
    }
    function plain(src) {
      return String(src).replace(/```[\s\S]*?```/g, ' ').replace(/<kv>([\s\S]*?)<\/kv>/g, function (_, b) { return b.replace(/\|/g, ': ').replace(/\n/g, '. '); })
        .replace(/[*`#]/g, '').replace(/\s+/g, ' ').trim();
    }

    /* ------------------------------------------------ messages */
    function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

    function actsHtml(acts) {
      if (!acts || !acts.length) return '';
      return '<div class="acts">' + acts.map(function (a) {
        return '<button type="button" class="act ' + (a[2] || '') + '" data-act="' + esc(a[1]) + '">' + esc(a[0]) + '</button>';
      }).join('') + '</div>';
    }

    function renderMsg(m) {
      var row = document.createElement('div');
      row.className = 'msg m-' + m.who;
      if (m.who === 'user') {
        row.innerHTML = '<div class="col"><div class="bubble">' + esc(m.text).replace(/\n/g, '<br>') + '</div><div class="meta">' + m.time + '</div></div>';
      } else {
        row.innerHTML = '<span class="mini" aria-hidden="true"><i></i></span><div class="col"><div class="bubble ' + (m.kind || '') + '">' + md(m.text) + '</div>' +
          actsHtml(m.acts) + '<div class="meta">' + m.time + '<button type="button" data-copy title="Copy">Copy</button><button type="button" data-say title="Read aloud">🔊</button></div></div>';
        row.__src = m.text;
      }
      el.msgs.appendChild(row);
      el.msgs.scrollTop = el.msgs.scrollHeight;
      return row;
    }

    function persist() {
      if (!prefs.keepChat) return;
      ssSet(CFG.chatKey, { h: state.history.slice(-60), topic: state.lastTopic, role: state.role });
    }

    function addUser(text) {
      var m = { who: 'user', text: text, time: nowTime() };
      state.history.push(m); renderMsg(m); persist();
    }

    function addBot(resp) {
      var m = { who: 'bot', text: resp.text, acts: resp.acts || null, kind: resp.kind || '', time: nowTime() };
      state.history.push(m); renderMsg(m); persist();
      setChips(resp.chips);
      if (resp.mood) mood(resp.mood, 2400);
      say(resp.speech || plain(resp.text));
      if (prefs.speak) speak(plain(resp.text));
      if (!state.open) { el.badge.textContent = '1'; el.badge.classList.add('on'); }
    }

    var typingRow = null;
    function showTyping() {
      hideTyping();
      typingRow = document.createElement('div');
      typingRow.className = 'msg m-bot';
      typingRow.innerHTML = '<span class="mini" aria-hidden="true"><i></i></span><div class="typing" aria-label="Mirage is typing"><span></span><span></span><span></span></div>';
      el.msgs.appendChild(typingRow); el.msgs.scrollTop = el.msgs.scrollHeight;
    }
    function hideTyping() { if (typingRow) { typingRow.remove(); typingRow = null; } }

    function deliver(resp) {
      if (!resp) return;
      if (resp.pending) state.pending = resp.pending;
      var delay = (prefs.instant || resp.instant) ? 0 : Math.min(1100, 320 + plain(resp.text).length * 3);
      host.setAttribute('data-busy', '');
      mood('think', delay + 200);
      if (!delay) { host.removeAttribute('data-busy'); addBot(resp); if (resp.after) resp.after(); return; }
      showTyping();
      setTimeout(function () {
        hideTyping(); host.removeAttribute('data-busy'); addBot(resp);
        if (resp.after) resp.after();
      }, delay);
    }

    function toast(msg) {
      el.toast.textContent = msg; el.toast.classList.add('on');
      clearTimeout(toast._t); toast._t = setTimeout(function () { el.toast.classList.remove('on'); }, 1800);
    }

    /* ------------------------------------------------ chips */
    function defaultChips() {
      if (state.role === 'admin') return ['/admin', 'Open tool 1 in new tab', '/team', '/diag', '/extend', 'What can a super admin do?'];
      if (state.role === 'staff') return ['Open Marksheet vs TR', 'Open White vs Original', 'Open Consolidated Checker', 'Which tool should I use?', 'sgpa 218 28', 'What is in the report?'];
      return ['What is this site?', 'How do I sign in?', 'I forgot my password', 'Is my data safe?', 'What can you do?'];
    }
    function setChips(list) {
      var items = (list && list.length ? list : defaultChips()).slice(0, 6);
      el.chips.innerHTML = items.map(function (c) {
        var admin = /^\/(admin|team|diag|extend|links|logout|export|session|unlock|reload|open)/.test(c);
        return '<button type="button" class="chip' + (admin ? ' admin' : '') + '">' + esc(c) + '</button>';
      }).join('');
    }

    /* =====================================================================
       ACTIONS  (every button and command funnels through here)
       ===================================================================== */

    function needLevel(min, what) {
      if (level() >= ROLE_LEVEL[min]) return null;
      if (min === 'staff') return { text: 'You need to **sign in** first' + (what ? ' to ' + what : '') + '. Use the sign-in form on this page, then ask me again.', chips: ['How do I sign in?', 'I forgot my password'], mood: 'wow' };
      return { text: '♔ **' + (what ? what.charAt(0).toUpperCase() + what.slice(1) : 'That') + '** is a super admin feature. You are signed in as ' + (state.role === 'staff' ? '**staff**' : 'a **guest**') + '.', chips: ['What can a super admin do?', 'What can you do?'], mood: 'wow' };
    }

    function goSameTab(url) {
      persist();
      setTimeout(function () { location.href = url; }, prefs.instant ? 150 : 700);
    }

    function openNew(url, gesture) {
      if (!gesture) return false;
      var w = null;
      try { w = window.open(url, '_blank'); } catch (e) {}
      if (!w) return false;               /* blocked: caller shows a button */
      try { w.opener = null; } catch (e) {}
      return true;
    }

    function openTool(key, newTab, gesture) {
      var gate = needLevel('staff', 'open the tools'); if (gate) return gate;
      var t = CFG.tools[key];
      if (newTab) {
        if (openNew(t.url, gesture)) return { text: '↗ Opened **' + t.name + '** in a new tab.', acts: [['Open again', 'opennew:' + key]], mood: 'happy' };
        return { text: 'Tap to open **' + t.name + '** in a new tab:', acts: [['Open ' + t.short + ' ↗', 'opennew:' + key, 'primary']] };
      }
      goSameTab(t.url);
      return { text: 'Opening **' + t.name + '**… ' + (key === 'tool3' ? 'Use your browser\'s **Back** button to come back.' : 'Use **Back to portal** (bottom-right inside the tool) to come back.'), mood: 'happy', speech: 'Opening ' + t.short + '…', instant: true };
    }

    function navTo(id) {
      var gate = needLevel('staff', 'jump around the portal'); if (gate) return gate;
      var target = document.getElementById(id);
      if (!target || !portalVisible()) return { text: 'The portal sections are not on screen right now.' };
      target.scrollIntoView({ behavior: prefs.motion ? 'smooth' : 'auto', block: 'start' });
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
      if (window.innerWidth <= 480) setTimeout(closePanel, 300);
      var names = { overview: 'Overview', tools: 'Tools', workflow: 'How it works', about: 'About' };
      return { text: '📍 Jumped to **' + (names[id] || id) + '**.', mood: 'happy' };
    }

    function setSiteTheme(want) {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = want === 'toggle' ? (cur === 'dark' ? 'light' : 'dark') : want;
      if (next === cur) return { text: 'It is already in **' + cur + '** mode. 😊', chips: [cur === 'dark' ? 'light mode' : 'dark mode'] };
      var btn = Array.prototype.slice.call(document.querySelectorAll('[data-theme-toggle]')).filter(function (b) { return b.offsetParent !== null; })[0] ||
        document.querySelector('[data-theme-toggle]');
      if (btn) btn.click();
      else { document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem('vsuite.theme', next); } catch (e) {} }
      return { text: (next === 'dark' ? '🌙 Switched to **dark** mode.' : '☀️ Switched to **light** mode.') + ' Your choice is remembered on this device.', chips: [next === 'dark' ? 'light mode' : 'dark mode'], mood: 'happy' };
    }

    function openUrl(url, newTab, gesture, label) {
      var gate = needLevel('admin', 'opening any link from chat'); if (gate) return gate;
      var u = safeUrl(url);
      if (!u) return { text: 'That does not look like a link I can open: `' + url + '`', kind: 'err' };
      var sameOrigin = false; try { sameOrigin = new URL(u).origin === location.origin; } catch (e) {}
      if (!newTab && sameOrigin) { goSameTab(u); return { text: '♔ Opening **' + (label || u) + '**…', kind: 'admin', mood: 'happy', instant: true }; }
      if (openNew(u, gesture)) return { text: '♔ Opened **' + (label || u) + '** in a new tab.', kind: 'admin', acts: [['Open again ↗', 'urlnew:' + u]], mood: 'happy' };
      return { text: '♔ Tap to open **' + (label || u) + '**:', kind: 'admin', acts: [['Open ↗', 'urlnew:' + u, 'gold']] };
    }

    /* ---- super admin operations ---- */
    function doLogout() {
      var gate = needLevel('admin', 'signing out from chat'); if (gate) return gate;
      return { text: '♔ Sign out of **' + (state.session && state.session.user) + '** on this browser?', kind: 'admin',
        acts: [['Yes, sign out', 'confirm:logout', 'danger'], ['Cancel', 'cancel:', '']], chips: ['yes', 'no'], pending: 'logout' };
    }
    function reallyLogout() {
      var btn = document.getElementById('logoutBtn');
      if (btn && portalVisible()) btn.click();
      else {
        try { localStorage.removeItem(CFG.sessionKey); } catch (e) {}
        try { sessionStorage.removeItem(CFG.sessionKey); } catch (e) {}
        setTimeout(function () { location.reload(); }, 400);
      }
      state.session = null; state.role = 'guest'; updateRole(true);
      return { text: '👋 Signed out. Your session on this browser has ended. I am in guest mode now.', mood: 'happy', chips: defaultChips(), instant: true };
    }

    function doExtend(hours) {
      var gate = needLevel('admin', 'extending the session'); if (gate) return gate;
      var h = hours > 0 && hours <= 24 ? hours : CFG.sessionHours;
      var s = readSession(); if (!s) return { text: 'There is no active session to extend.', kind: 'err' };
      var cap = Date.now() + 24 * 3600000;
      var next = Math.min(Math.max(s.expires, Date.now()) + h * 3600000, cap);
      var store = s.store === 'local' ? localStorage : sessionStorage;
      try {
        var raw = JSON.parse(store.getItem(CFG.sessionKey)); raw.expires = next;
        store.setItem(CFG.sessionKey, JSON.stringify(raw));
      } catch (e) { return { text: 'I could not update the session storage in this browser.', kind: 'err' }; }
      state.session = readSession(); renderAdmin();
      return { text: '♔ Session extended. It now ends **' + fmtWhen(next) + '** (' + fmtLeft(next) + ' left).' + (next === cap ? '\n\nCapped at 24 hours from now.' : ''), kind: 'admin', mood: 'happy' };
    }

    function doTeam() {
      var gate = needLevel('admin', 'viewing the team list'); if (gate) return gate;
      var list = SITE.CREDENTIALS || [];
      if (!list.length) return { text: 'I cannot see the account list from here (the portal CONFIG is not loaded on this page).', kind: 'admin' };
      var admins = superAdminNames(), me = state.session ? state.session.user.toLowerCase() : '';
      var rows = list.map(function (c) {
        var isA = admins.indexOf(String(c.id).toLowerCase()) >= 0;
        var you = me && (me === String(c.display || '').toLowerCase() || me === String(c.id).toLowerCase());
        return (c.display || c.id) + '|`' + c.id + '` · ' + (isA ? '♔ Super admin' : 'Staff') + (you ? ' · **you**' : '');
      });
      return { text: '♔ **Team accounts (' + list.length + ')**\n<kv>' + rows.join('\n') + '</kv>Passwords are never shown here. To add or change accounts, edit **CONFIG → CREDENTIALS** in `script.js`.', kind: 'admin', chips: ['Where are accounts managed?', '/session'] };
    }

    function doSession() {
      var gate = needLevel('admin', 'session details'); if (gate) return gate;
      var s = readSession();
      if (!s) return { text: 'There is no active session right now.', kind: 'err' };
      return { text: '♔ **Session**\n<kv>User|' + s.user + '\nRole|Super admin\nEnds|' + fmtWhen(s.expires) + '\nTime left|' + fmtLeft(s.expires) + '\nStored in|' + (s.store === 'local' ? 'localStorage (keep me signed in)' : 'sessionStorage (this tab)') + '\nStandard length|' + CFG.sessionHours + ' hours</kv>',
        kind: 'admin', acts: [['Extend +' + CFG.sessionHours + 'h', 'cmd:extend', 'gold'], ['Sign out', 'cmd:logout', 'danger']] };
    }

    function storageUsed() {
      try { var n = 0; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } return (n * 2 / 1024).toFixed(1) + ' KB'; } catch (e) { return 'unavailable'; }
    }
    function doDiag() {
      var gate = needLevel('admin', 'diagnostics'); if (gate) return gate;
      var ua = navigator.userAgent, br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
      var ver = (ua.match(/(Edg|Chrome|Firefox|Version)\/(\d+)/) || [])[2] || '';
      var tts = 'speechSynthesis' in window, stt = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      var s = readSession();
      var rows = [
        'Network|' + (navigator.onLine ? '🟢 Online' : '🟠 Offline (tools need cdnjs on first load)'),
        'Browser|' + br + ' ' + ver + (/Chrome|Edge/.test(br) ? ' ✓ recommended' : ''),
        'Screen|' + screen.width + '×' + screen.height + ' · window ' + innerWidth + '×' + innerHeight,
        'Site theme|' + (document.documentElement.getAttribute('data-theme') || 'light'),
        'Session|' + (s ? s.user + ' · ' + fmtLeft(s.expires) + ' left · ' + s.store : 'none'),
        'Storage used|' + storageUsed(),
        'Tool 1 path|`' + CFG.tools.tool1.url + '`',
        'Tool 2 path|`' + CFG.tools.tool2.url + '`',
        'Tool 3 path|`' + CFG.tools.tool3.url + '`',
        'Tool 4 path|`' + CFG.tools.tool4.url + '`',
        'Tool 5 path|`' + CFG.tools.tool5.url + '`',
        'Served over|' + location.protocol.replace(':', '') + (location.protocol === 'file:' ? ' ⚠ use a web server' : ''),
        'Voice|speak ' + (tts ? '✓' : '✗') + ' · listen ' + (stt ? '✓' : '✗'),
        'Reduced motion|' + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'on' : 'off'),
        'Time zone|' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '—'),
        'Mirage|v' + CFG.version + ' · ' + KB.length + ' topics'
      ];
      return { text: '♔ **Diagnostics**\n<kv>' + rows.join('\n') + '</kv>', kind: 'admin', acts: [['Reload page', 'cmd:reload'], ['Export chat', 'cmd:export']] };
    }

    function doUnlock() {
      var gate = needLevel('admin', 'clearing the lockout'); if (gate) return gate;
      try { sessionStorage.removeItem(CFG.attemptsKey); } catch (e) {}
      return { text: '♔ Sign-in attempt counter cleared **on this browser**. The lockout is per browser tab session, so it cannot be cleared for other people\'s devices.', kind: 'admin' };
    }

    function doExport() {
      var gate = needLevel('admin', 'exporting the chat'); if (gate) return gate;
      var lines = ['Mirage chat export · ' + new Date().toLocaleString(), 'User: ' + (state.session ? state.session.user : 'guest'), ''];
      state.history.forEach(function (m) { lines.push('[' + m.time + '] ' + (m.who === 'user' ? 'You' : 'Mirage') + ': ' + (m.who === 'user' ? m.text : plain(m.text))); });
      var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'mirage-chat-' + new Date().toISOString().slice(0, 10) + '.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      return { text: '♔ Chat exported as a .txt file (' + state.history.length + ' messages).', kind: 'admin', mood: 'happy' };
    }

    function getLinks() { return lsGet(CFG.linksKey, []); }
    function doLinks() {
      var gate = needLevel('admin', 'quick links'); if (gate) return gate;
      var L = getLinks();
      if (!L.length) return { text: '♔ No saved links yet. Add one:\n`/addlink Results https://example.com/results`', kind: 'admin', chips: ['/addlink '] };
      return { text: '♔ **Your quick links**. Say **"open ' + L[0].name + '"** to launch one.', kind: 'admin',
        acts: L.map(function (l) { return [l.name + ' ↗', 'urlnew:' + l.url]; }) };
    }
    function doAddLink(rest) {
      var gate = needLevel('admin', 'quick links'); if (gate) return gate;
      var m = rest.match(/^(.+?)\s+((?:https?:\/\/|www\.|\.{0,2}\/)?\S+\.\S+|\S*\/\S*)$/i);
      if (!m) return { text: 'Use: `/addlink Name URL`, e.g. `/addlink Results https://example.com/results`', kind: 'err' };
      var name = m[1].trim(), url = m[2];
      if (/^www\./i.test(url) || (!/^https?:/i.test(url) && /^[a-z0-9-]+\.[a-z]{2,}/i.test(url))) url = 'https://' + url;
      if (!safeUrl(url)) return { text: 'That URL does not look valid.', kind: 'err' };
      var L = getLinks().filter(function (l) { return norm(l.name) !== norm(name); });
      L.push({ name: name, url: url }); lsSet(CFG.linksKey, L); renderAdmin();
      return { text: '♔ Saved **' + name + '** → `' + url + '`. Say **"open ' + name + '"** any time.', kind: 'admin', mood: 'happy', acts: [['Open ' + name + ' ↗', 'urlnew:' + url]] };
    }
    function doRemoveLink(name) {
      var gate = needLevel('admin', 'quick links'); if (gate) return gate;
      var L = getLinks(), n = norm(name), keep = L.filter(function (l) { return norm(l.name) !== n; });
      if (keep.length === L.length) return { text: 'No saved link called **' + name + '**.', chips: ['/links'] };
      lsSet(CFG.linksKey, keep); renderAdmin();
      return { text: '♔ Removed **' + name + '**.', kind: 'admin' };
    }

    function clearChat() {
      state.history = []; state.lastEntry = null; state.lastTopic = null; state.pending = null;
      el.msgs.innerHTML = ''; try { sessionStorage.removeItem(CFG.chatKey); } catch (e) {}
      welcome(true);
    }

    function run(action, gesture) {
      var i = action.indexOf(':'), type = i < 0 ? action : action.slice(0, i), arg = i < 0 ? '' : action.slice(i + 1);
      switch (type) {
        case 'open': return openTool(arg, false, gesture);
        case 'opennew': return openTool(arg, true, gesture);
        case 'nav': return navTo(arg);
        case 'theme': return setSiteTheme(arg);
        case 'url': return openUrl(arg, false, gesture);
        case 'urlnew': return openUrl(arg, true, gesture);
        case 'ask': send(arg, gesture); return null;
        case 'confirm': state.pending = null; if (arg === 'logout') { var g = needLevel('admin', 'signing out from chat'); return g || reallyLogout(); } return null;
        case 'cancel': state.pending = null; return { text: 'Okay, cancelled. 👍' };
        case 'cmd':
          switch (arg) {
            case 'logout': return doLogout();
            case 'extend': return doExtend();
            case 'team': return doTeam();
            case 'diag': return doDiag();
            case 'export': return doExport();
            case 'unlock': return doUnlock();
            case 'links': return doLinks();
            case 'session': return doSession();
            case 'reload': var gr = needLevel('admin', 'reloading the page'); if (gr) return gr; persist(); setTimeout(function () { location.reload(); }, 500); return { text: '♔ Reloading…', kind: 'admin', instant: true };
            case 'admin': if (level() < 2) return needLevel('admin', 'the admin dashboard'); switchView('admin'); return null;
            case 'settings': openSettings(); return null;
            case 'explore': switchView('explore'); return null;
            case 'clear': clearChat(); return null;
          }
      }
      return null;
    }

    /* =====================================================================
       UNDERSTANDING A MESSAGE
       ===================================================================== */

    function entryResponse(e, c) {
      state.lastEntry = e; if (e.topic) state.lastTopic = e.topic;
      var text = typeof e.a === 'function' ? e.a(c) : e.a;
      var acts = (e.b || []).map(function (b) { return [b[0], b[1], /^open:/.test(b[1]) ? 'primary' : '']; });
      /* gate tool buttons for guests */
      if (c.level < 1) acts = acts.filter(function (a) { return !/^(open|nav):/.test(a[1]); });
      if (c.level < 2) acts = acts.filter(function (a) { return a[1] !== 'cmd:admin'; });
      if (c.level >= 2 && acts.some(function (a) { return /^open:/.test(a[1]); })) {
        acts = acts.concat(acts.filter(function (a) { return /^open:/.test(a[1]); }).map(function (a) { var k = a[1].slice(5); return ['↗ ' + (CFG.tools[k] ? CFG.tools[k].short : k) + ' (new tab)', 'opennew:' + k, '']; }));
      }
      if (e.more) acts.push(['Tell me more', 'ask:tell me more', '']);
      var chips = (e.f || []).slice();
      if (!chips.length) chips = relatedChips(e);
      return { text: text, acts: acts, chips: chips, mood: 'happy', entry: e.id };
    }

    function relatedChips(e) {
      return KB.filter(function (x) { return x.cat === e.cat && x.id !== e.id && (!x.level || level() >= ROLE_LEVEL[x.level]); })
        .slice(0, 4).map(function (x) { return x.t; });
    }

    var PETS = {
      wave: /\b(wave|say hi|hi mirage)\b/, dance: /\b(dance|boogie|party)\b/, jump: /\b(jump|hop)\b/, spin: /\b(spin|twirl|do a flip|flip)\b/,
      sleep: /\b(sleep|nap|go to bed|rest)\b/, wake: /\b(wake up|wakeup|get up|rise and shine)\b/, love: /\b(love you|i like you|you'?re cute|good (bot|boy|girl))\b/
    };
    var JOKES = [
      'Why did the gradesheet go to therapy? It had too many **unresolved issues**. 📄',
      'I told the TR a joke about SGPA… it only gave me a **7.6**. Not even 7.60. 😅',
      'Why do PDFs make great friends? They always keep their **layout**, no matter what.',
      'Half-up rounding walks into a bar at 8.25 and leaves at **8.3**. Optimist.'
    ];

    function respond(raw, gesture) {
      var c = ctx(), s = raw.trim(), low = s.toLowerCase(), n = norm(s);

      /* pending confirmation */
      if (state.pending) {
        var p = state.pending; state.pending = null;
        if (AFFIRM.test(s)) return run('confirm:' + p, gesture);
        if (NEGATE.test(s)) return { text: 'Okay, cancelled. 👍' };
      }

      /* slash commands */
      if (s.charAt(0) === '/') return slash(s, gesture, c);

      /* name memory */
      var nm = extractName(s);
      if (nm) { prefs.name = nm; savePrefs(); return { text: 'Nice to meet you, **' + nm + '**! I will remember that on this device. 🌱', mood: 'love' }; }
      if (/\b(what'?s|what is|do you know|tell me) my name\b/.test(low)) {
        var dn = displayName();
        return dn ? { text: 'You are **' + dn + '**' + (prefs.name ? '' : ' (from your sign-in)') + '. Say *"call me …"* to change it.', mood: 'happy' } : { text: 'I do not know yet. Tell me: *"my name is …"*' };
      }
      if (/\bforget (my name|me)\b/.test(low)) { prefs.name = null; savePrefs(); return { text: 'Done. I have forgotten your name. 🫧' }; }

      /* small talk */
      if (GREET.test(s)) {
        var who = displayName();
        return { text: pick([timeGreeting(), 'Hello', 'Hey']) + (who ? ', **' + who + '**' : '') + '! ' + pick(['What can I help you verify today?', 'Ask me anything about the suite.', 'Ready when you are.']), mood: 'happy', acts: [], chips: defaultChips(), after: function () { pet('wave'); } };
      }
      if (THANKS.test(s) && s.length < 60) {
        var tn = displayName();
        return { text: tn ? pick(['You are welcome, **' + tn + '**! 😊', 'Happy to help, **' + tn + '**!', 'Any time, **' + tn + '**. ✨']) : pick(['You are welcome! 😊', 'Happy to help!', 'Any time. ✨', 'Glad that helped!']), mood: 'love' };
      }
      if (BYE.test(s)) return { text: pick(['Bye for now! 👋', 'See you soon!', 'Take care!']) + ' Remember to sign out on shared computers.', mood: 'happy', after: function () { pet('wave'); } };
      if (HOWRU.test(s)) return { text: pick(['Running at 100%, fully offline and happy. How can I help?', 'Great, thanks for asking! What are we checking today?']), mood: 'happy' };
      if (JOKE.test(s)) return { text: pick(JOKES), mood: 'happy', after: function () { pet('dance'); } };
      if (/^(what time is it|time|what'?s the time|current time|date|what'?s the date|today'?s date|what day is it)[\s?]*$/i.test(s)) {
        var d = new Date(); return { text: '🕒 **' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '**, ' + d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
      }

      if (AFFIRM.test(s)) return { text: pick(['Great! 👍 What would you like to do next?', 'Okay! Ask me anything.']), chips: defaultChips() };
      if (NEGATE.test(s)) return { text: 'No problem. I am here if you need anything.', chips: defaultChips() };

      /* tell me more */
      if (MORE.test(s)) {
        var e0 = state.lastEntry;
        if (e0 && e0.more) return { text: e0.more, chips: e0.f || relatedChips(e0) };
        if (e0) return { text: 'Here is what is related to **' + e0.t + '**:', chips: relatedChips(e0), acts: relatedChips(e0).slice(0, 3).map(function (t) { return [t, 'ask:' + t]; }) };
        return { text: 'More about what? Try **Explore** to browse every topic.', acts: [['Open Explore', 'cmd:explore']] };
      }

      /* pet commands (only when clearly addressed at the companion) */
      if (s.length < 40 && !isQuestion(s) || /^(can|will|could) you (dance|wave|jump|spin|sleep|nap)/.test(low)) {
        for (var k in PETS) if (PETS[k].test(low) && !/\b(tool|report|pdf|sgpa|session|login)\b/.test(low)) {
          pet(k);
          var lines = { wave: 'Hello! 👋', dance: 'Watch this! 🕺', jump: 'Boing! ⤴', spin: 'Wheee! 🌀', sleep: 'Just a little nap… 😴', wake: 'I am up, I am up! ☀️', love: 'Aww, you too! 💚' };
          return { text: lines[k], mood: k === 'love' ? 'love' : 'happy', speech: lines[k] };
        }
      }

      /* companion / scene changes */
      var skin = low.match(/\b(?:switch|change|use|be|become|turn into)\b.*\b(mirage|nova|pip)\b/);
      if (skin) { setPref('skin', skin[1]); return { text: 'Say hi to **' + skin[1].charAt(0).toUpperCase() + skin[1].slice(1) + '**! ✨', mood: 'happy', after: function () { pet('jump'); } }; }
      var scn = low.match(/\b(aurora|meadow|night|ocean|sunset)\b.*\b(scene|background|habitat|world)\b|\b(?:scene|background)\b.*\b(aurora|meadow|night|ocean|sunset)\b/);
      if (scn) { var sv = scn[1] || scn[3]; setPref('scene', sv); if (!prefs.habitat) setPref('habitat', true); return { text: 'Changed the scene to **' + sv + '**. 🎨', mood: 'happy' }; }
      if (/\b(hide|collapse) (the )?(robot|habitat|scene|companion)\b/.test(low)) { setPref('habitat', false); return { text: 'Habitat hidden. Say *"show the habitat"* to bring it back.' }; }
      if (/\b(show|expand) (the )?(robot|habitat|scene|companion)\b/.test(low)) { setPref('habitat', true); return { text: 'Here I am again! 👋', after: function () { pet('wave'); } }; }

      /* imperative actions */
      if (!isQuestion(s)) {
        var newTab = /\b(new|another|separate|different) (tab|window)\b|↗/.test(low);

        /* open / go to */
        var om = s.match(/^(?:please\s+|pls\s+|plz\s+|kindly\s+|can you\s+|could you\s+|would you\s+|mirage,?\s+)?(?:open|launch|start|run|go to|goto|take me to|navigate to|visit|load|jump to|bring up|show me|scroll to)\s+(?:up\s+)?(.+?)[.!?]*$/i) ||
                 s.match(/^(.+?)\s+(?:open|kholo|khol do|khol)\s*(?:karo|do|please)?[.!]*$/i);
        if (om) {
          if (/^(the )?(settings|preferences)\b/i.test(om[1])) { openSettings(); return null; }
          if (/^(the )?(explore|topics|help topics)\b/i.test(om[1])) { switchView('explore'); return null; }
          if (/^(the )?(admin|admin panel|admin tab|dashboard)\b/i.test(om[1])) return run('cmd:admin', gesture);
          var tgt = resolveTarget(om[1]);
          var soft = /^(show me|bring up)/i.test(s);
          if (tgt && soft && (tgt.kind === 'nav' && (!portalVisible() || level() < 1) || tgt.kind === 'url')) tgt = null;
          if (tgt) {
            if (tgt.kind === 'tool') return openTool(tgt.key, newTab, gesture);
            if (tgt.kind === 'nav') return navTo(tgt.id);
            if (tgt.kind === 'url') return openUrl(tgt.url, newTab || !/^(\.|\/|apps\/)/.test(tgt.url), gesture, tgt.name);
            if (tgt.kind === 'both') {
              var gb = needLevel('staff', 'open the tools'); if (gb) return gb;
              var ok = openNew(CFG.tools.tool1.url, gesture);
              return { text: ok ? 'Opened **Marksheet vs TR** in a new tab. Browsers allow one pop-up per click, so tap for the second:' : 'Tap to open each tool in its own tab:',
                acts: [ok ? null : ['Marksheet vs TR ↗', 'opennew:tool1', 'primary'], ['White vs Original ↗', 'opennew:tool2', 'primary']].filter(Boolean) };
            }
          } else if (soft) { /* "show me …" falls through to knowledge */ }
          else if (level() >= 2 && !((rank(s, c)[0] || {}).s >= 0.5)) return { text: '♔ I could not find a page or saved link called **' + om[1] + '**. Give me a URL (e.g. `open example.com`) or save it with `/addlink Name URL`.', kind: 'admin', chips: ['/links', '/addlink '] };
        }

        if (/^(?:please\s+)?(?:log\s*me\s*out|sign\s*me\s*out|log\s*out|logout|sign\s*out|signout|end (my )?session|lock( the)? (screen|portal))(\s+now|\s+please)?[.!]*$/i.test(s)) {
          if (level() >= 2) return doLogout();
          if (level() === 1) return { text: 'Use **Sign out** at the top right of the portal (☰ menu on mobile). Signing out from chat is a ♔ super admin feature.', chips: ['What can a super admin do?'] };
          return { text: 'You are not signed in, so there is nothing to sign out of. 🙂' };
        }

        var tm = low.match(/^(?:please\s+)?(?:switch to|turn on|enable|use|go|make it|set|activate|change to)?\s*(dark|light)(?: mode| theme)?(?: please| now| on)?[.!]*$/) || low.match(/^(?:toggle|switch|change|flip) (?:the )?(?:theme|mode)[.!]*$/);
        if (tm) return setSiteTheme(tm[1] || 'toggle');

        if (/\b(extend|renew|refresh|lengthen) (my |the )?session\b/.test(low)) { var hx = nums(low)[0]; return doExtend(hx); }
        if (/^(show |list |view )?(the )?(team|users|accounts|members|staff list|user list)[.!?]*$/.test(low) || /\b(list|show) (all )?(users|accounts|team)\b/.test(low)) return level() >= 2 ? doTeam() : null || entryResponse(KB.filter(function (x) { return x.id === 'accounts'; })[0], c);
        if (/^(run )?(diagnostics?|diag|system (check|status|info)|health check)[.!?]*$/.test(low)) return doDiag();
        if (/\b(export|download|save) (the |this |my )?(chat|conversation|transcript)\b/.test(low)) return doExport();
        if (/^(reload|refresh)( the)?( page)?[.!]*$/.test(low)) return run('cmd:reload', gesture);
        if (/\b(unlock|reset (the )?(lockout|attempts))\b/.test(low)) return doUnlock();
        if (/^(clear|reset|restart|new) (the )?(chat|conversation)[.!]*$/.test(low)) { clearChat(); return null; }
        if (/^(my |saved |quick )?links[.!?]*$/.test(low)) return doLinks();
        var al = s.match(/^(?:add|save) (?:a )?link\s+(.+)$/i); if (al) return doAddLink(al[1]);
        var rl = s.match(/^(?:remove|delete) (?:the )?link\s+(.+)$/i); if (rl) return doRemoveLink(rl[1]);
        if (/^(admin|admin panel|dashboard|admin dashboard|control panel)[.!?]*$/.test(low)) return run('cmd:admin', gesture);
        if (/^(settings|preferences|options)[.!?]*$/.test(low)) { openSettings(); return null; }
      }

      /* calculators */
      var calc = calculators(s);
      if (calc) { state.lastTopic = state.lastTopic || 'site'; return Object.assign({ chips: ['What can you calculate?', 'How is SGPA recomputed?'] }, calc); }

      /* knowledge base */
      var ranked = rank(s, c);
      var best = ranked[0];
      if (best && best.s >= 0.4) {
        var resp = entryResponse(best.e, c);
        var alt = ranked.slice(1, 4).filter(function (r) { return r.s >= best.s * 0.82 && r.e.topic !== undefined; });
        if (alt.length && best.s < 0.85) resp.chips = alt.map(function (r) { return r.e.t; }).concat(resp.chips).slice(0, 5);
        return resp;
      }
      return fallback(s, ranked);
    }

    function fallback(s, ranked) {
      var guesses = ranked.filter(function (r) { return r.s >= 0.18; }).slice(0, 4);
      if (guesses.length) {
        return { text: pick(['I am not completely sure what you mean. Did you mean one of these?', 'Hmm, I want to get this right. Is it one of these?']),
          acts: guesses.map(function (r) { return [r.e.t, 'ask:' + r.e.t]; }), chips: ['What can you do?', 'Show commands'], mood: 'wow' };
      }
      return { text: 'I do not have an answer for that yet. I only know about this Verification Suite. Try rephrasing, browse **Explore**, or ask the examination office.',
        acts: [['Browse topics', 'cmd:explore']], chips: defaultChips(), mood: 'wow' };
    }

    function slash(s, gesture, c) {
      var m = s.match(/^\/(\S+)\s*(.*)$/), cmd = (m ? m[1] : '').toLowerCase(), rest = m ? m[2].trim() : '';
      var def = COMMANDS.filter(function (x) { return x.cmd === '/' + cmd; })[0];
      if (def && c.level < ROLE_LEVEL[def.level]) return needLevel(def.level, def.d);
      switch (cmd) {
        case 'help': case 'h': case '?': return entryResponse(KB.filter(function (x) { return x.id === 'm-what'; })[0], c);
        case 'commands': case 'cmds': return entryResponse(KB.filter(function (x) { return x.id === 'm-shortcuts'; })[0], c);
        case 'tools': return entryResponse(KB.filter(function (x) { return x.id === 'tools'; })[0], c);
        case 'calc': return rest ? (calculators(rest) || { text: 'I could not work that out. See `/calc` examples.', kind: 'err' }) : entryResponse(KB.filter(function (x) { return x.id === 'c-help'; })[0], c);
        case 'theme': return setSiteTheme(/dark|light/.test(rest) ? rest.match(/dark|light/)[0] : 'toggle');
        case 'whoami': case 'me': return entryResponse(KB.filter(function (x) { return x.id === 'whoami'; })[0], c);
        case 'explore': return run('cmd:explore');
        case 'settings': return run('cmd:settings');
        case 'clear': return run('cmd:clear');
        case 'tool1': return openTool('tool1', /new/.test(rest), gesture);
        case 'tool2': return openTool('tool2', /new/.test(rest), gesture);
        case 'tool3': return openTool('tool3', /new/.test(rest), gesture);
        case 'tool4': return openTool('tool4', /new/.test(rest), gesture);
        case 'tool5': return openTool('tool5', /new/.test(rest), gesture);
        case 'go': var t = resolveTarget(rest || 'tools'); return t && t.kind === 'nav' ? navTo(t.id) : { text: 'Use `/go overview`, `/go tools`, `/go workflow` or `/go about`.' };
        case 'open':
          if (!rest) return { text: '♔ Use `/open <url, page or saved link>`, e.g. `/open example.com`, `/open tool 2 new tab`.', kind: 'admin' };
          var nt = /\b(new tab|new window)\b/i.test(rest), tg = resolveTarget(rest.replace(/\b(in (a )?)?new (tab|window)\b/i, ''));
          if (!tg) return { text: 'I could not find **' + rest + '**.', kind: 'err', chips: ['/links'] };
          if (tg.kind === 'tool') return openTool(tg.key, nt, gesture);
          if (tg.kind === 'nav') return navTo(tg.id);
          return openUrl(tg.url, nt || !/^(\.|\/|apps\/)/.test(tg.url), gesture, tg.name);
        case 'logout': case 'signout': return doLogout();
        case 'extend': return doExtend(parseFloat(rest));
        case 'session': return doSession();
        case 'team': case 'users': return doTeam();
        case 'links': return doLinks();
        case 'addlink': return doAddLink(rest);
        case 'removelink': case 'dellink': return doRemoveLink(rest);
        case 'diag': case 'diagnostics': return doDiag();
        case 'unlock': return doUnlock();
        case 'export': return doExport();
        case 'reload': return run('cmd:reload', gesture);
        case 'admin': return run('cmd:admin', gesture);
      }
      return { text: 'Unknown command `/' + cmd + '`. Type `/` to see the list.', chips: ['Show commands'] };
    }

    /* ------------------------------------------------ send */
    function send(text, gesture) {
      text = String(text || '').trim();
      if (!text) return;
      activity();
      addUser(text);
      state.lastUser = text;
      var resp = respond(text, gesture !== false);
      deliver(resp);
    }

    /* =====================================================================
       COMPANION
       ===================================================================== */

    var moodTimer = null;
    function mood(m, ms) {
      if (state.asleep && m !== 'sleep') return;
      ['think', 'happy', 'wow', 'love'].forEach(function (x) { el.bot.classList.remove(x); });
      if (m) el.bot.classList.add(m);
      clearTimeout(moodTimer);
      if (ms) moodTimer = setTimeout(function () { el.bot.classList.remove(m); }, ms);
    }
    function pet(kind) {
      if (kind === 'wake') { wake(); return; }
      if (kind === 'sleep') { sleep(); return; }
      if (kind === 'love') { mood('love', 3000); return; }
      wake(true);
      var cls = kind === 'look' ? 'look' : kind === 'stretch' ? 'stretch' : kind;
      el.bot.classList.remove(cls); void el.bot.offsetWidth; el.bot.classList.add(cls);
      setTimeout(function () { el.bot.classList.remove(cls); }, kind === 'dance' ? 2700 : kind === 'wave' ? 2200 : kind === 'look' ? 3000 : kind === 'stretch' ? 1400 : 1100);
    }
    function sleep() { state.asleep = true; el.bot.classList.add('sleep'); say('Zzz… (poke me to wake me)'); }
    function wake(quiet) {
      if (state.away) comeBack();
      if (!state.asleep) return;
      state.asleep = false; el.bot.classList.remove('sleep');
      if (!quiet) { say('Oh! I am awake. ☀️'); mood('wow', 1200); }
    }
    function goAway() {
      state.away = true; el.actor.classList.add('walk'); el.stage.classList.add('away');
      setTimeout(function () { el.actor.classList.remove('walk'); }, 1700);
    }
    function comeBack() {
      state.away = false; state.asleep = false; el.bot.classList.remove('sleep');
      el.stage.classList.remove('away'); el.actor.classList.add('walk');
      setTimeout(function () { el.actor.classList.remove('walk'); pet('wave'); say('I am back! What did I miss?'); }, 1600);
    }

    var sayTimer = null;
    function say(text) {
      var src = String(text || ''), m1 = src.match(/^[\s\S]*?[.!?](?=\s|$)/), t = m1 ? m1[0] : src;
      if (t.length > 80) t = t.slice(0, 77).replace(/\s+\S*$/, '') + '…';
      el.speech.textContent = t;
      el.speech.classList.remove('hide');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(function () { el.speech.classList.add('hide'); }, 6500);
    }

    function activity() {
      state.idleSince = Date.now();
      if (state.asleep || state.away) wake();
    }

    setInterval(function () {
      if (!state.open || !prefs.idle || !prefs.habitat || state.view !== 'chat') return;
      var idle = (Date.now() - state.idleSince) / 1000;
      if (idle > 150 && !state.away) { goAway(); return; }
      if (idle > 70 && !state.asleep && !state.away) { sleep(); return; }
      if (idle > 20 && !state.asleep && !state.away && Math.random() < 0.06) pet(pick(['look', 'stretch', 'wave', 'jump']));
    }, 1000);

    /* eyes follow the pointer */
    var lookQueued = false, lastPt = null;
    document.addEventListener('pointermove', function (e) {
      lastPt = e; if (lookQueued || !state.open) return;
      lookQueued = true;
      requestAnimationFrame(function () {
        lookQueued = false;
        [[el.bot, 5, '--lx', '--ly'], [el.visor, 2.5, '--ax', '--ay']].forEach(function (t) {
          var r = t[0].getBoundingClientRect(); if (!r.width) return;
          var dx = lastPt.clientX - (r.left + r.width / 2), dy = lastPt.clientY - (r.top + r.height / 2);
          var d = Math.max(1, Math.hypot(dx, dy)), k = Math.min(1, d / 220);
          t[0].style.setProperty(t[2], (dx / d * t[1] * k).toFixed(1) + 'px');
          t[0].style.setProperty(t[3], (dy / d * t[1] * k).toFixed(1) + 'px');
        });
      });
    }, { passive: true });

    el.bot.addEventListener('click', function () { activity(); pet(pick(['jump', 'wave', 'spin'])); say(pick(['Hehe, that tickles!', 'Boop! 👆', 'Hi there!', 'Need anything?'])); });
    el.recall.addEventListener('click', function () { activity(); comeBack(); });
    shadow.querySelectorAll('[data-pet]').forEach(function (b) {
      b.addEventListener('click', function () { activity(); var k = b.getAttribute('data-pet'); if (k === 'sleep' && state.asleep) pet('wake'); else pet(k); });
    });

    /* =====================================================================
       VOICE
       ===================================================================== */

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false;
    function speak(text) {
      if (!('speechSynthesis' in window) || !text) return;
      try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text.slice(0, 600)); u.rate = 1.03; u.pitch = 1.05; speechSynthesis.speak(u); } catch (e) {}
    }
    function setVoiceStatus(msg) {
      el.vstatus.innerHTML = msg || 'Enter to send · <b>/</b> commands · <b>Alt+M</b> toggle';
    }
    if (!SR) { el.mic.title = 'Voice input is not supported in this browser'; el.mic.style.opacity = '.4'; }
    el.mic.addEventListener('click', function () {
      if (!SR) { toast('Voice input is not supported in this browser'); return; }
      if (listening) { try { rec.stop(); } catch (e) {} return; }
      rec = new SR(); rec.lang = navigator.language || 'en-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
      var finalText = '';
      rec.onstart = function () { listening = true; el.mic.classList.add('listen'); setVoiceStatus('🎤 Listening… speak now'); mood('wow'); };
      rec.onresult = function (ev) {
        var t = ''; for (var i = ev.resultIndex; i < ev.results.length; i++) { t += ev.results[i][0].transcript; if (ev.results[i].isFinal) finalText = t; }
        el.input.value = t; autosize(); syncSend();
      };
      rec.onerror = function (ev) {
        setVoiceStatus(ev.error === 'not-allowed' ? '⚠ Microphone permission denied' : ev.error === 'network' ? '⚠ Voice input needs internet in this browser; typing works offline' : '⚠ Voice input stopped (' + ev.error + ')');
        setTimeout(setVoiceStatus, 4500);
      };
      rec.onend = function () {
        listening = false; el.mic.classList.remove('listen'); mood(null);
        if (/Listening/.test(el.vstatus.textContent)) setVoiceStatus();
        var t = (finalText || el.input.value).trim();
        if (t) { el.input.value = ''; autosize(); syncSend(); send(t, false); }
      };
      try { rec.start(); } catch (e) { setVoiceStatus('⚠ Could not start voice input'); }
    });
    el.voiceBtn.addEventListener('click', function () {
      setPref('speak', !prefs.speak);
      toast(prefs.speak ? '🔊 I will read replies aloud' : '🔇 Voice replies off');
      if (!prefs.speak && 'speechSynthesis' in window) speechSynthesis.cancel();
    });

    /* =====================================================================
       COMPOSER & COMMAND PALETTE
       ===================================================================== */

    function autosize() { el.input.style.height = 'auto'; el.input.style.height = Math.min(110, el.input.scrollHeight) + 'px'; }
    function syncSend() { el.send.disabled = !el.input.value.trim(); }

    function paletteItems() {
      var v = el.input.value;
      if (v.charAt(0) !== '/' || /\s/.test(v)) return [];
      var q = v.slice(1).toLowerCase();
      return COMMANDS.filter(function (c) { return c.cmd.slice(1).indexOf(q) === 0 || (q.length > 1 && c.d.toLowerCase().indexOf(q) >= 0); });
    }
    function renderPalette() {
      var items = paletteItems();
      if (!items.length) { el.palette.classList.remove('on'); return; }
      state.palIndex = Math.min(state.palIndex, items.length - 1);
      el.palette.innerHTML = items.map(function (c, i) {
        var locked = level() < ROLE_LEVEL[c.level];
        return '<button type="button" class="pitem' + (i === state.palIndex ? ' sel' : '') + '" data-fill="' + esc(c.fill) + '" role="option"' + (locked ? ' style="opacity:.55"' : '') + '><code>' + c.cmd + '</code><span>' + esc(c.d) + '</span>' +
          (locked ? '<em class="lock">' + (c.level === 'admin' ? '♔ admin' : 'sign in') + '</em>' : '') + '</button>';
      }).join('');
      el.palette.classList.add('on');
      var sel = el.palette.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    function applyPalette(fill) {
      el.input.value = fill; el.palette.classList.remove('on'); autosize(); syncSend(); el.input.focus();
      if (!/\s$/.test(fill)) { el.input.value = ''; syncSend(); send(fill, true); }
    }
    el.palette.addEventListener('mousedown', function (e) { e.preventDefault(); });
    el.palette.addEventListener('click', function (e) { var b = e.target.closest('.pitem'); if (b) applyPalette(b.getAttribute('data-fill')); });

    el.input.addEventListener('input', function () { autosize(); syncSend(); state.palIndex = 0; renderPalette(); activity(); });
    el.input.addEventListener('keydown', function (e) {
      var palOn = el.palette.classList.contains('on');
      if (palOn && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault(); var n = paletteItems().length;
        state.palIndex = (state.palIndex + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; renderPalette(); return;
      }
      if (palOn && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
        var items = paletteItems(), it = items[state.palIndex];
        if (it && (e.key === 'Tab' || el.input.value.trim() !== it.cmd)) { e.preventDefault(); applyPalette(it.fill); return; }
      }
      if (e.key === 'Escape' && palOn) { e.preventDefault(); e.stopPropagation(); el.palette.classList.remove('on'); return; }
      if (e.key === 'ArrowUp' && !el.input.value && state.lastUser) { e.preventDefault(); el.input.value = state.lastUser; autosize(); syncSend(); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.form.requestSubmit ? el.form.requestSubmit() : submit(); }
    });
    el.input.addEventListener('blur', function () { setTimeout(function () { el.palette.classList.remove('on'); }, 120); });
    function submit(e) {
      if (e) e.preventDefault();
      var v = el.input.value.trim(); if (!v) return;
      el.input.value = ''; autosize(); syncSend(); el.palette.classList.remove('on');
      send(v, true);
    }
    el.form.addEventListener('submit', submit);

    /* delegated clicks: action buttons, chips, copy, speak */
    el.msgs.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]');
      if (a) { activity(); var act = a.getAttribute('data-act'); var r = run(act, true); if (r) deliver(r); return; }
      var cp = e.target.closest('[data-copy]');
      if (cp) { var src = cp.closest('.msg').__src || ''; copy(plain(src)); return; }
      var sy = e.target.closest('[data-say]');
      if (sy) { speak(plain(sy.closest('.msg').__src || '')); }
    });
    el.chips.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var t = c.textContent;
      if (/\s$/.test(t) || t === '/addlink ') { el.input.value = t; autosize(); syncSend(); el.input.focus(); renderPalette(); return; }
      send(t, true);
    });
    function copy(t) {
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copied ✓'); }, function () {
        var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('Copied ✓'); } catch (e) {} ta.remove();
      });
    }

    /* =====================================================================
       VIEWS: tabs, explore, admin
       ===================================================================== */

    function switchView(v) {
      if (v === 'admin' && level() < 2) v = 'chat';
      state.view = v;
      tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-view') === v)); });
      ['chat', 'explore', 'admin'].forEach(function (id) { shadow.getElementById('view-' + id).classList.toggle('on', id === v); });
      if (v === 'explore') renderExplore();
      if (v === 'admin') renderAdmin();
      if (v === 'chat') setTimeout(function () { el.msgs.scrollTop = el.msgs.scrollHeight; }, 0);
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { activity(); switchView(t.getAttribute('data-view')); }); });

    function visibleCats() { return CATS.filter(function (c) { return !c.level || level() >= ROLE_LEVEL[c.level]; }); }
    function visibleEntries() { return KB.filter(function (e) { return !e.level || level() >= ROLE_LEVEL[e.level]; }); }

    function renderExplore() {
      var q = el.exSearch.value.trim();
      el.exCats.style.display = q ? 'none' : '';
      el.exCats.innerHTML = visibleCats().map(function (c) {
        var n = KB.filter(function (e) { return e.cat === c.id; }).length;
        return '<button type="button" class="cat' + (state.exCat === c.id ? ' sel' : '') + '" data-cat="' + c.id + '"><span class="ic">' + c.ic + '</span><b>' + esc(c.t) + '</b><small>' + esc(c.d) + ' · ' + n + '</small></button>';
      }).join('');
      var list;
      if (q) {
        var qt = tokens(q), qn = norm(q);
        list = visibleEntries().map(function (e) {
          var s = scoreEntry(e, qn, qt, { level: level() });
          var tn = norm(e.t); if (tn.indexOf(qn) >= 0) s += 0.5;
          return { e: e, s: s };
        }).filter(function (r) { return r.s > 0.2; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 14).map(function (r) { return r.e; });
        el.exList.innerHTML = list.length ? '<p class="sec-title">Results</p>' + list.map(topicBtn).join('') : '<p class="empty">Nothing found for “' + esc(q) + '”. Try different words, or ask in Chat.</p>';
      } else if (state.exCat) {
        var cat = CATS.filter(function (c) { return c.id === state.exCat; })[0];
        list = visibleEntries().filter(function (e) { return e.cat === state.exCat; });
        el.exList.innerHTML = '<p class="sec-title">' + cat.ic + ' ' + esc(cat.t) + '</p>' + list.map(topicBtn).join('');
      } else {
        el.exList.innerHTML = '<p class="sec-title">Popular</p>' + ['which', 't1-steps', 't2-about', 'r-overview', 'x-blank', 'forgot'].map(function (id) { return topicBtn(KB.filter(function (e) { return e.id === id; })[0]); }).join('');
      }
    }
    function topicBtn(e) {
      var cat = CATS.filter(function (c) { return c.id === e.cat; })[0];
      return '<button type="button" class="topic" data-topic="' + e.id + '">' + esc(e.t) + '<span>' + (cat ? cat.ic : '') + ' ›</span></button>';
    }
    el.exCats.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      var id = b.getAttribute('data-cat'); state.exCat = state.exCat === id ? null : id; renderExplore();
    });
    el.exList.addEventListener('click', function (e) {
      var b = e.target.closest('[data-topic]'); if (!b) return;
      var entry = KB.filter(function (x) { return x.id === b.getAttribute('data-topic'); })[0];
      switchView('chat'); activity(); addUser(entry.t); deliver(entryResponse(entry, ctx()));
    });
    el.exSearch.addEventListener('input', renderExplore);

    function renderAdmin() {
      if (level() < 2) { el.admin.innerHTML = ''; return; }
      var s = readSession() || state.session || { user: '—', expires: Date.now(), store: 'session' };
      var total = CFG.sessionHours * 3600000, left = Math.max(0, s.expires - Date.now());
      var pct = Math.max(3, Math.min(100, left / total * 100));
      var L = getLinks(), team = SITE.CREDENTIALS || [], admins = superAdminNames();
      var me = s.user.toLowerCase();
      el.admin.innerHTML =
        '<div class="acard hero"><h3>♔ Super admin <small>' + esc(CFG.orgUnit) + '</small></h3>' +
        '<div class="skv"><span>Signed in as</span><span><b>' + esc(s.user) + '</b></span><span>Session ends</span><span>' + fmtWhen(s.expires) + '</span><span>Time left</span><span>' + fmtLeft(s.expires) + '</span><span>Remembered</span><span>' + (s.store === 'local' ? 'on this device' : 'this tab only') + '</span></div>' +
        '<div class="meter" aria-hidden="true"><i style="width:' + pct.toFixed(0) + '%"></i></div>' +
        '<div class="row"><button type="button" class="act gold" data-act="cmd:extend">＋ Extend ' + CFG.sessionHours + 'h</button><button type="button" class="act" data-act="cmd:logout">Sign out</button></div></div>' +

        '<div class="acard"><h3>🚀 Quick launch</h3><div class="grid2">' +
        tile('open:tool1', '📑', 'Marksheet vs TR', 'this tab') + tile('opennew:tool1', '↗', 'Marksheet vs TR', 'new tab') +
        tile('open:tool2', '🧾', 'White vs Original', 'this tab') + tile('opennew:tool2', '↗', 'White vs Original', 'new tab') +
        tile('open:tool3', '🎓', 'Consolidated Checker', 'this tab') + tile('opennew:tool3', '↗', 'Consolidated Checker', 'new tab') +
        tile('open:tool4', '📋', 'Provisional Result', 'this tab') + tile('opennew:tool4', '↗', 'Provisional Result', 'new tab') +
        tile('open:tool5', '✅', 'Tr-Tru Eligibility', 'this tab') + tile('opennew:tool5', '↗', 'Tr-Tru Eligibility', 'new tab') +
        tile('nav:tools', '🧰', 'Tools section', 'portal') + tile('theme:toggle', '🌓', 'Toggle theme', 'site-wide') +
        '</div></div>' +

        '<div class="acard"><h3>🔗 Quick links <small>' + L.length + ' saved</small></h3>' +
        (L.length ? L.map(function (l, i) {
          return '<div class="link-row"><div class="nm">' + esc(l.name) + '<small>' + esc(l.url) + '</small></div><button type="button" class="xbtn" data-act="urlnew:' + esc(l.url) + '">Open ↗</button><button type="button" class="xbtn del" data-del="' + i + '" aria-label="Remove ' + esc(l.name) + '">✕</button></div>';
        }).join('') : '<p class="small-note">Save pages you open often: results portal, TruScholar, shared drive…</p>') +
        '<div class="form2"><input id="ln-name" placeholder="Name" aria-label="Link name"><input id="ln-url" placeholder="https://…" aria-label="Link URL"><button type="button" class="act primary" id="ln-add">Add</button></div>' +
        '<div class="form2" style="grid-template-columns:1fr auto"><input id="ln-go" placeholder="Open any URL…" aria-label="Open any URL"><button type="button" class="act" id="ln-open">Open ↗</button></div></div>' +

        '<div class="acard"><h3>👥 Team <small>' + team.length + ' accounts</small></h3><div class="users">' +
        (team.length ? team.map(function (c) {
          var isA = admins.indexOf(String(c.id).toLowerCase()) >= 0;
          var you = me === String(c.display || '').toLowerCase() || me === String(c.id).toLowerCase();
          return '<div><span>' + esc(c.display || c.id) + ' <code>' + esc(c.id) + '</code></span><span>' + (you ? '<span class="pill you">you</span> ' : '') + '<span class="pill' + (isA ? ' gold' : '') + '">' + (isA ? '♔ admin' : 'staff') + '</span></span></div>';
        }).join('') : '<p class="small-note">Account list not available on this page.</p>') +
        '</div><p class="small-note">Passwords are never displayed. Accounts are edited in <b>CONFIG → CREDENTIALS</b> in script.js.</p></div>' +

        '<div class="acard"><h3>🛠 System</h3><div class="grid2">' +
        tile('cmd:diag', '🩺', 'Diagnostics', 'browser, network, storage') + tile('cmd:unlock', '🔓', 'Clear lockout', 'this browser') +
        tile('cmd:export', '💾', 'Export chat', '.txt download') + tile('cmd:reload', '🔄', 'Reload page', 'keeps chat') +
        '</div><p class="small-note">Super admin controls are shortcuts on a static site, not a security boundary.</p></div>';
    }
    function tile(act, ic, title, sub) {
      return '<button type="button" class="tile" data-act="' + esc(act) + '"><span class="ic">' + ic + '</span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></button>';
    }
    el.admin.addEventListener('click', function (e) {
      activity();
      var del = e.target.closest('[data-del]');
      if (del) { var L = getLinks(); var gone = L.splice(+del.getAttribute('data-del'), 1)[0]; lsSet(CFG.linksKey, L); renderAdmin(); toast('Removed ' + (gone ? gone.name : '')); return; }
      if (e.target.id === 'ln-add') {
        var nm = shadow.getElementById('ln-name').value.trim(), u = shadow.getElementById('ln-url').value.trim();
        if (!nm || !u) { toast('Add a name and a URL'); return; }
        var r = doAddLink(nm + ' ' + u); toast(r.kind === 'err' ? 'That URL does not look valid' : 'Saved ' + nm); return;
      }
      if (e.target.id === 'ln-open') {
        var g = shadow.getElementById('ln-go').value.trim(); if (!g) return;
        var tg = resolveTarget(g); var res = tg && tg.kind === 'url' ? openUrl(tg.url, true, true, tg.name) : tg && tg.kind === 'tool' ? openTool(tg.key, true, true) : null;
        toast(res && res.kind !== 'err' ? 'Opened ↗' : 'Not a valid link'); return;
      }
      var a = e.target.closest('[data-act]'); if (!a) return;
      var act = a.getAttribute('data-act');
      var result = run(act, true);
      if (!result) return;
      if (/^(cmd:(extend|unlock|export)|theme:|opennew:|urlnew:)/.test(act)) { toast(plain(result.text).slice(0, 60)); renderAdmin(); return; }
      switchView('chat'); deliver(result);
    });
    el.admin.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'ln-go') shadow.getElementById('ln-open').click();
      if (e.target.id === 'ln-url' || e.target.id === 'ln-name') shadow.getElementById('ln-add').click();
    });

    /* =====================================================================
       SETTINGS & PREFERENCES
       ===================================================================== */

    function effectiveTheme() {
      if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme;
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    function applyPrefs() {
      host.setAttribute('data-theme', effectiveTheme());
      host.setAttribute('data-skin', prefs.skin);
      host.setAttribute('data-motion', prefs.motion ? 'on' : 'off');
      el.scene.setAttribute('data-s', prefs.scene);
      el.stage.classList.toggle('min', !prefs.habitat);
      el.voiceBtn.classList.toggle('on', !!prefs.speak);
      el.voiceBtn.setAttribute('aria-pressed', String(!!prefs.speak));
      shadow.getElementById('bot-name').textContent = prefs.skin === 'nova' ? 'Nova' : prefs.skin === 'pip' ? 'Pip' : 'Mirage';
      shadow.querySelectorAll('.seg[data-pref]').forEach(function (g) {
        var k = g.getAttribute('data-pref');
        g.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === prefs[k])); });
      });
      shadow.querySelectorAll('input[data-pref]').forEach(function (i) { i.checked = !!prefs[i.getAttribute('data-pref')]; });
    }
    function setPref(k, v) {
      prefs[k] = v; savePrefs(); applyPrefs();
      if (k === 'keepChat') { if (v) persist(); else { try { sessionStorage.removeItem(CFG.chatKey); } catch (e) {} } }
    }
    shadow.querySelectorAll('.seg[data-pref]').forEach(function (g) {
      g.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) setPref(g.getAttribute('data-pref'), b.getAttribute('data-v')); });
    });
    shadow.querySelectorAll('input[data-pref]').forEach(function (i) {
      i.addEventListener('change', function () { setPref(i.getAttribute('data-pref'), i.checked); });
    });
    function openSettings() { el.settings.classList.add('on'); el.setClose.focus(); }
    function closeSettings() { el.settings.classList.remove('on'); el.setBtn.focus(); }
    el.setBtn.addEventListener('click', function () { el.settings.classList.contains('on') ? closeSettings() : openSettings(); });
    el.setClose.addEventListener('click', closeSettings);
    el.forget.addEventListener('click', function () {
      prefs = Object.assign({}, DEFAULT_PREFS, { seenTip: true }); savePrefs();
      try { localStorage.removeItem(CFG.oldMemoryKey); } catch (e) {}
      applyPrefs(); toast('Forgotten. Fresh start ✨');
    });

    /* follow the site's light / dark switch */
    new MutationObserver(function () { applyPrefs(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* =====================================================================
       ROLE WATCHER (sign-in / sign-out happen without a page load)
       ===================================================================== */

    function updateRole(announce) {
      var r = state.role;
      el.role.textContent = r === 'admin' ? '♔ Super Admin' : r === 'staff' ? 'Staff' : 'Guest';
      el.role.className = 'role ' + r;
      el.status.textContent = r === 'guest' ? 'Offline assistant · nothing leaves this browser'
        : (r === 'admin' ? 'Super admin · ' : 'Signed in · ') + (state.session ? state.session.user : '') + ' · offline & private';
      tabs.forEach(function (t) { if (t.getAttribute('data-view') === 'admin') t.hidden = r !== 'admin'; });
      if (r !== 'admin' && state.view === 'admin') switchView('chat');
      if (state.view === 'admin') renderAdmin();
      if (state.view === 'explore') renderExplore();
      setChips();
    }

    setInterval(function () {
      var s = readSession(), r = roleOf(s);
      var changed = r !== state.role || (s && state.session && s.user !== state.session.user);
      state.session = s;
      if (!changed) { if (state.view === 'admin' && state.open) renderAdmin(); return; }
      var prev = state.role; state.role = r; updateRole();
      if (!state.history.length) return;
      if (r === 'admin') deliver({ text: '♔ Welcome, **' + s.user + '**! **Super admin** controls are unlocked: I can open any link, sign you out, extend your session, show the team, run diagnostics and more.', kind: 'admin', acts: [['Open Admin tab', 'cmd:admin', 'gold'], ['What can a super admin do?', 'ask:What can a super admin do?']], mood: 'love' });
      else if (r === 'staff') deliver({ text: 'Welcome, **' + s.user + '**! You are signed in. I can open any of the five tools for you now.', acts: [['Open Marksheet vs TR', 'open:tool1', 'primary'], ['Open White vs Original', 'open:tool2', 'primary'], ['Open Consolidated Checker', 'open:tool3', 'primary'], ['Open Provisional Result', 'open:tool4', 'primary'], ['Open Tr-Tru Eligibility', 'open:tool5', 'primary']], mood: 'happy' });
      else if (prev !== 'guest') deliver({ text: 'You have signed out. I am in **guest** mode now. 👋', mood: 'happy' });
    }, 1500);

    /* =====================================================================
       OPEN / CLOSE / WELCOME
       ===================================================================== */

    function welcome(fresh) {
      var who = displayName(), r = state.role;
      var text;
      if (r === 'admin') text = timeGreeting() + ', **' + who + '**! ♔\n\n**Super admin mode is on.** Besides answering anything about the suite, I can **open any link**, **sign you out**, **extend your session**, show the **team**, run **diagnostics** and keep your **quick links**. Type `/` for commands.';
      else if (r === 'staff') text = timeGreeting() + ', **' + who + '**! I am **Mirage**, your offline guide to the Verification Suite.\n\nAsk me about any of the five tools, any report sheet, formats and rules, or give me numbers to check. I can also open the tools for you.';
      else text = (fresh ? '' : timeGreeting() + (who ? ', **' + who + '**' : '') + '! ') + 'I am **Mirage** ✨, the Verification Suite\'s offline assistant.\n\nAsk me what the site does, how to sign in, how the five tools work, or what a report means. Nothing you type leaves this browser.';
      var acts = r === 'admin' ? [['♔ Admin dashboard', 'cmd:admin', 'gold'], ['Browse topics', 'cmd:explore']]
        : r === 'staff' ? [['Open Marksheet vs TR', 'open:tool1', 'primary'], ['Open White vs Original', 'open:tool2', 'primary'], ['Open Consolidated Checker', 'open:tool3', 'primary'], ['Open Provisional Result', 'open:tool4', 'primary'], ['Open Tr-Tru Eligibility', 'open:tool5', 'primary']]
        : [['Browse topics', 'cmd:explore']];
      addBot({ text: text, acts: acts, mood: 'happy', speech: r === 'admin' ? 'Super admin mode on ♔' : 'Hi' + (who ? ' ' + who : '') + '! Ask me anything 👋' });
      state.welcomed = true;
    }

    function openPanel() {
      if (state.open) return;
      state.open = true; host.classList.add('open');
      el.badge.classList.remove('on'); el.tip.classList.remove('on');
      prefs.seenTip = true; savePrefs();
      state.session = readSession(); state.role = roleOf(state.session); updateRole();
      applyPrefs();
      if (!state.history.length) welcome();
      activity();
      setTimeout(function () { pet('wave'); }, 350);
      setTimeout(function () { if (window.innerWidth > 480) el.input.focus(); el.msgs.scrollTop = el.msgs.scrollHeight; }, 60);
    }
    function closePanel() {
      if (!state.open) return;
      state.open = false; host.classList.remove('open');
      el.settings.classList.remove('on'); el.palette.classList.remove('on');
      if (listening && rec) try { rec.stop(); } catch (e) {}
      if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) {}
      el.fab.focus();
    }
    el.fab.addEventListener('click', openPanel);
    el.closeBtn.addEventListener('click', closePanel);
    el.expBtn.addEventListener('click', function () { host.classList.toggle('expanded'); el.msgs.scrollTop = el.msgs.scrollHeight; });

    shadow.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (el.settings.classList.contains('on')) { closeSettings(); return; }
      closePanel();
    });
    document.addEventListener('keydown', function (e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
        e.preventDefault(); state.open ? closePanel() : openPanel();
      }
    });

    /* ------------------------------------------------ restore & start */
    applyPrefs();
    updateRole();
    setChips();
    if (prefs.keepChat) {
      var saved = ssGet(CFG.chatKey, null);
      if (saved && saved.h && saved.h.length) {
        saved.h.forEach(function (m) { state.history.push(m); renderMsg(m); });
        state.lastTopic = saved.topic || null;
      }
    }
    if (!state.history.length) el.badge.classList.add('on');
    if (!prefs.seenTip) setTimeout(function () { if (!state.open) { el.tip.classList.add('on'); setTimeout(function () { el.tip.classList.remove('on'); }, 5000); } }, 4000);

    /* ------------------------------------------------ public API */
    window.MirageCompanion = {
      version: CFG.version,
      open: openPanel,
      close: closePanel,
      toggle: function () { state.open ? closePanel() : openPanel(); },
      ask: function (text) { openPanel(); setTimeout(function () { send(text, false); }, 260); },
      forget: function () { prefs.name = null; savePrefs(); try { localStorage.removeItem(CFG.oldMemoryKey); } catch (e) {} },
      role: function () { return roleOf(readSession()); }
    };
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);

})();
