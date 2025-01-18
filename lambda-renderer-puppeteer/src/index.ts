import { Browser } from "puppeteer-core";

import { createPdf, launchBrowser, processPageContent } from "./utils";

import ejs from "ejs";

import { PuppeteerResponse } from "./types/types";

export const handler = async (event: {
  body: any;
}): Promise<PuppeteerResponse> => {
  const { template, data } = JSON.parse(event.body);

  let browser: Browser | null = null;

  const requestReceivedTime = Date.now();

  try {
    const html = ejs.render(template, data);

    browser = await launchBrowser();

    const page = await browser.newPage();

    await processPageContent(page, html);

    const pdfGenerationStartTime = Date.now();

    const pdf = await createPdf(page);

    const pdfGenerationEndTime = Date.now();

    const pdfGenerationTime = (pdfGenerationEndTime - pdfGenerationStartTime) / 1000;
    const requestProcessedTime = (Date.now() - requestReceivedTime) / 1000; 

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf: pdf.toString("base64"),
        requestProcessedTime: requestProcessedTime.toFixed(2),
        pdfGenerationTime: pdfGenerationTime.toFixed(2),
      }),
    };
  } catch (error) {
    console.log({ error });
    return {
      statusCode: 500,
      headers: { "Content-type": "application/json" },
      body: "ERROR: Could not create PDF",
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
