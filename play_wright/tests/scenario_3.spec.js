import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { parse } from "csv-parse/sync";
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, "..", "config", "config.env") })

const records = parse(fs.readFileSync(path.join(__dirname, "scenario_input_3.csv")), {
  columns: true,
  skip_empty_lines: true,
});

let test_id = 1;
const accountId = "1234567890";
const password = "1234";

for (const record of records) {
  if (record.type == "invalid") {
    test(`Test ${record.test_case_id}`, async ({ page }) => {
      await page.goto(process.env.CU_BANK_URL);
      console.log(
        String(record.accountId),
        String(record.password),
      );
      // Fill in input fields using the provided IDs
      await page.fill('#accountId', accountId);
      await page.fill('#password', password);
      // Click the submit button using the 'cid' attribute selector
      await page.click('button[cid="lc"]');
      // await expect(page.locator('.account-form')).toHaveCount(10);
      await expect.poll(async () => await page.locator('.account-form').count()).toBeGreaterThanOrEqual(9);

      const amountInput = page.locator('input[cid="d1"]');
      const errorLabel  = page.locator('label[cid="deposite-error-mes"]');

      // Type like a user: fill() rejects non-numeric text on type=number
      await amountInput.clear();
      await amountInput.pressSequentially(record.amount);
      await page.click('button[cid="dc"]');

      // Read the browser's validation state
      const v = await amountInput.evaluate((el) => ({
        valid: el.validity.valid,
        stepMismatch: el.validity.stepMismatch,
        valueMissing: el.validity.valueMissing,
        badInput: el.validity.badInput,
        message: el.validationMessage,
      }));

      if (!v.valid) {
        // Native browser validation blocked the submit (e.g. "10.5")
        // locale-independent check; "abc" is filtered to empty -> valueMissing
        expect(v.stepMismatch || v.valueMissing || v.badInput).toBe(true);
        console.log('Native message:', v.message);
        await expect(errorLabel).toHaveCount(0);  // app never got the request
      } else {
        // Browser allowed it, so the app's own validation should respond
        await expect(errorLabel).toBeVisible();
        await expect(errorLabel).toHaveText(record.expected_error);
      }
    });
    test_id += 1;
  }
}
