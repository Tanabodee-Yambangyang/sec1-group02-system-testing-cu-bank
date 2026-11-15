import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { parse } from "csv-parse/sync";
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, "..", "config", "config.env") })

const records = parse(fs.readFileSync(path.join(__dirname, "scenario_input_2.csv")), {
  columns: true,
  skip_empty_lines: true,
});

let test_id = 1;

for (const record of records) {
  if (record.type == "invalid") {
    test(`Test ${record.test_case_id}`, async ({ page }) => {
      await page.goto(process.env.CU_BANK_URL);
      console.log(
        record.accountId,
        record.password,
      );
      // Fill in input fields using the provided IDs
      await page.fill('#accountId', record.accountId);
      await page.fill('#password', record.password);

      // Click the submit button using the 'cid' attribute selector
      await page.click('button[cid="lc"]');
      const errorLabel = page.locator('label[cid="login-error-mes"]');
      await expect(errorLabel).toBeVisible();
      await expect(errorLabel).toHaveText(record.expected_result);
    });
    test_id += 1;
  }
}
