// auto_fill_local_pdf.js
import fs from "fs";
import * as pdfParse from "pdf-parse";
import { chromium } from "playwright";

(async () => {
  // === ① PDFをローカルから読み込み ===
  const pdfPath = "./form.pdf"; // PDFファイルのパスを指定
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);

  // === ② School（キャンパス名）を抽出 ===
  // 例：... School: Sydney ...
  const text = pdfData.text;
  console.log("📄 PDF内容:\n", text);

  const campus = text.match(/School\s*[:：]?\s*([A-Za-z]+)/)?.[1]?.trim();
  if (!campus) {
    console.log("⚠️ School の項目が見つかりませんでした。");
    return;
  }

  console.log("🏫 抽出したキャンパス名:", campus);

  // === ③ Lexis Portal にアクセス ===
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://enrol.lexisenglish.com/");

  // === ④ キャンパス名に応じたボタンをクリック ===
  if (campus.toLowerCase().includes("sydney")) {
    await page.click('img[alt*="Sydney"]');
    console.log("✅ Sydney キャンパスを選択しました。");
  } else if (campus.toLowerCase().includes("noosa")) {
    await page.click('img[alt*="Noosa"]');
    console.log("✅ Noosa キャンパスを選択しました。");
  } else if (campus.toLowerCase().includes("brisbane")) {
    await page.click('img[alt*="Brisbane"]');
    console.log("✅ Brisbane キャンパスを選択しました。");
  } else {
    console.log("❌ 該当するキャンパスボタンが見つかりませんでした。");
  }

  // === ⑤ 完了 ===
  console.log("🎯 自動クリック完了！");
  // await browser.close(); // 手動確認のためコメントアウト
})();
