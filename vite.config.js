import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

// These retained source assets have unresolved provenance or were rejected during
// art review. Development can still inspect them, but release bundles must not.
export const RELEASE_ASSET_DENYLIST = Object.freeze([
  Object.freeze({ pattern: /^assets\/[^/]+\.webp$/i, reason: "unresolved legacy root art" }),
  Object.freeze({ pattern: /^assets\/sprites\/[^/]+\.webp$/i, reason: "unresolved legacy sprite art" }),
  Object.freeze({ pattern: /^assets\/vfx\/[^/]+\.webp$/i, reason: "unresolved legacy VFX art" }),
  Object.freeze({ pattern: /^assets\/menu\/title-bg-01\.png$/, reason: "rejected title background candidate" }),
  Object.freeze({ pattern: /^assets\/menu\/zephyr-c-title\.png$/, reason: "rejected title character candidate" }),
]);

export function normalizeReleaseAssetPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.includes("\0")) {
    throw new Error("Release asset paths must be non-empty strings without null bytes.");
  }

  const normalized = candidate.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Release asset path must be relative: ${candidate}`);
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Release asset path contains an unsafe segment: ${candidate}`);
  }

  return segments.join("/");
}

export function isReleaseAssetBlocked(candidate) {
  const normalized = normalizeReleaseAssetPath(candidate);
  return RELEASE_ASSET_DENYLIST.some(({ pattern }) => pattern.test(normalized));
}

export async function collectReleasePublicAssets(publicRoot) {
  const root = path.resolve(publicRoot);
  const files = [];

  async function visit(relativeDirectory = "") {
    const directory = relativeDirectory
      ? path.resolve(root, ...relativeDirectory.split("/"))
      : root;
    const relativeToRoot = path.relative(root, directory);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Release asset directory escaped public root: ${directory}`);
    }

    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = normalizeReleaseAssetPath(
        relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name,
      );
      const absolutePath = path.resolve(root, ...relativePath.split("/"));
      const entryRelativeToRoot = path.relative(root, absolutePath);
      if (entryRelativeToRoot.startsWith("..") || path.isAbsolute(entryRelativeToRoot)) {
        throw new Error(`Release asset escaped public root: ${relativePath}`);
      }
      if (entry.isSymbolicLink()) {
        throw new Error(`Release assets cannot be symbolic links: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        await visit(relativePath);
        continue;
      }
      if (!entry.isFile() || isReleaseAssetBlocked(relativePath)) continue;
      files.push({ fileName: relativePath, source: await readFile(absolutePath) });
    }
  }

  try {
    await visit();
  } catch (error) {
    throw new Error(`Unable to package allowed public assets from ${root}: ${error.message}`, { cause: error });
  }
  return files;
}

export function releasePublicAssetsPlugin() {
  let publicRoot;
  return {
    name: "release-public-assets",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      publicRoot = path.resolve(config.root, "public");
    },
    async buildStart() {
      if (!publicRoot) throw new Error("Release public asset root was not configured.");
      const files = await collectReleasePublicAssets(publicRoot);
      for (const file of files) this.emitFile({ type: "asset", ...file });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? process.env.VITE_BASE_PATH ?? "/The-Saviour/" : "/",
  publicDir: command === "build" ? false : "public",
  plugins: [releasePublicAssetsPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith("/node_modules/three/build/three.core.js")) return "three-core";
          if (id.includes("/node_modules/three/")) return "three-render";
          return undefined;
        },
      },
    },
  },
}));
