import express from "express";
import { Browser } from "puppeteer";
import ejs from "ejs";

import { createPdf, launchBrowser, processPageContent } from "./utils";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post("/generate-pdf", async (req, res) => {
  const { template, data } = req.body;

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

    const pdfGenerationTime =
      (pdfGenerationEndTime - pdfGenerationStartTime) / 1000;
    const requestProcessedTime = (Date.now() - requestReceivedTime) / 1000;

    res.status(200).json({
      pdf: Buffer.from(pdf).toString("base64"),
      requestProcessedTime: requestProcessedTime.toFixed(2),
      pdfGenerationTime: pdfGenerationTime.toFixed(2),
    });
  } catch (error) {
    console.log({ error });
    res.status(500).json({
      error: "ERROR: Could not create PDF",
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
