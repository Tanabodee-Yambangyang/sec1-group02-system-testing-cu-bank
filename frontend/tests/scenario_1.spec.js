import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { parse } from "csv-parse/sync";
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, "..", "config", "config.env") })

const records = parse(fs.readFileSync(path.join(__dirname, "..", "data", "scenario_input_1.csv")), {
  columns: true,
  skip_empty_lines: true,
});

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/";
const DB_NAME = process.env.MONGO_DB || "test"; // mongoose default db when URI has no db name
const SEED_ACCOUNT_ID = "1234567890";

async function accountExists(accountId) {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const count = await client
      .db(DB_NAME)
      .collection("users")
      .countDocuments({ accountId });
    return count > 0;
  } finally {
    await client.close();
  }
}

// Before the data-driven tests: make sure account 1234567890 exists in MongoDB.
// If not, register it once using the first "valid" row of the CSV.
test.beforeAll(async ({ browser }) => {
  if (await accountExists(SEED_ACCOUNT_ID)) return;

  const record = records.find((r) => r.type == "valid");
  const page = await browser.newPage();
  try {
    await page.goto(process.env.CU_BANK_REGISTER_URL);
    await page.getByRole("textbox", { name: "Account Number:" }).fill(record.accountId);
    await page.getByRole("textbox", { name: "Password:" }).fill(record.password);
    await page.getByRole("textbox", { name: "First Name:" }).fill(record.firstname);
    await page.getByRole("textbox", { name: "Last Name:" }).fill(record.lastname);
    await page.getByRole("button", { name: "Register" }).click();
    await page.waitForTimeout(2000);
  } finally {
    await page.close();
  }

  // Parallel workers may race on the seed; only fail if the account is still missing.
  expect(await accountExists(SEED_ACCOUNT_ID)).toBe(true);
});

let test_id = 1;

for (const record of records) {
  if (record.type == "invalid") {
    test(`Test ${record.test_case_id}`, async ({ page }) => {
      await page.goto(process.env.CU_BANK_REGISTER_URL);
      console.log(
        record.accountId,
        record.password,
        record.firsname,
        record.lastname
      );
      await page.getByRole('textbox', { name: 'Account Number:' }).click();
      await page.getByRole('textbox', { name: 'Account Number:' }).fill(record.accountId);
      await page.getByRole('textbox', { name: 'Password:' }).click();
      await page.getByRole('textbox', { name: 'Password:' }).fill(record.password);
      await page.getByRole('textbox', { name: 'First Name:' }).click();
      await page.getByRole('textbox', { name: 'First Name:' }).fill(record.firstname);
      await page.getByRole('textbox', { name: 'Last Name:' }).click();
      await page.getByRole('textbox', { name: 'Last Name:' }).fill(record.lastname);
      await page.getByRole('button', { name: 'Register' }).click();
      await page.waitForTimeout(2000);
      const errorLabel = page.locator('label[cid="register-error-mes"]');
      await expect(errorLabel).toBeVisible();
      await expect(errorLabel).toHaveText(record.expected_result);
    });
    test_id += 1;
  }
}
