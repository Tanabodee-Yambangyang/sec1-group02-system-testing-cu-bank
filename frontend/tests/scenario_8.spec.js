const { test, expect } = require('@playwright/test');
const {
  readData, ensureAccount, login, deposit, transfer, logout, attachJson
} = require('./helpers/cu-bank');

for (const record of readData('scenario_input_8.csv')) {
  test(`${record.test_case_id}: ${record.test_case_name}`, async ({ page, request }, testInfo) => {
    let sender;
    let recipient;
    await test.step('Setup: prepare the two CSV accounts and verify zero-balance preconditions', async () => {
      sender = await ensureAccount(request, record.sender_account_id, record.sender_password, 'PW Sender');
      recipient = await ensureAccount(request, record.recipient_account_id, record.recipient_password, 'PW Recipient');
      expect(sender.accountId).not.toBe(recipient.accountId);
      await attachJson(testInfo, 'test-data.json', {
        testCaseId: record.test_case_id, sender: sender.accountId, recipient: recipient.accountId,
        depositAmount: Number(record.deposit_amount), transferAmount: Number(record.transfer_amount),
      });
    });
    const depositAmount = Number(record.deposit_amount);
    const transferAmount = Number(record.transfer_amount);
    const senderEnd = Number(record.sender_end_balance);
    const recipientEnd = Number(record.recipient_end_balance);
    expect(transferAmount).toBeGreaterThan(0);
    expect(transferAmount).toBeLessThan(depositAmount);
    expect(senderEnd).toBe(depositAmount - transferAmount);
    expect(recipientEnd).toBe(transferAmount);
    const depositHistory = [{ title: 'deposit', target: '', amount: depositAmount, balance: depositAmount }];
    const senderHistory = [...depositHistory, {
      title: 'transfer to', target: recipient.accountId, amount: transferAmount, balance: senderEnd
    }];
    const recipientHistory = [{
      title: 'transfer from', target: sender.accountId, amount: transferAmount, balance: recipientEnd
    }];
    await test.step('Login as sender and verify balance 0 with empty history', async () => {
      await login(page, sender, 0, []);
    });
    await test.step('Deposit 1000 through the UI', async () => {
      await deposit(page, depositAmount, depositAmount, depositHistory);
    });
    await test.step('Transfer 400 through the UI and verify sender balance 600', async () => {
      await transfer(page, recipient.accountId, transferAmount, senderEnd, senderHistory);
    });
    await test.step('Logout sender', async () => { await logout(page); });
    await test.step('Login as recipient and verify balance 400 and incoming transfer', async () => {
      await login(page, recipient, recipientEnd, recipientHistory);
    });
    await test.step('Logout recipient', async () => { await logout(page); });
    await attachJson(testInfo, 'verified-state.json', {
      sender: { accountId: sender.accountId, balance: senderEnd, history: senderHistory },
      recipient: { accountId: recipient.accountId, balance: recipientEnd, history: recipientHistory },
      status: 'Both accounts verified through the UI; client logout verified.'
    });
  });
}
