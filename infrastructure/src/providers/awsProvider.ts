import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";

import { CloudProvider } from "./cloudProvider";
import { InfrastructureConfig, InfrastructureOutputs } from "../types";
import { resolveArtifactPath } from "../utils/pathResolver";

export class AwsCloudProvider implements CloudProvider {
  constructor(private readonly config: InfrastructureConfig) {}

  deploy(): InfrastructureOutputs {
    const namePrefix = this.config.projectName;
    const lambdaPackagePath = resolveArtifactPath(this.config.lambda.packagePath);

    const vpc = new aws.ec2.Vpc(`${namePrefix}-vpc`, {
      cidrBlock: "10.0.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: this.tags("vpc"),
    });

    const internetGateway = new aws.ec2.InternetGateway(`${namePrefix}-igw`, {
      vpcId: vpc.id,
      tags: this.tags("igw"),
    });

    const routeTable = new aws.ec2.RouteTable(`${namePrefix}-public-rt`, {
      vpcId: vpc.id,
      routes: [
        {
          cidrBlock: "0.0.0.0/0",
          gatewayId: internetGateway.id,
        },
      ],
      tags: this.tags("public-rt"),
    });

    const subnetA = new aws.ec2.Subnet(`${namePrefix}-subnet-a`, {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      mapPublicIpOnLaunch: true,
      availabilityZone: `${aws.config.region}a`,
      tags: this.tags("subnet-a"),
    });

    const subnetB = new aws.ec2.Subnet(`${namePrefix}-subnet-b`, {
      vpcId: vpc.id,
      cidrBlock: "10.0.2.0/24",
      mapPublicIpOnLaunch: true,
      availabilityZone: `${aws.config.region}b`,
      tags: this.tags("subnet-b"),
    });

    new aws.ec2.RouteTableAssociation(`${namePrefix}-rta-a`, {
      subnetId: subnetA.id,
      routeTableId: routeTable.id,
    });

    new aws.ec2.RouteTableAssociation(`${namePrefix}-rta-b`, {
      subnetId: subnetB.id,
      routeTableId: routeTable.id,
    });

    const rendererSecurityGroup = new aws.ec2.SecurityGroup(
      `${namePrefix}-renderer-sg`,
      {
        vpcId: vpc.id,
        ingress: [
          {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: [this.config.ec2.sshCidr],
          },
          {
            protocol: "tcp",
            fromPort: this.config.renderer.containerPort,
            toPort: this.config.renderer.containerPort,
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
        egress: [
          {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
        tags: this.tags("renderer-sg"),
      },
    );

    const userData = this.buildEc2UserData();

    const ec2Instance = new aws.ec2.Instance(`${namePrefix}-renderer-ec2`, {
      ami: this.config.ec2.amiId,
      instanceType: this.config.ec2.instanceType,
      subnetId: subnetA.id,
      vpcSecurityGroupIds: [rendererSecurityGroup.id],
      associatePublicIpAddress: true,
      userData,
      tags: this.tags("renderer-ec2"),
    });

    const lambdaRole = new aws.iam.Role(`${namePrefix}-lambda-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "lambda.amazonaws.com",
      }),
      tags: this.tags("lambda-role"),
    });

    new aws.iam.RolePolicyAttachment(`${namePrefix}-lambda-basic-exec`, {
      role: lambdaRole.name,
      policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
    });

    const lambdaFunction = new aws.lambda.Function(`${namePrefix}-lambda`, {
      role: lambdaRole.arn,
      runtime: this.config.lambda.runtime,
      handler: this.config.lambda.handler,
      memorySize: this.config.lambda.memorySize,
      timeout: this.config.lambda.timeout,
      architectures: [this.config.lambda.architecture],
      code: new pulumi.asset.FileArchive(lambdaPackagePath),
      environment: {
        variables: {
          ...this.config.renderer.environment,
          CHROME_PATH: "/usr/bin/google-chrome",
        },
      },
      tags: this.tags("lambda"),
    });

    const lambdaUrl = new aws.lambda.FunctionUrl(`${namePrefix}-lambda-url`, {
      functionName: lambdaFunction.name,
      authorizationType: "NONE",
    });

    const eksClusterRole = new aws.iam.Role(`${namePrefix}-eks-cluster-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "eks.amazonaws.com",
      }),
      tags: this.tags("eks-cluster-role"),
    });

    new aws.iam.RolePolicyAttachment(`${namePrefix}-eks-cluster-policy`, {
      role: eksClusterRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    });

    const eksNodeRole = new aws.iam.Role(`${namePrefix}-eks-node-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
      }),
      tags: this.tags("eks-node-role"),
    });

    [
      "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
      "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
      "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    ].forEach((policyArn, index) => {
      new aws.iam.RolePolicyAttachment(`${namePrefix}-eks-node-policy-${index}`, {
        role: eksNodeRole.name,
        policyArn,
      });
    });

    const eksCluster = new aws.eks.Cluster(`${namePrefix}-eks`, {
      roleArn: eksClusterRole.arn,
      version: "1.30",
      vpcConfig: {
        subnetIds: [subnetA.id, subnetB.id],
        endpointPublicAccess: true,
      },
      tags: this.tags("eks"),
    });

    new aws.eks.NodeGroup(`${namePrefix}-eks-node-group`, {
      clusterName: eksCluster.name,
      nodeRoleArn: eksNodeRole.arn,
      subnetIds: [subnetA.id, subnetB.id],
      instanceTypes: [this.config.eks.instanceType],
      scalingConfig: {
        desiredSize: this.config.eks.desiredCapacity,
        minSize: this.config.eks.minSize,
        maxSize: this.config.eks.maxSize,
      },
      tags: this.tags("eks-node-group"),
    });

    const kubeconfig = pulumi
      .all([
        eksCluster.endpoint,
        eksCluster.certificateAuthority,
        eksCluster.name,
      ])
      .apply(([endpoint, certAuthority, clusterName]) => ({
        apiVersion: "v1",
        clusters: [
          {
            cluster: {
              server: endpoint,
              "certificate-authority-data": certAuthority.data,
            },
            name: "kubernetes",
          },
        ],
        contexts: [
          {
            context: {
              cluster: "kubernetes",
              user: "aws",
            },
            name: "aws",
          },
        ],
        "current-context": "aws",
        kind: "Config",
        users: [
          {
            name: "aws",
            user: {
              exec: {
                apiVersion: "client.authentication.k8s.io/v1beta1",
                command: "aws",
                args: [
                  "eks",
                  "get-token",
                  "--cluster-name",
                  clusterName,
                  "--region",
                  aws.config.region ?? "eu-west-1",
                ],
              },
            },
          },
        ],
      }));

    const k8sProvider = new k8s.Provider(`${namePrefix}-k8s-provider`, {
      kubeconfig: kubeconfig.apply((cfg) => JSON.stringify(cfg)),
    });

    const appLabels = { app: `${namePrefix}-renderer` };

    new k8s.apps.v1.Deployment(
      `${namePrefix}-renderer-deployment`,
      {
        metadata: {
          labels: appLabels,
          name: "puppeteer-renderer",
        },
        spec: {
          replicas: this.config.eks.replicas,
          selector: {
            matchLabels: appLabels,
          },
          template: {
            metadata: {
              labels: appLabels,
            },
            spec: {
              containers: [
                {
                  name: "puppeteer-container",
                  image: this.config.renderer.containerImage,
                  ports: [
                    {
                      containerPort: this.config.renderer.containerPort,
                    },
                  ],
                  env: Object.entries(this.config.renderer.environment).map(
                    ([name, value]) => ({
                      name,
                      value,
                    }),
                  ),
                },
              ],
            },
          },
        },
      },
      { provider: k8sProvider },
    );

    const eksService = new k8s.core.v1.Service(
      `${namePrefix}-renderer-service`,
      {
        metadata: {
          name: "puppeteer-service",
        },
        spec: {
          type: this.config.eks.serviceType,
          selector: appLabels,
          ports: [
            {
              port: 80,
              targetPort: this.config.renderer.containerPort,
              nodePort:
                this.config.eks.serviceType === "NodePort"
                  ? this.config.eks.nodePort
                  : undefined,
            },
          ],
        },
      },
      { provider: k8sProvider },
    );

    return {
      cloud: pulumi.output("aws"),
      vmPublicIp: ec2Instance.publicIp,
      containerServiceUrl: ec2Instance.publicIp.apply(
        (ip) => `http://${ip}:${this.config.renderer.containerPort}/generate-pdf`,
      ),
      functionServiceName: lambdaFunction.name,
      functionServiceUrl: lambdaUrl.functionUrl,
      kubernetesClusterName: eksCluster.name,
      kubernetesKubeconfig: kubeconfig,
      kubernetesServiceName: eksService.metadata.name,
    };
  }

  private tags(resource: string): Record<string, string> {
    return {
      ...this.config.tags,
      resource,
    };
  }

  private buildEc2UserData(): string {
    const envFlags = Object.entries(this.config.renderer.environment)
      .map(([key, value]) => `-e ${key}=${value}`)
      .join(" ");

    return `#!/bin/bash
set -euxo pipefail
yum update -y
yum install -y docker
systemctl enable docker
systemctl start docker
usermod -a -G docker ec2-user
docker pull ${this.config.renderer.containerImage}
docker run -d --restart unless-stopped --name renderer -p ${this.config.renderer.containerPort}:${this.config.renderer.containerPort} ${envFlags} ${this.config.renderer.containerImage}
`;
  }
}
