import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import * as k8s from "@pulumi/kubernetes";

import { CloudProvider } from "./cloudProvider";
import { InfrastructureConfig, InfrastructureOutputs } from "../types";
import { resolveArtifactPath } from "../utils/pathResolver";

export class AzureCloudProvider implements CloudProvider {
  constructor(private readonly config: InfrastructureConfig) {}

  deploy(): InfrastructureOutputs {
    const namePrefix = this.config.projectName;
    const location = this.config.region ?? "westeurope";
    const azureConfig = new pulumi.Config("azure-native");
    const functionPackagePath = resolveArtifactPath(this.config.lambda.packagePath);

    const resourceGroup = new azure.resources.ResourceGroup(`${namePrefix}-rg`, {
      resourceGroupName: `${namePrefix}-rg`,
      location,
      tags: this.config.tags,
    });

    const vnet = new azure.network.VirtualNetwork(`${namePrefix}-vnet`, {
      resourceGroupName: resourceGroup.name,
      location,
      addressSpace: {
        addressPrefixes: ["10.10.0.0/16"],
      },
      tags: this.config.tags,
    });

    const vmSubnet = new azure.network.Subnet(`${namePrefix}-vm-subnet`, {
      resourceGroupName: resourceGroup.name,
      virtualNetworkName: vnet.name,
      addressPrefix: "10.10.1.0/24",
    });

    const aksSubnet = new azure.network.Subnet(`${namePrefix}-aks-subnet`, {
      resourceGroupName: resourceGroup.name,
      virtualNetworkName: vnet.name,
      addressPrefix: "10.10.2.0/24",
    });

    const networkSecurityGroup = new azure.network.NetworkSecurityGroup(
      `${namePrefix}-nsg`,
      {
        resourceGroupName: resourceGroup.name,
        location,
        securityRules: [
          {
            name: "allow-ssh",
            access: "Allow",
            direction: "Inbound",
            priority: 100,
            protocol: "Tcp",
            sourcePortRange: "*",
            destinationPortRange: "22",
            sourceAddressPrefix: this.config.ec2.sshCidr,
            destinationAddressPrefix: "*",
          },
          {
            name: "allow-renderer",
            access: "Allow",
            direction: "Inbound",
            priority: 110,
            protocol: "Tcp",
            sourcePortRange: "*",
            destinationPortRange: `${this.config.renderer.containerPort}`,
            sourceAddressPrefix: "*",
            destinationAddressPrefix: "*",
          },
        ],
        tags: this.config.tags,
      },
    );

    const publicIp = new azure.network.PublicIPAddress(`${namePrefix}-vm-pip`, {
      resourceGroupName: resourceGroup.name,
      location,
      publicIPAllocationMethod: "Static",
      sku: {
        name: "Standard",
      },
      tags: this.config.tags,
    });

    const networkInterface = new azure.network.NetworkInterface(
      `${namePrefix}-vm-nic`,
      {
        resourceGroupName: resourceGroup.name,
        location,
        ipConfigurations: [
          {
            name: "ipconfig1",
            privateIPAllocationMethod: "Dynamic",
            subnet: {
              id: vmSubnet.id,
            },
            publicIPAddress: {
              id: publicIp.id,
            },
          },
        ],
        networkSecurityGroup: {
          id: networkSecurityGroup.id,
        },
        tags: this.config.tags,
      },
    );

    const vmAdminUsername = "azureuser";
    const vmAdminPassword =
      azureConfig.getSecret("vmAdminPassword") ?? pulumi.secret("ChangeMe123!Pass");

    const storageAccountName = this.buildStorageAccountName(namePrefix);

    const vmCustomData = Buffer.from(
      this.buildVmBootstrapScript(),
      "utf8",
    ).toString("base64");

    new azure.compute.VirtualMachine(`${namePrefix}-vm`, {
      resourceGroupName: resourceGroup.name,
      vmName: `${namePrefix}-vm`,
      location,
      hardwareProfile: {
        vmSize: this.mapVmSize(this.config.ec2.instanceType),
      },
      networkProfile: {
        networkInterfaces: [
          {
            id: networkInterface.id,
            primary: true,
          },
        ],
      },
      osProfile: {
        computerName: `${namePrefix}-vm`,
        adminUsername: vmAdminUsername,
        adminPassword: vmAdminPassword,
        customData: vmCustomData,
        linuxConfiguration: {
          disablePasswordAuthentication: false,
        },
      },
      storageProfile: {
        osDisk: {
          createOption: "FromImage",
          managedDisk: {
            storageAccountType: "Standard_LRS",
          },
        },
        imageReference: {
          publisher: "Canonical",
          offer: "0001-com-ubuntu-server-jammy",
          sku: "22_04-lts-gen2",
          version: "latest",
        },
      },
      tags: this.config.tags,
    });

    const storageAccount = new azure.storage.StorageAccount(
      `${namePrefix}-stg`,
      {
        accountName: storageAccountName,
        resourceGroupName: resourceGroup.name,
        location,
        sku: {
          name: "Standard_LRS",
        },
        kind: "StorageV2",
        tags: this.config.tags,
      },
    );

    const functionPackageContainer = new azure.storage.BlobContainer(
      `${namePrefix}-funcpkg`,
      {
        accountName: storageAccount.name,
        resourceGroupName: resourceGroup.name,
        publicAccess: "Blob",
      },
    );

    const functionPackageBlob = new azure.storage.Blob(`${namePrefix}-funcpkgzip`, {
      accountName: storageAccount.name,
      resourceGroupName: resourceGroup.name,
      containerName: functionPackageContainer.name,
      blobName: "functionapp.zip",
      type: "Block",
      source: new pulumi.asset.FileArchive(functionPackagePath),
    });

    const functionStorageKeys = azure.storage.listStorageAccountKeysOutput({
      accountName: storageAccount.name,
      resourceGroupName: resourceGroup.name,
    });

    const functionStorageConnectionString = pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${functionStorageKeys.keys[0].value};EndpointSuffix=core.windows.net`;

    const appServicePlan = new azure.web.AppServicePlan(`${namePrefix}-func-plan`, {
      resourceGroupName: resourceGroup.name,
      location,
      kind: "functionapp",
      reserved: true,
      sku: {
        name: "Y1",
        tier: "Dynamic",
      },
      tags: this.config.tags,
    });

    const functionPackageUrl = pulumi.interpolate`https://${storageAccount.name}.blob.core.windows.net/${functionPackageContainer.name}/${functionPackageBlob.name}`;

    const functionApp = new azure.web.WebApp(`${namePrefix}-function`, {
      resourceGroupName: resourceGroup.name,
      location,
      serverFarmId: appServicePlan.id,
      kind: "functionapp,linux",
      httpsOnly: true,
      siteConfig: {
        appSettings: [
          {
            name: "FUNCTIONS_WORKER_RUNTIME",
            value: "node",
          },
          {
            name: "FUNCTIONS_EXTENSION_VERSION",
            value: "~4",
          },
          {
            name: "AzureWebJobsStorage",
            value: functionStorageConnectionString,
          },
          {
            name: "WEBSITE_RUN_FROM_PACKAGE",
            value: functionPackageUrl,
          },
          ...Object.entries(this.config.renderer.environment).map(
            ([key, value]) => ({
              name: key,
              value,
            }),
          ),
        ],
        linuxFxVersion: "NODE|20",
      },
      tags: this.config.tags,
    });

    const aksCluster = new azure.containerservice.ManagedCluster(
      `${namePrefix}-aks`,
      {
        resourceGroupName: resourceGroup.name,
        resourceName: `${namePrefix}-aks`,
        location,
        dnsPrefix: `${namePrefix}-aks`,
        kubernetesVersion: "1.30.9",
        identity: {
          type: "SystemAssigned",
        },
        networkProfile: {
          networkPlugin: "azure",
        },
        agentPoolProfiles: [
          {
            name: "agentpool",
            mode: "System",
            osType: "Linux",
            type: "VirtualMachineScaleSets",
            count: this.config.eks.desiredCapacity,
            vmSize: this.mapVmSize(this.config.eks.instanceType),
            vnetSubnetID: aksSubnet.id,
          },
        ],
        tags: this.config.tags,
      },
    );

    const userCredentials = azure.containerservice.listManagedClusterUserCredentialsOutput(
      {
        resourceGroupName: resourceGroup.name,
        resourceName: aksCluster.name,
      },
    );

    const kubeconfig = userCredentials.kubeconfigs.apply((configs) => {
      const encoded = configs?.[0]?.value ?? "";
      return Buffer.from(encoded, "base64").toString("utf8");
    });

    const k8sProvider = new k8s.Provider(`${namePrefix}-aks-k8s`, {
      kubeconfig,
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

    const aksService = new k8s.core.v1.Service(
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
      cloud: pulumi.output("azure"),
      vmPublicIp: publicIp.ipAddress.apply((ip) => ip ?? ""),
      containerServiceUrl: publicIp.ipAddress.apply(
        (ip) =>
          `http://${ip ?? ""}:${this.config.renderer.containerPort}/generate-pdf`,
      ),
      functionServiceName: functionApp.name,
      functionServiceUrl: functionApp.defaultHostName.apply(
        (host) => `https://${host}`,
      ),
      kubernetesClusterName: aksCluster.name,
      kubernetesKubeconfig: kubeconfig,
      kubernetesServiceName: aksService.metadata.name,
    };
  }

  private mapVmSize(instanceType: string): string {
    const normalized = instanceType.toLowerCase();
    if (normalized.startsWith("t3.")) {
      return "Standard_D2s_v5";
    }
    if (normalized.startsWith("t2.")) {
      return "Standard_B2s";
    }
    return "Standard_D2s_v5";
  }

  private buildStorageAccountName(projectName: string): string {
    const sanitized = projectName.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const stack = pulumi.getStack().replace(/[^a-z0-9]/gi, "").toLowerCase();

    const base = `${sanitized}${stack}stg`;
    if (base.length >= 3 && base.length <= 24) {
      return base;
    }

    const trimmed = base.slice(0, 24);
    if (trimmed.length >= 3) {
      return trimmed;
    }

    return "stgacct001";
  }

  private buildVmBootstrapScript(): string {
    const envFlags = Object.entries(this.config.renderer.environment)
      .map(([key, value]) => `-e ${key}=${value}`)
      .join(" ");

    return `#!/bin/bash
set -euxo pipefail
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
docker pull ${this.config.renderer.containerImage}
docker run -d --restart unless-stopped --name renderer -p ${this.config.renderer.containerPort}:${this.config.renderer.containerPort} ${envFlags} ${this.config.renderer.containerImage}
`;
  }
}
