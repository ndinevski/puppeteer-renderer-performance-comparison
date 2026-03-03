import { loadInfrastructureConfigFromPulumi } from "./config";
import { CloudProviderFactory } from "./providers/providerFactory";

const config = loadInfrastructureConfigFromPulumi();
const provider = CloudProviderFactory.create(config);
const outputs = provider.deploy();

export const providerCloud = outputs.cloud;
export const vmPublicIp = outputs.vmPublicIp;
export const containerServiceUrl = outputs.containerServiceUrl;
export const functionServiceName = outputs.functionServiceName;
export const functionServiceUrl = outputs.functionServiceUrl;
export const kubernetesClusterName = outputs.kubernetesClusterName;
export const kubernetesKubeconfig = outputs.kubernetesKubeconfig;
export const kubernetesServiceName = outputs.kubernetesServiceName;
export const notes = outputs.notes;
