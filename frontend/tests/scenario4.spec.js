import { test, expect } from '@playwright/test';
import { uniqueAccountNumber, registerUser, login } from './helpers';

test('TC4: Deposit 1000, Withdraw 5000 -> not enough balance', async ({ page }) => {
  const acc = uniqueAccountNumber();
  await registerUser(page, acc, '1234');
  await login(page, acc, '1234');

  const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
  const confirmButtons = page.getByRole('button', { name: 'Confirm' });

  // Deposit 1000
  await amountInputs.first().fill('1000');
  await confirmButtons.first().click();
  await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

  // Withdraw 5000 (more than the balance)
  await amountInputs.nth(1).fill('5000');
  await confirmButtons.nth(1).click();

  await expect(page.getByText(/balance is not enough/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();
});