import { test, expect } from '@playwright/test';
import { uniqueAccountNumber, registerUser, login } from './helpers';

test('TC5.1: Transfer to a non-numeric target account number', async ({ page }) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Withdraw 500
    await amountInputs.nth(1).fill('500');
    await confirmButtons.nth(1).click();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();

    // Transfer to a non-numeric target account number (TAC1)
    const transferForm = page.locator('form').filter({ hasText: 'Please put target Account ID:' });

    await transferForm.getByRole('textbox', { name: 'Please put target Account ID:' }).fill('01234567ab');
    await transferForm.getByPlaceholder('Please fill amount').fill('50');
    await transferForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText('Your account ID should contain numbers only.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();
});

test('TC5.2: Transfer to an account with incorrect length (Exceed)', async ({ page }) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Withdraw 500
    await amountInputs.nth(1).fill('500');
    await confirmButtons.nth(1).click();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();

    // Transfer to an account with incorrect length (Exceed) (TAC2)
    const transferForm = page.locator('form').filter({ hasText: 'Please put target Account ID:' });

    await transferForm.getByRole('textbox', { name: 'Please put target Account ID:' }).fill('12345678901');
    await transferForm.getByPlaceholder('Please fill amount').fill('50');
    await transferForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText('Your account ID must be exactly 10 digits long.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();
});

test('TC5.3: Transfer to an account with incorrect length (Under-length)', async ({ page }) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Withdraw 500
    await amountInputs.nth(1).fill('500');
    await confirmButtons.nth(1).click();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();

    // Transfer to an account with incorrect length (Under-length) (TAC3)
    const transferForm = page.locator('form').filter({ hasText: 'Please put target Account ID:' });

    await transferForm.getByRole('textbox', { name: 'Please put target Account ID:' }).fill('12345');
    await transferForm.getByPlaceholder('Please fill amount').fill('50');
    await transferForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText('Your account ID must be exactly 10 digits long.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();
});

test('TC5.4: Transfer to a non-existent Target Account Number', async ({ page }) => {
    const acc = uniqueAccountNumber();
    const nonExistentAcc = uniqueAccountNumber();

    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Withdraw 500
    await amountInputs.nth(1).fill('500');
    await confirmButtons.nth(1).click();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();

    // Transfer to non-existent Target Account Number (TAC4)
    const transferForm = page.locator('form').filter({ hasText: 'Please put target Account ID:' });

    await transferForm.getByRole('textbox', { name: 'Please put target Account ID:' }).fill(nonExistentAcc);
    await transferForm.getByPlaceholder('Please fill amount').fill('50');
    await transferForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText("We couldn't find the recipient's account. Please double-check the account ID.")).toBeVisible();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();
});

test('TC5.5: Transfer to an Account Number that is identical to the Source Number', async ({ page }) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Withdraw 500
    await amountInputs.nth(1).fill('500');
    await confirmButtons.nth(1).click();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();

    // Transfer to the same Account Number (TAC5)
    const transferForm = page.locator('form').filter({ hasText: 'Please put target Account ID:' });

    await transferForm.getByRole('textbox', { name: 'Please put target Account ID:' }).fill(acc);
    await transferForm.getByPlaceholder('Please fill amount').fill('50');
    await transferForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText("You cannot transfer to your own account.")).toBeVisible();
    await expect(page.getByRole('heading', { name: '500', exact: true })).toBeVisible();
});