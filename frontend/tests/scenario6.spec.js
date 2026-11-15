import { test, expect } from '@playwright/test';
import { uniqueAccountNumber, registerUser, login } from './helpers';

test('TC6.1: Non-numeric Bill Amount', async ({ page }, testInfo) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000 (setup)
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Pay bill: Water Charge (BT1), non-numeric amount "e" (BA1)
    const billForm = page.locator('form').filter({ hasText: 'Water ChargeElectric' });
    const billAmount = billForm.getByPlaceholder('Please fill amount');

    await billForm.getByRole('radio').first().check();
    await billAmount.focus();
    await page.keyboard.type('e');   // fill('e') is rejected by number inputs
    await billForm.getByRole('button', { name: 'Confirm' }).click();

    // Capture the browser's native validation message as evidence
    const nativeMsg = await billAmount.evaluate(el => el.validationMessage);
    await testInfo.attach('native-validation-message', {
        body: nativeMsg,
        contentType: 'text/plain',
    });

    // Expected: system error message (soft: the post-condition is still checked if this fails)
    await expect.soft(page.getByText('Invalid balance amount. Please enter a valid number.')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();
});

test('TC6.2: Decimal value Bill Amount', async ({ page }, testInfo) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000 (setup)
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Pay bill: Electric Charge (BT2), decimal amount 10.5 (BA2)
    const billForm = page.locator('form').filter({ hasText: 'Water ChargeElectric' });
    const billAmount = billForm.getByPlaceholder('Please fill amount');

    await billForm.getByRole('radio').nth(1).check();
    await billAmount.fill('10.5');
    await billForm.getByRole('button', { name: 'Confirm' }).click();

    // Capture the browser's native validation message as evidence
    const nativeMsg = await billAmount.evaluate(el => el.validationMessage);
    await testInfo.attach('native-validation-message', {
        body: nativeMsg,
        contentType: 'text/plain',
    });

    // Expected: system error message, balance unchanged
    await expect.soft(page.getByText('The balance amount must be a whole number with no decimals.')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();
});

test('TC6.3: Negative value Bill Amount', async ({ page }) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000 (setup)
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Pay bill: Phone Charge (BT3), negative amount -200 (BA3)
    const billForm = page.locator('form').filter({ hasText: 'Water ChargeElectric' });

    await billForm.getByRole('radio').nth(2).check();
    await billForm.getByPlaceholder('Please fill amount').fill('-200');
    await billForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText('The amount must be greater than 0. Please enter a positive number.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();
});

test('TC6.4: Bill Amount greater than the current Balance', async ({ page }) => {
    const acc = uniqueAccountNumber();
    await registerUser(page, acc, '1234');
    await login(page, acc, '1234');

    const amountInputs = page.getByRole('spinbutton', { name: 'Please put your amount:' });
    const confirmButtons = page.getByRole('button', { name: 'Confirm' });

    // Deposit 1000 (setup)
    await amountInputs.first().fill('1000');
    await confirmButtons.first().click();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();

    // Pay bill: Water Charge (BT1), amount 5000 (BA4)
    const billForm = page.locator('form').filter({ hasText: 'Water ChargeElectric' });

    await billForm.getByRole('radio').first().check();
    await billForm.getByPlaceholder('Please fill amount').fill('5000');
    await billForm.getByRole('button', { name: 'Confirm' }).click();

    // Expected: error message, balance unchanged
    await expect(page.getByText('Your balance is not enough to complete the bill payment.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '1000', exact: true })).toBeVisible();
});