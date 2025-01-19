# PDF Document Rendering Performance Comparison
This project evaluates the performance and cost of parallel PDF document rendering using three AWS architectures: Virtual Machine (EC2) with Docker and Nginx, Kubernetes (EKS), and FaaS (Lambda). It aims to measure the scalability, cost-effectiveness, and efficiency of each architecture under varying batch sizes. For more details check out the research paper provided in this repository.

## Features
- Parallel Rendering: Simulates real-world workloads by generating multiple PDFs in parallel.
- Scalability Testing: Tests batch sizes of 1, 10, 30, 50, and 100 documents.
- Performance Metrics: Measures average request time, render time, and total time for each architecture.
- Cost Analysis: Provides insights into the cost of document generation for each service.
- Cloud Architectures: Compares Lambda (FaaS), EC2, EKS, and Local Container.
