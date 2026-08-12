const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const test = require("node:test");

const { Library } = require("../main/library");
const { createServer } = require("../main/server");

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "beam-stream-"));
  const shared = path.join(base, "shared");

  fs.mkdirSync(shared, { recursive: true });

  const content = Buffer.from("0123456789ABCDEF");
  fs.writeFileSync(path.join(shared, "movie.mp4"), content);

  const library = new Library();
  library.reset([{ path: shared, label: "Media" }]);

  const root = library.browse("0");
  const listing = library.browse(root.containers[0].id);
  const item = listing.items[0];

  return { base, library, item, content };
}

function request(server, options = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: options.path || `/stream/${options.id}`,
        method: "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

async function startServer(library) {
  const app = createServer({
    library,
    getSettings: () => ({
      friendlyName: "Test Server",
      port: 0,
    }),
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve(server);
    });

    server.on("error", reject);
  });
}

test("full-file request returns 200 with the complete file", async (t) => {
  const f = fixture();
  const server = await startServer(f.library);

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(f.base, { recursive: true, force: true }));

  const res = await request(server, {
    id: f.item.id,
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers["accept-ranges"], "bytes");
  assert.equal(res.headers["content-type"], "video/mp4");
  assert.equal(Number(res.headers["content-length"]), f.content.length);
  assert.deepEqual(res.body, f.content);
});

test("valid range returns 206 with the requested bytes", async (t) => {
  const f = fixture();
  const server = await startServer(f.library);

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(f.base, { recursive: true, force: true }));

  const res = await request(server, {
    id: f.item.id,
    headers: {
      Range: "bytes=2-5",
    },
  });

  assert.equal(res.status, 206);
  assert.equal(res.headers["accept-ranges"], "bytes");
  assert.equal(res.headers["content-type"], "video/mp4");
  assert.equal(res.headers["content-range"], "bytes 2-5/16");
  assert.equal(Number(res.headers["content-length"]), 4);
  assert.deepEqual(res.body, f.content.subarray(2, 6));
});

test("open-ended range returns 206 with bytes through the end", async (t) => {
  const f = fixture();
  const server = await startServer(f.library);

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(f.base, { recursive: true, force: true }));

  const res = await request(server, {
    id: f.item.id,
    headers: {
      Range: "bytes=6-",
    },
  });

  assert.equal(res.status, 206);
  assert.equal(res.headers["accept-ranges"], "bytes");
  assert.equal(res.headers["content-type"], "video/mp4");
  assert.equal(res.headers["content-range"], "bytes 6-15/16");
  assert.equal(Number(res.headers["content-length"]), 10);
  assert.deepEqual(res.body, f.content.subarray(6));
});

test("invalid range returns 416", async (t) => {
  const f = fixture();
  const server = await startServer(f.library);

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(f.base, { recursive: true, force: true }));

  const res = await request(server, {
    id: f.item.id,
    headers: {
      Range: "bytes=10-5",
    },
  });

  assert.equal(res.status, 416);
  assert.equal(res.headers["content-range"], "bytes */16");
});

test("out-of-bounds range returns 416", async (t) => {
  const f = fixture();
  const server = await startServer(f.library);

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(f.base, { recursive: true, force: true }));

  const res = await request(server, {
    id: f.item.id,
    headers: {
      Range: "bytes=100-200",
    },
  });

  assert.equal(res.status, 416);
  assert.equal(res.headers["content-range"], "bytes */16");
});

test("unknown media id returns 404", async (t) => {
  const f = fixture();
  const server = await startServer(f.library);

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => fs.rmSync(f.base, { recursive: true, force: true }));

  const res = await request(server, {
    id: "unknown-media-id",
  });

  assert.equal(res.status, 404);
});
