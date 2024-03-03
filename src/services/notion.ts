import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type { KindleBook, DatabaseProperties } from "../types";
import { kindle2Notion } from "../types/transformer/kindle-notion";
import { NotionAdapter } from "../adapters";
import { kindleDatabaseProperties } from "../constants/kindle-notion";
import _get from "lodash/get";

export class NotionService {
  private notion: NotionAdapter;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.notion = new NotionAdapter(apiKey);
    } else {
      this.notion = new NotionAdapter();
    }
  }

  private async createDatabasePage(
    parentDbId: string,
    dbPage: Partial<CreatePageParameters>
  ) {
    const blocks = structuredClone(dbPage.children) || [];

    const newPage = await this.notion.createPage({
      parent: { database_id: parentDbId },
      icon: dbPage.icon,
      cover: dbPage.cover,
      properties: dbPage.properties!,
      children: blocks.splice(0, 100),
    });

    const pageId = newPage.id;
    while (blocks.length > 0) {
      await this.notion.appendBlockChildren(pageId, blocks.splice(0, 100));
    }
  }

  private async updateDatabasePage(
    parentDbId: string,
    oldPageId: string,
    dbPage: Partial<CreatePageParameters>
  ) {
    /* Method 1: Delete old page and re-create */
    await this.notion.deletePage(oldPageId);
    await this.createDatabasePage(parentDbId, dbPage);

    /* Method 2: Delete all blocks and re-create */
    // error while deleting blocks
    // const oldBlocks = await this.notion.getBlockChildren(pageId);
    // const oldBlockIds = oldBlocks.results.map(b => b.id);
    // const deleteBlockPromises = oldBlockIds.map(id => this.notion.deleteBlock(id));
    // for (const p of deleteBlockPromises) {
    //   try { await p; } catch { }
    // }

    // await this.notion.updatePageProperties(pageId, dbPage.properties!);
    // await this.notion.appendBlockChildren(pageId, dbPage.children!);
  }

  async syncKindleBooks(
    books: KindleBook[],
    target: { pageId?: string; dbId?: string }
  ) {
    if (!target.pageId && !target.dbId) {
      throw new Error("No target specified");
    }

    console.log({ pageId: target.pageId, dbId: target.dbId });

    let dbId;
    let db;
    let dbProperties: DatabaseProperties = {};
    let dbPagesMap: {
      [title: string]: { pageId: string; pageProperties?: any };
    } = {};
    if (target.dbId) {
      const oldDb = await this.notion.getDatabase(target.dbId);
      db = oldDb;
      dbId = oldDb.id;
      dbProperties = oldDb.properties;

      const pages = await this.notion.queryDatabase({
        database_id: target.dbId,
      });
      for (const page of pages.results) {
        if (page.object === "page") {
          const title = _get(
            page,
            "properties.Title.title[0].text.content",
            ""
          );
          if (title) {
            dbPagesMap[title] = {
              pageId: page.id,
              pageProperties: _get(page, "properties"),
            };
          }
        }
      }

      console.log("sync to existing db...");
    } else if (target.pageId && !target.dbId) {
      const newDB = await this.notion.createDatabase(
        target.pageId,
        kindleDatabaseProperties
      );
      db = newDB;
      dbId = newDB.id;
      dbProperties = newDB.properties;
      console.log("sync to new db...");
    }

    try {
      const notionFactory = (book: KindleBook) =>
        kindle2Notion(dbProperties, book);
      const dbPages = books.map(notionFactory);
      // console.log(dbPages);

      for (const dbPage of dbPages) {
        try {
          const { title } = dbPage;

          if (Object.keys(dbPagesMap).includes(title)) {
            console.log("Updating page", title);

            const { pageId } = dbPagesMap[title];
            await this.updateDatabasePage(dbId!, pageId, dbPage);
          } else {
            console.log("Creating page", title);

            await this.createDatabasePage(dbId!, dbPage);
          }
        } catch {
          break;
        }
      }
      console.log("Synced Kindle books to Notion");
    } catch (e: unknown) {
      console.error(e);
      // console.error((e as Error).message);
      // Rollback
      if (target.pageId) {
        await this.notion.deleteDatabase(dbId!);
      }
    }
  }
}
