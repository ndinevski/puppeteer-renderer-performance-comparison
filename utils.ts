import fs from "fs";

export function readHtml(filePath: string): string | undefined {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return data;
  } catch (error) {
    console.error("Error reading the template:", error);
  }
}

export function readJsonFile(filePath: string): any {
  try {
    const jsonString = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(jsonString);
    return data;
  } catch (error) {
    console.error("Error reading the JSON file:", error);
  }
}
