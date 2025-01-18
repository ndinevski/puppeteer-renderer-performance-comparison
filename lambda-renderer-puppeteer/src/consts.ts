import dotenv from "dotenv";
dotenv.config();

export const config = {
  metrics: {
    a4Width: 210 * 3.779528,
    a4Height: 280 * 3.779528,
  },
};

export const pdfOptionsParams = [
  "displayHeaderFooter",
  "footerTemplate",
  "format",
  "headerTemplate",
  "height",
  "landscape",
  "margin",
  "omitBackground",
  "outline",
  "pageRanges",
  "path",
  "preferCSSPageSize",
  "printBackground",
  "scale",
  "tagged",
  "timeout",
  "waitForFonts",
  "width",
];
