import * as puppeteer from "puppeteer";
import { KindleCredentials } from "../types";
import { PuppeteerAdapter } from "../adapters/puppeteer";
import { CredentialService } from "./credential";

const MAX_RETRY = 5;
const MAX_TIMEOUT = 10_000;

const waitOptions = { timeout: MAX_TIMEOUT };

export class KindleService {
  private puppeteer;
  private credentials: KindleCredentials;
  private notebooksPage: puppeteer.Page | null;
  private notebooksPageLoading: Promise<void> | null = null;

  constructor(credentials?: { email: string; password: string; url: string }) {
    if (credentials) {
      this.credentials = credentials;
    } else {
      const config = CredentialService.getInstance();
      this.credentials = config.getKindleCredentials();
    }

    this.puppeteer = new PuppeteerAdapter();
    this.notebooksPage = null;
    this.notebooksPageLoading = this.goToNotebooksPage();
  }

  private login = async (
    email: string,
    password: string,
    url: string = "https://read.amazon.com/kp/notebook"
  ) => {
    const browser = this.puppeteer;

    let page = await browser.goToPage(url);
    let emailInput: puppeteer.ElementHandle<Element> | null = null;
    while (!emailInput) {
      try {
        await page.waitForSelector("#ap_email", { timeout: 1_000 });
        emailInput = await page.$("#ap_email");
        break;
      } catch {
        page = await browser.goToPage(url, page);
      }
    }

    await page.type("#ap_email", email);
    await page.type("#ap_password", password);
    await page.click("#signInSubmit");

    console.log("logged in to Kindle");
    return page;
  };

  private goToNotebooksPage = async () => {
    const { url, email, password } = this.credentials;

    let arrived = false;
    let page = this.notebooksPage || (await this.login(email, password, url));
    do {
      try {
        await page.waitForSelector("#kp-notebook-library", waitOptions);
        this.notebooksPage = page;
        console.log("arrived at notebooks page");
        arrived = true;
      } catch {
        page = await this.login(email, password, url);
        console.log("retrying to arrive at notebooks page");
      }
    } while (!arrived);
  };

  getNotebooksPage = async (
    force: boolean = false
  ): Promise<puppeteer.Page> => {
    if (this.notebooksPageLoading) {
      await this.notebooksPageLoading;
      this.notebooksPageLoading = null;
    }

    if (force || !this.notebooksPage) {
      this.notebooksPageLoading = this.goToNotebooksPage();
    }

    return this.notebooksPage!;
  };

  closeNotebooksPage = async () => {
    if (this.notebooksPage) {
      await this.puppeteer.closePage(this.notebooksPage);
      this.notebooksPage = null;
    }

    if (this.notebooksPageLoading) {
      this.notebooksPageLoading = null;
    }
  };

  destroy = async () => {
    if (this.notebooksPage) {
      await this.puppeteer.closePage(this.notebooksPage);
    }

    if (this.puppeteer) {
      // await this.puppeteer.closeBrowser(); // don't close the browser if multiple services are using it
    }
  };

  scrapeBooksInfo = async () => {
    const page = await this.getNotebooksPage();
    await page.waitForSelector("#kp-notebook-library", waitOptions); // sidebar

    const books = await page.$$(".kp-notebook-library-each-book");
    const promises = books.map(async (book) => {
      const info = await book.$$eval(".kp-notebook-searchable", (els) =>
        els.map((el) => el.textContent)
      );

      const [title] = info.filter((t) => !t?.includes("By: "));
      const author = info.find((t) => t?.includes("By: "))?.replace("By: ", "");
      const cover = await book.$eval(".kp-notebook-cover-image", (node) =>
        node.getAttribute("src")
      );

      console.log(title, author, cover);
      if (title && author && cover) {
        return { title, author, cover_url: cover };
      }
      return null;
    });

    const booksInfo = await Promise.all(promises);
    const booksMap: { [title: string]: { author: string; cover_url: string } } =
      {};
    booksInfo.forEach((b) => {
      if (b) {
        booksMap[b.title] = { author: b.author, cover_url: b.cover_url };
      }
    });

    console.log({ booksMap });
    return booksMap;
  };

  scrapeHighlights = async (bookTitle: string) => {
    const page = await this.getNotebooksPage();
    await page.waitForSelector("#kp-notebook-library", waitOptions); // sidebar

    const books = await page.$$(".kp-notebook-library-each-book");
    const book = books.find(async (b) => {
      const info = await b.$$eval(".kp-notebook-searchable", (els) =>
        els.map((el) => el.textContent)
      );
      const [title] = info.filter((t) => !t?.includes("By: "));
      return title === bookTitle;
    });

    if (!book) {
      throw new Error(`Book with title ${bookTitle} not found`);
    }

    await book.click();
    await page.waitForSelector(
      ".kp-notebook-annotations-container",
      waitOptions
    );

    const highlights = await page.$$eval(
      ".kp-notebook-annotations-container .kp-notebook-highlight",
      (els) => els.map((el) => el.textContent)
    );

    return highlights;
  };

  scrapeBooksHighlights = async () => {
    const page = await this.getNotebooksPage();
    await page.waitForSelector("#kp-notebook-library", waitOptions); // sidebar

    const books = await page.$$(".kp-notebook-library-each-book");
    console.log("total book(s):", books.length);

    let booksHighlights: any[] = [];
    let count = 0;
    for (let book of books) {
      console.log("scraping book", ++count, "of", books.length);
      if (!book?.click) {
        continue;
      }

      let bookHighlights;
      for (let i = 0; i < MAX_RETRY; i++) {
        try {
          await book.click();
          await page.waitForSelector("#annotation-section", waitOptions);
          bookHighlights = await KindleService.parseBooksHighlights(page);
          booksHighlights.push(bookHighlights);
          break;
        } catch {
          console.log("retrying...");
        }
      }
    }

    return booksHighlights;
  };

  static parseBooksHighlights = async (page: puppeteer.Page) => {
    await page.waitForSelector("#annotation-section", waitOptions);

    // book
    await page.waitForSelector(
      "#annotation-scroller > div > div.a-row.a-spacing-base"
    );
    const bookInfo = await page.$eval(
      "#annotation-scroller > div > div.a-row.a-spacing-base",
      (el) => {
        const title =
          el.querySelector("h3.kp-notebook-selectable.kp-notebook-metadata")
            ?.textContent || "";

        const author =
          el.querySelector(
            "p.a-color-secondary.kp-notebook-selectable.kp-notebook-metadata"
          )?.textContent || "";

        const url =
          el.querySelector("a.kp-notebook-printable")?.getAttribute("href") ||
          "";

        const cover =
          el
            .querySelector("img.kp-notebook-cover-image-border")
            ?.getAttribute("src") || "";

        const annotated =
          el.querySelector("#kp-notebook-annotated-date")?.textContent || "";

        return { title, author, url, cover, annotated };
      }
    );
    // console.log({ bookInfo });

    // count
    const highlightsCount = +(
      (await page.$eval(
        "#kp-notebook-highlights-count",
        (el) => el.textContent
      )) || 0
    );

    const notesCount = +(
      (await page.$eval("#kp-notebook-notes-count", (el) => el.textContent)) ||
      0
    );

    if (highlightsCount === 0 && notesCount === 0) {
      return {
        ...bookInfo,
        annotationsCount: { highlightsCount, notesCount },
        annotations: [],
      };
    }

    // annotations
    await page.waitForSelector(".kp-notebook-print-override");
    // highlight, note
    const highlightPromises = page.$$eval(
      ".kp-notebook-print-override",
      (els) => {
        return els.map((el) => {
          const highlight = el.querySelector("#highlight")?.textContent;
          const note = el.querySelector("#note")?.textContent;
          return { highlight, note };
        });
      }
    );

    // color, page
    const metaPromises = await page.$$eval(
      "#annotationHighlightHeader",
      (els) =>
        els.map((el) => {
          let meta = el.textContent;

          if (!meta) {
            meta = "Yellow highlight | Page: 0";
          }

          const color = meta.split(" highlight")[0].trim();
          const page = meta.includes("Page") ? +meta.split("Page:")[1].replace(',', '') : 0;
          const location = meta.includes("Location")
            ? +meta.split("Location:")[1].replace(',', '')
            : 0;

          return { color, page, location };
        })
    );

    const [highlights, metas] = await Promise.all([
      highlightPromises,
      metaPromises,
    ]);

    const highlightsWithMeta = highlights.map((highlight, i) => {
      return { ...highlight, ...metas[i] };
    });

    // console.log({ highlightsWithMeta });

    return {
      ...bookInfo,
      annotationsCount: { highlightsCount, notesCount },
      annotations: highlightsWithMeta,
    };
  };
}
