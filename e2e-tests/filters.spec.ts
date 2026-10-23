import { test, expect } from '@playwright/test';

test.describe('Filtrowanie gier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Filtry - pokazuje wszystkie gry domyślnie', async ({ page }) => {
    const cards = page.getByTestId('game-card');
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    await expect(page.getByTestId('filter-result-count')).toHaveText(`Wyświetlono ${total} z ${total} gier`);
  });

  test('Filtry - kategoria zawęża listę do wybranej kategorii', async ({ page }) => {
    const checkbox = page.getByRole('group', { name: 'Kategorie' }).getByRole('checkbox').first();
    const name = (await page.getByRole('group', { name: 'Kategorie' }).locator('label').first().textContent())?.trim() ?? '';

    await test.step('wybierz kategorię', async () => {
      await checkbox.check();
    });

    await test.step('widoczne są tylko gry z tej kategorii', async () => {
      const visible = page.getByTestId('game-card').filter({ visible: true });
      const count = await visible.count();
      expect(count).toBeGreaterThan(0);
      await expect(visible.getByTestId('game-category')).toHaveText(Array(count).fill(name));
    });
  });

  test('Filtry - wiele kategorii poszerza wynik', async ({ page }) => {
    const checkboxes = page.getByRole('group', { name: 'Kategorie' }).getByRole('checkbox');
    await checkboxes.nth(0).check();
    const visible = page.getByTestId('game-card').filter({ visible: true });
    const first = await visible.count();

    await checkboxes.nth(1).check();
    await expect.poll(() => visible.count()).toBeGreaterThan(first);
  });

  test('Filtry - wydawca zawęża listę do wybranego wydawcy', async ({ page }) => {
    const select = page.getByLabel('Wydawca');
    const name = (await select.locator('option').nth(1).textContent())?.trim() ?? '';
    await select.selectOption({ label: name });

    const visible = page.getByTestId('game-card').filter({ visible: true });
    const count = await visible.count();
    expect(count).toBeGreaterThan(0);
    await expect(visible.getByTestId('game-publisher')).toHaveText(Array(count).fill(name));
  });

  test('Filtry - kategoria i wydawca są łączone, a reset przywraca listę', async ({ page }) => {
    const total = await page.getByTestId('game-card').count();
    const checkboxes = page.getByRole('group', { name: 'Kategorie' }).getByRole('checkbox');
    const select = page.getByLabel('Wydawca');

    await test.step('zastosuj oba filtry', async () => {
      await checkboxes.first().check();
      await select.selectOption({ index: 1 });
      const visible = await page.getByTestId('game-card').filter({ visible: true }).count();
      expect(visible).toBeLessThan(total);
    });

    await test.step('wyczyść filtry', async () => {
      await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
      await expect(page.getByTestId('filter-result-count')).toHaveText(`Wyświetlono ${total} z ${total} gier`);
      await expect(checkboxes.first()).not.toBeChecked();
    });
  });

  test('Filtry - pokazuje komunikat, gdy żadna gra nie pasuje', async ({ page }) => {
    const select = page.getByLabel('Wydawca');

    await test.step('wybierz wydawcę bez gier', async () => {
      // Dane przykładowe nie zawierają pustej kombinacji, więc dodajemy wydawcę bez gier.
      await select.evaluate((el: HTMLSelectElement) => {
        el.add(new Option('Wydawca bez gier', '999999'));
        el.value = '999999';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    await test.step('widoczny jest komunikat o braku wyników', async () => {
      await expect(page.getByTestId('empty-state-text')).toHaveText('Żadna gra nie spełnia wybranych filtrów.');
      await expect(page.getByTestId('filter-result-count')).toContainText('Wyświetlono 0 z');
      await expect(page.getByTestId('games-grid')).toBeHidden();
    });
  });

  test('Filtry - działają z klawiatury i mają widoczny fokus', async ({ page }) => {
    const checkbox = page.getByRole('group', { name: 'Kategorie' }).getByRole('checkbox').first();
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toHaveClass(/focus:ring-2/);
  });
});
