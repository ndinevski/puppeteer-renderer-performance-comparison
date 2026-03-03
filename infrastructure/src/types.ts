import * as pulumi from "@pulumi/pulumi";

export type SupportedCloud = "aws" | "azure";

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

export interface RendererSettings {
  containerImage: string;
  containerPort: number;
  environment: Record<string, string>;
}

export interface Ec2Settings {
  instanceType: string;
  amiId: string;
  sshCidr: string;
}

export interface LambdaSettings {
  memorySize: number;
  timeout: number;
  handler: string;
  runtime: "nodejs20.x" | "nodejs18.x";
  packagePath: string;
  architecture: "arm64" | "x86_64";
}

export interface EksSettings {
  instanceType: string;
  desiredCapacity: number;
  minSize: number;
  maxSize: number;
  replicas: number;
  serviceType: "NodePort" | "LoadBalancer";
  nodePort?: number;
}

export interface InfrastructureConfig {
  cloud: SupportedCloud;
  projectName: string;
  region?: string;
  tags: Record<string, string>;
  renderer: RendererSettings;
  ec2: Ec2Settings;
  lambda: LambdaSettings;
  eks: EksSettings;
}

export interface InfrastructureOutputs {
  cloud: pulumi.Output<string>;
  vmPublicIp?: pulumi.Output<string>;
  containerServiceUrl?: pulumi.Output<string>;
  functionServiceName?: pulumi.Output<string>;
  functionServiceUrl?: pulumi.Output<string>;
  kubernetesClusterName?: pulumi.Output<string>;
  kubernetesKubeconfig?: pulumi.Output<any>;
  kubernetesServiceName?: pulumi.Output<string>;
  notes?: pulumi.Output<string>;
}
