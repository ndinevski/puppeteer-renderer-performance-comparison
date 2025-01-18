export type PuppeteerRequest = {
  template: string;
  data: any;
};

export type PuppeteerResponse = {
  success: boolean;
  result?: any;
}
