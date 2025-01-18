import { Page, PDFOptions } from "puppeteer-core";
import _ from "lodash";

import chromium from "@sparticuz/chromium";
import puppeteer, { Browser } from "puppeteer-core";

import { config } from "./consts";

export const createPdf = async (
  page: Page,
) => {
  const formatOpts: PDFOptions = {
    format: 'a4',
    printBackground: true,
  }

  const pdf = await page.pdf(formatOpts);

  return pdf;
};

export const getChromiumArgs = () => {
  const args = chromium.args.slice();
  args.push(
    "--disable-software-rasterizer",
    "--disable-web-security",
    "--disable-gpu"
  );
  return args;
};

export const launchBrowser = async (): Promise<Browser> => {
  const args = getChromiumArgs();
  const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";
  const browserArgs = {
    args,
    defaultViewport: chromium.defaultViewport,
    executablePath: process.env.AWS_EXECUTION_ENV
      ? await chromium.executablePath(
          "/opt/nodejs/node_modules/@sparticuz/chromium/bin"
        )
      : chromePath,
    headless: true,
    ignoreHTTPSErrors: true,
    printBackground: true,
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

export const handleError = async (
  error: any
) => {
  console.error({ error });
};

export const processPageContent = async (page: Page, html: string) => {
  await page.setContent(html);
  await page.setViewport({
    width: Math.round(config.metrics.a4Width),
    height: Math.round(config.metrics.a4Height),
  });
};
