export type KindleCredentials = {
  url: string;
  email: string;
  password: string;
}

export type NotionCredentials = {
  apiKey: string;
  kindleDBId?: string
}

export type ConfigCredentials = {
  kindle: KindleCredentials;
  notion: NotionCredentials;
}
