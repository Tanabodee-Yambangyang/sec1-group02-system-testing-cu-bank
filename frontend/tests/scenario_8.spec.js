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

const records = parse(fs.readFileSync(path.join(__dirname, "scenario_input_8.csv")), {
  columns: true, skip_empty_lines: true, trim: true
});
test.describe.configure({ retries: 0 });

for (const r of records) {
  test(`${r.test_case_id}: ${r.test_case_name}`, async ({ page, request }) => {
    expect(r.sender_account_id).not.toBe(r.recipient_account_id);
    await prepareAccount(request, r.sender_account_id, r.sender_password);
    await prepareAccount(request, r.recipient_account_id, r.recipient_password);

    const deposited = Number(r.deposit_amount);
    const transferred = Number(r.transfer_amount);
    expect(transferred).toBeGreaterThan(0);
    expect(transferred).toBeLessThan(deposited);
    expect(Number(r.sender_end_balance)).toBe(deposited - transferred);
    expect(Number(r.recipient_end_balance)).toBe(transferred);

    await login(page, r.sender_account_id, r.sender_password);
    await checkState(page, 0, []);
    await page.locator('input[cid="d1"]').fill(r.deposit_amount);
    await page.locator('button[cid="dc"]').click();
    const history = [["deposit", "", deposited, deposited]];
    await checkState(page, deposited, history);

    await page.locator('input[cid="t1"]').fill(r.recipient_account_id);
    await page.locator('input[cid="t2"]').fill(r.transfer_amount);
    await page.locator('button[cid="tc"]').click();
    history.push(["transfer to", r.recipient_account_id, transferred, Number(r.sender_end_balance)]);
    await checkState(page, Number(r.sender_end_balance), history);
    await logout(page);

    await login(page, r.recipient_account_id, r.recipient_password);
    await checkState(page, Number(r.recipient_end_balance), [
      ["transfer from", r.sender_account_id, transferred, Number(r.recipient_end_balance)]
    ]);
    await logout(page);
  });
}
