require("dotenv").config();
import { ConfigCredentials } from "../types";
import { readFromFile } from "../utils";

export class CredentialService {
  private config: ConfigCredentials;

  constructor() {
    this.config = {
      kindle: {
        url:
          (process.env.KINDLE_URL as string) ||
          "https://read.amazon.com/notebook",
        email: process.env.KINDLE_EMAIL as string,
        password: process.env.KINDLE_PASSWORD as string,
      },
      notion: {
        apiKey: process.env.NOTION_API_KEY as string,
        kindleDBId: process.env.NOTION_KINDLE_DB_ID as string,
      },
    };
  }

  private static instance: CredentialService;
  public static getInstance(): CredentialService {
    if (!CredentialService.instance) {
      CredentialService.instance = new CredentialService();
    }
    return CredentialService.instance;
  }

  getKindleCredentials = () => this.config.kindle;
  getNotionCredentials = () => this.config.notion;

  getFromData = () => readFromFile("credentials.json", "data");
}
