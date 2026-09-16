/**
 * Drives the real Portale UI in a real browser, over the Chrome DevTools Protocol.
 *
 * Zero dependencies. Node 24 ships a WebSocket client and CDP speaks WebSocket, so this
 * needs no Playwright, no Puppeteer, and no browser download. It uses the Edge already
 * installed on the machine, in a throwaway profile.
 *
 * It emulates a phone viewport by default, because Portale is a mobile-first surface and
 * verifying it at desktop width proves the wrong thing.
 *
 * Steps run in order. Any failed assert or timed-out wait exits non-zero.
 *
 *   node drive.mjs --base http://127.0.0.1:8787 --out ./evidence \
 *     goto / \
 *     wait "document.querySelectorAll('[data-testid=log] .line').length > 0" \
 *     shot opening \
 *     type "[data-testid=utterance]" "I strike at Marga" \
 *     click "[data-testid=send]" \
 *     wait "!document.body.dataset.busy" \
 *     shot after-turn \
 *     assert "document.querySelectorAll('.roll').length > 0" "the engine rolled a die"
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/microsoft-edge",
  "/usr/bin/google-chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v ?? fallback;
}

const base = flag("base", "http://127.0.0.1:8787");
const outDir = resolve(flag("out", "./evidence"));
const width = Number(flag("width", "390"));
const height = Number(flag("height", "844"));
const headed = argv.includes("--headed");
if (headed) argv.splice(argv.indexOf("--headed"), 1);
const timeoutMs = Number(flag("timeout", "180000"));

const browser = BROWSERS.find((p) => existsSync(p));
if (browser === undefined) {
  console.error("No Edge or Chrome found. Checked:\n  " + BROWSERS.join("\n  "));
  process.exit(3);
}

mkdirSync(outDir, { recursive: true });
const profile = join(tmpdir(), `portale-verify-${process.pid}`);
const port = 9222 + (process.pid % 500);

const child = spawn(
  browser,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    ...(headed ? [] : ["--headless=new"]),
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

let ws = null;
let msgId = 0;
const pending = new Map();

function cleanup(code) {
  try { ws?.close(); } catch { /* already gone */ }
  try { child.kill(); } catch { /* already gone */ }
  setTimeout(() => {
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
    process.exit(code);
  }, 300);
}

async function findTarget() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* browser still starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("browser never exposed a debuggable page");
}

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.delete(id)) rej(new Error(`${method} timed out`));
    }, 60000);
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(`evaluate failed: ${r.exceptionDetails.text} :: ${expression}`);
  }
  return r.result?.value;
}

async function waitFor(expression, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`!!(${expression})`)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${label ?? expression}`);
}

async function main() {
  const wsUrl = await findTarget();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", () => rej(new Error("CDP socket failed")), { once: true });
  });
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message}`));
      else res(m.result);
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 2, mobile: true,
  });

  const shots = [];
  let failures = 0;
  let i = 0;

  while (i < argv.length) {
    const step = argv[i++];

    if (step === "goto") {
      const path = argv[i++];
      const url = path.startsWith("http") ? path : base + path;
      await send("Page.navigate", { url });
      await waitFor("document.readyState === 'complete'", "page load");
      console.log(`  goto    ${url}`);
    } else if (step === "wait") {
      const expr = argv[i++];
      await waitFor(expr);
      console.log(`  wait    ${expr}`);
    } else if (step === "type") {
      const sel = argv[i++];
      const text = argv[i++];
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) throw new Error('no element ' + ${JSON.stringify(sel)});
        el.focus();
        el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      console.log(`  type    ${sel} <- ${JSON.stringify(text)}`);
    } else if (step === "click") {
      const sel = argv[i++];
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) throw new Error('no element ' + ${JSON.stringify(sel)});
        el.click();
        return true;
      })()`);
      console.log(`  click   ${sel}`);
    } else if (step === "reload") {
      await send("Page.reload", {});
      await waitFor("document.readyState === 'complete'", "reload");
      console.log(`  reload`);
    } else if (step === "shot") {
      const name = argv[i++];
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const file = join(outDir, `${name}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      shots.push(file);
      console.log(`  shot    ${file}`);
    } else if (step === "assert") {
      const expr = argv[i++];
      const label = argv[i++] ?? expr;
      const ok = await evaluate(`!!(${expr})`);
      console.log(`  ${ok ? "PASS" : "FAIL"}    ${label}`);
      if (!ok) {
        failures++;
        const dump = await evaluate("document.body.innerText.slice(0, 900)");
        console.log(`          page said: ${JSON.stringify(dump)}`);
      }
    } else if (step === "dump") {
      const name = argv[i++];
      const text = await evaluate("document.body.innerText");
      const file = join(outDir, `${name}.txt`);
      writeFileSync(file, text ?? "");
      console.log(`  dump    ${file}`);
    } else {
      throw new Error(`unknown step "${step}"`);
    }
  }

  console.log(`\n${failures === 0 ? "VERIFIED" : "NOT VERIFIED"}  ${shots.length} screenshot(s) in ${outDir}`);
  cleanup(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nNOT VERIFIED  ${e.message}`);
  cleanup(2);
});
