import { Browser } from "puppeteer-core";

import {
  createPdf,
  launchBrowser,
  processPageContent,
} from "./utils";

import ejs from "ejs";

import { PuppeteerRequest, PuppeteerResponse } from "./types/types";

export const handler = async (event: PuppeteerRequest): Promise<PuppeteerResponse> => {
  const { template, data } = event;

  let browser: Browser | null = null;

  try {
    const html = ejs.render(template, data);

    browser = await launchBrowser();

    const page = await browser.newPage();

    await processPageContent(page, html);

    const pdf = await createPdf(
      page,
    );
    
    return {
      success: true,
      result: pdf,
    }
  } catch (error) {
    console.log({ error })
    return {
      success: false,
      result: undefined,
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
