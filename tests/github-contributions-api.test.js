import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import handlerDefault, { ALLOWED_GITHUB_USERNAME, createHandler } from "../api/github-contributions.js";

// Test-only values. No real token or network request is involved in this file.
const FAKE_TOKEN = "test-token-DO-NOT-LEAK-0123456789";
const FIXED_NOW = Date.parse("2026-11-27T10:00:00Z");

function makeClock(start = FIXED_NOW) {
  const clock = { time: start, now: () => new Date(clock.time) };
  return clock;
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { res.headers[name.toLowerCase()] = value; },
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; }
  };
  return res;
}

function calendarPayload(overrides = {}) {
  return {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 7,
            weeks: [{ contributionDays: [
              { date: "2026-11-26", contributionCount: 3 },
              { date: "2026-11-27", contributionCount: 4 }
            ] }],
            ...overrides
          }
        }
      }
    }
  };
}

function upstream(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return responder(url, init, calls.length);
  };
  return { fetchImpl, calls };
}

const okResponse = (payload = calendarPayload(), headers = {}) =>
  new Response(JSON.stringify(payload), { status: 200, headers });

function build(responder, extra = {}) {
  const clock = makeClock();
  const { fetchImpl, calls } = upstream(responder);
  const handler = createHandler({ fetchImpl, getToken: () => FAKE_TOKEN, now: clock.now, ...extra });
  return { handler, calls, clock };
}

async function call(handler, { method = "GET", url = "/api/github-contributions" } = {}) {
  const res = makeRes();
  await handler({ method, url }, res);
  return res;
}

describe("successful response", () => {
  it("returns the contribution days for the one allowed account", async () => {
    const { handler } = build(() => okResponse());
    const res = await call(handler);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.login, "sabbirhossainrafat");
    assert.equal(res.body.totalContributions, 7);
    assert.deepEqual(res.body.days, [
      { date: "2026-11-26", contributionCount: 3 },
      { date: "2026-11-27", contributionCount: 4 }
    ]);
    assert.match(res.headers["content-type"], /^application\/json/);
    assert.match(res.headers["cache-control"], /s-maxage=1800/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  it("queries GitHub only for the allowed username over a 365 day window, with the token server-side", async () => {
    const { handler, calls } = build(() => okResponse());
    await call(handler);
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, "https://api.github.com/graphql");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, `Bearer ${FAKE_TOKEN}`);
    const { variables } = JSON.parse(init.body);
    assert.equal(variables.login, ALLOWED_GITHUB_USERNAME);
    assert.equal(variables.to, "2026-11-27T23:59:59.999Z");
    assert.equal(variables.from, "2025-11-28T00:00:00.000Z");
  });

  it("drops malformed days and fails when no valid day remains", async () => {
    const mixed = build(() => okResponse(calendarPayload({
      weeks: [{ contributionDays: [
        { date: "bad", contributionCount: 1 },
        { date: "2026-11-25", contributionCount: -1 },
        { date: "2026-11-24", contributionCount: "5" },
        { date: "2026-11-23", contributionCount: 2 }
      ] }]
    })));
    assert.deepEqual((await call(mixed.handler)).body.days, [{ date: "2026-11-23", contributionCount: 2 }]);

    const none = build(() => okResponse(calendarPayload({ weeks: [{ contributionDays: [{ date: "x", contributionCount: 1 }] }] })));
    const res = await call(none.handler);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, "contribution_data_unavailable");
  });
});

describe("input restriction", () => {
  it("rejects every query string, including other usernames, without calling GitHub", async () => {
    const { handler, calls } = build(() => okResponse());
    for (const url of [
      "/api/github-contributions?username=someone-else",
      "/api/github-contributions?username=sabbirhossainrafat",
      "/api/github-contributions?cache=1",
      "/api/github-contributions?a=1&b=2"
    ]) {
      const res = await call(handler, { url });
      assert.equal(res.statusCode, 400, url);
      assert.equal(res.body.error, "query_not_supported");
    }
    assert.equal(calls.length, 0);
  });

  it("allows only GET and HEAD", async () => {
    const { handler, calls } = build(() => okResponse());
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const res = await call(handler, { method });
      assert.equal(res.statusCode, 405, method);
      assert.equal(res.headers.allow, "GET, HEAD");
    }
    assert.equal(calls.length, 0);
  });

  it("answers HEAD with the same status and headers as GET", async () => {
    const { handler } = build(() => okResponse());
    const get = await call(handler, { method: "GET" });
    const head = await call(handler, { method: "HEAD" });
    assert.equal(head.statusCode, get.statusCode);
    assert.equal(head.headers["cache-control"], get.headers["cache-control"]);
    assert.equal(head.headers["content-type"], get.headers["content-type"]);
  });

  it("is configured for exactly the confirmed username", () => {
    assert.equal(ALLOWED_GITHUB_USERNAME, "sabbirhossainrafat");
    assert.equal(typeof handlerDefault, "function");
  });
});

describe("token handling", () => {
  it("returns a generic 503 and never calls GitHub when the token is missing or blank", async () => {
    const errorMock = mock.method(console, "error", () => {});
    for (const token of [undefined, null, "", "   "]) {
      const { fetchImpl, calls } = upstream(() => okResponse());
      const handler = createHandler({ fetchImpl, getToken: () => token, now: makeClock().now });
      const res = await call(handler);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.body, { error: "service_unavailable" });
      assert.equal(calls.length, 0);
    }
    assert.match(errorMock.mock.calls[0].arguments.join(" "), /github_token_not_configured/);
    errorMock.mock.restore();
  });

  it("refuses a token that has the read:user scope with a generic 503 and logs the reason", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const { handler } = build(() => okResponse(calendarPayload(), { "X-OAuth-Scopes": "repo, read:user" }));
    const res = await call(handler);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: "service_unavailable" });
    assert.match(errorMock.mock.calls[0].arguments.join(" "), /public_only_token_required/);
    errorMock.mock.restore();
  });

  it("never exposes the token in responses, headers or logs, on success or failure", async () => {
    const logged = [];
    const errorMock = mock.method(console, "error", (...args) => logged.push(args.join(" ")));
    const scenarios = [
      () => okResponse(),
      () => new Response("denied", { status: 401 }),
      () => { throw new Error(`network failure for ${FAKE_TOKEN}`); },
      () => okResponse({ errors: [{ message: `bad credentials ${FAKE_TOKEN}` }] }),
      () => okResponse(calendarPayload(), { "X-OAuth-Scopes": "read:user" })
    ];
    for (const responder of scenarios) {
      const { handler } = build(responder);
      const res = await call(handler);
      const surface = JSON.stringify({ body: res.body, headers: res.headers });
      assert.equal(surface.includes(FAKE_TOKEN), false);
    }
    assert.equal(logged.join("\n").includes(FAKE_TOKEN), false);
    errorMock.mock.restore();
  });
});

describe("error handling", () => {
  it("maps upstream failures to generic 502 responses that are not cached", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const cases = [
      [() => new Response("x", { status: 500 }), "github_unavailable"],
      [() => { throw new Error("socket hang up"); }, "github_unavailable"],
      [() => okResponse({ errors: [{ message: "boom" }] }), "contribution_data_unavailable"],
      [() => okResponse({ data: { user: null } }), "contribution_data_unavailable"],
      [() => okResponse(calendarPayload({ weeks: "nope" })), "contribution_data_unavailable"],
      [() => new Response("not json", { status: 200 }), "github_unavailable"]
    ];
    for (const [responder, code] of cases) {
      const { handler } = build(responder);
      const res = await call(handler);
      assert.equal(res.statusCode, 502);
      assert.equal(res.body.error, code);
      assert.equal(res.headers["cache-control"], "no-store");
    }
    errorMock.mock.restore();
  });

  it("aborts a slow upstream request after the timeout", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const hanging = (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const { handler } = build(hanging, { timeoutMs: 20 });
    const res = await call(handler);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, "github_unavailable");
    errorMock.mock.restore();
  });

  it("remembers a failure for 30 seconds, then asks GitHub again", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const { handler, calls, clock } = build((url, init, count) => (count === 1 ? new Response("x", { status: 500 }) : okResponse()));
    const first = await call(handler);
    assert.equal(first.statusCode, 502);
    clock.time += 29 * 1000;
    const second = await call(handler);
    assert.equal(second.statusCode, 502);
    assert.deepEqual(second.body, first.body);
    assert.equal(calls.length, 1);
    clock.time += 2 * 1000;
    assert.equal((await call(handler)).statusCode, 200);
    assert.equal(calls.length, 2);
    errorMock.mock.restore();
  });

  it("shares one upstream request between concurrent callers when it fails", async () => {
    const errorMock = mock.method(console, "error", () => {});
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const { handler, calls } = build(async () => { await gate; return new Response("x", { status: 500 }); });
    const pending = Array.from({ length: 4 }, () => call(handler));
    release();
    const responses = await Promise.all(pending);
    assert.equal(calls.length, 1);
    assert.ok(responses.every((res) => res.statusCode === 502));
    errorMock.mock.restore();
  });
});

describe("caching", () => {
  it("serves repeat requests from memory until the TTL expires", async () => {
    const { handler, calls, clock } = build(() => okResponse());
    await call(handler);
    await call(handler);
    assert.equal(calls.length, 1);
    clock.time += 14 * 60 * 1000;
    await call(handler);
    assert.equal(calls.length, 1);
    clock.time += 2 * 60 * 1000;
    await call(handler);
    assert.equal(calls.length, 2);
  });

  it("shares one upstream request between concurrent callers", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const { handler, calls } = build(async () => { await gate; return okResponse(); });
    const pending = Array.from({ length: 5 }, () => call(handler));
    release();
    const responses = await Promise.all(pending);
    assert.equal(calls.length, 1);
    assert.ok(responses.every((res) => res.statusCode === 200));
  });
});

describe("operator diagnostics and public error surface", () => {
  const PUBLIC_ERROR_CODES = new Set([
    "method_not_allowed", "query_not_supported", "service_unavailable", "github_unavailable", "contribution_data_unavailable"
  ]);

  async function failureLog(responder, extra) {
    const errorMock = mock.method(console, "error", () => {});
    const { handler } = build(responder, extra);
    const res = await call(handler);
    const log = errorMock.mock.calls.map((entry) => entry.arguments.join(" ")).join("\n");
    errorMock.mock.restore();
    return { res, log };
  }

  it("logs a specific reason for each kind of upstream failure and sends only a generic code", async () => {
    const hanging = (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const cases = [
      ["upstream_status_401", () => new Response("{}", { status: 401 })],
      ["upstream_status_403", () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } })],
      ["upstream_status_429", () => new Response("{}", { status: 429, headers: { "retry-after": "60" } })],
      ["upstream_status_500", () => new Response("{}", { status: 500 })],
      ["request_failed", () => { throw new Error("ECONNRESET"); }],
      ["invalid_json", () => new Response("not json", { status: 200 })],
      ["graphql_errors", () => okResponse({ errors: [{ message: "boom" }] })],
      ["no_calendar", () => okResponse({ data: { user: null } })],
      ["no_valid_days", () => okResponse(calendarPayload({ weeks: [{ contributionDays: [{ date: "x", contributionCount: 1 }] }] }))]
    ];
    for (const [reason, responder] of cases) {
      const { res, log } = await failureLog(responder);
      assert.equal(res.statusCode, 502, reason);
      assert.ok(PUBLIC_ERROR_CODES.has(res.body.error), reason);
      assert.deepEqual(Object.keys(res.body), ["error"], reason);
      assert.ok(log.includes(reason), `${reason}: ${log}`);
      assert.equal(JSON.stringify(res.body).includes(reason), false, `${reason} leaked to the client`);
    }
    const timeout = await failureLog(hanging, { timeoutMs: 20 });
    assert.ok(timeout.log.includes("timeout"));
    assert.equal(timeout.res.statusCode, 502);
  });

  it("logs a remembered failure only once", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const { handler } = build(() => new Response("x", { status: 500 }));
    await call(handler);
    await call(handler);
    await call(handler);
    assert.equal(errorMock.mock.calls.length, 1);
    errorMock.mock.restore();
  });

  it("warns once, without exposing the token, when the token has scopes beyond public access", async () => {
    const warnMock = mock.method(console, "warn", () => {});
    const { handler } = build(() => okResponse(calendarPayload(), { "X-OAuth-Scopes": "repo, admin:org" }));
    const first = await call(handler);
    assert.equal(first.statusCode, 200);
    assert.equal(warnMock.mock.calls.length, 1);
    const message = warnMock.mock.calls[0].arguments.join(" ");
    assert.match(message, /repo, admin:org/);
    assert.equal(message.includes(FAKE_TOKEN), false);
    warnMock.mock.restore();
  });

  it("does not warn for a token without scopes or for fine-grained tokens", async () => {
    const warnMock = mock.method(console, "warn", () => {});
    for (const headers of [{}, { "X-OAuth-Scopes": "" }]) {
      const { handler } = build(() => okResponse(calendarPayload(), headers));
      assert.equal((await call(handler)).statusCode, 200);
    }
    assert.equal(warnMock.mock.calls.length, 0);
    warnMock.mock.restore();
  });

  it("never sets CORS headers on any response type", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const responses = [
      await call(build(() => okResponse()).handler),
      await call(build(() => okResponse()).handler, { url: "/api/github-contributions?x=1" }),
      await call(build(() => okResponse()).handler, { method: "POST" }),
      await call(build(() => new Response("x", { status: 500 })).handler),
      await call(createHandler({ fetchImpl: async () => okResponse(), getToken: () => "", now: makeClock().now }))
    ];
    for (const res of responses) {
      assert.equal(Object.keys(res.headers).some((name) => name.startsWith("access-control-")), false);
      assert.equal(res.headers["x-content-type-options"], "nosniff");
      assert.match(res.headers["content-type"], /^application\/json/);
    }
    errorMock.mock.restore();
  });

  it("only ever answers with a fixed set of public error codes", async () => {
    const errorMock = mock.method(console, "error", () => {});
    const bodies = [
      (await call(build(() => okResponse()).handler, { method: "DELETE" })).body,
      (await call(build(() => okResponse()).handler, { url: "/x?a=1" })).body,
      (await call(createHandler({ fetchImpl: async () => okResponse(), getToken: () => undefined, now: makeClock().now }))).body,
      (await call(build(() => okResponse(calendarPayload(), { "X-OAuth-Scopes": "read:user" })).handler)).body,
      (await call(build(() => new Response("x", { status: 401 })).handler)).body
    ];
    for (const body of bodies) {
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.ok(PUBLIC_ERROR_CODES.has(body.error), body.error);
    }
    errorMock.mock.restore();
  });
});
