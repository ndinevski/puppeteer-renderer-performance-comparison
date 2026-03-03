import * as fs from "fs";
import * as path from "path";

export const resolveArtifactPath = (artifactPath: string): string => {
  if (path.isAbsolute(artifactPath) && fs.existsSync(artifactPath)) {
    return artifactPath;
  }

  const candidates = [
    path.resolve(process.cwd(), artifactPath),
    path.resolve(process.cwd(), "..", artifactPath),
    path.resolve(__dirname, "..", "..", artifactPath),
    path.resolve(__dirname, "..", "..", "..", artifactPath),
  ];

  const foundPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (foundPath) {
    return foundPath;
  }

  const normalized = artifactPath.replace(/\\/g, "/");
  if (normalized.endsWith("/dist") || normalized === "dist") {
    const parentPath = normalized.replace(/\/?dist$/, "");
    const parentCandidates = [
      path.resolve(process.cwd(), parentPath),
      path.resolve(process.cwd(), "..", parentPath),
      path.resolve(__dirname, "..", "..", parentPath),
      path.resolve(__dirname, "..", "..", "..", parentPath),
    ];

    const parentFoundPath = parentCandidates.find((candidate) =>
      fs.existsSync(candidate),
    );

    if (parentFoundPath) {
      return parentFoundPath;
    }
  }

  throw new Error(
    `Artifact path not found: ${artifactPath}. Checked: ${candidates.join(", ")}`,
  );
};
