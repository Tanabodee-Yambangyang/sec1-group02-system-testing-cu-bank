import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", "config", "config.env") });

const records = parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario_input_3.csv")),
  { columns: true, skip_empty_lines: true }
);

const accountId = "1234567890";
const password = "1234";

for (const record of records) {
  if (record.type == "invalid") {
    test(`Test ${record.test_case_id}`, async ({ page }, testInfo) => {
      await page.goto(process.env.CU_BANK_URL);
      console.log("amount:", record.amount);

      // Login
      await page.locator('input[cid="l1"]').fill(accountId);
      await page.locator('input[cid="l2"]').fill(password);
      await page.locator('button[cid="lc"]').click();
      await expect
        .poll(async () => await page.locator(".account-form").count())
        .toBeGreaterThanOrEqual(9);

      const amountInput = page.locator('input[cid="d1"]');
      const errorLabel = page.locator('label[cid="deposite-error-mes"]');

      // Type like a user: fill() rejects non-numeric text on type=number
      await amountInput.clear();
      await amountInput.pressSequentially(record.amount);
      await page.locator('button[cid="dc"]').click();

      // Evidence: what the browser itself reported
      const v = await amountInput.evaluate((el) => ({
        valid: el.validity.valid,
        stepMismatch: el.validity.stepMismatch,
        valueMissing: el.validity.valueMissing,
        badInput: el.validity.badInput,
        message: el.validationMessage,
      }));
      await testInfo.attach("native-validation", {
        body: JSON.stringify(v, null, 2),
        contentType: "application/json",
      });

      // Expected per spec: the app's own error message
      await expect.soft(errorLabel).toBeVisible({ timeout: 3000 });
      await expect.soft(errorLabel).toHaveText(record.expected_error);
    });
  }
}