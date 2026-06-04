// GET /api/pdf/:token
//
// Отдаёт PDF-документ «Схема хранения» для оплаченного заказа.
//
// Рендер: Puppeteer открывает нашу HTML-страницу /pdf/?t=TOKEN,
// ждёт пока pdf-render.js поставит data-pdf-ready="1" (значит DOM
// и картинки подтянулись), снимает PDF в формате A4.
//
// Кэширование: готовый PDF сохраняем в файл /var/www/umestno/storage/pdfs/
// {token}.pdf. Повторные запросы отдаются с диска без Puppeteer — экономит
// CPU и память. Инвалидация не нужна: заказ после оплаты неизменен.
//
// Браузер запускается один раз на процесс (browserPromise singleton);
// каждый запрос открывает новую page и закрывает её после рендера.

import type { Request, Response } from "express";
import type { Pool } from "pg";
import type { Env } from "../config/env.js";
import { promises as fs } from "fs";
import path from "path";
import puppeteer, { type Browser } from "puppeteer";

const PDF_STORAGE_DIR = "/var/www/umestno/storage/pdfs";
const ACCESS_STATUSES = new Set(["paid", "sent_free"]);

let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // Если задан PUPPETEER_EXECUTABLE_PATH — берём бинарник напрямую,
    // в обход resolver'а Puppeteer'а (полезно когда Chrome лежит вне
    // дефолтного ~/.cache/puppeteer, или Puppeteer почему-то его не
    // находит из-за HOME / drop-in env).
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    browserPromise = puppeteer.launch({
      headless: true,
      ...(execPath ? { executablePath: execPath } : {}),
      // systemd с ProtectHome=yes маскирует $HOME=/root для сервиса, и
      // chrome_crashpad_handler падает «--database is required» потому что
      // не может вычислить путь к своей БД. Явно подсовываем Chrome'у HOME
      // в писаемое место — он положит туда свои crashpad/cache/etc.
      env: { ...process.env, HOME: "/var/cache/puppeteer" },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // /dev/shm на маленьких VPS обычно ~64МБ, Chrome падает с ENOMEM
        // если рендерит сложную страницу — лучше использовать tmpfs/diск.
        "--disable-dev-shm-usage",
        // На сервере нет GPU — headless рендерит на CPU.
        "--disable-gpu",
        "--user-data-dir=/var/cache/puppeteer/user-data",
      ],
    });
    browserPromise
      .then((b) => {
        b.on("disconnected", () => { browserPromise = null; });
      })
      .catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

async function renderPdf(env: Env, token: string): Promise<Buffer> {
  const url = `${env.SITE_BASE_URL}/pdf/?t=${encodeURIComponent(token)}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-pdf-ready") === "1",
      { timeout: 15000 },
    );
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(buf);
  } finally {
    await page.close();
  }
}

export function pdfHandler(pool: Pool, env: Env) {
  return async (req: Request, res: Response) => {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const q = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM orders WHERE token = $1`,
      [token],
    );
    if (q.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const order = q.rows[0];
    if (!ACCESS_STATUSES.has(order.status)) {
      return res.status(402).json({ ok: false, error: "payment_required" });
    }

    const shortId = order.id.split("-")[0].toUpperCase();
    // Content-Disposition с UTF-8 именем по RFC 5987. filename=… —
    // ASCII-фолбэк для совсем старых клиентов; filename*=UTF-8'' —
    // современные браузеры берут это поле и показывают кириллицу.
    const filenameUtf8 = `Уместно. Схема хранения №${shortId}.pdf`;
    const filenameAscii = `umestno-${shortId}.pdf`;
    const contentDisposition =
      `attachment; filename="${filenameAscii}"; filename*=UTF-8''${encodeURIComponent(filenameUtf8)}`;
    const filePath = path.join(PDF_STORAGE_DIR, `${token}.pdf`);

    await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });

    // Cache hit — отдаём с диска без Puppeteer.
    try {
      const cached = await fs.readFile(filePath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition);
      return res.send(cached);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[pdf] cache read failed", e);
      }
    }

    // Cache miss — рендерим и сохраняем.
    try {
      const buf = await renderPdf(env, token);
      await fs.writeFile(filePath, buf);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition);
      res.send(buf);
    } catch (e) {
      console.error("[pdf] render failed", e);
      res.status(500).json({ ok: false, error: "render_failed" });
    }
  };
}
