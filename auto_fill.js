import fs from "fs";
import pdfParse from "pdf-parse";
import { chromium } from "playwright";

// === ① PDFの読み取り ===
const pdfPath = "https://documentcloud.adobe.com/gsuiteintegration/index.html?state=%7B%22ids%22%3A%5B%2215-gGunNA4_10vQHt4ypc7W9uT93frgsm%22%5D%2C%22action%22%3A%22open%22%2C%22userId%22%3A%22105628411456710693121%22%2C%22resourceKeys%22%3A%7B%7D%7D"; // ← 読み取りたいPDFファイル名
const pdfBuffer = fs.readFileSync(pdfPath);
const pdfData = await pdfParse(pdfBuffer);

// === ② PDFテキストから情報抽出 ===
// 例：「氏名（漢字）：千年倫子」「メール：noriko@gmail.com」「電話：09099999999」「キャンパス：Sydney」
const text = pdfData.text;
const name = text.match(/氏名[（(]漢字[）)]\s*[:：]?\s*(.+)/)?.[1]?.trim() || "";
const email = text.match(/メール[アドレス]*[:：]?\s*(.+)/)?.[1]?.trim() || "";
const phone = text.match(/電話[番号]*[:：]?\s*(\d{9,11})/)?.[1]?.trim() || "";
// const campus = text.match(/キャンパス名[:：]?\s*(\w+)/)?.[1]?.trim() || "";

console.log("📄 抽出結果:");
console.log({ name, email, phone, campus });

// === ③ ブラウザ起動・入力 ===
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// 対象サイトを開く（例：BluedやLexis Portal）
await page.goto("https://blued.jp/contact");

// --- 氏名・メール・電話を入力 ---
await page.fill("#your_name", name);
await page.fill("#your_email", email);
await page.fill("#your_tel", phone);

// === ④ キャンパス名に応じたボタン選択 ===
// if (campus.toLowerCase().includes("sydney")) {
//   await page.click('img[alt*="Sydney"]');
// } else if (campus.toLowerCase().includes("noosa")) {
//   await page.click('img[alt*="Noosa"]');
// } else if (campus.toLowerCase().includes("brisbane")) {
//   await page.click('img[alt*="Brisbane"]');
// } else {
//   console.log("⚠️ 該当するキャンパスボタンが見つかりませんでした。");
// }

// --- 確認用 ---
console.log("✅ 自動入力完了！");

// await browser.close(); // 手動確認のためコメントアウト中
