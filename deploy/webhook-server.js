/**
 * GitHub Webhook Server for actionleader.com.hk
 *
 * Listens for GitHub push events and auto-pulls the website repo.
 * This ensures CMS-uploaded images and content appear on the live site immediately.
 *
 * Usage:
 *   node /var/www/actionleader.com.hk/deploy/webhook-server.js
 *
 * Systemd service (optional):
 *   See deploy/webhook-server.service
 *
 * GitHub Webhook Setup:
 *   1. Go to: https://github.com/Actionleader/zhixing-edu-website/settings/hooks
 *   2. Click "Add webhook"
 *   3. Payload URL: https://actionleader.com.hk/webhook
 *   4. Content type: application/json
 *   5. Secret: (generate a random string)
 *   6. Events: "Just the push event"
 *   7. Set WEBHOOK_SECRET env var on VPS to match
 */

const http = require("http");
const crypto = require("crypto");
const { execSync } = require("child_process");

const PORT = process.env.WEBHOOK_PORT || 9000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const SITE_DIR = process.env.SITE_DIR || "/var/www/actionleader.com.hk";
const BRANCH = "refs/heads/main";

const server = http.createServer((req, res) => {
  // Only accept POST to /webhook
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    // Verify signature if secret is configured
    const signature = req.headers["x-hub-signature-256"];
    if (WEBHOOK_SECRET) {
      const expected =
        "sha256=" +
        crypto
          .createHmac("sha256", WEBHOOK_SECRET)
          .update(body)
          .digest("hex");

      if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        console.log(`[${new Date().toISOString()}] Invalid signature — request rejected`);
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }
    }

    // Parse the event
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request");
      return;
    }

    const eventType = req.headers["x-github-event"];
    console.log(`[${new Date().toISOString()}] Received: ${eventType}`);

    // Only handle push events
    if (eventType !== "push") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK — ignoring non-push event");
      return;
    }

    // Only handle push to main branch
    if (payload.ref !== BRANCH) {
      console.log(`  Skipping push to ${payload.ref} (not ${BRANCH})`);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK — not main branch");
      return;
    }

    // Run git pull
    console.log(`  Pulling main branch...`);
    try {
      const before = execSync("git rev-parse HEAD", {
        cwd: SITE_DIR,
        encoding: "utf-8",
        timeout: 10000,
      }).trim();

      execSync("git fetch origin main", {
        cwd: SITE_DIR,
        timeout: 30000,
      });

      execSync("git reset --hard origin/main", {
        cwd: SITE_DIR,
        timeout: 10000,
      });

      const after = execSync("git rev-parse HEAD", {
        cwd: SITE_DIR,
        encoding: "utf-8",
        timeout: 10000,
      }).trim();

      console.log(`  Updated: ${before} → ${after}`);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`OK — synced to ${after}`);
    } catch (err) {
      console.error(`  Pull failed: ${err.message}`);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Pull failed");
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Webhook server listening on http://127.0.0.1:${PORT}/webhook`);
});
