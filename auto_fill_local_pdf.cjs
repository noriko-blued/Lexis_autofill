// auto_fill_local_pdf.cjs
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const { chromium } = require("playwright");

/**
 * Clicks the specified option (e.g. "No") for a question referenced by its legend text.
 * Falls back to matching label text or input values in case the markup changes slightly.
 */
const clickLegendOption = async (page, legendText, optionText) => {
  await page.waitForFunction(
    (text) => {
      const normalize = (val) => val.replace(/\s+/g, " ").trim().toLowerCase();
      const legends = Array.from(document.querySelectorAll("legend"));
      return legends.some((legend) => normalize(legend.textContent).includes(normalize(text)));
    },
    legendText,
    { timeout: 60000 }
  );

  await page.evaluate(({ legendText, optionText }) => {
    const normalize = (val) => val.replace(/\s+/g, " ").trim().toLowerCase();
    const escapeId = (value) => {
      if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
      return value.replace(/([#.;,\[\]><+~])/g, "\\$1");
    };

    const legends = Array.from(document.querySelectorAll("legend"));
    const legend = legends.find((node) =>
      normalize(node.textContent).includes(normalize(legendText))
    );
    if (!legend) throw new Error(`Legend not found: ${legendText}`);

    const container = legend.closest(".gfield") || legend.closest("fieldset") || legend.parentElement;
    if (!container) throw new Error(`Container not found for legend: ${legendText}`);

    const inputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
    const match = inputs.find((input) => {
      const directLabel = input.closest("label");
      const forLabel = input.id
        ? container.querySelector(`label[for="${escapeId(input.id)}"]`)
        : null;
      const labelNode = directLabel || forLabel;
      const textSource = labelNode ? labelNode.textContent : input.value;
      return textSource && normalize(textSource) === normalize(optionText);
    });

    if (!match) throw new Error(`Option "${optionText}" not found for legend: ${legendText}`);
    match.click();
  }, { legendText, optionText });
};

/**
 * Selects a dropdown option by matching the label text tied to the select element.
 */
const selectDropdownOption = async (page, labelText, optionText) => {
  await page.waitForFunction(
    (text) => {
      const normalize = (val) => val.replace(/\s+/g, " ").trim().toLowerCase();
      const labels = Array.from(document.querySelectorAll("label"));
      return labels.some((label) => normalize(label.textContent).includes(normalize(text)));
    },
    labelText,
    { timeout: 60000 }
  );

  await page.evaluate(({ labelText, optionText }) => {
    const normalize = (val) => val.replace(/\s+/g, " ").trim().toLowerCase();
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((node) => normalize(node.textContent).includes(normalize(labelText)));
    if (!label) throw new Error(`Label not found: ${labelText}`);

    const select = label.htmlFor
      ? document.getElementById(label.htmlFor)
      : label.parentElement?.querySelector("select");

    if (!select) throw new Error(`Select element not found for label: ${labelText}`);

    const options = Array.from(select.options);
    const target = options.find((opt) => normalize(opt.textContent) === normalize(optionText)) ||
      options.find((opt) => normalize(opt.value) === normalize(optionText));

    if (!target) throw new Error(`Option "${optionText}" not found for select tied to: ${labelText}`);

    select.value = target.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { labelText, optionText });
};

/** Ensures an input is visible before filling it. */
const fillVisibleInput = async (page, selector, value) => {
  await page.waitForSelector(selector, { state: "visible", timeout: 60000 });
  await page.fill(selector, value);
};

/** Forces value assignment even if the field stays hidden. */
const forceSetInputValue = async (page, selector, value) => {
  await page.waitForSelector(selector, { timeout: 60000 });
  const result = await page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`Input not found: ${selector}`);

    const reveal = (node) => {
      if (!node) return;
      node.classList?.remove("gform_hidden");
      if (node.style) {
        node.style.removeProperty("display");
        node.style.removeProperty("visibility");
        node.style.removeProperty("opacity");
      }
    };

    let current = input;
    while (current) {
      reveal(current);
      current = current.parentElement;
    }

    const field = input.closest(".gfield");
    if (field) {
      field.style.setProperty("display", "block", "important");
      field.style.removeProperty("visibility");
    }

    const beforeValue = input.value;
    input.disabled = false;
    input.removeAttribute("readonly");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const styleSummary = {
      display: getComputedStyle(input).display,
      visibility: getComputedStyle(input).visibility,
      offsetParentExists: input.offsetParent !== null,
    };

    return { selector, beforeValue, afterValue: input.value, styleSummary };
  }, { selector, value });

  console.log(
    `ℹ️ forceSetInputValue ${result.selector}: before="${result.beforeValue}" after="${result.afterValue}" display=${result.styleSummary.display} visibility=${result.styleSummary.visibility} offsetParent=${result.styleSummary.offsetParentExists}`
  );
};

/** Ensures the Agent email field block is visible even if Gravity Forms scripts lag. */
const ensureAgentEmailVisible = async (page) => {
  await page.waitForSelector("#field_1_593", { timeout: 60000 });

  await page.waitForFunction(
    () => {
      const field = document.querySelector("#field_1_593");
      if (!field) return false;

      const canApply = window.gform && typeof window.gform.applyConditions === "function";
      if (canApply) {
        window.gform.applyConditions(1, true);
      } else {
        field.classList.remove("gform_hidden");
        field.style.removeProperty("display");
      }

      const innerContainers = field.querySelectorAll(".ginput_container, .ginput_container_email, input");
      innerContainers.forEach((node) => {
        node.classList?.remove("gform_hidden");
        node.style?.removeProperty("display");
        node.style?.removeProperty("visibility");
        if (node instanceof HTMLInputElement) {
          node.disabled = false;
          node.removeAttribute("readonly");
        }
      });

      const targetInput = field.querySelector("#input_1_593");
      const hidden = field.classList.contains("gform_hidden");
      const style = getComputedStyle(field);
      if (!targetInput) return false;
      const targetStyle = getComputedStyle(targetInput);
      const inputVisible =
        targetStyle.display !== "none" &&
        targetStyle.visibility !== "hidden" &&
        targetInput.offsetParent !== null;

      return !hidden && style.display !== "none" && style.visibility !== "hidden" && field.offsetParent !== null && inputVisible;
    },
    { timeout: 60000 }
  );
};

(async () => {
  const pdfPath = "./form_noosa.pdf";
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const form = pdfDoc.getForm();

  // PDFフォームの全フィールドを取得
  const fields = form.getFields();
  let campus = "";

  for (const f of fields) {
    const name = f.getName();
    const value = f.getText ? f.getText() : "";
    console.log(`${name}: ${value}`);

    if (name.toLowerCase().includes("school") || name.toLowerCase().includes("campus")) {
      campus = value.trim();
    }
  }

  if (!campus) {
    console.log("⚠️ School / Campus の項目が見つかりませんでした。");
    return;
  }

  console.log("🏫 抽出したキャンパス名:", campus);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://enrol.lexisenglish.com/", {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });

  // // 🌏 ページを開いたあと
  // console.log("🌏 ページを開きました。キャンパスを探しています...");

  // // 変数 campus を動的に使用
  // const campusName = campus.trim();
  // const selector = `label:has(img[alt*="${campusName}"])`;

  // try {
  //   await page.waitForSelector(selector, { timeout: 60000 });
  //   await page.click(selector);
  //   console.log(`✅ ${campusName} キャンパスを選択しました。`);
  // } catch {
  //   console.log(`⚠️ ${campusName} の labelクリック失敗 → JS強制クリックを実行`);
  //   await page.evaluate((name) => {
  //     const el = document.querySelector(`img[alt*="${name}"]`);
  //     if (el) el.click();
  //   }, campusName);
  //   console.log(`✅ JSで ${campusName} 画像をクリックしました。`);
  // }

  // const radioQuestions = [
  //   "Are you a Current Lexis Student?",
  //   "Are you in Australia currently?",
  //   "In addition to your Lexis English course, are you in the future planning to enrol into a vocational course at Lexis Training, The Beauty House Academy or The Culinary Academy?",
  // ];

  // for (const question of radioQuestions) {
  //   try {
  //     await clickLegendOption(page, question, "No");
  //     console.log(`✅ "${question}" で "No" を選択しました。`);
  //   } catch (error) {
  //     console.log(`⚠️ "${question}" の選択に失敗: ${error.message}`);
  //   }
  // }

  try {
    await selectDropdownOption(page, "How did you hear about us?", "agent");
    console.log("✅ How did you hear about us? で agent を選択しました。");
  } catch (error) {
    console.log(`⚠️ How did you hear about us? の選択に失敗: ${error.message}`);
  }

  try {
    await clickLegendOption(page, "Do you have an Agent?", "Yes");
    await ensureAgentEmailVisible(page);
    const emailState = await page.evaluate(() => {
      const input = document.querySelector("#input_1_593");
      if (!input) return { exists: false };
      const style = getComputedStyle(input);
      return {
        exists: true,
        display: style.display,
        visibility: style.visibility,
        offsetParent: input.offsetParent !== null,
        value: input.value,
      };
    });
    console.log(
      emailState.exists
        ? `ℹ️ Agent email state → display=${emailState.display} visibility=${emailState.visibility} offsetParent=${emailState.offsetParent} value="${emailState.value}"`
        : "ℹ️ Agent email input not found"
    );
    console.log("✅ Do you have an Agent? で Yes を選択しました。");
  } catch (error) {
    console.log(`⚠️ Do you have an Agent? の選択に失敗: ${error.message}`);
  }

  try {
    await fillVisibleInput(page, "#input_1_386_3", "apply@studyin.jp");
    await fillVisibleInput(page, "#input_1_386_6", "Chitose");
    console.log("✅ Agent Name に Noriko Chitose を入力しました。");
  } catch (error) {
    console.log(`⚠️ Agent Name の入力に失敗: ${error.message}`);
  }

  try {
    await forceSetInputValue(page, "#input_1_593", "apply@gmail.com");
    await forceSetInputValue(page, "#input_1_593_2", "apply@gmail.com");
    console.log("✅ Agent Email と Confirm Email に apply@studyin.jp を入力しました。");
  } catch (error) {
    console.log(`⚠️ Agent Email の入力に失敗: ${error.message}`);
  }

  try {
    await fillVisibleInput(page, "#input_1_116", "BLUED CO., LTD");
    console.log("✅ Agency Name に BLUED CO., LTD を入力しました。");
  } catch (error) {
    console.log(`⚠️ Agency Name の入力に失敗: ${error.message}`);
  }

  try {
    await fillVisibleInput(page, "#input_1_78_raw", "03-6455-3910");
    console.log("✅ Agency Phone Number に 03-6455-3910 を入力しました。");
  } catch (error) {
    console.log(`⚠️ Agency Phone Number の入力に失敗: ${error.message}`);
  }

  try {
    await page.click("#gform_next_button_1_158");
    console.log("✅ Proceed to Personal Details ボタンをクリックしました。");
  } catch (error) {
    console.log(`⚠️ Proceed ボタンのクリックに失敗: ${error.message}`);
  }

  // 他項目の自動入力を追加する場合はここに記述

  // await browser.close(); // 必要に応じてブラウザを閉じる
})();
