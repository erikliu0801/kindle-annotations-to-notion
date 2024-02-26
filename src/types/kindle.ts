export type KindleBookAnnotation = {
  highlight: string
  note: string
  color: string
  page: number
  location: number
}

export type KindleBook = {
  title: string;
  author: string;
  url: string;
  cover: string;

  annotated: string;
  annotationsCount: { highlightsCount: number, notesCount: number }
  annotations: Array<KindleBookAnnotation>
}

export type KindleDatabasePropertyItem = {
  id: string
  name: string
  type: "title" | "rich_text" | "number" | "date" | "url";
  // data:
}
