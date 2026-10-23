import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesFiltered,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategia', description: 'kat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Wydawca Jeden', description: 'wyd' })
        .returning({ id: publishers.id });

    // Wstawiamy tytuły w odwrotnej kolejności alfabetycznej, żeby sprawdzić sortowanie.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Gra ${String(i).padStart(2, '0')}`,
            description: `Opis ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('helpery dostępu do danych o grach', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('zwraca wszystkie gry posortowane po tytule', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Gra 01', 'Gra 02', 'Gra 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategia' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Wydawca Jeden' });
    });

    it('zwraca identyfikatory wszystkich gier posortowane po tytule', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('pobiera pojedynczą grę po id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Gra 01');
    });

    it('zwraca null dla nieistniejącej gry', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});

describe('filtrowanie gier', () => {
    let db: Database;
    let ids: { kat: Record<string, number>; wyd: Record<string, number> };

    beforeEach(async () => {
        db = await createTestDatabase();
        const kat: Record<string, number> = {};
        const wyd: Record<string, number> = {};
        for (const name of ['Strategia', 'Platformówka', 'Zagadki']) {
            const [row] = await db.insert(categories).values({ name }).returning({ id: categories.id });
            kat[name] = row.id;
        }
        for (const name of ['Wydawca B', 'Wydawca A']) {
            const [row] = await db.insert(publishers).values({ name }).returning({ id: publishers.id });
            wyd[name] = row.id;
        }
        const rows: [string, string, string][] = [
            ['Gra 1', 'Strategia', 'Wydawca A'],
            ['Gra 2', 'Strategia', 'Wydawca B'],
            ['Gra 3', 'Platformówka', 'Wydawca A'],
            ['Gra 4', 'Zagadki', 'Wydawca B'],
        ];
        for (const [title, k, w] of rows) {
            await db.insert(games).values({
                title,
                description: 'Opis',
                categoryId: kat[k],
                publisherId: wyd[w],
            });
        }
        ids = { kat, wyd };
    });

    const titles = async (filters?: Parameters<typeof getGamesFiltered>[1]): Promise<string[]> =>
        (await getGamesFiltered(db, filters)).map((g) => g.title);

    it('zwraca wszystkie gry bez filtrów', async () => {
        expect(await titles()).toEqual(['Gra 1', 'Gra 2', 'Gra 3', 'Gra 4']);
        expect(await titles({ categoryIds: [] })).toHaveLength(4);
    });

    it('filtruje po jednej kategorii', async () => {
        expect(await titles({ categoryIds: [ids.kat['Strategia']] })).toEqual(['Gra 1', 'Gra 2']);
    });

    it('filtruje po wielu kategoriach (OR)', async () => {
        const result = await titles({ categoryIds: [ids.kat['Strategia'], ids.kat['Zagadki']] });
        expect(result).toEqual(['Gra 1', 'Gra 2', 'Gra 4']);
    });

    it('filtruje po wydawcy', async () => {
        expect(await titles({ publisherId: ids.wyd['Wydawca A'] })).toEqual(['Gra 1', 'Gra 3']);
    });

    it('łączy filtry kategorii i wydawcy (AND)', async () => {
        const result = await titles({
            categoryIds: [ids.kat['Strategia']],
            publisherId: ids.wyd['Wydawca B'],
        });
        expect(result).toEqual(['Gra 2']);
    });

    it('zwraca pustą listę, gdy nic nie pasuje', async () => {
        const result = await titles({
            categoryIds: [ids.kat['Zagadki']],
            publisherId: ids.wyd['Wydawca A'],
        });
        expect(result).toEqual([]);
    });

    it('zwraca kategorie i wydawców posortowanych po nazwie', async () => {
        expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Platformówka', 'Strategia', 'Zagadki']);
        expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Wydawca A', 'Wydawca B']);
    });
});
