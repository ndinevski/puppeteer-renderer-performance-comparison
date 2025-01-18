import axios from "axios";
import fs from "fs";
import { readHtml, readJsonFile } from "./utils";

const LOCAL_URL = "http://localhost:8080/generate-pdf";
const LAMBDA_URL =
  "https://2xxdayczg5.execute-api.eu-west-1.amazonaws.com/default/puppeteer-renderer-lambda";
const EC2_URL =
  "http://ec2-34-241-196-237.eu-west-1.compute.amazonaws.com/generate-pdf";
// const EKS_URL =
//   "https://2356F191A553D1F940E739D97597722B.gr7.eu-west-1.eks.amazonaws.com/generate-pdf";

const template = readHtml("./data/template.ejs");
const data = readJsonFile("./data/data.json");

const NUM_REQUESTS = 100;

async function sendRequest(url: string) {
  try {
    const response = await axios.post(url, { template, data });
    return {
      pdf: response.data.pdf,
      requestProcessedTime: parseFloat(response.data.requestProcessedTime),
      pdfGenerationTime: parseFloat(response.data.pdfGenerationTime),
    };
  } catch (error) {
    console.error(`Error with request to ${url}:`, error);
    throw error;
  }
}

async function performLoadTest(url: string, serviceName: string) {
  const results = [];

  for (let i = 0; i < NUM_REQUESTS; i++) {
    console.log(`Sending request ${i + 1} to ${serviceName}...`);
    const result = await sendRequest(url);
    results.push(result);
  }

  const averageResponseTime = (
    results.reduce((sum, r) => sum + r.requestProcessedTime, 0) / NUM_REQUESTS
  ).toFixed(2);

  const averageGenerationTime = (
    results.reduce((sum, r) => sum + r.pdfGenerationTime, 0) / NUM_REQUESTS
  ).toFixed(2);

  return {
    averageResponseTime,
    averageGenerationTime,
    lastPdf: results[results.length - 1]?.pdf,
  };
}

async function saveDocuments() {
  try {
    const lambdaResults = await performLoadTest(LAMBDA_URL, "LAMBDA");
    const ec2Results = await performLoadTest(EC2_URL, "EC2");
    // const eksResults = await performLoadTest(EKS_URL, "EKS");
    const localResults = await performLoadTest(LOCAL_URL, "LOCAL_CONTAINER");

    console.log("Performance comparison on 100 requests:");

    fs.writeFileSync(
      "results/local-document.pdf",
      Buffer.from(localResults.lastPdf || "", "base64")
    );
    console.log(
      `- LOCAL_CONTAINER - Avg Response Time: ${localResults.averageResponseTime}s, Avg Generation Time: ${localResults.averageGenerationTime}s`
    );

    fs.writeFileSync(
      "results/lambda-document.pdf",
      Buffer.from(lambdaResults.lastPdf || "", "base64")
    );
    console.log(
      `LAMBDA - Avg Response Time: ${lambdaResults.averageResponseTime}s, Avg Generation Time: ${lambdaResults.averageGenerationTime}s`
    );

    fs.writeFileSync(
      "results/ec2-document.pdf",
      Buffer.from(ec2Results.lastPdf || "", "base64")
    );
    console.log(
      `EC2 - Avg Response Time: ${ec2Results.averageResponseTime}s, Avg Generation Time: ${ec2Results.averageGenerationTime}s`
    );

    // fs.writeFileSync(
    //   "results/eks-document.pdf",
    //   Buffer.from(eksResults.lastPdf || "", "base64")
    // );
    // console.log(`EKS - Avg Response Time: ${eksResults.averageResponseTime}s, Avg Generation Time: ${eksResults.averageGenerationTime}s`);
  } catch (error) {
    console.error("An error occurred during load testing:", error);
  }
}

saveDocuments();
