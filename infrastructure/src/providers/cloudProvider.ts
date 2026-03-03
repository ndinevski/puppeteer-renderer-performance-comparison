import { InfrastructureOutputs } from "../types";

export interface CloudProvider {
  deploy(): InfrastructureOutputs;
}
