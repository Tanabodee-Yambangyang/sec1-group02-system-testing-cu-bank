import { expect } from '@playwright/test';

export function uniqueAccountNumber() {
  const t = String(Date.now()).slice(-7);
  const r = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return t + r; // always 10 digits, always a string
}

export async function registerUser(
  page,
  accountNumber,
  password = '1234',
  first = 'Sam',
  last = 'Son'
) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Account Number:' }).fill(accountNumber);
  await page.getByRole('textbox', { name: 'Password:' }).fill(password);
  await page.getByRole('textbox', { name: 'First Name:' }).fill(first);
  await page.getByRole('textbox', { name: 'Last Name:' }).fill(last);

  // Wait for the "Registration successful!" alert, then accept it
  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Register' }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('Registration successful');
  await dialog.accept();
}

export async function login(page, accountNumber, password = '1234') {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Account Number:' }).fill(accountNumber);
  await page.getByRole('textbox', { name: 'Password:' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Account ID:' })).toBeVisible();
}