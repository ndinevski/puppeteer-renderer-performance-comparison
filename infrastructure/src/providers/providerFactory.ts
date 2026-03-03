import { InfrastructureConfig } from "../types";
import { CloudProvider } from "./cloudProvider";
import { AwsCloudProvider } from "./awsProvider";
import { AzureCloudProvider } from "./azureProvider";

export class CloudProviderFactory {
  static create(config: InfrastructureConfig): CloudProvider {
    if (config.cloud === "aws") {
      return new AwsCloudProvider(config);
    }

    if (config.cloud === "azure") {
      return new AzureCloudProvider(config);
    }

    throw new Error(`Unsupported cloud provider: ${config.cloud}`);
  }
}
