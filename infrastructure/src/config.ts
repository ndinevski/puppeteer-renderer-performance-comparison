import * as pulumi from "@pulumi/pulumi";
import { DeepPartial, InfrastructureConfig, SupportedCloud } from "./types";

const defaultConfig: InfrastructureConfig = {
  cloud: "aws",
  projectName: "puppeteer-renderer-comparison",
  region: "westeurope",
  tags: {
    project: "puppeteer-renderer",
    managedBy: "pulumi",
  },
  renderer: {
    containerImage:
      "263409072898.dkr.ecr.eu-west-1.amazonaws.com/pogodoc/renderer-puppeteer:latest",
    containerPort: 8080,
    environment: {
      PORT: "8080",
    },
  },
  ec2: {
    instanceType: "t3.medium",
    amiId: "ami-01f23391a59163da9",
    sshCidr: "0.0.0.0/0",
  },
  lambda: {
    memorySize: 1024,
    timeout: 60,
    handler: "index.handler",
    runtime: "nodejs20.x",
    packagePath: "../lambda-renderer-puppeteer/dist",
    architecture: "x86_64",
  },
  eks: {
    instanceType: "t3.medium",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 3,
    replicas: 2,
    serviceType: "NodePort",
    nodePort: 30080,
  },
};

export const mergeInfrastructureConfig = (
  overrides: DeepPartial<InfrastructureConfig>,
): InfrastructureConfig => ({
  ...defaultConfig,
  ...overrides,
  tags: {
    ...defaultConfig.tags,
    ...((overrides.tags ?? {}) as Record<string, string>),
  },
  renderer: {
    ...defaultConfig.renderer,
    ...(overrides.renderer ?? {}),
    environment: {
      ...defaultConfig.renderer.environment,
      ...((overrides.renderer?.environment ?? {}) as Record<string, string>),
    },
  },
  ec2: {
    ...defaultConfig.ec2,
    ...(overrides.ec2 ?? {}),
  },
  lambda: {
    ...defaultConfig.lambda,
    ...(overrides.lambda ?? {}),
  },
  eks: {
    ...defaultConfig.eks,
    ...(overrides.eks ?? {}),
  },
});

export const loadInfrastructureConfigFromPulumi = (): InfrastructureConfig => {
  const config = new pulumi.Config();

  const cloud = (config.get("cloud") ?? defaultConfig.cloud) as SupportedCloud;
  const projectName = config.get("projectName") ?? defaultConfig.projectName;
  const region = config.get("region") ?? defaultConfig.region;

  const tags = config.getObject<Record<string, string>>("tags") ?? {};
  const renderer = config.getObject<DeepPartial<InfrastructureConfig["renderer"]>>(
    "renderer",
  );
  const ec2 = config.getObject<DeepPartial<InfrastructureConfig["ec2"]>>("ec2");
  const lambda = config.getObject<DeepPartial<InfrastructureConfig["lambda"]>>(
    "lambda",
  );
  const eks = config.getObject<DeepPartial<InfrastructureConfig["eks"]>>("eks");

  return mergeInfrastructureConfig({
    cloud,
    projectName,
    region,
    tags,
    renderer: renderer ?? {},
    ec2: ec2 ?? {},
    lambda: lambda ?? {},
    eks: eks ?? {},
  });
};
