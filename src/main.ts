import { KindleService, NotionService } from "./services";
import { writeToFile } from "./utils";

async function run() {
  console.log("Start running...");
  const kindle = new KindleService();
  const booksHighlights = await kindle.scrapeBooksHighlights();
  await kindle.destroy();

  writeToFile(booksHighlights, "books-highlights.json", "data");

  const notion = new NotionService();
  await notion.syncKindleBooks(booksHighlights, {
    pageId: process.env.NOTION_KINDLE_PAGE_ID, // create a new database on this page
    dbId: process.env.NOTION_KINDLE_DB_ID, // sync to an existing database
  });

  process.exit(0);
}

run();
