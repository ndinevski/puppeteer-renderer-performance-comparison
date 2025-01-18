export type PuppeteerRequest = {
  body: { template: string; data: any };
};

export type PuppeteerResponse = {
  statusCode: number;
  headers?: any;
  body: any;
  isBase64Encoded?: boolean;
};
