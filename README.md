# Sync Kindle Annotations to Notion with Headless Scraping (puppeteer)

Hi there! This is a simple project to sync your Kindle annotations to Notion. It uses `puppeteer` to scrape the Kindle notebook page and official `notion-api-client` to interact with Notion API.

## Why this project

I believe there are already many similar projects out there, but I still want to create my own version for the following reasons:

- All of them (incl. Readwise) only support single account and the USA version of Kindle (Amazon.com), but I have serveral accounts in different regions, and I want to sync all of them to Notion.
- Most of them use `clippings.txt` to sync or `selenium` to scrape the Kindle, which is trivial. So I want to use `puppeteer` to improve performance.
- I want to use `typescript` to write this project, which is more readable and maintainable.
- The temporary json file is used to store the data folder, which is more flexible and easy to debug. Even though you don't have to sync kindle annotations to notion, you can still use the json file to store your annotations. That means you can store into every database you want, not only notion. (By this way, you can write a type transformer to easily make it compatible with other databases.)
- I want to use the official `notion-api-client` to interact with Notion API, which is more stable and reliable. And I made the synced data in Notion absolutely follow the type of Readwise, we can directly indicate the Database ID which is created by Readwise.

## How to use

### Step 1. Create a new Notion API key and copy that.

Go to [Notion Integrations](https://www.notion.so/my-integrations) and create a new integration.
![](/images/notion-integration.png)

### Step 2. Create a new Notion database and copy the database id.

You can use the database id created by Readwise.
Alternatively, you can also copy the page id of the new database you will creat.
Both of them need to connect the integration you created in step 1.

### Step 3. Clone this project and setup the environment.

After cloning this project, you need to copy the `.env.example` to `.env` and fill in the `NOTION_API_KEY` and `NOTION_KINDLE_DB_ID` (or `NOTION_KINDLE_PAGE_ID`) with the values you got in step 1 and step 2.

### Step 4. Fill out the Kindle account in `.env`

You need to fill out the `KINDLE_EMAIL` and `KINDLE_PASSWORD` in `.env` to login to your Kindle account.
If you want to sync USA version, then keep `KINDLE_URL` as default.
Otherwise, you need to change the `KINDLE_URL` to the corresponding region. Following are the regions I know:

- `https://read.amazon.co.jp/kp/notebook` for Japan
- `https://lesen.amazon.de/kp/notebook` for Germany
- `https://lire.amazon.fr/kp/notebook` for France

Optionally, you can also fill out the `PUPPETEER_HEADLESS` as true in `.env` to show the browser when scraping. In this way, you can see the scraping process and solve the CAPTCHA if needed. Don't worry, after CAPTCHA is solved, the scraping process will continue automatically.

### Step 5. Run the project

Run the following command to install the dependencies and run the project.

```bash
sh install.sh # if first time
sh run.sh
```

### Step 6. Check the Notion database

You should see the synced data in the Notion database you created.
If you got any problem, you can check the json file in the `data` folder to debug. Or you can open an issue to ask for help.

## Reference

- [kindle_notion_syncer](https://github.com/lg08/kindle_notion_syncer)
  mainly refer to the scraping logic (kindle notebooks page) of this project, but use `puppeteer` instead of `selenium` to improve performance

- [kindle-to-notion](https://github.com/arkalim/kindle-to-notion)
  mainly refer to the interface, adapter and partial structure design of this project
