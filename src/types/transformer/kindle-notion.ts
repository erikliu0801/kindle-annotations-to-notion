// type
import type { KindleBook, KindleBookAnnotation } from "../kindle";
import type { DatabaseProperties } from "../notion";
import type {
  CreatePageParameters,
  BlockObjectRequest,
} from "@notionhq/client/build/src/api-endpoints";
// utils
import _get from "lodash/get";

const kindleBook2NotionProperties = (
  properties: DatabaseProperties,
  book: KindleBook
): CreatePageParameters["properties"] => {
  let params: CreatePageParameters["properties"] = {
    Title: {
      title: [{ type: "text", text: { content: book.title, link: null } }],
    },
    URL: { url: book.url },
    Author: {
      rich_text: [{ type: "text", text: { content: book.author, link: null } }],
    },
    "Full Title": {
      rich_text: [{ type: "text", text: { content: book.title, link: null } }],
    },
    Highlights: { number: book.annotationsCount.highlightsCount },
    "Last Synced": { date: { start: new Date().toISOString() } },
  };

  const options = _get(properties, "Category.select.options", []) as {
    id: string;
    name: string;
  }[];
  const categoryBookId = options.find((op) => op.name === "Books")?.id;
  if (categoryBookId) {
    params["Category"] = { select: { id: categoryBookId } };
  }

  return params;
};
const kindleBookAnnotation2NotionBlock = (
  annotation: KindleBookAnnotation
): BlockObjectRequest[] => {
  let blocks = [];

  const blockFactory = (content: string): BlockObjectRequest => ({
    type: "paragraph",
    paragraph: {
      rich_text: [{ text: { content, link: null } }],
    },
  });

  // highlight
  const placeText = annotation.page
    ? `Page ${annotation.page}`
    : `Location ${annotation.location}`;
  const highlightText = annotation.highlight + "(" + placeText + ")";
  blocks.push(blockFactory(highlightText));

  if (annotation.note) {
    blocks.push(blockFactory(annotation.note));
  }

  blocks.push(blockFactory(""));
  return blocks;
};

export const kindle2Notion = (
  properties: DatabaseProperties,
  book: KindleBook
): Partial<CreatePageParameters> & { title: string } => ({
  title: book.title,
  icon: { type: "external", external: { url: book.cover } },
  cover: { type: "external", external: { url: book.cover } },
  properties: kindleBook2NotionProperties(properties, book),
  children: Array.from(book.annotations || [])
    .map(kindleBookAnnotation2NotionBlock)
    .flat(),
});
