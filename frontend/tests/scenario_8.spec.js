import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";

dotenv.config({
  path: path.join(__dirname, "..", "config", "config.env"),
});

const APP_URL = new URL(
  "/",
  process.env.CU_BANK_URL || "http://localhost:3000"
).href;

const API_URL =
  process.env.CU_BANK_API_URL || "http://localhost:4000";

const api = route =>
  new URL(`/api/v1/${route}`, API_URL).href;

test.setTimeout(60000);
test.use({ storageState: { cookies: [], origins: [] } });

function amount(value, name) {
  expect(value, `${name} is required`).not.toBeUndefined();
  expect(String(value).trim(), `${name} is required`).not.toBe("");

  const number = Number(value);

  expect(
    Number.isSafeInteger(number),
    `${name} must be a safe integer`
  ).toBe(true);

  expect(number, name).toBeGreaterThan(0);

  return number;
}

// Create a missing account or verify an existing account.
// Preserve its current balance and transaction history.
async function prepareAccount(request, accountId, password) {
  expect(accountId).toMatch(/^[0-9]{10}$/);
  expect(password).toMatch(/^[0-9]{4}$/);

  const registered = await request.post(api("auth/register"), {
    data: {
      accountId,
      password,
      name: "Playwright Test",
    },
  });

  const registration = await registered.json();

  expect(
    registered.ok() ||
      /already in use/i.test(registration.msg || ""),
    "Registration must succeed or report an existing account"
  ).toBe(true);

  const response = await request.post(api("auth/login"), {
    data: { accountId, password },
  });

  expect(
    response.ok(),
    `Check credentials for account ${accountId}`
  ).toBe(true);

  // This is an APIRequestContext response, not a browser response.
  const body = await response.json();

  expect(body.success).toBe(true);
  expect(body.user.accountId).toBe(accountId);
  expect(Number.isSafeInteger(body.user.balance)).toBe(true);
  expect(body.user.balance).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(body.user.transactions)).toBe(true);

  return {
    balance: body.user.balance,
    history: body.user.transactions.map(transaction => [
      transaction.title,
      transaction.target || "",
      transaction.amount,
      transaction.balance,
    ]),
  };
}

async function login(page, accountId, password) {
  await page.goto(APP_URL);
  await page.locator('input[cid="l1"]').fill(accountId);
  await page.locator('input[cid="l2"]').fill(password);
  await page.locator('button[cid="lc"]').click();

  await expect(page).toHaveURL(/\/account\/?$/);

  await expect(
    page.getByRole("link", { name: "LOG OUT", exact: true })
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "LOG IN", exact: true })
  ).toHaveCount(0);

  await expect(
    page.getByRole("link", { name: "Register", exact: true })
  ).toHaveCount(0);

  const id = await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.user?.accountId;
  });

  expect(id).toBe(accountId);
}

// Verify the balance and complete history.
// Sorting preserves duplicate records while allowing a different display order.
async function checkState(page, state) {
  const summary = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Balance:",
      exact: true,
    }),
  });

  await expect(summary.locator("h1").last()).toHaveText(
    String(state.balance),
    { timeout: 10000 }
  );

  const rows = page.locator(".history-list .account-form > div");

  await expect(rows).toHaveCount(state.history.length, {
    timeout: 10000,
  });

  const expected = state.history
    .map(row => JSON.stringify(row))
    .sort();

  await expect
    .poll(
      async () => {
        const actual = await rows.evaluateAll(elements =>
          elements.map(element => {
            const heading = element.querySelector(
              "h1,h2,h3,h4,h5,h6,[role='heading']"
            );

            const paragraphs = Array.from(
              element.querySelectorAll("p")
            );

            const field = name => {
              const paragraph = paragraphs.find(p =>
                p.textContent.trim().startsWith(`${name}:`)
              );

              return paragraph
                ? paragraph.textContent
                    .trim()
                    .slice(name.length + 1)
                    .trim()
                : null;
            };

            const numeric = name => {
              const value = field(name);

              return value === null || value === ""
                ? null
                : Number(value);
            };

            return [
              heading?.textContent.trim() || null,
              field("target"),
              numeric("amount"),
              numeric("balance"),
            ];
          })
        );

        return actual.map(row => JSON.stringify(row)).sort();
      },
      {
        timeout: 10000,
        message:
          "History must preserve the baseline and contain exactly the expected new entries",
      }
    )
    .toEqual(expected);

  await expect(
    page.locator('label[cid$="-error-mes"]')
  ).toHaveCount(0);
}

async function submitTransaction(page, button, action, value, target) {
  const [response] = await Promise.all([
    page.waitForResponse(response => {
      const pathname = new URL(response.url()).pathname.replace(
        /\/$/,
        ""
      );

      if (pathname !== "/api/v1/transactions") return false;
      if (response.request().method() !== "PUT") return false;

      const data = response.request().postDataJSON();

      return (
        data.action === action &&
        data.balance === value &&
        (target === undefined || data.target === target)
      );
    }),

    page.locator(button).click(),
  ]);

  expect(
    response.ok(),
    `${action} HTTP status: ${response.status()}`
  ).toBe(true);

  // Do not read response.json(): the application may already have reloaded.
  // checkState() verifies the actual balance and history afterward.
}

async function deposit(page, value, state) {
  await page.locator('input[cid="d1"]').fill(String(value));

  await submitTransaction(
    page,
    'button[cid="dc"]',
    "deposit",
    value
  );

  const next = {
    balance: state.balance + value,
    history: [
      ...state.history,
      ["deposit", "", value, state.balance + value],
    ],
  };

  await checkState(page, next);
  return next;
}

async function logout(page) {
  await page
    .getByRole("link", { name: "LOG OUT", exact: true })
    .click();

  await expect(page.locator('input[cid="l1"]')).toBeVisible();

  await expect(
    page.getByRole("link", { name: "LOG OUT", exact: true })
  ).toHaveCount(0);

  expect(
    await page.evaluate(() => localStorage.getItem("user"))
  ).toBeNull();
}

const records = parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario_input_8.csv")),
  {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }
);

expect(
  records.length,
  "CSV must contain at least one test case"
).toBeGreaterThan(0);

test.describe("Scenario 8: Login, deposit and transfer succeed", () => {
  test.describe.configure({
    mode: "serial",
    retries: 0,
  });

  for (const record of records) {
    test(
      `${record.test_case_id}: ${record.test_case_name}`,
      async ({ page, request }, testInfo) => {
        expect(record.sender_account_id).not.toBe(
          record.recipient_account_id
        );

        const sender = await prepareAccount(
          request,
          record.sender_account_id,
          record.sender_password
        );

        const recipient = await prepareAccount(
          request,
          record.recipient_account_id,
          record.recipient_password
        );

        const deposited = amount(
          record.deposit_amount,
          "Deposit amount"
        );

        const transferred = amount(
          record.transfer_amount,
          "Transfer amount"
        );

        await login(
          page,
          record.sender_account_id,
          record.sender_password
        );

        await checkState(page, sender);

        const funded = await deposit(page, deposited, sender);

        expect(
          funded.balance,
          "Precondition: balance must be greater than the transfer amount"
        ).toBeGreaterThan(transferred);

        await page
          .locator('input[cid="t1"]')
          .fill(record.recipient_account_id);

        await page
          .locator('input[cid="t2"]')
          .fill(String(transferred));

        await submitTransaction(
          page,
          'button[cid="tc"]',
          "transfer",
          transferred,
          record.recipient_account_id
        );

        const senderAfter = {
          balance: funded.balance - transferred,
          history: [
            ...funded.history,
            [
              "transfer to",
              record.recipient_account_id,
              transferred,
              funded.balance - transferred,
            ],
          ],
        };

        await checkState(page, senderAfter);
        await logout(page);

        await login(
          page,
          record.recipient_account_id,
          record.recipient_password
        );

        const recipientAfter = {
          balance: recipient.balance + transferred,
          history: [
            ...recipient.history,
            [
              "transfer from",
              record.sender_account_id,
              transferred,
              recipient.balance + transferred,
            ],
          ],
        };

        await checkState(page, recipientAfter);
        await logout(page);

        await testInfo.attach("verified-balances", {
          body: JSON.stringify(
            {
              senderStart: sender.balance,
              recipientStart: recipient.balance,
              deposit: deposited,
              transfer: transferred,
              senderEnd: senderAfter.balance,
              recipientEnd: recipientAfter.balance,
            },
            null,
            2
          ),
          contentType: "application/json",
        });
      }
    );
  }
});