import { NotionAdapter } from "../adapters";
import { kindleDatabaseProperties } from "../constants/kindle-notion";
import { KindleBook } from "../types";
import { DatabaseProperties } from "../types/notion";
import { kindle2Notion } from "../types/transformer/kindle-notion";
import { readFromFile } from "../utils";
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
            /* Method 1: Delete old page and re-create */
            await this.notion.deletePage(pageId);
            await this.notion.createPage({
              parent: { database_id: dbId! },
              icon: dbPage.icon,
              cover: dbPage.cover,
              properties: dbPage.properties!,
              children: dbPage.children,
            });

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
          } else {
            console.log("Creating page", title);

            await this.notion.createPage({
              parent: { database_id: dbId! },
              properties: dbPage.properties!,
              children: dbPage.children,
            });
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

async function test() {
  const notion = new NotionAdapter();

  // const pageId = "83fa45f349684832bb514d8d558c7745"; // target
  // const newDB = await notion.createDatabase(pageId, KindleDabaseProperties, {
  //   dbName: "Books",
  //   iconUrl: "https://www.notion.so/favicon.ico",
  //   // coverUrl: "https://www.notion.so/favicon.ico",
  //   description: "Database for Kindle highlights"
  // });

  // const dbId = "752b3fe869524829a236f7562f921f4a"; // target
  const dbId = "afeb258e43054c399ecc70f261e424e1"; // readwise
  const pageId = "c5c0bdf864cc40a5b6928c2d86b74326"; // page item in database

  // const response = await notion.queryDatabase({ database_id: dbId })
  // const response = await notion.getDatabase(dbId);
  // const response = await notion.updateDatabaseProperties(dbId, KindleDabaseProperties)
  // const response = await notion.getPage(pageId)
  const response = await notion.getBlockChildren(pageId);
  console.log(response);
}
// test()

async function test1() {
  const notion = new NotionService();
  const pageId = "83fa45f349684832bb514d8d558c7745"; // target
  const booksAnnotations: KindleBook[] = JSON.parse(
    readFromFile("books-highlights.json", "data")
  );

  await notion.syncKindleBooks(booksAnnotations, { pageId });
}

// test1();
