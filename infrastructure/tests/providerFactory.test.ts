import { describe, expect, it } from "vitest";

import { mergeInfrastructureConfig } from "../src/config";
import { AwsCloudProvider } from "../src/providers/awsProvider";
import { AzureCloudProvider } from "../src/providers/azureProvider";
import { CloudProviderFactory } from "../src/providers/providerFactory";

describe("CloudProviderFactory", () => {
  it("creates AWS provider for aws cloud", () => {
    const config = mergeInfrastructureConfig({ cloud: "aws" });
    const provider = CloudProviderFactory.create(config);

    expect(provider).toBeInstanceOf(AwsCloudProvider);
  });

  it("creates Azure provider for azure cloud", () => {
    const config = mergeInfrastructureConfig({ cloud: "azure" });
    const provider = CloudProviderFactory.create(config);

    expect(provider).toBeInstanceOf(AzureCloudProvider);
  });
});
