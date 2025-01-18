import axios from "axios";
import fs from "fs";
import { readHtml, readJsonFile } from "./utils";

const LAMBDA_URL =
  "https://2xxdayczg5.execute-api.eu-west-1.amazonaws.com/default/puppeteer-renderer-lambda";
const template = readHtml("./data/template.ejs");
const data = readJsonFile("./data/data.json");

async function generateDocuments(): Promise<any> {
  try {
    const lambdaGeneratedResponse = await axios.post(LAMBDA_URL, {
      template,
      data,
    });

    return {
      lambdaGeneratedPdf: {
        pdf: lambdaGeneratedResponse.data.pdf,
        requestProcessedTime: lambdaGeneratedResponse.data.requestProcessedTime,
        pdfGenerationTime: lambdaGeneratedResponse.data.pdfGenerationTime,
      },
    };
  } catch (error) {
    console.error("Error generating document:", error);
    throw error;
  }
}

async function saveDocuments() {
  try {
    const { lambdaGeneratedPdf } = await generateDocuments();

    const pdfBuffer = Buffer.from(lambdaGeneratedPdf.pdf || "", "base64");

    fs.writeFile("lambda-document.pdf", pdfBuffer, (err) => {
      if (err) {
        console.error("Error writing PDF file", err);
      } else {
        console.log(
          "1. LAMBDA - PDF file saved with name lambda-document.pdf\n\tResponse time: " +
            lambdaGeneratedPdf.requestProcessedTime +
            "\n\tGeneration time: " +
            lambdaGeneratedPdf.pdfGenerationTime +
            "\n"
        );
      }
    });
  } catch (error) {
    console.error("An error occurred while generating documents:", error);
  }
}

saveDocuments();
