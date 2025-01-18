import puppeteer, { Browser, Page, PDFOptions } from "puppeteer";
import { config } from "./consts";

export const createPdf = async (page: Page) => {
  const formatOpts: PDFOptions = {
    format: "a4",
    printBackground: true,
  };

  const pdf = await page.pdf(formatOpts);

  return pdf;
};

export const getChromiumArgs = () => {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-software-rasterizer",
    "--disable-web-security",
    "--disable-gpu",
  ];
};

export const launchBrowser = async (): Promise<Browser> => {
  const args = getChromiumArgs();
  const browserArgs = {
    executablePath: "/usr/bin/chromium",
    args,
    headless: true,
    ignoreHTTPSErrors: true,
  };

  return puppeteer.launch(browserArgs);
};

export const calculateTotalPages = async (page: Page) => {
  return page.evaluate(() => {
    const pageHeight = window.innerHeight;
    const documentHeight = document.body.scrollHeight;

    return Math.ceil(documentHeight / pageHeight);
  });
};

export const handleError = async (error: any) => {
  console.error({ error });
};

export const processPageContent = async (page: Page, html: string) => {
  await page.setContent(html);
  await page.setViewport({
    width: Math.round(config.metrics.a4Width),
    height: Math.round(config.metrics.a4Height),
  });
};
