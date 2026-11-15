import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", "config", "config.env") });
const APP_URL = new URL("/", process.env.CU_BANK_URL || "http://localhost:3000").href;
const API_URL = process.env.CU_BANK_API_URL || "http://localhost:4000";
const api = (route) => new URL(`/api/v1/${route}`, API_URL).href;
test.setTimeout(60000);
test.use({ storageState: { cookies: [], origins: [] } });

async function prepareAccount(request, accountId, password) {
  const registered = await request.post(api("auth/register"), {
    data: { accountId, password, name: "Playwright Test" }
  });
  const result = await registered.json();
  expect(registered.ok() || /already in use/i.test(result.msg || "")).toBe(true);
  const login = await request.post(api("auth/login"), { data: { accountId, password } });
  expect(login.ok(), `Check password for account ${accountId}`).toBe(true);
  const body = await login.json();
  expect(body.success).toBe(true);
  expect(body.user.accountId).toBe(accountId);
  expect(body.user.balance, `${accountId} must start with balance 0`).toBe(0);
  expect(body.user.transactions, `${accountId} must start with empty history`).toEqual([]);
}

async function login(page, accountId, password) {
  await page.goto(APP_URL);
  await page.locator('input[cid="l1"]').fill(accountId);
  await page.locator('input[cid="l2"]').fill(password);
  await page.locator('button[cid="lc"]').click();
  await expect(page).toHaveURL(/\/account\/?$/);
  await expect(page.getByRole("link", { name: "LOG OUT", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "LOG IN", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Register", exact: true })).toHaveCount(0);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem("user")).user.accountId);
  expect(id).toBe(accountId);
}

async function checkState(page, balance, history) {
  const summary = page.locator("article").filter({ has: page.getByRole("heading", { name: "Balance:", exact: true }) });
  await expect(summary.locator("h1").last()).toHaveText(String(balance));
  const rows = page.locator(".history-list .account-form > div");
  await expect(rows).toHaveCount(history.length);
  for (let i = 0; i < history.length; i++) {
    const [title, target, amount, resultingBalance] = history[i];
    await expect(rows.nth(i).getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(rows.nth(i).locator("p").filter({ hasText: /^target:/ })).toHaveText(`target: ${target}`.trim());
    await expect(rows.nth(i).locator("p").filter({ hasText: /^amount:/ })).toHaveText(`amount: ${amount}`);
    await expect(rows.nth(i).locator("p").filter({ hasText: /^balance:/ })).toHaveText(`balance: ${resultingBalance}`);
  }
  await expect(page.locator('label[cid$="-error-mes"]')).toHaveCount(0);
  await expect(page.locator('button[cid="dc"]')).toBeVisible();
}

async function logout(page) {
  await page.getByRole("link", { name: "LOG OUT", exact: true }).click();
  await expect(page.locator('input[cid="l1"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "LOG OUT", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("user"))).toBeNull();
}

const records = parse(fs.readFileSync(path.join(__dirname, "scenario_input_7.csv")), {
  columns: true, skip_empty_lines: true, trim: true
});

test.describe("Scenario 7: Successful bill payment", () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  let history = [];

  test.beforeAll(async ({ request }) => {
    const first = records[0];
    expect(records.every(r => r.accountId === first.accountId && r.password === first.password)).toBe(true);
    await prepareAccount(request, first.accountId, first.password);
  });

  for (const r of records) {
    test(`${r.test_case_id}: ${r.test_case_name}`, async ({ page }) => {
      await login(page, r.accountId, r.password);
      await checkState(page, Number(r.start_balance), history);

      if (Number(r.deposit_amount) > 0) {
        await page.locator('input[cid="d1"]').fill(r.deposit_amount);
        await page.locator('button[cid="dc"]').click();
        const balance = Number(r.start_balance) + Number(r.deposit_amount);
        history.push(["deposit", "", Number(r.deposit_amount), balance]);
        await checkState(page, balance, history);
      }

      await page.locator(`input[cid="${r.bill_selector}"]`).check();
      await expect(page.locator('input[name="billTarget"]:checked')).toHaveCount(1);
      await page.locator('input[cid="b4"]').fill(r.bill_amount);
      await page.locator('button[cid="bc"]').click();
      history.push(["billpayment", r.bill_target, Number(r.bill_amount), Number(r.end_balance)]);
      await checkState(page, Number(r.end_balance), history);
      await logout(page);
    });
  }
});
