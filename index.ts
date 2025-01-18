import axios from "axios";
import fs from "fs";
import { readHtml, readJsonFile } from "./utils";

const LAMBDA_URL =
  "https://2xxdayczg5.execute-api.eu-west-1.amazonaws.com/default/puppeteer-renderer-lambda";
const EC2_URL =
  "http://ec2-34-241-196-237.eu-west-1.compute.amazonaws.com/generate-pdf";
const template = readHtml("./data/template.ejs");
const data = readJsonFile("./data/data.json");

async function generateDocuments(): Promise<any> {
  try {
    const lambdaGeneratedResponse = await axios.post(LAMBDA_URL, {
      template,
      data,
    });

    const ec2GeneratedResponse = await axios.post(EC2_URL, {
      template,
      data,
    });

    return {
      lambdaGeneratedPdf: {
        pdf: lambdaGeneratedResponse.data.pdf,
        requestProcessedTime: lambdaGeneratedResponse.data.requestProcessedTime,
        pdfGenerationTime: lambdaGeneratedResponse.data.pdfGenerationTime,
      },
      ec2GeneratedPdf: {
        pdf: ec2GeneratedResponse.data.pdf,
        requestProcessedTime: ec2GeneratedResponse.data.requestProcessedTime,
        pdfGenerationTime: ec2GeneratedResponse.data.pdfGenerationTime,
      },
    };
  } catch (error) {
    console.error("Error generating document:", error);
    throw error;
  }
}

async function saveDocuments() {
  try {
    const { lambdaGeneratedPdf, ec2GeneratedPdf } = await generateDocuments();
    let pdfBuffer: Buffer;

    // EC2
    pdfBuffer = Buffer.from(ec2GeneratedPdf.pdf || "", "base64");
    fs.writeFile("results/container-document.pdf", pdfBuffer, (err) => {
      if (err) {
        console.error("Error writing PDF file", err);
      } else {
        console.log(
          "1. EC2 - PDF file saved with name container-document.pdf\n\tResponse time: " +
            ec2GeneratedPdf.requestProcessedTime +
            "\n\tGeneration time: " +
            ec2GeneratedPdf.pdfGenerationTime +
            "\n"
        );
      }
    });

    // LAMBDA
    pdfBuffer = Buffer.from(lambdaGeneratedPdf.pdf || "", "base64");
    fs.writeFile("results/lambda-document.pdf", pdfBuffer, (err) => {
      if (err) {
        console.error("Error writing PDF file", err);
      } else {
        console.log(
          "2. LAMBDA - PDF file saved with name lambda-document.pdf\n\tResponse time: " +
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
