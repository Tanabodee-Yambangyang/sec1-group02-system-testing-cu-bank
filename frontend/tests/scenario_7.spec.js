const { test } = require('@playwright/test');
const {
  readData, createAccount, login, deposit, payBill, logout, attachJson
} = require('./helpers/cu-bank');

const records = readData('scenario_input_7.csv');

test.describe('Scenario 7: Login succeeds, then bill payment succeeds', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });
  let account;
  let history = [];

  test.beforeAll(async ({ request }) => {
    account = await createAccount(request, '1234', 'PW Scenario Seven');
  });

  for (const record of records) {
    test(`${record.test_case_id}: ${record.test_case_name}`, async ({ page }, testInfo) => {
      await attachJson(testInfo, 'test-data.json', {
        ...record, accountId: account.accountId,
        note: 'Generated account ID maps to the Scenario 7 account in the report.'
      });
      await test.step('Login and verify the carried-forward balance and history', async () => {
        await login(page, account, Number(record.start_balance), history);
      });
      const depositAmount = Number(record.deposit_amount);
      if (depositAmount > 0) {
        await test.step('Deposit 5000 through the UI and verify the new history entry', async () => {
          const expected = [...history, {
            title: 'deposit', target: '', amount: depositAmount,
            balance: Number(record.start_balance) + depositAmount
          }];
          await deposit(page, depositAmount, expected.at(-1).balance, expected);
          history = expected;
        });
      }
      await test.step(`Pay ${record.bill_target} bill and verify balance and complete history`, async () => {
        const expected = [...history, {
          title: 'billpayment', target: record.bill_target,
          amount: Number(record.bill_amount), balance: Number(record.end_balance)
        }];
        await payBill(page, record.bill_selector, Number(record.bill_amount), Number(record.end_balance), expected);
        history = expected;
      });
      await test.step('Logout through the UI', async () => { await logout(page); });
      await attachJson(testInfo, 'verified-state.json', {
        accountId: account.accountId, balance: Number(record.end_balance), history,
        status: 'Verified by UI assertions; client logout verified.'
      });
    });
  }
});
